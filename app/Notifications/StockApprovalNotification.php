<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class StockApprovalNotification extends Notification
{
    use Queueable;

    protected $namaPengaju;
    protected $namaProduk;
    protected $jenisPenyesuaian;
    protected $referenceId;

    public function __construct($namaPengaju, $namaProduk, $jenisPenyesuaian)
    {
        $this->namaPengaju = $namaPengaju;
        $this->namaProduk = $namaProduk;
        $this->jenisPenyesuaian = $jenisPenyesuaian; // misal: "Stock Opname" atau "Barang Rusak"
        $this->referenceId = $referenceId;
    }

    public function via($notifiable)
    {
        return ['database'];
    }

    public function toDatabase($notifiable)
    {
        return [
            'tipe' => 'stok_approval',
            'reference_id' => $this->referenceId,
            'judul' => 'Persetujuan Penyesuaian Stok',
            'pesan' => "{$this->namaPengaju} mengajukan penyesuaian stok ({$this->jenisPenyesuaian}) untuk produk {$this->namaProduk}. Menunggu persetujuan Anda.",
        ];
    }
}