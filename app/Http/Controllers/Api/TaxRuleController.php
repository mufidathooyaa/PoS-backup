<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TaxRule;

class TaxRuleController extends Controller
{
    public function active()
    {
        // Ambil satu tax rule aktif pertama — asumsi hanya ada satu tarif pajak berlaku sekaligus
        $taxRule = TaxRule::where('is_active', true)->first();

        return response()->json(['tax_rule' => $taxRule]);
    }
}