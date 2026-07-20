<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CategoryController extends Controller
{
    public function index()
    {
        return response()->json(['categories' => Category::orderBy('nama')->get()]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'nama' => 'required|string|max:255|unique:categories,nama',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validasi gagal', 'errors' => $validator->errors()], 422);
        }

        $category = Category::create(['nama' => $request->nama]);

        return response()->json(['message' => 'Kategori berhasil dibuat', 'category' => $category], 201);
    }

    public function update(Request $request, int $id)
    {
        $category = Category::find($id);
        if (! $category) {
            return response()->json(['message' => 'Kategori tidak ditemukan'], 404);
        }

        $validator = Validator::make($request->all(), [
            'nama' => 'required|string|max:255|unique:categories,nama,' . $id,
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validasi gagal', 'errors' => $validator->errors()], 422);
        }

        $category->update(['nama' => $request->nama]);

        return response()->json(['message' => 'Kategori berhasil diperbarui', 'category' => $category]);
    }

    public function toggleActive(string $id)
    {
        $category = Category::find($id);
        if (! $category) {
            return response()->json(['message' => 'Kategori tidak ditemukan'], 404);
        }

        $category->update(['is_active' => ! $category->is_active]);

        return response()->json([
            'message' => $category->is_active ? 'Kategori diaktifkan' : 'Kategori dinonaktifkan',
            'category' => $category->fresh(),
        ]);
    }

    
}