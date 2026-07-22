<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ShiftController;
use App\Http\Controllers\Api\TransactionController;
use App\Http\Controllers\Api\TransactionActionController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\PaymentMethodController;
use App\Http\Controllers\Api\TaxRuleController;
use App\Http\Controllers\Api\StockMovementController;
use App\Http\Controllers\Api\DiscountRuleController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\OutletController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:6,1');

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/me/change-password', [AuthController::class, 'changePassword']);
    Route::post('/price-overrides/authorize', [AuthController::class, 'authorizePriceOverride'])->middleware('throttle:6,1');

    // ==========================================
    // Katalog (semua role yang login)
    // ==========================================
    Route::get('/catalog', [ProductController::class, 'catalog']);

    // ==========================================
    // Shift
    // ==========================================
    Route::post('/shifts/open', [ShiftController::class, 'open']);
    Route::get('/shifts/current', [ShiftController::class, 'current']);
    Route::get('/shifts', [ShiftController::class, 'index']);
    
    Route::middleware('permission:review_shift_variance')->group(function () {
        Route::get('/shifts/pending-review', [ShiftController::class, 'pendingReview']);
        Route::post('/shifts/{id}/review', [ShiftController::class, 'review']);
    });
    
    Route::post('/shifts/{id}/close', [ShiftController::class, 'close']);

    // ==========================================
    // Transaksi — route SPESIFIK dulu, baru wildcard {id}
    // ==========================================
    Route::post('/transactions/hold', [TransactionController::class, 'hold']);
    Route::get('/transactions/held', [TransactionController::class, 'held']);
    Route::post('/transactions/{id}/cancel-hold', [TransactionActionController::class, 'cancelHold']);
    Route::post('/transactions', [TransactionController::class, 'store']);
    Route::get('/transactions/summary', [TransactionController::class, 'summary']);
    Route::get('/transactions', [TransactionController::class, 'index']);
    Route::get('/transactions/{id}', [TransactionController::class, 'show']);

    Route::post('/transactions/{id}/resume', [TransactionActionController::class, 'resume']);

    Route::middleware('permission:approve_void')
        ->post('/transactions/{id}/void', [TransactionActionController::class, 'void']);

    Route::middleware('permission:approve_refund')
        ->post('/transactions/{id}/refund', [TransactionActionController::class, 'refund']);

    Route::get('/payment-methods', [PaymentMethodController::class, 'index']);
    Route::get('/tax-rules/active', [TaxRuleController::class, 'active']);
    Route::get('/discount-rules/active', [DiscountRuleController::class, 'active']);

    // ==========================================
    // Produk & Kategori (Admin)
    // ==========================================
    Route::middleware('permission:manage_products')->group(function () {
        Route::get('/categories', [CategoryController::class, 'index']);
        Route::post('/categories', [CategoryController::class, 'store']);
        Route::put('/categories/{id}', [CategoryController::class, 'update']);
        Route::post('/categories/{id}/toggle-active', [CategoryController::class, 'toggleActive']);

        Route::get('/products', [ProductController::class, 'index']);
        Route::get('/products/{id}', [ProductController::class, 'show']);
        Route::post('/products', [ProductController::class, 'store']);
        Route::put('/products/{id}', [ProductController::class, 'update']);
        Route::post('/products/{id}/archive', [ProductController::class, 'archive']);
        Route::post('/products/{id}/reactivate', [ProductController::class, 'reactivate']);
        Route::post('/products/{id}/initial-stock', [ProductController::class, 'setInitialStock']);
    });

    Route::middleware('permission:adjust_stock')->group(function () {
        Route::get('/stock-movements', [StockMovementController::class, 'index']);
        Route::post('/products/{id}/stock-receipt', [StockMovementController::class, 'receipt']);
        Route::post('/products/{id}/stock-adjustment', [StockMovementController::class, 'adjustment']);
    });

    Route::middleware('permission:approve_stock_adjustment')->group(function () {
        Route::get('/stock-adjustments/pending', [StockMovementController::class, 'pendingAdjustments']);
        Route::post('/stock-movements/{id}/approve', [StockMovementController::class, 'approveAdjustment']);
        Route::post('/stock-movements/{id}/reject', [StockMovementController::class, 'rejectAdjustment']);
    });

    // ==========================================
    // Laporan & Audit
    // ==========================================
    Route::middleware('permission:view_reports')->group(function () {
        Route::get('/reports/daily', [ReportController::class, 'daily']);
        Route::get('/reports/daily/export', [ReportController::class, 'dailyExport']);
    });

    Route::middleware('permission:view_audit_logs')
        ->get('/audit-logs', [AuditLogController::class, 'index']);
    
    Route::middleware('permission:manage_outlets')->group(function () {
        Route::get('/outlets', [OutletController::class, 'index']);
        Route::post('/outlets', [OutletController::class, 'store']);
        Route::put('/outlets/{id}', [OutletController::class, 'update']);
        Route::post('/outlets/{id}/toggle-active', [OutletController::class, 'toggleActive']);
    });

    Route::middleware('permission:manage_users')->group(function () {
        Route::get('/roles', [RoleController::class, 'index']);
        Route::get('/users', [UserController::class, 'index']);
        Route::post('/users', [UserController::class, 'store']);
        Route::put('/users/{id}', [UserController::class, 'update']);
        Route::post('/users/{id}/toggle-active', [UserController::class, 'toggleActive']);
    });
});