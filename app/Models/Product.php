<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Product extends Model
{
    use HasFactory;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'category_id',
        'sku',
        'barcode',
        'nama',
        'image_url',
        'unit',
        'harga',
        'is_active',
        'track_stock',
    ];

    protected $casts = [
        'harga' => 'decimal:2',
        'is_active' => 'boolean',
        'track_stock' => 'boolean',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($product) {
            if (empty($product->id)) {
                $product->id = (string) Str::uuid();
            }
            if (is_null($product->is_active)){
                $product->is_active = true;
            }
            $product->syncActiveBarcode();
        });

        static::updating(function ($product) {
            $product->syncActiveBarcode();
        });
    }

    protected function syncActiveBarcode(): void
    {
        $this->active_barcode = $this->is_active ? $this->barcode : null;
    }

    public function category()
    {
        return $this->belongsTo(Category::class, 'category_id');
    }

    public function inventories()
    {
        return $this->hasMany(Inventory::class, 'product_id');
    }
}