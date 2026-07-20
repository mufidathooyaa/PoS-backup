import React, { useEffect, useState, useCallback } from "react";
import { Check, ChevronDown, ChevronRight, Plus, SlidersHorizontal, X } from "lucide-react";
import { Status } from "../../components/ui/Status";
import { useToast } from "../../context/ToastContext";
import { formatIDR } from "../../mockData";
import { api } from "../../lib/apiClient";

export function CategoriesTab() {
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, prodRes] = await Promise.all([
        api.get("/categories"),
        api.get("/products", { include_inactive: true }),
      ]);
      setCategories(catRes.categories);
      setProducts(prodRes.products);
    } catch (err) {
      toast(err.message || "Gagal memuat kategori", "danger");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const productCounts = {};
  products.forEach((p) => {
    if (p.category?.id) productCounts[p.category.id] = (productCounts[p.category.id] || 0) + 1;
  });

  const addCategory = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await api.post("/categories", { nama: name.trim() });
      setName("");
      toast("Kategori ditambahkan");
      await loadData();
    } catch (err) {
      toast(err.message || "Gagal menambahkan kategori", "danger");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (c, e) => {
    e.stopPropagation(); // supaya klik tombol tidak ikut memicu expand/collapse
    try {
      await api.post(`/categories/${c.id}/toggle-active`);
      toast("Status kategori diperbarui");
      await loadData();
    } catch (err) {
      toast(err.message || "Gagal mengubah status kategori", "danger");
    }
  };

  if (loading) return <div className="p-6 text-sm text-slate-500">Memuat kategori...</div>;

  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="card col-span-8 overflow-hidden">
        <div className="p-4"><h3 className="text-sm font-bold">Daftar Kategori</h3></div>
        {categories.map((c) => {
          const isOpen = expandedId === c.id;
          const productsInCategory = products.filter((p) => p.category?.id === c.id);
          return (
            <div key={c.id} className="border-t">
              <div className="flex cursor-pointer items-center gap-3 p-4 hover:bg-slate-50" onClick={() => setExpandedId(isOpen ? null : c.id)}>
                {isOpen ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-violet-50 text-violet-600"><SlidersHorizontal size={16} /></span>
                <div className="flex-1"><div className="text-xs font-bold">{c.nama}</div><div className="mt-1 text-[10px] text-slate-500">{productCounts[c.id] ?? 0} produk</div></div>
                <Status value={c.is_active ? "Aktif" : "Nonaktif"} />
                <button className="rounded-md border p-2" onClick={(e) => toggleActive(c, e)}>{c.is_active ? <X size={14} /> : <Check size={14} />}</button>
              </div>
              {isOpen && (
                <div className="bg-slate-50 px-4 pb-3 pl-14">
                  {productsInCategory.length === 0 ? (
                    <p className="py-2 text-xs text-slate-400">Belum ada produk di kategori ini</p>
                  ) : (
                    <div className="space-y-1.5 py-2">
                      {productsInCategory.map((p) => (
                        <div key={p.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs">
                          <div><span className="font-semibold">{p.nama}</span><span className="ml-2 text-[10px] text-slate-400">{p.sku}</span></div>
                          <span className="font-semibold text-orange">{formatIDR(p.harga)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="card col-span-4 p-4">
        <h3 className="text-sm font-bold">Tambah Kategori</h3>
        <div className="mt-4"><label className="label">Nama kategori</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Paket Hemat" /></div>
        <button className="btn-primary mt-4 w-full" disabled={submitting} onClick={addCategory}><Plus size={15} />Tambah Kategori</button>
      </div>
    </div>
  );
}