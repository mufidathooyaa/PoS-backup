<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\DB;

class HealthController extends Controller
{
    public function check()
    {
        $checks = [];
        $overallStatus = 'ok';

        // Cek koneksi database
        $dbStart = microtime(true);
        try {
            DB::select('SELECT 1');
            $checks['database'] = [
                'status' => 'ok',
                'latency_ms' => round((microtime(true) - $dbStart) * 1000, 2),
            ];
        } catch (\Exception $e) {
            $checks['database'] = ['status' => 'down', 'error' => 'Tidak dapat terhubung ke database'];
            $overallStatus = 'degraded';
        }

        return response()->json([
            'status' => $overallStatus,
            'timestamp' => now()->toIso8601String(),
            'checks' => $checks,
        ], $overallStatus === 'ok' ? 200 : 503);
    }
}