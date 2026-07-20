<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\Outlet;
use App\Models\User;
use Illuminate\Database\Seeder;

class KasirUserSeeder extends Seeder
{
    public function run(): void
    {
        $kasirRole = Role::where('nama_peran', 'Kasir')->firstOrFail();
        $operatorRole = Role::where('nama_peran', 'Operator Inventaris')->firstOrFail();
        $outlet = Outlet::firstOrFail();

        User::firstOrCreate(
            ['username' => 'kasirtest'],
            [
                'role_id' => $kasirRole->id,
                'outlet_id' => $outlet->id,
                'nama' => 'Kasir Test',
                'email' => 'kasir@test.com',
                'password_hash' => 'kasir123', // otomatis di-hash oleh cast 'hashed' di model User
                'is_active' => true,
            ]
        );

        User::firstOrCreate(
            ['username' => 'operatortest'],
            [
                'role_id' => $operatorRole->id,
                'outlet_id' => $outlet->id,
                'nama' => 'Operator Inventaris Test',
                'email' => 'operator@test.com',
                'password_hash' => 'operator123',
                'is_active' => true,
            ]
        );
    }
}