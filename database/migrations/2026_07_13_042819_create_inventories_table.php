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
        Schema::create('inventories', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->foreignUuid('product_id')->constrained('products')->onDelete('cascade');
            $table->foreignUuid('outlet_id')->constrained('outlets')->onDelete('cascade');
            
            $table->integer('stok_saat_ini')->default(0);
            $table->integer('stok_minimum')->default(0);

            $table->timestamp('last_updated')->useCurrent()->useCurrentOnUpdate();
        
            $table->timestamps();

            $table->unique(['product_id', 'outlet_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('inventories');
    }
};
