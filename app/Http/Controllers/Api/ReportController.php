<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ReportController extends Controller
{
    public function daily(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'tanggal_mulai' => 'nullable|date',
            'tanggal_selesai' => 'nullable|date|after_or_equal:tanggal_mulai',
            'outlet_id' => 'nullable|uuid|exists:outlets,id',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'Validasi gagal', 'errors' => $validator->errors()], 422);
        }

        // Default: hari ini saja
        $tanggalMulai = $request->filled('tanggal_mulai') ? $request->tanggal_mulai : now()->toDateString();
        $tanggalSelesai = $request->filled('tanggal_selesai') ? $request->tanggal_selesai : $tanggalMulai;

        // Admin bisa lihat semua outlet atau filter spesifik; kasir/operator otomatis dibatasi ke outlet-nya sendiri
        $outletId = $request->outlet_id;
        if (! $user->role || $user->role->nama_peran !== 'Admin') {
            $outletId = $user->outlet_id;
        }

        $baseQuery = Transaction::whereDate('timestamp', '>=', $tanggalMulai)
            ->whereDate('timestamp', '<=', $tanggalSelesai);

        if ($outletId) {
            $baseQuery->where('outlet_id', $outletId);
        }

        // 1. Penjualan kotor & bersih (hanya transaksi completed, void dikeluarkan sepenuhnya)
        $completed = (clone $baseQuery)->where('status', 'completed');

        $penjualanKotor = (clone $completed)->sum('subtotal');
        $totalDiskon = (clone $completed)->sum('total_diskon');
        $totalPajak = (clone $completed)->sum('total_pajak');
        $penjualanBersih = $penjualanKotor - $totalDiskon; // TANPA pajak, karena pajak bukan pendapatan toko
        $jumlahTransaksi = (clone $completed)->count();

        // 2. Refund (dihitung terpisah, sebagai pengurang, bukan campur ke penjualan)
        $refundQuery = (clone $baseQuery)->where('status', 'refunded');
        $totalRefund = (clone $refundQuery)->sum('grand_total');
        $jumlahRefund = (clone $refundQuery)->count();

        // 3. Void (statistik pembatalan, tidak masuk hitungan uang sama sekali)
        $jumlahVoid = (clone $baseQuery)->where('status', 'void')->count();

        // 4. Komposisi pembayaran (group by metode, hanya dari transaksi completed)
        $komposisiPembayaran = Payment::join('transactions', 'payments.transaction_id', '=', 'transactions.id')
            ->join('payment_methods', 'payments.payment_method_id', '=', 'payment_methods.id')
            ->whereDate('transactions.timestamp', '>=', $tanggalMulai)
            ->whereDate('transactions.timestamp', '<=', $tanggalSelesai)
            ->where('transactions.status', 'completed')
            ->when($outletId, fn ($q) => $q->where('transactions.outlet_id', $outletId))
            ->groupBy('payment_methods.nama')
            ->select('payment_methods.nama as metode', DB::raw('SUM(payments.jumlah_dibayar) as total'), DB::raw('COUNT(*) as jumlah_transaksi'))
            ->get();

        // 5. Produk terlaris (berdasarkan jumlah terjual, dari transaksi completed)
        $produkTerlaris = TransactionItem::join('transactions', 'transaction_items.transaction_id', '=', 'transactions.id')
            ->whereDate('transactions.timestamp', '>=', $tanggalMulai)
            ->whereDate('transactions.timestamp', '<=', $tanggalSelesai)
            ->where('transactions.status', 'completed')
            ->when($outletId, fn ($q) => $q->where('transactions.outlet_id', $outletId))
            ->groupBy('transaction_items.snapshot_nama_produk')
            ->select(
                'transaction_items.snapshot_nama_produk as nama_produk',
                DB::raw('SUM(transaction_items.jumlah) as total_terjual'),
                DB::raw('SUM(transaction_items.total_baris) as total_pendapatan')
            )
            ->orderByDesc('total_terjual')
            ->limit(10)
            ->get();

        return response()->json([
            'periode' => [
                'tanggal_mulai' => $tanggalMulai,
                'tanggal_selesai' => $tanggalSelesai,
                'outlet_id' => $outletId,
            ],
            'ringkasan' => [
                'jumlah_transaksi' => $jumlahTransaksi,
                'penjualan_kotor' => (float) $penjualanKotor,
                'total_diskon' => (float) $totalDiskon,
                'total_pajak' => (float) $totalPajak,
                'penjualan_bersih' => (float) $penjualanBersih, // sekarang subtotal - diskon, TANPA pajak
                'jumlah_void' => $jumlahVoid,
                'jumlah_refund' => $jumlahRefund,
                'total_refund' => (float) $totalRefund,
                'penjualan_bersih_setelah_refund' => (float) ($penjualanBersih - $totalRefund),
            ],
            'komposisi_pembayaran' => $komposisiPembayaran,
            'produk_terlaris' => $produkTerlaris,
        ]);
    }

    public function dailyExport(Request $request)
    {
        $user = $request->user();

        $tanggalMulai = $request->filled('tanggal_mulai') ? $request->tanggal_mulai : now()->toDateString();
        $tanggalSelesai = $request->filled('tanggal_selesai') ? $request->tanggal_selesai : $tanggalMulai;

        $outletId = $request->outlet_id;
        if (! $user->role || $user->role->nama_peran !== 'Admin') {
            $outletId = $user->outlet_id;
        }

        $query = Transaction::with(['cashier', 'outlet'])
            ->whereDate('timestamp', '>=', $tanggalMulai)
            ->whereDate('timestamp', '<=', $tanggalSelesai)
            ->where('status', 'completed');

        if ($outletId) {
            $query->where('outlet_id', $outletId);
        }

        $transactions = $query->orderBy('timestamp')->get();

        $filename = "laporan-harian-{$tanggalMulai}-sd-{$tanggalSelesai}.csv";

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $callback = function () use ($transactions) {
            $file = fopen('php://output', 'w');

            // Header kolom
            fputcsv($file, [
                'Nomor Transaksi', 'Tanggal', 'Outlet', 'Kasir',
                'Subtotal', 'Diskon', 'Pajak', 'Grand Total', 'Status',
            ]);

            foreach ($transactions as $trx) {
                fputcsv($file, [
                    $trx->nomor_transaksi,
                    $trx->timestamp->format('Y-m-d H:i:s'),
                    $trx->outlet->nama,
                    $trx->cashier->nama,
                    $trx->subtotal,
                    $trx->total_diskon,
                    $trx->total_pajak,
                    $trx->grand_total,
                    $trx->status,
                ]);
            }

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }
}