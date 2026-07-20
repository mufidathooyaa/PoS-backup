<?php

namespace Database\Seeders;

use App\Models\DiscountRule;
use Illuminate\Database\Seeder;

class DiscountRuleSeeder extends Seeder
{
    public function run(): void
    {
        DiscountRule::firstOrCreate(
            ['nama' => 'Tanpa Diskon'],
            ['tipe' => 'nominal', 'nilai' => 0, 'is_active' => true]
        );

        DiscountRule::firstOrCreate(
            ['nama' => 'Diskon Member 10%'],
            ['tipe' => 'persentase', 'nilai' => 10, 'is_active' => true]
        );

        DiscountRule::firstOrCreate(
            ['nama' => 'Potongan Rp 5.000'],
            ['tipe' => 'nominal', 'nilai' => 5000, 'is_active' => true]
        );
    }
}