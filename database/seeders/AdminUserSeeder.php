<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\Outlet;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $adminRole = Role::where('nama_peran', 'Admin')->firstOrFail();
        $outlet = Outlet::firstOrFail();

        User::firstOrCreate(
            ['username' => 'admin'],
            [
                'role_id' => $adminRole->id,
                'outlet_id' => $outlet->id,
                'nama' => 'Administrator',
                'email' => 'admin@posdb.test',
                'password_hash' => Hash::make('admin123'), // ganti setelah seed pertama
                'is_active' => true,
            ]
        );
    }
}