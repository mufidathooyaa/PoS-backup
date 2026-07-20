<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockMovement extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'product_id',
        'outlet_id',
        'user_id',
        'approved_by_user_id',
        'jenis_pergerakan',
        'jumlah',
        'source_type',
        'source_id',
        'alasan',
        'timestamp',
        'status',
    ];

    protected $casts = [
        'timestamp' => 'datetime',
    ];

    // ==========================================
    // RELASI DASAR
    // ==========================================

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class, 'outlet_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by_user_id');
    }

    // ==========================================
    // RESOLUSI MANUAL POLYMORPHIC (source_type/source_id)
    // Bukan morphTo() bawaan Laravel, karena source_type di sini
    // berisi nama tabel bebas ('transaction_items', 'manual'),
    // bukan nama class PHP sesuai konvensi Eloquent.
    // ==========================================

    public function resolveSource(): ?Model
    {
        if (is_null($this->source_id)) {
            return null;
        }

        return match ($this->source_type) {
            'transaction_items' => TransactionItem::find($this->source_id),
            default => null, // 'manual' atau tipe lain tidak merujuk ke tabel manapun
        };
    }
}