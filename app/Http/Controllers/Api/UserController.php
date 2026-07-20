<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use App\Services\AuditLogger;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $admin = $request->user();

        $users = User::with('role')
            ->where('outlet_id', $admin->outlet_id)
            ->orderBy('nama')
            ->get();

        return response()->json(['users' => $users]);
    }

    public function store(Request $request)
    {
        $admin = $request->user();

        $validator = Validator::make($request->all(), [
            'nama' => 'required|string|max:255',
            'username' => 'required|string|max:255|unique:users,username',
            'email' => 'required|email|max:255|unique:users,email',
            'password' => 'required|string|min:6',
            'role_id' => 'required|integer|exists:roles,id',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'Validasi gagal', 'errors' => $validator->errors()], 422);
        }

        $user = User::create([
            'nama' => $request->nama,
            'username' => $request->username,
            'email' => $request->email,
            'password_hash' => $request->password, // otomatis di-hash oleh cast 'hashed' di model
            'role_id' => $request->role_id,
            'outlet_id' => $admin->outlet_id,
            'is_active' => true,
        ]);

        AuditLogger::log($request, 'create_user', 'users', $user->id, 'success', null, ['nama' => $user->nama, 'role_id' => $user->role_id]);

        return response()->json(['message' => 'Pengguna berhasil dibuat', 'user' => $user->load('role')], 201);
    }

    public function update(Request $request, string $id)
    {
        $user = User::find($id);
        if (! $user) {
            return response()->json(['message' => 'Pengguna tidak ditemukan'], 404);
        }

        $validator = Validator::make($request->all(), [
            'nama' => 'sometimes|string|max:255',
            'username' => 'sometimes|string|max:255|unique:users,username,' . $id,
            'email' => 'sometimes|email|max:255|unique:users,email,' . $id,
            'password' => 'nullable|string|min:6',
            'role_id' => 'sometimes|integer|exists:roles,id',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'Validasi gagal', 'errors' => $validator->errors()], 422);
        }

        $oldData = ['nama' => $user->nama, 'role_id' => $user->role_id];

        $user->fill($request->only(['nama', 'username', 'email', 'role_id']));
        if ($request->filled('password')) {
            $user->password_hash = $request->password;
        }
        $user->save();

        AuditLogger::log($request, 'update_user', 'users', $user->id, 'success', $oldData, ['nama' => $user->nama, 'role_id' => $user->role_id]);

        return response()->json(['message' => 'Pengguna berhasil diperbarui', 'user' => $user->load('role')]);
    }

    public function toggleActive(Request $request, string $id)
    {
        $admin = $request->user();
        $user = User::find($id);
        if (! $user) {
            return response()->json(['message' => 'Pengguna tidak ditemukan'], 404);
        }

        if ($user->id === $admin->id) {
            return response()->json(['message' => 'Anda tidak dapat menonaktifkan akun Anda sendiri'], 422);
        }

        $user->update(['is_active' => ! $user->is_active]);

        AuditLogger::log($request, $user->is_active ? 'activate_user' : 'deactivate_user', 'users', $user->id, 'success', null, ['is_active' => $user->is_active]);

        return response()->json([
            'message' => $user->is_active ? 'Pengguna diaktifkan' : 'Pengguna dinonaktifkan',
            'user' => $user->fresh('role'),
        ]);
    }
}