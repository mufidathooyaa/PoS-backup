<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;

class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            'approve_refund',
            'approve_void',
            'override_price',
            'close_shift_with_variance',
            'manage_products',
            'manage_users',
            'manage_outlets',
            'adjust_stock',
            'view_reports',
            'view_audit_logs',
            'approve_stock_adjustment',
            'review_shift_variance',
        ];

        foreach ($permissions as $nama) {
            Permission::firstOrCreate(['nama_izin' => $nama]);
        }
    }
}