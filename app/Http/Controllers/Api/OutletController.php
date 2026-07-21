<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Outlet;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class OutletController extends Controller
{
    public function index(Request $request)
    {
        $query = Outlet::query();

        // Default: hanya tampilkan outlet aktif, kecuali diminta eksplisit semua
        // (pola sama seperti ProductController::index)
        if (! $request->boolean('include_inactive')) {
            $query->where('is_active', true);
        }

        return response()->json(['outlets' => $query->orderBy('nama')->get()]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'nama' => 'required|string|max:255|unique:outlets,nama',
            'kode' => 'required|string|max:10|unique:outlets,kode',
            'alamat' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validasi gagal', 'errors' => $validator->errors()], 422);
        }

        $outlet = Outlet::create([
            'nama' => $request->nama,
            'kode' => strtoupper($request->kode),
            'alamat' => $request->alamat,
            'is_active' => true,
        ]);

        AuditLogger::log($request, 'create_outlet', 'outlets', $outlet->id, 'success', null, [
            'nama' => $outlet->nama,
            'kode' => $outlet->kode,
        ]);

        return response()->json(['message' => 'Outlet berhasil dibuat', 'outlet' => $outlet], 201);
    }

    public function update(Request $request, string $id)
    {
        $outlet = Outlet::find($id);
        if (! $outlet) {
            return response()->json(['message' => 'Outlet tidak ditemukan'], 404);
        }

        $validator = Validator::make($request->all(), [
            'nama' => 'required|string|max:255|unique:outlets,nama,' . $id,
            'kode' => 'required|string|max:10|unique:outlets,kode,' . $id,
            'alamat' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validasi gagal', 'errors' => $validator->errors()], 422);
        }

        $oldData = ['nama' => $outlet->nama, 'kode' => $outlet->kode, 'alamat' => $outlet->alamat];

        $outlet->update([
            'nama' => $request->nama,
            'kode' => strtoupper($request->kode),
            'alamat' => $request->alamat,
        ]);

        AuditLogger::log($request, 'update_outlet', 'outlets', $outlet->id, 'success', $oldData, [
            'nama' => $outlet->nama,
            'kode' => $outlet->kode,
            'alamat' => $outlet->alamat,
        ]);

        return response()->json(['message' => 'Outlet berhasil diperbarui', 'outlet' => $outlet->fresh()]);
    }

    public function toggleActive(Request $request, string $id)
    {
        $admin = $request->user();
        $outlet = Outlet::find($id);
        if (! $outlet) {
            return response()->json(['message' => 'Outlet tidak ditemukan'], 404);
        }

        // Cegah admin menonaktifkan outlet tempat dirinya sendiri login,
        // supaya tidak terkunci keluar dari sistem
        if ($outlet->is_active && $outlet->id === $admin->outlet_id) {
            return response()->json([
                'message' => 'Anda tidak dapat menonaktifkan outlet tempat Anda sedang login',
            ], 422);
        }

        $outlet->update(['is_active' => ! $outlet->is_active]);

        AuditLogger::log(
            $request,
            $outlet->is_active ? 'activate_outlet' : 'deactivate_outlet',
            'outlets',
            $outlet->id,
            'success',
            null,
            ['is_active' => $outlet->is_active]
        );

        return response()->json([
            'message' => $outlet->is_active ? 'Outlet diaktifkan' : 'Outlet dinonaktifkan',
            'outlet' => $outlet->fresh(),
        ]);
    }
}