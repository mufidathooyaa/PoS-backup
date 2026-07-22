import React, { useEffect, useState, useCallback } from "react";
import { AlertTriangle, Download, Search } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { api } from "../../lib/apiClient";

export function LowStock() {
  const { user, activeOutlet } = useAuth();
  const isAdmin = user?.role === "Admin";
  const toast = useToast();

  const [lowStockList, setLowStockList] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [savingId, setSavingId] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const lowStockParams = isAdmin ? { outlet_id: activeOutlet?.id } : {};
      const [lowStockRes, catalogRes] = await Promise.all([
        api.get("/inventory/low-stock", lowStockParams),
        api.get("/catalog"),
      ]);
      setLowStockList(lowStockRes.produk);
      setCatalog(catalogRes.products.filter((p) => p.track_stock));
    } catch (err) {
      toast(err.message || "Gagal memuat data stok rendah", "danger");
    } finally {
      setLoading(false);
    }
  }, [toast, isAdmin, activeOutlet]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredCatalog = catalog.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.nama.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q);
  });

  const saveThreshold = async (productId, value) => {
    const stok_minimum = Number(value);
    if (Number.isNaN(stok_minimum) || stok_minimum < 0) return;
    setSavingId(productId);
    try {
      await api.post(`/products/${productId}/stock-minimum`, { stok_minimum });
      toast("Ambang stok rendah diperbarui");
      await loadData();
    } catch (err) {
      toast(err.message || "Gagal mengubah ambang stok", "danger");
    } finally {
      setSavingId(null);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem("pos_token");
      const outletParam = isAdmin && activeOutlet?.id ? `?outlet_id=${activeOutlet.id}` : "";
      const response = await fetch(`/api/inventory/low-stock/export${outletParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Gagal mengekspor data");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stok-rendah-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast(err.message || "Gagal mengekspor data", "danger");
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <div className="p-6 text-sm text-slate-500">Memuat data stok rendah...</div>;

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-50 text-amber-600"><AlertTriangle size={16} /></span>
            <div>
              <h3 className="text-sm font-bold">Produk Stok Rendah ({lowStockList.length})</h3>
              <p className="mt-0.5 text-xs text-slate-500">Stok saat ini sudah di bawah atau sama dengan ambang minimum</p>
            </div>
          </div>
          <button className="btn-secondary" disabled={exporting || lowStockList.length === 0} onClick={exportCsv}>
            <Download size={15} /> {exporting ? "Mengekspor..." : "Ekspor CSV"}
          </button>
        </div>
        <table className="w-full">
          <thead className="table-head"><tr><th className="px-4 py-3">Produk</th><th>Kategori</th><th>Stok Saat Ini</th><th>Ambang Minimum</th></tr></thead>
          <tbody>
            {lowStockList.map((p) => (
              <tr key={p.product_id}>
                <td className="table-cell"><div className="font-semibold">{p.nama}</div><div className="text-[11px] text-slate-500">{p.sku}</div></td>
                <td className="table-cell">{p.kategori ?? "-"}</td>
                <td className="table-cell"><span className="font-bold text-red-600">{p.stok_saat_ini}</span></td>
                <td className="table-cell">{p.stok_minimum}</td>
              </tr>
            ))}
            {lowStockList.length === 0 && <tr><td colSpan={4} className="table-cell text-center text-slate-400">Tidak ada produk di bawah ambang stok — aman semua 🎉</td></tr>}
          </tbody>
        </table>
      </div>

      {isAdmin && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <div><h3 className="text-sm font-bold">Atur Ambang Stok Minimum</h3><p className="mt-1 text-xs text-slate-500">Ubah kapan sebuah produk dianggap "stok rendah" di outlet Anda</p></div>
            <div className="relative w-64">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input className="input pl-8" placeholder="Cari produk..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <table className="w-full">
            <thead className="table-head"><tr><th className="px-4 py-3">Produk</th><th>Stok Saat Ini</th><th>Ambang Minimum</th></tr></thead>
            <tbody>
              {filteredCatalog.map((p) => (
                <tr key={p.id}>
                  <td className="table-cell"><div className="font-semibold">{p.nama}</div><div className="text-[11px] text-slate-500">{p.sku}</div></td>
                  <td className="table-cell">{p.stok_tersedia}</td>
                  <td className="table-cell">
                    <input
                      type="number"
                      min={0}
                      defaultValue={p.stok_minimum}
                      className="input w-24"
                      disabled={savingId === p.id}
                      onBlur={(e) => { if (Number(e.target.value) !== p.stok_minimum) saveThreshold(p.id, e.target.value); }}
                      aria-label={`Ambang stok minimum untuk ${p.nama}`}
                    />
                  </td>
                </tr>
              ))}
              {filteredCatalog.length === 0 && <tr><td colSpan={3} className="table-cell text-center text-slate-400">Tidak ada produk ditemukan</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}