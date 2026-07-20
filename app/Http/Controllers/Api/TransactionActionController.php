<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\StockMovement;
use App\Models\Inventory;
use App\Models\Shift;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use App\Services\AuditLogger;

class TransactionActionController extends Controller
{
    public function void(Request $request, string $id)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'void_reason' => 'required|string',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'Validasi gagal', 'errors' => $validator->errors()], 422);
        }

        $transaction = Transaction::with('items')->find($id);
        if (! $transaction) {
            return response()->json(['message' => 'Transaksi tidak ditemukan'], 404);
        }
        if ($transaction->status !== 'completed') {
            return response()->json(['message' => "Transaksi berstatus '{$transaction->status}' tidak bisa dibatalkan"], 422);
        }

        try {
            DB::transaction(function () use ($transaction, $request, $user) {
                // Kembalikan stok untuk setiap item
                foreach ($transaction->items as $item) {
                    $product = $item->product()->lockForUpdate()->first();
                    if (! $product || ! $product->track_stock) {
                        continue;
                    }

                    StockMovement::create([
                        'product_id' => $product->id,
                        'outlet_id' => $transaction->outlet_id,
                        'user_id' => $user->id,
                        'approved_by_user_id' => $user->id,
                        'jenis_pergerakan' => 'retur',
                        'jumlah' => $item->jumlah, // positif, stok kembali
                        'source_type' => 'transaction_items',
                        'source_id' => $item->id,
                        'alasan' => 'Reversal stok karena void transaksi ' . $transaction->nomor_transaksi,
                        'timestamp' => now(),
                    ]);

                    $inventory = Inventory::where('product_id', $product->id)
                        ->where('outlet_id', $transaction->outlet_id)
                        ->lockForUpdate()
                        ->first();

                    if ($inventory) {
                        $inventory->increment('stok_saat_ini', $item->jumlah);
                    }
                }

                $transaction->update([
                    'status' => 'void',
                    'void_reason' => $request->void_reason,
                    'void_approved_by_user_id' => $user->id,
                ]);
            });

            AuditLogger::log(
                $request,
                'void_transaction',
                'transactions',
                $transaction->id,
                'success',
                ['status' => 'completed'],
                ['status' => 'void', 'void_reason' => $request->void_reason]
            );

            return response()->json([
                'message' => 'Transaksi berhasil dibatalkan (void)',
                'transaction' => $transaction->fresh('items'),
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function refund(Request $request, string $id)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'refund_reason' => 'required|string',
            'items' => 'required|array|min:1',
            'items.*.transaction_item_id' => 'required|uuid|exists:transaction_items,id',
            'items.*.jumlah' => 'required|integer|min:1',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'Validasi gagal', 'errors' => $validator->errors()], 422);
        }

        $originalTransaction = Transaction::find($id);
        if (! $originalTransaction) {
            return response()->json(['message' => 'Transaksi asal tidak ditemukan'], 404);
        }
        if ($originalTransaction->status !== 'completed') {
            return response()->json(['message' => "Transaksi berstatus '{$originalTransaction->status}' tidak bisa direfund"], 422);
        }

        $shift = Shift::where('user_id', $user->id)->where('status', 'OPEN')->first();
        if (! $shift) {
            return response()->json(['message' => 'Anda harus membuka shift terlebih dahulu untuk memproses refund'], 422);
        }

        try {
            $refundTransaction = DB::transaction(function () use ($request, $originalTransaction, $user, $shift) {

                $refundItemsData = [];
                $subtotal = 0;

                // Validasi setiap item: tidak boleh refund melebihi sisa yang belum direfund
                foreach ($request->items as $reqItem) {
                    $originalItem = TransactionItem::where('id', $reqItem['transaction_item_id'])
                        ->where('transaction_id', $originalTransaction->id)
                        ->first();

                    if (! $originalItem) {
                        throw new \Exception('Item tidak ditemukan pada transaksi asal ini');
                    }

                    $sudahDirefund = TransactionItem::where('original_item_id', $originalItem->id)->sum('jumlah');
                    $sisaBisaRefund = $originalItem->jumlah - $sudahDirefund;

                    if ($reqItem['jumlah'] > $sisaBisaRefund) {
                        throw new \Exception("Refund untuk '{$originalItem->snapshot_nama_produk}' melebihi sisa yang bisa direfund (sisa: {$sisaBisaRefund})");
                    }

                    $lineTotal = $originalItem->harga_satuan * $reqItem['jumlah'];
                    $subtotal += $lineTotal;

                    $refundItemsData[] = [
                        'original_item' => $originalItem,
                        'jumlah' => $reqItem['jumlah'],
                        'total_baris' => $lineTotal,
                    ];
                }

                // Nomor transaksi refund
                $outlet = $originalTransaction->outlet;
                $tanggal = now()->format('Ymd');
                $countHariIni = Transaction::where('outlet_id', $outlet->id)
                    ->whereDate('timestamp', now()->toDateString())
                    ->lockForUpdate()
                    ->count();
                $nomorTransaksi = sprintf('TRX-%s-%s-%04d', $outlet->kode, $tanggal, $countHariIni + 1);

                $refundTransaction = Transaction::create([
                    'nomor_transaksi' => $nomorTransaksi,
                    'original_transaction_id' => $originalTransaction->id,
                    'outlet_id' => $originalTransaction->outlet_id,
                    'shift_id' => $shift->id,
                    'cashier_id' => $user->id,
                    'status' => 'refunded',
                    'subtotal' => $subtotal,
                    'total_diskon' => 0,
                    'total_pajak' => 0,
                    'grand_total' => $subtotal,
                    'refund_reason' => $request->refund_reason,
                    'refund_approved_by_user_id' => $user->id,
                    'idempotency_key' => (string) \Illuminate\Support\Str::uuid(),
                    'sync_status' => 'synced',
                    'timestamp' => now(),
                ]);

                foreach ($refundItemsData as $data) {
                    $originalItem = $data['original_item'];
                    $product = $originalItem->product;

                    $refundItem = TransactionItem::create([
                        'transaction_id' => $refundTransaction->id,
                        'product_id' => $originalItem->product_id,
                        'original_item_id' => $originalItem->id,
                        'snapshot_nama_produk' => $originalItem->snapshot_nama_produk,
                        'jumlah' => $data['jumlah'],
                        'harga_satuan' => $originalItem->harga_satuan,
                        'diskon' => 0,
                        'pajak' => 0,
                        'total_baris' => $data['total_baris'],
                    ]);

                    if ($product && $product->track_stock) {
                        StockMovement::create([
                            'product_id' => $product->id,
                            'outlet_id' => $refundTransaction->outlet_id,
                            'user_id' => $user->id,
                            'approved_by_user_id' => $user->id,
                            'jenis_pergerakan' => 'retur',
                            'jumlah' => $data['jumlah'],
                            'source_type' => 'transaction_items',
                            'source_id' => $refundItem->id,
                            'alasan' => 'Refund dari transaksi ' . $originalTransaction->nomor_transaksi,
                            'timestamp' => now(),
                        ]);

                        $inventory = Inventory::where('product_id', $product->id)
                            ->where('outlet_id', $refundTransaction->outlet_id)
                            ->lockForUpdate()
                            ->first();

                        if ($inventory) {
                            $inventory->increment('stok_saat_ini', $data['jumlah']);
                        }
                    }
                }

                return $refundTransaction;
            });

            AuditLogger::log(
                $request,
                'refund_transaction',
                'transactions',
                $refundTransaction->id,
                'success',
                null,
                [
                    'original_transaction_id' => $originalTransaction->id, 
                    'refund_reason' => $request->refund_reason, 
                    'grand_total' => $refundTransaction->grand_total
                    ]
            );

            return response()->json([
                'message' => 'Refund berhasil diproses',
                'refund_transaction' => $refundTransaction->load('items'),
            ], 201);
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function resume(Request $request, string $id)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'payment_method_id' => 'required|integer|exists:payment_methods,id',
            'jumlah_dibayar' => 'required|numeric|min:0',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'Validasi gagal', 'errors' => $validator->errors()], 422);
        }

        $transaction = Transaction::with('items')->find($id);
        if (! $transaction) {
            return response()->json(['message' => 'Keranjang tidak ditemukan'], 404);
        }
        if ($transaction->status !== 'hold') {
            return response()->json(['message' => "Transaksi berstatus '{$transaction->status}' tidak bisa dilanjutkan"], 422);
        }
        if ($transaction->cashier_id !== $user->id) {
            return response()->json(['message' => 'Anda tidak berwenang melanjutkan keranjang ini'], 403);
        }
        if ($request->jumlah_dibayar < $transaction->grand_total) {
            return response()->json(['message' => 'Jumlah pembayaran tidak mencukupi'], 422);
        }

        try {
            DB::transaction(function () use ($transaction, $request, $user) {
                // Cek ulang stok sekarang (bisa saja berubah sejak keranjang ditahan)
                foreach ($transaction->items as $item) {
                    $product = $item->product()->lockForUpdate()->first();
                    if (! $product->is_active) {
                        throw new \Exception("Produk '{$product->nama}' sudah tidak aktif");
                    }

                    if ($product->track_stock) {
                        $inventory = \App\Models\Inventory::where('product_id', $product->id)
                            ->where('outlet_id', $transaction->outlet_id)
                            ->lockForUpdate()
                            ->first();

                        if (! $inventory || $inventory->stok_saat_ini < $item->jumlah) {
                            $tersedia = $inventory->stok_saat_ini ?? 0;
                            throw new \Exception("Stok '{$product->nama}' tidak mencukupi. Tersedia: {$tersedia}, diminta: {$item->jumlah}");
                        }

                        \App\Models\StockMovement::create([
                            'product_id' => $product->id,
                            'outlet_id' => $transaction->outlet_id,
                            'user_id' => $user->id,
                            'jenis_pergerakan' => 'penjualan',
                            'jumlah' => -$item->jumlah,
                            'source_type' => 'transaction_items',
                            'source_id' => $item->id,
                            'timestamp' => now(),
                        ]);

                        $inventory->decrement('stok_saat_ini', $item->jumlah);
                    }
                }

                \App\Models\Payment::create([
                    'transaction_id' => $transaction->id,
                    'payment_method_id' => $request->payment_method_id,
                    'jumlah_dibayar' => $request->jumlah_dibayar,
                    'kembalian' => $request->jumlah_dibayar - $transaction->grand_total,
                    'status' => 'completed',
                ]);

                $transaction->update(['status' => 'completed', 'timestamp' => now()]);
            });

            AuditLogger::log(
                $request,
                'resume_transaction',
                'transactions',
                $transaction->id,
                'success',
                ['status' => 'hold'],
                ['status' => 'completed']
            );

            return response()->json([
                'message' => 'Transaksi berhasil diselesaikan',
                'transaction' => $transaction->fresh(['items', 'payments.paymentMethod', 'cashier', 'outlet']),
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
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
}