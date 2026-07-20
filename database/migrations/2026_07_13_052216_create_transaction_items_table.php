<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('transaction_items', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->foreignUuid('transaction_id')->constrained('transactions')->onDelete('cascade');
            
            $table->foreignUuid('product_id')->nullable()->constrained('products')->onDelete('restrict');

            $table->foreignUuid('original_item_id')->nullable()->constrained('transaction_items')->onDelete('restrict');
            
            $table->foreignId('tax_rule_id')->nullable()->constrained('tax_rules')->onDelete('restrict');
            $table->foreignId('discount_rule_id')->nullable()->constrained('discount_rules')->onDelete('restrict');

            $table->string('snapshot_nama_produk');
            $table->decimal('snapshot_persentase_pajak', 5, 2)->nullable();
            $table->decimal('snapshot_nilai_diskon', 15, 2)->nullable();
            
            $table->integer('jumlah');
            $table->decimal('harga_satuan', 15, 2);
            $table->decimal('diskon', 15, 2)->default(0);
            $table->decimal('pajak', 15,2)->default(0);
            $table->decimal('total_baris', 15, 2);

            $table->string('alasan_override')->nullable();
            $table->foreignUuid('override_approved_by_user_id')->nullable()->constrained('users')->onDelete('restrict');

            $table->timestamps();
        });

        DB::statement(
            'ALTER TABLE transaction_items ADD CONSTRAINT chk_jumlah_positif CHECK (jumlah > 0)'
        );
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transaction_items');
    }
};
