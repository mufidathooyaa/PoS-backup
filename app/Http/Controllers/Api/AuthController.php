<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'login' => 'required|string', // bisa diisi username ATAU email
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validasi gagal', 'errors' => $validator->errors()], 422);
        }

        $user = User::where('username', $request->login)
            ->orWhere('email', $request->login)
            ->first();

        // Cek user ada, password cocok, DAN akun masih aktif
        if (! $user || ! Hash::check($request->password, $user->password_hash)) {
            return response()->json(['message' => 'Username atau password salah'], 401);
        }

        if (! $user->is_active) {
            return response()->json(['message' => 'Akun tidak aktif, hubungi admin'], 403);
        }

        // Hapus token lama supaya tidak menumpuk (opsional, sesuai kebijakan tim)
        $user->tokens()->delete();

        $token = $user->createToken('pos-token')->plainTextToken;

        $user->load('outlet');

        return response()->json([
            'message' => 'Login berhasil',
            'user' => [
                'id' => $user->id,
                'nama' => $user->nama,
                'username' => $user->username,
                'role' => $user->role->nama_peran,
                'outlet_id' => $user->outlet_id,
                'outlet_nam' => $user->outlet->nama,
            ],
            'token' => $token,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logout berhasil']);
    }

    public function me(Request $request)
    {
        $user = $request->user()->load('role', 'outlet');

        return response()->json([
            'id' => $user->id,
            'nama' => $user->nama,
            'username' => $user->username,
            'email' => $user->email,
            'role' => $user->role->nama_peran,
            'outlet' => $user->outlet->nama,
            'is_active' => $user->is_active,
        ]);
    }

    public function authorizePriceOverride(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'login' => 'required|string',
            'password' => 'required|string',
            'product_id' => 'required|uuid|exists:products,id',
            'harga_baru' => 'required|numeric|min:0',
            'alasan' => 'required|string',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'Validasi gagal', 'errors' => $validator->errors()], 422);
        }

        $admin = User::where('username', $request->login)->orWhere('email', $request->login)->first();

        if (! $admin || ! Hash::check($request->password, $admin->password_hash)) {
            return response()->json(['message' => 'Username/email atau password salah'], 401);
        }
        if (! $admin->is_active) {
            return response()->json(['message' => 'Akun tidak aktif'], 403);
        }

        $hasPermission = $admin->role()->whereHas('permissions', function ($q) {
            $q->where('nama_izin', 'override_price');
        })->exists();

        if (! $hasPermission) {
            return response()->json(['message' => 'Akun ini tidak memiliki izin mengubah harga'], 403);
        }

        $token = (string) \Illuminate\Support\Str::uuid();
        \Illuminate\Support\Facades\Cache::put("price_override:{$token}", [
            'user_id' => $admin->id,
            'nama_admin' => $admin->nama,
            'product_id' => $request->product_id,
            'harga_baru' => $request->harga_baru,
            'alasan' => $request->alasan,
        ], now()->addMinutes(10));

        return response()->json([
            'message' => "Diotorisasi oleh {$admin->nama}",
            'token' => $token,
            'nama_admin' => $admin->nama,
        ]);
    }
}