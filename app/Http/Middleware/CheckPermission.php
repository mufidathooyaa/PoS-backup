<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckPermission
{
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Tidak terautentikasi'], 401);
        }

        // Load role beserta daftar permission-nya
        $hasPermission = $user->role()
            ->whereHas('permissions', function ($query) use ($permission) {
                $query->where('nama_izin', $permission);
            })
            ->exists();

        if (! $hasPermission) {
            return response()->json([
                'message' => "Anda tidak memiliki izin untuk aksi ini ({$permission})",
            ], 403);
        }

        return $next($request);
    }
}