<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class ShiftDiscrepancyNotification extends Notification
{
    use Queueable;

    protected $namaKasir;
    protected $selisih;
    protected $shiftId;

    public function __construct($namaKasir, $selisih, $shiftId)
    {
        $this->namaKasir = $namaKasir;
        $this->selisih = $selisih; // Uang minus atau plus
        $this->shiftId = $shiftId;
    }

    public function via($notifiable)
    {
        return ['database'];
    }

    public function toDatabase($notifiable)
    {
        return [
            'tipe' => 'shift_selisih',
            'shift_id' => $this->shiftId,
            'judul' => 'Selisih Uang Kasir',
            'pesan' => "Shift ditutup oleh {$this->namaKasir} dengan selisih uang Rp " . number_format($this->selisih, 0, ',', '.'),
        ];
    }
}