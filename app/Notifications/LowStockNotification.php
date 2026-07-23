<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class LowStockNotification extends Notification
{
    use Queueable;

    protected $productName;
    protected $currentStock;
    protected $outletName;

    public function __construct($productName, $currentStock, $outletName)
    {
        $this->productName = $productName;
        $this->currentStock = $currentStock;
        $this->outletName = $outletName;
    }

    // Pastikan ini me-return 'database'
    public function via($notifiable)
    {
        return ['database'];
    }

    // Data yang akan disimpan ke kolom 'data' (format JSON)
    public function toDatabase($notifiable)
    {
        return [
            'tipe' => 'stok_menipis',
            'judul' => 'Stok Menipis: ' . $this->productName,
            'pesan' => "Sisa stok {$this->productName} di {$this->outletName} tinggal {$this->currentStock}.",
            'action_url' => '/inventory' // opsional, jika ingin notif bisa di-klik
        ];
    }
}