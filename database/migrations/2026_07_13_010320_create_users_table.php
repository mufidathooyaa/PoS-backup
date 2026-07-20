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
        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->foreignId('role_id')->constrained('roles')->onDelete('cascade');
            $table->foreignUuId('outlet_id')->constrained('outlets')->onDelete('cascade');

            $table->string('nama');
            $table->string('email')->unique();
            $table->string('username')->unique();
            $table->string('password_hash');
            $table->boolean('is_active')->default(true);

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
