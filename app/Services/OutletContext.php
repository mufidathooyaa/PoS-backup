<?php

namespace App\Services;

use Illuminate\Http\Request;

class OutletContext
{
    /**
     * Tentukan outlet_id untuk endpoint READ (dashboard, laporan, daftar transaksi/shift/stok).
     *
     * Hanya Admin yang boleh "berpindah" outlet lewat query param ?outlet_id=..., karena
     * mereka mengelola organisasi secara keseluruhan. Kasir/Operator Inventaris selalu
     * dikunci ke outlet tempat mereka login — sesuai realitas fisik, mereka bekerja
     * di 1 lokasi. Ini TIDAK dipakai untuk endpoint yang menulis data (buka shift,
     * penerimaan stok, dsb) — aksi itu tetap terikat outlet fisik user yang login.
     */
    public static function resolve(Request $request): string
    {
        $user = $request->user();

        if ($user->role && $user->role->nama_peran === 'Admin' && $request->filled('outlet_id')) {
            return $request->outlet_id;
        }

        return $user->outlet_id;
    }
}