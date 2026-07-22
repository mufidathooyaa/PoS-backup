<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class ObservabilityController extends Controller
{
    public function summary(Request $request)
    {
        $minutes = (int) $request->input('minutes', 60);
        $cutoff = now()->subMinutes($minutes);

        $path = storage_path('logs/api.log');
        if (! file_exists($path)) {
            return response()->json([
                'total_requests' => 0, 'error_count' => 0, 'error_rate' => 0,
                'avg_latency_ms' => 0, 'p95_latency_ms' => 0,
                'requests_per_endpoint' => [], 'recent_errors' => [],
            ]);
        }

        // Baca maksimal 5000 baris terakhir saja, supaya tidak berat kalau file sudah besar
        $lines = $this->tailLines($path, 5000);

        $entries = [];
        foreach ($lines as $line) {
            // Format: [2026-07-22 14:53:43] local.INFO: api_request {...json...}
            if (! preg_match('/^\[(.*?)\].*api_request\s+(\{.*\})\s*$/', $line, $matches)) {
                continue;
            }

            $timestamp = \Carbon\Carbon::parse($matches[1]);
            if ($timestamp->lt($cutoff)) {
                continue;
            }

            $data = json_decode($matches[2], true);
            if (! $data) {
                continue;
            }

            $data['timestamp'] = $timestamp->toIso8601String();
            $entries[] = $data;
        }

        $total = count($entries);
        $errors = array_filter($entries, fn ($e) => $e['status'] >= 400);
        $errorCount = count($errors);

        $latencies = array_column($entries, 'duration_ms');
        sort($latencies);
        $avgLatency = $total > 0 ? round(array_sum($latencies) / $total, 2) : 0;
        $p95Index = $total > 0 ? (int) floor($total * 0.95) : 0;
        $p95Latency = $total > 0 ? ($latencies[min($p95Index, $total - 1)] ?? 0) : 0;

        $perEndpoint = [];
        foreach ($entries as $e) {
            $key = "{$e['method']} /{$e['path']}";
            $perEndpoint[$key] = ($perEndpoint[$key] ?? 0) + 1;
        }
        arsort($perEndpoint);

        $recentErrors = array_slice(array_reverse(array_values($errors)), 0, 10);

        return response()->json([
            'periode_menit' => $minutes,
            'total_requests' => $total,
            'error_count' => $errorCount,
            'error_rate' => $total > 0 ? round(($errorCount / $total) * 100, 2) : 0,
            'avg_latency_ms' => $avgLatency,
            'p95_latency_ms' => $p95Latency,
            'requests_per_endpoint' => array_slice($perEndpoint, 0, 10, true),
            'recent_errors' => $recentErrors,
        ]);
    }

    private function tailLines(string $path, int $maxLines): array
    {
        $lines = file($path, FILE_IGNORE_NEW_LINES);
        return array_slice($lines, -$maxLines);
    }
}