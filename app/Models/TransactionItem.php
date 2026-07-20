<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TransactionItem extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'transaction_id',
        'product_id',
        'original_item_id',
        'tax_rule_id',
        'discount_rule_id',
        'snapshot_nama_produk',
        'snapshot_persentase_pajak',
        'snapshot_nilai_diskon',
        'jumlah',
        'harga_satuan',
        'diskon',
        'pajak',
        'total_baris',
        'alasan_override',
        'override_approved_by_user_id',
    ];

    protected $casts = [
        'snapshot_persentase_pajak' => 'decimal:2',
        'snapshot_nilai_diskon' => 'decimal:2',
        'harga_satuan' => 'decimal:2',
        'diskon' => 'decimal:2',
        'pajak' => 'decimal:2',
        'total_baris' => 'decimal:2',
    ];

    // ==========================================
    // RELASI DASAR
    // ==========================================

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'transaction_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
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
    // RELASI AKUNTABILITAS
    // ==========================================

    public function overrideApprovedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'override_approved_by_user_id');
    }

    // ==========================================
    // RELASI SELF-REFERENCE (retur bertahap per item)
    // ==========================================

    // Item asal yang direfund oleh baris ini
    public function originalItem(): BelongsTo
    {
        return $this->belongsTo(TransactionItem::class, 'original_item_id');
    }

    // Semua baris refund yang merujuk ke item ini sebagai asal
    public function refundItems(): HasMany
    {
        return $this->hasMany(TransactionItem::class, 'original_item_id');
    }
}