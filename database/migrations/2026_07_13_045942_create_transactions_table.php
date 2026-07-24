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
        Schema::create('transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('nomor_transaksi')->unique();

            $table->foreignUuid('original_transaction_id')->nullable()->constrained('transactions')->onDelete('restrict');

            $table->foreignUuid('outlet_id')->constrained('outlets')->onDelete('restrict');
            $table->foreignUuid('shift_id')->nullable()->constrained('shifts')->onDelete('restrict');
            $table->foreignUuid('cashier_id')->constrained('users')->onDelete('restrict');

            $table->foreignId('tax_rule_id')->nullable()->constrained('tax_rules')->onDelete('restrict');
            $table->foreignId('discount_rule_id')->nullable()->constrained('discount_rules')->onDelete('restrict');

            $table->decimal('snapshot_persentase_pajak', 5, 2)->nullable();
            $table->decimal('snapshot_nilai_diskon', 15, 2)->nullable();

            $table->enum('status', ['pending','hold','completed','void','refunded'])->default('pending');

            $table->decimal('subtotal',15,2)->default(0);
            $table->decimal('total_pajak',15,2)->default(0);
            $table->decimal('total_diskon',15,2)->default(0);
            $table->decimal('pembulatan',15,2)->default(0);
            $table->decimal('grand_total',15,2)->default(0);

            $table->text('void_reason')->nullable();
            $table->foreignUuid('void_approved_by_user_id')->nullable()->constrained('users')->onDelete('restrict');
            

            $table->string('idempotency_key')->unique();
            $table->string('local_transaction_id')->nullable();
            $table->enum('sync_status',['pending','synced'])->default('pending');
            $table->timestamp('created_at_local')->nullable();
            
            $table->timestamp('timestamp')->useCurrent();
            $table->timestamps();

            $table->index(['outlet_id', 'timestamp']);
            $table->index('shift_id');

            $table->unique(['outlet_id','local_transaction_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};
