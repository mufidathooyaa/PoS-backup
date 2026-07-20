<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\Permission;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        $admin = Role::where('nama_peran', 'Admin')->firstOrFail();
        $kasir = Role::where('nama_peran', 'Kasir')->firstOrFail();
        $operator = Role::where('nama_peran', 'Operator Inventaris')->firstOrFail();

        $allPermissions = Permission::pluck('id');
        foreach ($allPermissions as $permId) {
            DB::table('role_permissions')->insertOrIgnore([
                'role_id' => $admin->id,
                'permission_id' => $permId,
            ]);
        }

        $adjustStock = Permission::where('nama_izin', 'adjust_stock')->firstOrFail();
        DB::table('role_permissions')->insertOrIgnore([
            'role_id' => $operator->id,
            'permission_id' => $adjustStock->id,
        ]);
    }
}