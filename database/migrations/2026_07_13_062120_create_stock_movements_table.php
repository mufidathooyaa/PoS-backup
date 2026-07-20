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
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->foreignUuid('product_id')->constrained('products')->onDelete('restrict');
            $table->foreignUuid('outlet_id')->constrained('outlets')->onDelete('restrict');

            $table->foreignUuid('user_id')->constrained('users')->onDelete('restrict');
            $table->foreignUuid('approved_by_user_id')->nullable()->constrained('users')->onDelete('restrict');

            $table->enum('jenis_pergerakan',
            [
                'penjualan', 'retur', 
                'penyesuaian', 'penerimaan',
                'saldo_awal'
            ]);

            $table->integer('jumlah');

            $table->string('source_type');
            $table->uuid('source_id')->nullable();
            $table->enum('status', ['applied', 'pending', 'rejected'])->default('applied');

            $table->text('alasan')->nullable();

            $table->timestamp('timestamp')->useCurrent();
            $table->timestamps();

            $table->unique(
                [
                    'product_id', 'source_type', 'source_id',
                    'jenis_pergerakan'
                ],
                'stock_movements_idompetency_unique'
            );

            $table->index(['outlet_id', 'product_id', 'timestamp']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
    }
};
