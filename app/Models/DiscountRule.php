<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DiscountRule extends Model
{
    use HasFactory;

    protected $fillable = [
        'nama',
        'jenis_diskon', 
        'nilai',
        'berlaku_mulai',
        'berlaku_sampai',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'berlaku_mulai' => 'datetime',
        'berlaku_sampai' => 'datetime',
    ];
}