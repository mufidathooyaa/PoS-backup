<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->string('refund_reason')->nullable()->after('void_approved_by_user_id');
            $table->foreignUuid('refund_approved_by_user_id')
                ->nullable()
                ->after('refund_reason')
                ->constrained('users')
                ->onDelete('restrict');
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropForeign(['refund_approved_by_user_id']);
            $table->dropColumn(['refund_reason', 'refund_approved_by_user_id']);
        });
    }
};