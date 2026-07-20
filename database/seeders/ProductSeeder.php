<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use App\Models\Inventory;
use App\Models\Outlet;
use Illuminate\Database\Seeder;

class ProductSeeder extends Seeder
{
    public function run(): void
    {
        $makanan = Category::where('nama', 'Makanan')->firstOrFail();
        $minuman = Category::where('nama', 'Minuman')->firstOrFail();
        $outlet = Outlet::firstOrFail();

        $products = [
            [
                'category_id' => $makanan->id,
                'sku' => 'MK-001',
                'barcode' => null,
                'nama' => 'Nasi Ayam',
                'unit' => 'porsi',
                'harga' => 20000,
                'stok_awal' => 100,
            ],
            [
                'category_id' => $minuman->id,
                'sku' => 'MN-001',
                'barcode' => '899123456789',
                'nama' => 'Le Minerale 600ml',
                'unit' => 'botol',
                'harga' => 5000,
                'stok_awal' => 200,
            ],
            [
                'category_id' => $minuman->id,
                'sku' => 'MN-002',
                'barcode' => null,
                'nama' => 'Kopi Susu',
                'unit' => 'cup',
                'harga' => 15000,
                'stok_awal' => 50,
            ],
        ];

        foreach ($products as $data) {
            $stokAwal = $data['stok_awal'];
            unset($data['stok_awal']);

            $product = Product::firstOrCreate(
                ['sku' => $data['sku']],
                $data
            );

            Inventory::firstOrCreate(
                ['product_id' => $product->id, 'outlet_id' => $outlet->id],
                ['stok_saat_ini' => $stokAwal, 'stok_minimum' => 10]
            );
        }
    }
}