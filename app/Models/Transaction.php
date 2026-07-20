<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Transaction extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'nomor_transaksi',
        'original_transaction_id',
        'outlet_id',
        'shift_id',
        'cashier_id',
        'tax_rule_id',
        'discount_rule_id',
        'snapshot_persentase_pajak',
        'snapshot_nilai_diskon',
        'status',
        'subtotal',
        'total_pajak',
        'total_diskon',
        'grand_total',
        'void_reason',
        'void_approved_by_user_id',
        'refund_reason',
        'refund_approved_by_user_id',
        'idempotency_key',
        'local_transaction_id',
        'sync_status',
        'created_at_local',
        'timestamp',
    ];

    protected $casts = [
        'snapshot_persentase_pajak' => 'decimal:2',
        'snapshot_nilai_diskon' => 'decimal:2',
        'subtotal' => 'decimal:2',
        'total_pajak' => 'decimal:2',
        'total_diskon' => 'decimal:2',
        'grand_total' => 'decimal:2',
        'created_at_local' => 'datetime',
        'timestamp' => 'datetime',
    ];

    // ==========================================
    // RELASI DASAR
    // ==========================================

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class, 'outlet_id');
    }

    public function shift(): BelongsTo
    {
        return $this->belongsTo(Shift::class, 'shift_id');
    }

    public function cashier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cashier_id');
    }

    public function taxRule(): BelongsTo
    {
        return $this->belongsTo(TaxRule::class, 'tax_rule_id');
    }

    public function discountRule(): BelongsTo
    {
        return $this->belongsTo(DiscountRule::class, 'discount_rule_id');
    }

    // ==========================================
    // RELASI AKUNTABILITAS (void & refund terpisah)
    // ==========================================

    public function voidApprovedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'void_approved_by_user_id');
    }

    public function refundApprovedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'refund_approved_by_user_id');
    }

    // ==========================================
    // RELASI SELF-REFERENCE (retur bertahap)
    // ==========================================

    // Transaksi asal yang direfund oleh transaksi ini
    public function originalTransaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'original_transaction_id');
    }

    // Semua transaksi refund yang merujuk ke transaksi ini sebagai asal
    public function refundTransactions(): HasMany
    {
        return $this->hasMany(Transaction::class, 'original_transaction_id');
    }

    // ==========================================
    // RELASI KE DOMAIN LAIN
    // ==========================================

    public function items(): HasMany
    {
        return $this->hasMany(TransactionItem::class, 'transaction_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class, 'transaction_id');
    }
}