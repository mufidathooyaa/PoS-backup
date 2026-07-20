<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RoleSeeder::class,
            PermissionSeeder::class,
            RolePermissionSeeder::class,
            OutletSeeder::class,
            CategorySeeder::class,
            TaxRuleSeeder::class,
            DiscountRuleSeeder::class,
            PaymentMethodSeeder::class,
            AdminUserSeeder::class,
            KasirUserSeeder::class,
            ProductSeeder::class,
        ]);
    }
}