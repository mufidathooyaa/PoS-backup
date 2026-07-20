<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Shift extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'user_id',
        'outlet_id',
        'waktu_buka',
        'waktu_tutup',
        'kas_awal',
        'kas_diharapkan',
        'kas_dihitung',
        'selisih',
        'status',
        'catatan_penutup',
        'catatan_admin',
        'approved_by_user_id',
    ];

    protected $casts = [
        'waktu_buka' => 'datetime',
        'waktu_tutup' => 'datetime',
        'kas_awal' => 'decimal:2',
        'kas_diharapkan' => 'decimal:2',
        'kas_dihitung' => 'decimal:2',
        'selisih' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class, 'outlet_id');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by_user_id');
    }
}