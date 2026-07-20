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
        Schema::create('products', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->foreignId('category_id')->constrained('categories')->onDelete('cascade');

            $table->string('sku');

            $table->string('barcode')->nullable();
            $table->string('nama');
            $table->string('image_url')->nullable();
            $table->string('unit');
            $table->decimal('harga', 15, 2);
            $table->boolean('is_active')->default(true);
            $table->boolean('track_stock')->default(true);

            $table->string('active_barcode')->nullable()->unique();

            $table->timestamps();

            $table->unique('sku');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
