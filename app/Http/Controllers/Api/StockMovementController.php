<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use App\Notifications\StockApprovalNotification;
use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Inventory;
use App\Models\StockMovement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Notification;
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

        if (! $isAdmin) {
            $admins = User::where('outlet_id', $user->outlet_id)
                ->whereHas('role', function ($q) {
                    $q->where('nama_peran', 'Admin');
                })->get();

            // Menggunakan $user->name dan $product->nama
            Notification::send($admins, new StockApprovalNotification($user->nama, $product->nama, 'Penyesuaian Manual', $movement->id));
        }

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

        \Illuminate\Support\Facades\DB::table('notifications')
            ->where('data->tipe', 'stok_approval')
            ->where('data->reference_id', $movement->id)
            ->update(['read_at' => now()]);

        // Khusus untuk Stock Opname massal: Hapus lonceng HANYA jika semua item sudah disetujui
        if ($movement->source_type === 'stock_opname' && $movement->source_id) {
            $pendingCount = \App\Models\StockMovement::where('source_id', $movement->source_id)
                ->where('status', 'pending')
                ->count();
                
            if ($pendingCount === 0) {
                \Illuminate\Support\Facades\DB::table('notifications')
                    ->where('data->tipe', 'stok_approval')
                    ->where('data->reference_id', $movement->source_id)
                    ->update(['read_at' => now()]);
            }
        }

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

        \Illuminate\Support\Facades\DB::table('notifications')
            ->where('data->tipe', 'stok_approval')
            ->where('data->reference_id', $movement->id)
            ->update(['read_at' => now()]);

        // Khusus untuk Stock Opname massal: Hapus lonceng HANYA jika semua item sudah disetujui
        if ($movement->source_type === 'stock_opname' && $movement->source_id) {
            $pendingCount = \App\Models\StockMovement::where('source_id', $movement->source_id)
                ->where('status', 'pending')
                ->count();
                
            if ($pendingCount === 0) {
                \Illuminate\Support\Facades\DB::table('notifications')
                    ->where('data->tipe', 'stok_approval')
                    ->where('data->reference_id', $movement->source_id)
                    ->update(['read_at' => now()]);
            }
        }

        return response()->json(['message' => 'Pengajuan penyesuaian ditolak']);
    }

    // Sesi penghitungan inventaris (stock opname) — POSFR-15.
    // Operator memasukkan hasil hitung fisik untuk banyak produk sekaligus dalam 1 sesi;
    // hanya produk yang selisih dari hasil hitungnya != 0 yang menghasilkan movement.
    // Produk dengan selisih 0 dianggap "sudah sesuai" dan tidak menghasilkan record apa pun.
    public function opname(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'catatan_sesi' => 'required|string',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|uuid|exists:products,id',
            'items.*.stok_fisik' => 'required|integer|min:0',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'Validasi gagal', 'errors' => $validator->errors()], 422);
        }

        $isAdmin = $user->role && $user->role->nama_peran === 'Admin';
        $sessionId = (string) Str::uuid();

        $hasilPenyesuaian = [];
        $jumlahSesuai = 0;

        DB::transaction(function () use ($request, $user, $isAdmin, $sessionId, &$hasilPenyesuaian, &$jumlahSesuai) {
            foreach ($request->items as $item) {
                $inventory = Inventory::where('product_id', $item['product_id'])
                    ->where('outlet_id', $user->outlet_id)
                    ->lockForUpdate()
                    ->first();

                if (! $inventory) {
                    continue; // produk belum punya catatan stok di outlet ini, lewati
                }

                $selisih = $item['stok_fisik'] - $inventory->stok_saat_ini;

                if ($selisih === 0) {
                    $jumlahSesuai++;
                    continue;
                }

                $movement = StockMovement::create([
                    'product_id' => $item['product_id'],
                    'outlet_id' => $user->outlet_id,
                    'user_id' => $user->id,
                    'approved_by_user_id' => $isAdmin ? $user->id : null,
                    'jenis_pergerakan' => 'penyesuaian',
                    'jumlah' => $selisih,
                    'source_type' => 'stock_opname',
                    'source_id' => $sessionId,
                    'status' => $isAdmin ? 'applied' : 'pending',
                    'alasan' => "Stock opname: {$request->catatan_sesi}",
                    'timestamp' => now(),
                ]);

                if ($isAdmin) {
                    $inventory->update(['stok_saat_ini' => $item['stok_fisik']]);
                }

                $hasilPenyesuaian[] = $movement;
            }
        });

        AuditLogger::log(
            $request,
            'stock_opname',
            'stock_movements',
            $sessionId,
            'success',
            null,
            ['catatan_sesi' => $request->catatan_sesi, 'jumlah_disesuaikan' => count($hasilPenyesuaian), 'jumlah_sesuai' => $jumlahSesuai, 'status' => $isAdmin ? 'applied' : 'pending']
        );

        if (! $isAdmin && count($hasilPenyesuaian) > 0) {
            $admins = User::where('outlet_id', $user->outlet_id)
                ->whereHas('role', function ($q) {
                    $q->where('nama_peran', 'Admin');
                })->get();

            Notification::send($admins, new StockApprovalNotification($user->nama, count($hasilPenyesuaian) . ' Item Produk', 'Stock Opname', $sessionId));
        }

        return response()->json([
            'message' => $isAdmin
                ? 'Sesi stock opname selesai, semua penyesuaian langsung diterapkan'
                : 'Sesi stock opname dikirim, menunggu persetujuan Admin untuk item yang selisih',
            'session_id' => $sessionId,
            'jumlah_disesuaikan' => count($hasilPenyesuaian),
            'jumlah_sesuai' => $jumlahSesuai,
            'movements' => $hasilPenyesuaian,
        ], 201);
    }
}