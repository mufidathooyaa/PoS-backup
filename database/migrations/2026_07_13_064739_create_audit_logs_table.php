<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->foreignUuid('user_id')->nullable()->constrained('users')->onDelete('set null');

            $table->string('action');

            $table->string('table_name')->nullable();
            $table->string('record_id')->nullable();
            
            $table->enum('hasil', ['success', 'failed', 'rejected'])->default('success');

            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();

            $table->string('correlation_id')->nullable();

            $table->string('ip_address')->nullable();
            $table->string('user_agent')->nullable();

            $table->timestamps();

            $table->index(['table_name', 'record_id']);
            $table->index('action');
            $table->index('created_at');
            $table->index('correlation_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
