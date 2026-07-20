<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Permission extends Model
{
    use HasFactory;

    protected $fillable = [
        'nama_izin',
    ];

    public function roles()
    {
    return $this->belongsToMany(Role::class, 'role_permissions');
    }
}