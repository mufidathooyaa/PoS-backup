<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Inventory;
use App\Models\StockMovement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use App\Services\AuditLogger;

class StockMovementController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = StockMovement::with('product', 'user', 'approvedBy')
            ->where('outlet_id', \App\Services\OutletContext::resolve($request))
            ->orderByDesc('timestamp');

        if ($request->filled('jenis_pergerakan')) {
            $query->where('jenis_pergerakan', $request->jenis_pergerakan);
        }
        if ($request->filled('product_id')) {
            $query->where('product_id', $request->product_id);
        }
        if ($request->filled('tanggal')) {
            $query->whereDate('timestamp', $request->tanggal);
        }

        return response()->json(['movements' => $query->paginate(50)]);
    }

    public function receipt(Request $request, string $id)
    {
        $user = $request->user();
        $product = Product::find($id);
        if (! $product) {
            return response()->json(['message' => 'Produk tidak ditemukan'], 404);
        }

        $validator = Validator::make($request->all(), [
            'jumlah' => 'required|integer|min:1',
            'sumber' => 'nullable|string|max:255',
            'alasan' => 'nullable|string',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'Validasi gagal', 'errors' => $validator->errors()], 422);
        }

        DB::transaction(function () use ($product, $user, $request) {
            $inventory = Inventory::where('product_id', $product->id)
                ->where('outlet_id', $user->outlet_id)
                ->lockForUpdate()
                ->first();

            if (! $inventory) {
                $inventory = Inventory::create([
                    'product_id' => $product->id,
                    'outlet_id' => $user->outlet_id,
                    'stok_saat_ini' => 0,
                    'stok_minimum' => 0,
                ]);
            }

            StockMovement::create([
                'product_id' => $product->id,
                'outlet_id' => $user->outlet_id,
                'user_id' => $user->id,
                'jenis_pergerakan' => 'penerimaan',
                'jumlah' => $request->jumlah,
                'source_type' => 'manual',
                'source_id' => null,
                'alasan' => trim(($request->sumber ? "Sumber: {$request->sumber}. " : '') . $request->alasan),
                'timestamp' => now(),
            ]);

            $inventory->increment('stok_saat_ini', $request->jumlah);
        });

        AuditLogger::log($request, 'stock_receipt', 'products', $product->id, 'success', null, ['jumlah' => $request->jumlah]);

        return response()->json(['message' => 'Penerimaan stok berhasil dicatat'], 201);
    }

    public function adjustment(Request $request, string $id)
    {
        $user = $request->user();
        $product = Product::find($id);
        if (! $product) {
            return response()->json(['message' => 'Produk tidak ditemukan'], 404);
        }

        $validator = Validator::make($request->all(), [
            'stok_fisik' => 'required|integer|min:0',
            'alasan' => 'required|string',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'Validasi gagal', 'errors' => $validator->errors()], 422);
        }

        $inventory = Inventory::where('product_id', $product->id)
            ->where('outlet_id', $user->outlet_id)
            ->lockForUpdate()
            ->first();

        if (! $inventory) {
            return response()->json(['message' => 'Stok produk ini belum terdaftar di outlet Anda'], 422);
        }

        $selisih = $request->stok_fisik - $inventory->stok_saat_ini;

        if ($selisih === 0) {
            return response()->json(['message' => 'Tidak ada selisih, penyesuaian tidak diperlukan'], 422);
        }

        $isAdmin = $user->role && $user->role->nama_peran === 'Admin';

        $movement = DB::transaction(function () use ($product, $user, $request, $inventory, $selisih, $isAdmin) {
            $movement = StockMovement::create([
                'product_id' => $product->id,
                'outlet_id' => $user->outlet_id,
                'user_id' => $user->id,
                'approved_by_user_id' => $isAdmin ? $user->id : null,
                'jenis_pergerakan' => 'penyesuaian',
                'jumlah' => $selisih,
                'source_type' => 'manual',
                'source_id' => null,
                'status' => $isAdmin ? 'applied' : 'pending',
                'alasan' => $request->alasan,
                'timestamp' => now(),
            ]);

            if ($isAdmin) {
                $inventory->update(['stok_saat_ini' => $request->stok_fisik]);
            }

            return $movement;
        });

        AuditLogger::log(
            $request,
            $isAdmin ? 'stock_adjustment' : 'stock_adjustment_request',
            'products',
            $product->id,
            'success',
            ['stok_lama' => $inventory->stok_saat_ini],
            ['selisih' => $selisih, 'alasan' => $request->alasan, 'status' => $movement->status]
        );

        return response()->json([
            'message' => $isAdmin ? 'Penyesuaian stok berhasil disimpan' : 'Pengajuan penyesuaian dikirim, menunggu persetujuan Admin',
            'movement' => $movement,
        ], 201);
    }

    public function pendingAdjustments(Request $request)
    {
        $user = $request->user();

        $movements = StockMovement::with('product', 'user')
            ->where('outlet_id', $user->outlet_id)
            ->where('jenis_pergerakan', 'penyesuaian')
            ->where('status', 'pending')
            ->orderByDesc('timestamp')
            ->get();

        return response()->json(['pending' => $movements]);
    }

    public function approveAdjustment(Request $request, string $id)
    {
        $user = $request->user();
        $movement = StockMovement::find($id);

        if (! $movement || $movement->jenis_pergerakan !== 'penyesuaian') {
            return response()->json(['message' => 'Pengajuan tidak ditemukan'], 404);
        }
        if ($movement->status !== 'pending') {
            return response()->json(['message' => 'Pengajuan ini sudah diproses sebelumnya'], 422);
        }

        DB::transaction(function () use ($movement, $user) {
            $inventory = Inventory::where('product_id', $movement->product_id)
                ->where('outlet_id', $movement->outlet_id)
                ->lockForUpdate()
                ->first();

            $inventory->increment('stok_saat_ini', $movement->jumlah);

            $movement->update([
                'status' => 'applied',
                'approved_by_user_id' => $user->id,
            ]);
        });

        AuditLogger::log($request, 'approve_stock_adjustment', 'stock_movements', $movement->id, 'success', ['status' => 'pending'], ['status' => 'applied']);

        return response()->json(['message' => 'Penyesuaian stok disetujui dan diterapkan']);
    }

    public function rejectAdjustment(Request $request, string $id)
    {
        $user = $request->user();
        $movement = StockMovement::find($id);

        if (! $movement || $movement->jenis_pergerakan !== 'penyesuaian') {
            return response()->json(['message' => 'Pengajuan tidak ditemukan'], 404);
        }
        if ($movement->status !== 'pending') {
            return response()->json(['message' => 'Pengajuan ini sudah diproses sebelumnya'], 422);
        }

        $movement->update([
            'status' => 'rejected',
            'approved_by_user_id' => $user->id,
        ]);

        AuditLogger::log($request, 'reject_stock_adjustment', 'stock_movements', $movement->id, 'success', ['status' => 'pending'], ['status' => 'rejected']);

        return response()->json(['message' => 'Pengajuan penyesuaian ditolak']);
    }
}