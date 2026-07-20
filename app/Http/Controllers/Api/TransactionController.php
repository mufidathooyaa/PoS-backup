<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\Payment;
use App\Models\StockMovement;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\TaxRule;
use App\Models\DiscountRule;
use App\Models\Shift;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class TransactionController extends Controller
{
    public function store(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'idempotency_key' => 'required|string',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|uuid|exists:products,id',
            'items.*.jumlah' => 'required|integer|min:1',
            'tax_rule_id' => 'nullable|integer|exists:tax_rules,id',
            'discount_rule_id' => 'nullable|integer|exists:discount_rules,id',
            'payment_method_id' => 'required|integer|exists:payment_methods,id',
            'jumlah_dibayar' => 'required|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validasi gagal', 'errors' => $validator->errors()], 422);
        }

        // 1. Idempotency check — kalau key ini sudah pernah diproses, kembalikan hasil lama, jangan insert lagi
        $existing = Transaction::where('idempotency_key', $request->idempotency_key)->first();
        if ($existing) {
            return response()->json([
                'message' => 'Transaksi ini sudah pernah diproses sebelumnya',
                'transaction' => $existing->load('items', 'payments'),
            ], 200);
        }

        // 2. Pastikan kasir punya shift OPEN
        $shift = Shift::where('user_id', $user->id)->where('status', 'OPEN')->first();
        if (! $shift) {
            return response()->json(['message' => 'Anda harus membuka shift terlebih dahulu sebelum bertransaksi'], 422);
        }

        try {
            $transaction = DB::transaction(function () use ($request, $user, $shift) {

                // 3. Ambil aturan pajak/diskon (kalau ada) dan snapshot nilainya SEKARANG
                $taxRule = $request->tax_rule_id ? TaxRule::find($request->tax_rule_id) : null;
                $discountRule = $request->discount_rule_id ? DiscountRule::find($request->discount_rule_id) : null;

                // 4. Hitung subtotal dari item, sambil kunci baris produk (lockForUpdate mencegah race condition)
                $subtotal = 0;
                $itemsData = [];

                foreach ($request->items as $item) {
                    $product = Product::lockForUpdate()->find($item['product_id']);

                    if (! $product->is_active) {
                        throw new \Exception("Produk '{$product->nama}' tidak aktif dan tidak bisa dijual");
                    }

                    // Validasi stok cukup — hanya untuk produk yang memang dilacak stoknya
                    if ($product->track_stock) {
                        $inventory = Inventory::where('product_id', $product->id)
                            ->where('outlet_id', $user->outlet_id)
                            ->lockForUpdate()
                            ->first();

                        if (! $inventory) {
                            throw new \Exception("Stok untuk produk '{$product->nama}' belum terdaftar di outlet ini");
                        }

                        if ($inventory->stok_saat_ini < $item['jumlah']) {
                            throw new \Exception("Stok '{$product->nama}' tidak mencukupi. Tersedia: {$inventory->stok_saat_ini}, diminta: {$item['jumlah']}");
                        }
                    }

                    $lineTotal = $product->harga * $item['jumlah'];
                    $subtotal += $lineTotal;

                    $itemsData[] = [
                        'product' => $product,
                        'jumlah' => $item['jumlah'],
                        'harga_satuan' => $product->harga,
                        'total_baris' => $lineTotal,
                    ];
                }

                // 5. Hitung diskon & pajak di level transaksi
                $totalDiskon = 0;
                if ($discountRule) {
                    $totalDiskon = $discountRule->tipe === 'persentase'
                        ? $subtotal * ($discountRule->nilai / 100)
                        : $discountRule->nilai;
                }

                $dasarPajak = $subtotal - $totalDiskon;
                $totalPajak = $taxRule ? $dasarPajak * ($taxRule->persentase / 100) : 0;
                $grandTotal = $dasarPajak + $totalPajak;

                // 6. Validasi pembayaran cukup
                if ($request->jumlah_dibayar < $grandTotal) {
                    throw new \Exception('Jumlah pembayaran tidak mencukupi');
                }
                $kembalian = $request->jumlah_dibayar - $grandTotal;

                // 7. Generate nomor transaksi: TRX-{kode_outlet}-{tanggal}-{counter_harian}
                $outlet = $user->outlet;
                $tanggal = now()->format('Ymd');
                $countHariIni = Transaction::where('outlet_id', $outlet->id)
                    ->whereDate('timestamp', now()->toDateString())
                    ->lockForUpdate()
                    ->count();
                $nomorTransaksi = sprintf('TRX-%s-%s-%04d', $outlet->kode, $tanggal, $countHariIni + 1);

                // 8. Buat transaksi
                $transaction = Transaction::create([
                    'nomor_transaksi' => $nomorTransaksi,
                    'outlet_id' => $outlet->id,
                    'shift_id' => $shift->id,
                    'cashier_id' => $user->id,
                    'tax_rule_id' => $taxRule?->id,
                    'discount_rule_id' => $discountRule?->id,
                    'snapshot_persentase_pajak' => $taxRule?->persentase,
                    'snapshot_nilai_diskon' => $discountRule?->nilai,
                    'status' => 'completed',
                    'subtotal' => $subtotal,
                    'total_diskon' => $totalDiskon,
                    'total_pajak' => $totalPajak,
                    'grand_total' => $grandTotal,
                    'idempotency_key' => $request->idempotency_key,
                    'sync_status' => 'synced',
                    'timestamp' => now(),
                ]);

                // 9. Buat transaction_items + stock_movements + update inventory cache
                foreach ($itemsData as $data) {
                    $product = $data['product'];

                    $transactionItem = TransactionItem::create([
                        'transaction_id' => $transaction->id,
                        'product_id' => $product->id,
                        'snapshot_nama_produk' => $product->nama,
                        'jumlah' => $data['jumlah'],
                        'harga_satuan' => $data['harga_satuan'],
                        'diskon' => 0, // diskon level item belum dicakup di MVP ini
                        'pajak' => 0,  // pajak level item belum dicakup di MVP ini
                        'total_baris' => $data['total_baris'],
                    ]);

                    if ($product->track_stock) {
                        StockMovement::create([
                            'product_id' => $product->id,
                            'outlet_id' => $transaction->outlet_id,
                            'user_id' => $user->id,
                            'jenis_pergerakan' => 'penjualan',
                            'jumlah' => -$data['jumlah'], // negatif karena stok berkurang
                            'source_type' => 'transaction_items',
                            'source_id' => $transactionItem->id,
                            'timestamp' => now(),
                        ]);

                        // Update cache stok, kunci baris dulu supaya aman dari race condition
                        $inventory = Inventory::where('product_id', $product->id)
                            ->where('outlet_id', $transaction->outlet_id)
                            ->lockForUpdate()
                            ->first();

                        if ($inventory) {
                            $inventory->decrement('stok_saat_ini', $data['jumlah']);
                        }
                    }
                }

                // 10. Buat payment
                Payment::create([
                    'transaction_id' => $transaction->id,
                    'payment_method_id' => $request->payment_method_id,
                    'jumlah_dibayar' => $request->jumlah_dibayar,
                    'kembalian' => $kembalian,
                    'status' => 'completed',
                ]);

                return $transaction;
            });

            return response()->json([
                'message' => 'Transaksi berhasil',
                'transaction' => $transaction->load('items', 'payments'),
            ], 201);

        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function index(Request $request)
    {
        $user = $request->user();

        $query = Transaction::with('cashier')->orderByDesc('timestamp');

        if ($user->role && $user->role->nama_peran === 'Admin') {
            $query->where('outlet_id', $user->outlet_id);
        } else {
            $query->where('cashier_id', $user->id);
        }

        if ($request->filled('search')) {
            $query->where('nomor_transaksi', 'like', "%{$request->search}%");
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('tanggal_mulai')) {
            $query->whereDate('timestamp', '>=', $request->tanggal_mulai);
        }
        if ($request->filled('tanggal_selesai')) {
            $query->whereDate('timestamp', '<=', $request->tanggal_selesai);
        } elseif (! $request->filled('tanggal_mulai')) {
            $query->whereDate('timestamp', now()->toDateString()); // default: hari ini
        }

        return response()->json(['transactions' => $query->paginate(50)]);
    }

    public function show(string $id)
    {
        $transaction = Transaction::with(['items', 'payments', 'cashier'])->find($id);

        if (! $transaction) {
            return response()->json(['message' => 'Transaksi tidak ditemukan'], 404);
        }

        // Untuk transaksi completed, hitung sisa yang masih bisa direfund per item
        if ($transaction->status === 'completed') {
            $transaction->items->each(function ($item) {
                $sudahDirefund = TransactionItem::where('original_item_id', $item->id)->sum('jumlah');
                $item->sudah_direfund = $sudahDirefund;
                $item->sisa_bisa_refund = $item->jumlah - $sudahDirefund;
            });
        }

        return response()->json(['transaction' => $transaction]);
    }

    public function hold(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|uuid|exists:products,id',
            'items.*.jumlah' => 'required|integer|min:1',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'Validasi gagal', 'errors' => $validator->errors()], 422);
        }

        $shift = Shift::where('user_id', $user->id)->where('status', 'OPEN')->first();
        if (! $shift) {
            return response()->json(['message' => 'Anda harus membuka shift terlebih dahulu'], 422);
        }

        $outlet = $user->outlet;
        $subtotal = 0;
        $itemsData = [];

        foreach ($request->items as $item) {
            $product = Product::find($item['product_id']);
            if (! $product || ! $product->is_active) {
                return response()->json(['message' => "Produk tidak ditemukan atau tidak aktif"], 422);
            }

            $lineTotal = $product->harga * $item['jumlah'];
            $subtotal += $lineTotal;

            $itemsData[] = [
                'product' => $product,
                'jumlah' => $item['jumlah'],
                'harga_satuan' => $product->harga,
                'total_baris' => $lineTotal,
            ];
        }

        $tanggal = now()->format('Ymd');
        $countHariIni = Transaction::where('outlet_id', $outlet->id)
            ->whereDate('timestamp', now()->toDateString())
            ->count();
        $nomorTransaksi = sprintf('TRX-%s-%s-%04d', $outlet->kode, $tanggal, $countHariIni + 1);

        $transaction = Transaction::create([
            'nomor_transaksi' => $nomorTransaksi,
            'outlet_id' => $outlet->id,
            'shift_id' => $shift->id,
            'cashier_id' => $user->id,
            'status' => 'hold',
            'subtotal' => $subtotal,
            'total_diskon' => 0,
            'total_pajak' => 0,
            'grand_total' => $subtotal,
            'idempotency_key' => (string) \Illuminate\Support\Str::uuid(),
            'sync_status' => 'synced',
            'timestamp' => now(),
        ]);

        foreach ($itemsData as $data) {
            TransactionItem::create([
                'transaction_id' => $transaction->id,
                'product_id' => $data['product']->id,
                'snapshot_nama_produk' => $data['product']->nama,
                'jumlah' => $data['jumlah'],
                'harga_satuan' => $data['harga_satuan'],
                'diskon' => 0,
                'pajak' => 0,
                'total_baris' => $data['total_baris'],
            ]);
        }

        return response()->json([
            'message' => 'Keranjang berhasil ditahan',
            'transaction' => $transaction->load('items'),
        ], 201);
    }

    public function held(Request $request)
    {
        $user = $request->user();

        $held = Transaction::with('items')
            ->where('status', 'hold')
            ->where('cashier_id', $user->id)
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['held_transactions' => $held]);
    }

    public function cancelHold(Request $request, string $id)
    {
        $user = $request->user();

        $transaction = Transaction::with('items')->find($id);
        if (! $transaction) {
            return response()->json(['message' => 'Keranjang tidak ditemukan'], 404);
        }
        if ($transaction->status !== 'hold') {
            return response()->json(['message' => "Hanya keranjang berstatus 'hold' yang bisa dibatalkan lewat sini"], 422);
        }
        if ($transaction->cashier_id !== $user->id) {
            return response()->json(['message' => 'Anda tidak berwenang membatalkan keranjang ini'], 403);
        }

        // Aman langsung hard-delete: belum ada stok/uang yang bergerak sama sekali saat status masih hold
        $transaction->items()->delete();
        $transaction->delete();

        return response()->json(['message' => 'Keranjang tertahan berhasil dibatalkan']);
    }

    public function summary(Request $request)
    {
        $user = $request->user();

        $baseQuery = Transaction::query();
        if ($user->role && $user->role->nama_peran === 'Admin') {
            $baseQuery->where('outlet_id', $user->outlet_id);
        } else {
            $baseQuery->where('cashier_id', $user->id);
        }
        $baseQuery->whereDate('timestamp', now()->toDateString());

        $completed = (clone $baseQuery)->where('status', 'completed');
        $refunded = (clone $baseQuery)->where('status', 'refunded');

        return response()->json([
            'total_transaksi' => (clone $completed)->count(),
            'nilai_transaksi' => (float) (clone $completed)->sum('grand_total'),
            'jumlah_refund' => (clone $refunded)->count(),
            'total_refund' => (float) (clone $refunded)->sum('grand_total'),
        ]);
    }

}