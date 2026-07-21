<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids; 
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Outlet extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'nama',
        'kode',
        'alamat',
        'is_active',
    ];


    protected $casts = [
        'is_active' => 'boolean',
    ];
}