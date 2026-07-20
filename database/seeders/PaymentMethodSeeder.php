<?php

namespace Database\Seeders;

use App\Models\PaymentMethod;
use Illuminate\Database\Seeder;

class PaymentMethodSeeder extends Seeder
{
    public function run(): void
    {
        foreach (['Tunai', 'QRIS'] as $nama) {
            PaymentMethod::firstOrCreate(['nama' => $nama], ['is_active' => true]);
        }
    }
}