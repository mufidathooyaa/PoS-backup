<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;

class RoleController extends Controller
{
    public function index()
    {
        return response()->json(['roles' => Role::orderBy('nama_peran')->get(['id', 'nama_peran'])]);
    }
}