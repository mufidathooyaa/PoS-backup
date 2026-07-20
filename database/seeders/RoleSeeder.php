<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        foreach (['Admin', 'Kasir', 'Operator Inventaris'] as $nama) {
            Role::firstOrCreate(['nama_peran' => $nama]);
        }
    }
}