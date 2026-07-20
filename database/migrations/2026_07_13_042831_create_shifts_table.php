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
        Schema::create('shifts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            
            $table->foreignUuid('user_id')->constrained('users')->onDelete('restrict');
            $table->foreignUuid('outlet_id')->constrained('outlets')->onDelete('restrict');

            $table->dateTime('waktu_buka');
            $table->dateTime('waktu_tutup')->nullable();

            $table->decimal('kas_awal', 15, 2);
            $table->decimal('kas_diharapkan', 15, 2)->nullable();
            $table->decimal('kas_dihitung', 15, 2)->nullable();
            $table->decimal('selisih', 15, 2)->nullable();

            $table->enum('status', ['OPEN', 'CLOSED'])->default('OPEN');
            $table->text('catatan_penutup')->nullable();
            $table->text('catatan_admin')->nullable();
            $table->foreignUuid('approved_by_user_id')->nullable()->constrained('users')->onDelete('restrict');

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('shifts');
    }
};
