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

        return response()->json([
            'message' => 'Login berhasil',
            'user' => [
                'id' => $user->id,
                'nama' => $user->nama,
                'username' => $user->username,
                'role' => $user->role->nama_peran,
                'outlet_id' => $user->outlet_id,
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
}