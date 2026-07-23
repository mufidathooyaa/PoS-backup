<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Inventory;
use App\Models\StockMovement;
use App\Services\AuditLogger;
use App\Services\OutletContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $query = Product::with('category');

        // Default: hanya tampilkan produk aktif, kecuali diminta eksplisit semua
        if (! $request->boolean('include_inactive')) {
            $query->where('is_active', true);
        }

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('nama', 'like', "%{$search}%")
                    ->orWhere('sku', 'like', "%{$search}%")
                    ->orWhere('barcode', $search); // barcode biasanya dicari persis, bukan partial
            });
        }

        return response()->json(['products' => $query->orderBy('nama')->get()]);
    }

    public function show(string $id)
    {
        $product = Product::with('category')->find($id);
        if (! $product) {
            return response()->json(['message' => 'Produk tidak ditemukan'], 404);
        }

        return response()->json(['product' => $product]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'category_id' => 'required|integer|exists:categories,id',
            'sku' => 'required|string|max:255|unique:products,sku',
            'barcode' => 'nullable|string|max:255',
            'nama' => 'required|string|max:255',
            'image_url' => 'nullable|string|max:255',
            'unit' => 'required|string|max:50',
            'harga' => 'required|numeric|min:0',
            'track_stock' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validasi gagal', 'errors' => $validator->errors()], 422);
        }

        // Cek barcode bentrok HANYA dengan produk yang masih aktif (sesuai desain reuse barcode)
        if ($request->filled('barcode')) {
            $conflict = Product::where('barcode', $request->barcode)
                ->where('is_active', true)
                ->exists();
            if ($conflict) {
                return response()->json(['message' => 'Barcode ini sudah digunakan produk aktif lain'], 422);
            }
        }

        $product = Product::create($request->only([
            'category_id', 'sku', 'barcode', 'nama', 'image_url', 'unit', 'harga', 'track_stock',
        ]));

        return response()->json(['message' => 'Produk berhasil dibuat', 'product' => $product], 201);
    }

    public function update(Request $request, string $id)
    {
        $product = Product::find($id);
        if (! $product) {
            return response()->json(['message' => 'Produk tidak ditemukan'], 404);
        }

        $validator = Validator::make($request->all(), [
            'category_id' => 'sometimes|integer|exists:categories,id',
            'sku' => 'sometimes|string|max:255|unique:products,sku,' . $id,
            'barcode' => 'nullable|string|max:255',
            'nama' => 'sometimes|string|max:255',
            'image_url' => 'nullable|string|max:255',
            'unit' => 'sometimes|string|max:50',
            'harga' => 'sometimes|numeric|min:0',
            'track_stock' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validasi gagal', 'errors' => $validator->errors()], 422);
        }

        if ($request->filled('barcode') && $request->barcode !== $product->barcode) {
            $conflict = Product::where('barcode', $request->barcode)
                ->where('is_active', true)
                ->where('id', '!=', $product->id)
                ->exists();
            if ($conflict) {
                return response()->json(['message' => 'Barcode ini sudah digunakan produk aktif lain'], 422);
            }
        }

        $product->update($request->only([
            'category_id', 'sku', 'barcode', 'nama', 'image_url', 'unit', 'harga', 'track_stock',
        ]));

        return response()->json(['message' => 'Produk berhasil diperbarui', 'product' => $product]);
    }

    // "Hapus" = arsipkan, BUKAN delete permanen (sesuai POSFR-02)
    public function archive(Request $request, string $id)
    {
        $product = Product::find($id);
        if (! $product) {
            return response()->json(['message' => 'Produk tidak ditemukan'], 404);
        }

        if (! $product->is_active) {
            return response()->json(['message' => 'Produk sudah diarsipkan sebelumnya'], 422);
        }

        $product->update(['is_active' => false]);

        AuditLogger::log(
            $request,
            'archive_product',
            'products',
            $product->id,
            'success',
            ['is_active' => true],
            ['is_active' => false]
        );

        return response()->json(['message' => 'Produk berhasil diarsipkan', 'product' => $product->fresh()]);
    }

    public function reactivate(Request $request, string $id)
    {
        $product = Product::find($id);
        if (! $product) {
            return response()->json(['message' => 'Produk tidak ditemukan'], 404);
        }

        // Cek dulu apakah barcode-nya sekarang bentrok dengan produk aktif lain
        if ($product->barcode) {
            $conflict = Product::where('barcode', $product->barcode)
                ->where('is_active', true)
                ->where('id', '!=', $product->id)
                ->exists();
            if ($conflict) {
                return response()->json([
                    'message' => 'Tidak bisa diaktifkan kembali: barcode sudah dipakai produk aktif lain',
                ], 422);
            }
        }

        $product->update(['is_active' => true]);

        AuditLogger::log(
            $request,
            'reactivate_product',
            'products',
            $product->id,
            'success',
            ['is_active' => false],
            ['is_active' => true]
        );

        return response()->json(['message' => 'Produk berhasil diaktifkan kembali', 'product' => $product->fresh()]);
    }

    // Set/tambah stok awal untuk produk di outlet tertentu
    public function setInitialStock(Request $request, string $id)
    {
        $user = $request->user();
        $product = Product::find($id);
        if (! $product) {
            return response()->json(['message' => 'Produk tidak ditemukan'], 404);
        }

        $validator = Validator::make($request->all(), [
            'jumlah' => 'required|integer|min:0',
            'stok_minimum' => 'nullable|integer|min:0',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'Validasi gagal', 'errors' => $validator->errors()], 422);
        }

        $existing = Inventory::where('product_id', $product->id)
            ->where('outlet_id', $user->outlet_id)
            ->first();

        if ($existing) {
            return response()->json([
                'message' => 'Stok untuk produk ini di outlet Anda sudah pernah diatur. Gunakan endpoint penyesuaian stok, bukan set ulang.',
            ], 422);
        }

        DB::transaction(function () use ($product, $user, $request) {
            Inventory::create([
                'product_id' => $product->id,
                'outlet_id' => $user->outlet_id,
                'stok_saat_ini' => $request->jumlah,
                'stok_minimum' => $request->stok_minimum ?? 0,
            ]);

            StockMovement::create([
                'product_id' => $product->id,
                'outlet_id' => $user->outlet_id,
                'user_id' => $user->id,
                'jenis_pergerakan' => 'saldo_awal',
                'jumlah' => $request->jumlah,
                'source_type' => 'manual',
                'source_id' => null,
                'alasan' => 'Stok awal produk baru',
                'timestamp' => now(),
            ]);
        });

        return response()->json(['message' => 'Stok awal berhasil diatur'], 201);
    }

    // Ubah ambang stok rendah untuk produk ini di outlet user yang login.
    // Dibatasi permission manage_products di route — sesuai AC POSFR-11 "perubahan ambang dibatasi berdasarkan peran".
    public function updateStockMinimum(Request $request, string $id)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'stok_minimum' => 'required|integer|min:0',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'Validasi gagal', 'errors' => $validator->errors()], 422);
        }

        $inventory = Inventory::where('product_id', $id)->where('outlet_id', $user->outlet_id)->first();
        if (! $inventory) {
            return response()->json(['message' => 'Stok produk ini belum diatur di outlet Anda. Atur stok awal terlebih dahulu.'], 422);
        }

        $ambangLama = $inventory->stok_minimum;
        $inventory->update(['stok_minimum' => $request->stok_minimum]);

        AuditLogger::log($request, 'update_stock_minimum', 'products', $id, 'success', ['stok_minimum' => $ambangLama], ['stok_minimum' => $request->stok_minimum]);

        return response()->json(['message' => 'Ambang stok rendah diperbarui', 'inventory' => $inventory]);
    }

    // Daftar produk yang stoknya di bawah/sama dengan ambang minimum (POSFR-11)
    public function lowStock(Request $request)
    {
        $outletId = OutletContext::resolve($request);

        $rows = Inventory::with('product.category')
            ->where('outlet_id', $outletId)
            ->where('stok_minimum', '>', 0)
            ->whereColumn('stok_saat_ini', '<=', 'stok_minimum')
            ->whereHas('product', fn ($q) => $q->where('is_active', true)->where('track_stock', true))
            ->get()
            ->map(fn ($inv) => [
                'product_id' => $inv->product->id,
                'sku' => $inv->product->sku,
                'nama' => $inv->product->nama,
                'kategori' => $inv->product->category?->nama,
                'stok_saat_ini' => $inv->stok_saat_ini,
                'stok_minimum' => $inv->stok_minimum,
            ]);

        return response()->json(['produk' => $rows]);
    }

    // Ekspor CSV daftar stok rendah (AC POSFR-11: "dapat diekspor")
    public function lowStockExport(Request $request)
    {
        $outletId = OutletContext::resolve($request);

        $rows = Inventory::with('product.category')
            ->where('outlet_id', $outletId)
            ->where('stok_minimum', '>', 0)
            ->whereColumn('stok_saat_ini', '<=', 'stok_minimum')
            ->whereHas('product', fn ($q) => $q->where('is_active', true)->where('track_stock', true))
            ->get();

        $callback = function () use ($rows) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['SKU', 'Nama Produk', 'Kategori', 'Stok Saat Ini', 'Stok Minimum']);
            foreach ($rows as $inv) {
                fputcsv($out, [
                    $inv->product->sku,
                    $inv->product->nama,
                    $inv->product->category?->nama,
                    $inv->stok_saat_ini,
                    $inv->stok_minimum,
                ]);
            }
            fclose($out);
        };

        return response()->stream($callback, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="stok-rendah-' . now()->format('Y-m-d') . '.csv"',
        ]);
    }

    // Endpoint katalog untuk kasir — hanya produk aktif + stok di outlet kasir sendiri
    public function catalog(Request $request)
    {
        $outletId = \App\Services\OutletContext::resolve($request);

        $query = Product::with('category')
            ->where('is_active', true);

        if ($request->boolean('for_checkout')) {
            $query->whereHas('inventories', function ($q) use ($outletId) {
                $q->where('outlet_id', $outletId);
            });
        }

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->category_id);
        }
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('nama', 'like', "%{$search}%")
                    ->orWhere('sku', 'like', "%{$search}%")
                    ->orWhere('barcode', $search);
            });
        }

        $products = $query->orderBy('nama')->get();

        // Gabungkan info stok sesuai outlet yang di-resolve (bisa outlet lain kalau Admin sedang switch)
        $inventories = Inventory::where('outlet_id', $outletId)
            ->whereIn('product_id', $products->pluck('id'))
            ->get()
            ->keyBy('product_id');

        $result = $products->map(function ($product) use ($inventories) {
            $inventory = $inventories->get($product->id);
            return [
                'id' => $product->id,
                'sku' => $product->sku,
                'barcode' => $product->barcode,
                'nama' => $product->nama,
                'unit' => $product->unit,
                'harga' => $product->harga,
                'image_url' => $product->image_url,
                'category' => $product->category?->nama,
                'track_stock' => $product->track_stock,
                'stok_tersedia' => $product->track_stock ? ($inventory?->stok_saat_ini ?? 0) : null,
                'stok_minimum' => $product->track_stock ? ($inventory?->stok_minimum ?? 0) : null,
            ];
        });

        return response()->json(['products' => $result]);
    }
}