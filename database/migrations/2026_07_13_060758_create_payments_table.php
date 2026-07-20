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
        Schema::create('payments', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->foreignUuid('transaction_id')->constrained('transactions')->onDelete('restrict');

            $table->foreignId('payment_method_id')->constrained('payment_methods')->onDelete('restrict');

            $table->decimal('jumlah_dibayar', 15, 2);
            $table->decimal('kembalian', 15, 2)->default(0);

            $table->string('referensi')->nullable();

            $table->enum('status',['pending','completed','failed','refunded'])->default('completed');
            
            $table->timestamps();

            $table->index('payment_method_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
