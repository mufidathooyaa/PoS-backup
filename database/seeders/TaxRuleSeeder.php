<?php

namespace Database\Seeders;

use App\Models\TaxRule;
use Illuminate\Database\Seeder;

class TaxRuleSeeder extends Seeder
{
    public function run(): void
    {
        TaxRule::firstOrCreate(
            ['nama' => 'PPN 11%'],
            ['persentase' => 11.00, 'is_active' => true]
        );
    }
}