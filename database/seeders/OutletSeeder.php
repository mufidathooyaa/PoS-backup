<?php

namespace Database\Seeders;

use App\Models\Outlet;
use Illuminate\Database\Seeder;

class OutletSeeder extends Seeder
{
    public function run(): void
    {
        Outlet::firstOrCreate(
            ['nama' => 'Toko Pusat'],
            [
                'kode' => 'OUT1',
                'alamat' => 'Jl. Contoh No. 1, Semarang',
            ]
        );
    }
}