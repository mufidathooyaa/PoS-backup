<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditLogger
{
    public static function log(
        Request $request,
        string $action,
        ?string $tableName = null,
        ?string $recordId = null,
        string $hasil = 'success',
        ?array $oldValues = null,
        ?array $newValues = null,
        ?string $actorId = null,
    ): AuditLog {
        return AuditLog::create([
            'user_id' => $actorId ?? $request->user()?->id,
            'action' => $action,
            'table_name' => $tableName,
            'record_id' => $recordId,
            'hasil' => $hasil,
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'correlation_id' => $request->attributes->get('correlation_id'),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);
    }
}