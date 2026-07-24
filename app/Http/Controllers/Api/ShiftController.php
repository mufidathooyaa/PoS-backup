<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Shift;
use App\Models\Transaction;
use App\Models\Payment;
use App\Services\AuditLogger;
use App\Services\OutletContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ShiftController extends Controller
{
    public function open(Request $request)
    {
        $user = $request->user();

        if ($user->role && $user->role->nama_peran === 'Admin') {
            return response()->json([
                'message' => 'Admin tidak perlu membuka shift; silakan tinjau penutupan kasir.',
            ], 403);
        }

        $outletId = OutletContext::resolve($request);

        $existingOpenShift = Shift::where('user_id', $user->id)
            ->where('status', 'OPEN')
            ->where('outlet_id', $outletId)
            ->first();

        if ($existingOpenShift) {
            return response()->json([
                'message' => 'Anda masih memiliki shift yang terbuka di outlet ini.',
                'shift_id' => $existingOpenShift->id,
            ], 409);
        }

        $shift = Shift::create([
            'user_id' => $user->id,
            'outlet_id' => $outletId,
            'waktu_buka' => now(),
            'kas_awal' => $request->kas_awal,
            'status' => 'OPEN',
        ]);

        return response()->json(['message' => 'Shift berhasil dibuka', 'shift' => $shift], 201);
    }

    public function close(Request $request, string $id)
    {
        $user = $request->user();

        if ($user->role && $user->role->nama_peran === 'Admin') {
            return response()->json([
                'message' => 'Admin tidak perlu menutup shift; silakan tinjau penutupan kasir.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'kas_dihitung' => 'required|numeric|min:0',
            'catatan_penutup' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validasi gagal', 'errors' => $validator->errors()], 422);
        }

        $shift = Shift::find($id);

        if (! $shift) {
            return response()->json(['message' => 'Shift tidak ditemukan'], 404);
        }

        if ($shift->status !== 'OPEN') {
            return response()->json(['message' => 'Shift ini sudah ditutup'], 422);
        }

        // Hanya kasir pemilik shift yang boleh menutup shift-nya sendiri
        $isAdmin = $user->role && $user->role->nama_peran === 'Admin';
        $selectedOutletId = $isAdmin ? OutletContext::resolve($request) : $user->outlet_id;

        $canCloseShift = $shift->user_id === $user->id || ($isAdmin && $shift->outlet_id === $selectedOutletId);

        if (! $canCloseShift) {
            return response()->json(['message' => 'Anda tidak berwenang menutup shift ini'], 403);
        }

        // TODO: setelah endpoint transaksi dibangun, kas_diharapkan harus dihitung
        // dari kas_awal + total penjualan tunai selama shift ini berlangsung.
        // Untuk sekarang, sementara disamakan dengan kas_awal.
        $totalTunaiMasuk = Payment::join('transactions', 'payments.transaction_id', '=', 'transactions.id')
            ->join('payment_methods', 'payments.payment_method_id', '=', 'payment_methods.id')
            ->where('transactions.shift_id', $shift->id)
            ->where('transactions.status', 'completed')
            ->where('payment_methods.nama', 'Tunai')
            ->selectRaw('SUM(payments.jumlah_dibayar - payments.kembalian) as total')
            ->value('total') ?? 0;

        $kasDiharapkan = (float) $shift->kas_awal + (float) $totalTunaiMasuk;
        $selisih = $request->kas_dihitung - $kasDiharapkan;

        if ($selisih != 0 && ! $request->filled('catatan_penutup')) {
            return response()->json(['message' => 'Catatan wajib diisi karena terdapat selisih kas'], 422);
        }

        $shift->update([
            'waktu_tutup' => now(),
            'kas_diharapkan' => $kasDiharapkan,
            'kas_dihitung' => $request->kas_dihitung,
            'selisih' => $selisih,
            'status' => 'CLOSED',
            'catatan_penutup' => $request->catatan_penutup,
        ]);

        AuditLogger::log(
            $request,
            'close_shift',
            'shifts',
            $shift->id,
            'success',
            ['status' => 'OPEN'],
            ['status' => 'CLOSED', 'selisih' => $selisih]
        );

        return response()->json([
            'message' => 'Shift berhasil ditutup',
            'shift' => $shift,
            'ada_selisih' => $selisih != 0,
        ]);
    }

    public function index(Request $request)
    {
        $user = $request->user();

        $query = Shift::with('user.role', 'approvedBy')->orderByDesc('waktu_buka');

        // Admin bisa lihat semua kasir di outletnya; selain admin hanya lihat shift miliknya sendiri
        if ($user->role && $user->role->nama_peran === 'Admin') {
            $query->where('outlet_id', \App\Services\OutletContext::resolve($request))
                ->whereHas('user.role', fn ($q) => $q->where('nama_peran', 'Kasir'));
        } else {
            $query->where('user_id', $user->id);
        }

        if ($request->filled('tanggal')) {
            $query->whereDate('waktu_buka', $request->tanggal);
        } else {
            $query->whereDate('waktu_buka', now()->toDateString()); // default: hari ini
        }

        $shifts = $query->get()->map(function ($shift) {
            return $this->withLiveStats($shift);
        });

        return response()->json(['shifts' => $shifts]);
    }

    public function current(Request $request)
    {
        $user = $request->user();
        $query = Shift::with('user.role', 'approvedBy')
            ->where('status', 'OPEN');

        // Jika Admin, cari shift siapapun yang terbuka di outlet ini.
        // Jika bukan, cari HANYA shift milik user itu sendiri.
        if ($user->role && $user->role->nama_peran === 'Admin') {
            $query->where('outlet_id', \App\Services\OutletContext::resolve($request));
        } else {
            $query->where('user_id', $user->id);
        }
        $shift = $query->orderBy('waktu_buka')->first();

        if (! $shift) {
            return response()->json(['shift' => null]);
        }

        return response()->json(['shift' => $this->withLiveStats($shift)]);
    }

    public function pendingReview(Request $request)
    {
        $user = $request->user();
        $selectedOutletId = OutletContext::resolve($request);

        $shifts = Shift::with('user')
            ->where('outlet_id', $selectedOutletId)
            ->where('status', 'CLOSED')
            ->where('selisih', '!=', 0)
            ->whereNull('approved_by_user_id')
            ->orderBy('waktu_tutup')
            ->get();

        return response()->json(['shifts' => $shifts]);
    }

    public function review(Request $request, string $id)
    {
        $admin = $request->user();
        $shift = Shift::find($id);

        if (! $shift) {
            return response()->json(['message' => 'Shift tidak ditemukan'], 404);
        }
        if ($shift->status !== 'CLOSED' || $shift->selisih == 0) {
            return response()->json(['message' => 'Shift ini tidak memerlukan tinjauan'], 422);
        }
        if ($shift->approved_by_user_id) {
            return response()->json(['message' => 'Shift ini sudah pernah ditinjau'], 422);
        }

        $shift->update([
            'approved_by_user_id' => $admin->id,
            'catatan_admin' => $request->catatan_admin,
        ]);

        AuditLogger::log($request, 'review_shift_variance', 'shifts', $shift->id, 'success', null, ['selisih' => $shift->selisih, 'catatan_admin' => $request->catatan_admin]);

        return response()->json(['message' => 'Shift berhasil ditinjau', 'shift' => $shift->fresh('user')]);
    }

    // Helper: hitung statistik live (jumlah transaksi & kas diharapkan sementara) untuk shift yang masih OPEN
    private function withLiveStats(Shift $shift): array
    {
        $data = $shift->toArray();

        if ($shift->status === 'OPEN') {
            $jumlahTransaksi = Transaction::where('shift_id', $shift->id)
                ->where('status', 'completed')
                ->count();

            $totalTunaiMasuk = Payment::join('transactions', 'payments.transaction_id', '=', 'transactions.id')
                ->join('payment_methods', 'payments.payment_method_id', '=', 'payment_methods.id')
                ->where('transactions.shift_id', $shift->id)
                ->where('transactions.status', 'completed')
                ->where('payment_methods.nama', 'Tunai')
                ->selectRaw('SUM(payments.jumlah_dibayar - payments.kembalian) as total')
                ->value('total') ?? 0;

            $data['jumlah_transaksi'] = $jumlahTransaksi;
            $data['kas_diharapkan_sementara'] = (float) $shift->kas_awal + (float) $totalTunaiMasuk;
        }

        return $data;
    }
}