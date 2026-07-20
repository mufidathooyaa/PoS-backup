<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DiscountRule;

class DiscountRuleController extends Controller
{
    public function active()
    {
        return response()->json([
            'discount_rules' => DiscountRule::where('is_active', true)->orderBy('nama')->get(['id', 'nama', 'tipe', 'nilai']),
        ]);
    }
}