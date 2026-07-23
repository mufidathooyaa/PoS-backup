<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    // Mengambil daftar notifikasi yang BELUM dibaca
    public function index(Request $request)
    {
        $user = $request->user();
        
        // Ambil notifikasi milik user yang login, belum dibaca, urutkan dari yang terbaru
        $notifications = $user->unreadNotifications()->take(10)->get();

        // Format ulang response agar mudah dibaca oleh React
        $formatted = $notifications->map(function ($notif) {
            return [
                'id' => $notif->id,
                'judul' => $notif->data['judul'] ?? 'Notifikasi',
                'pesan' => $notif->data['pesan'] ?? '',
                'tipe' => $notif->data['tipe'] ?? 'info',
                'created_at' => $notif->created_at->diffForHumans(), // Output: "2 hours ago"
            ];
        });

        return response()->json([
            'notifications' => $formatted,
            'unread_count' => $user->unreadNotifications()->count()
        ]);
    }

    // Menandai satu notifikasi sebagai "Sudah Dibaca"
    public function markAsRead(Request $request, $id)
    {
        $notification = $request->user()->notifications()->find($id);
        
        if ($notification) {
            $notification->markAsRead();
        }

        return response()->json(['message' => 'Notifikasi ditandai sudah dibaca']);
    }

    // (Opsional) Menandai semua notifikasi sebagai "Sudah Dibaca"
    public function markAllAsRead(Request $request)
    {
        $request->user()->unreadNotifications->markAsRead();
        return response()->json(['message' => 'Semua notifikasi ditandai sudah dibaca']);
    }
}