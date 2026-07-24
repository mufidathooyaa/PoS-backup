<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\Role;
use App\Models\Shift;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ShiftAdminAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_cannot_open_shift(): void
    {
        $adminRole = Role::create(['nama_peran' => 'Admin']);
        $outlet = Outlet::create(['nama' => 'Outlet Utama', 'kode' => 'OUTA', 'alamat' => 'Utama']);

        $admin = User::create([
            'nama' => 'Admin Test',
            'email' => 'admin@test.com',
            'username' => 'admintest',
            'password_hash' => 'secret',
            'role_id' => $adminRole->id,
            'outlet_id' => $outlet->id,
            'is_active' => true,
        ]);

        $this->actingAs($admin, 'sanctum');

        $response = $this->postJson('/api/shifts/open', ['kas_awal' => 100]);

        $response->assertStatus(403);
        $response->assertJsonFragment(['message' => 'Admin tidak perlu membuka shift; silakan tinjau penutupan kasir.']);
    }

    public function test_admin_cannot_close_shift(): void
    {
        $adminRole = Role::create(['nama_peran' => 'Admin']);
        $kasirRole = Role::create(['nama_peran' => 'Kasir']);
        $outlet = Outlet::create(['nama' => 'Outlet Cabang', 'kode' => 'OUTB', 'alamat' => 'Cabang']);

        $admin = User::create([
            'nama' => 'Admin Test',
            'email' => 'admin2@test.com',
            'username' => 'admintest2',
            'password_hash' => 'secret',
            'role_id' => $adminRole->id,
            'outlet_id' => $outlet->id,
            'is_active' => true,
        ]);

        $cashier = User::create([
            'nama' => 'Kasir Test',
            'email' => 'kasir@test.com',
            'username' => 'kasirtest',
            'password_hash' => 'secret',
            'role_id' => $kasirRole->id,
            'outlet_id' => $outlet->id,
            'is_active' => true,
        ]);

        $shift = Shift::create([
            'user_id' => $cashier->id,
            'outlet_id' => $outlet->id,
            'waktu_buka' => now(),
            'kas_awal' => 100,
            'status' => 'OPEN',
        ]);

        $this->actingAs($admin, 'sanctum');

        $response = $this->postJson('/api/shifts/' . $shift->id . '/close', [
            'kas_dihitung' => 100,
            'catatan_penutup' => null,
        ]);

        $response->assertStatus(403);
        $response->assertJsonFragment(['message' => 'Admin tidak perlu menutup shift; silakan tinjau penutupan kasir.']);
    }
}
