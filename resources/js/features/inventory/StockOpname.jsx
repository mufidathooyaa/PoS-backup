import React, { useEffect, useState, useCallback } from "react";
import { ClipboardList, Search } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { api } from "../../lib/apiClient";

export function StockOpname() {
  const toast = useToast();
  const [catalog, setCatalog] = useState([]);
  const [search, setSearch] = useState("");
  const [counts, setCounts] = useState({}); // { [product_id]: "12" }
  const [catatanSesi, setCatatanSesi] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/catalog");
      setCatalog(res.products.filter((p) => p.track_stock));
    } catch (err) {
      toast(err.message || "Gagal memuat katalog produk", "danger");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = catalog.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.nama.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q);
  });

  const itemsToSubmit = Object.entries(counts).filter(([, v]) => v !== "" && v !== null);

  const submit = async () => {
    if (!catatanSesi.trim()) {
      toast("Catatan sesi wajib diisi (mis. 'Opname bulanan Juli 2026')", "danger");
      return;
    }
    if (itemsToSubmit.length === 0) {
      toast("Isi minimal 1 hasil hitung fisik terlebih dahulu", "danger");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        catatan_sesi: catatanSesi,
        items: itemsToSubmit.map(([product_id, stok_fisik]) => ({ product_id, stok_fisik: Number(stok_fisik) })),
      };
      const res = await api.post("/stock-opname", payload);
      toast(res.message);
      setLastResult(res);
      setCounts({});
      setCatatanSesi("");
      await loadData();
    } catch (err) {
      toast(err.message || "Gagal memposting hasil opname", "danger");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-6 text-sm text-slate-500">Memuat produk...</div>;

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-600"><ClipboardList size={16} /></span>
          <div>
            <h3 className="text-sm font-bold">Sesi Penghitungan Stok (Stock Opname)</h3>
            <p className="mt-0.5 text-xs text-slate-500">Isi hasil hitung fisik untuk produk yang sudah dihitung. Produk yang dibiarkan kosong tidak ikut diposting.</p>
          </div>
        </div>
        <textarea
          className="input mt-3"
          rows={2}
          placeholder="Catatan sesi, mis. 'Opname bulanan Juli 2026'"
          value={catatanSesi}
          onChange={(e) => setCatatanSesi(e.target.value)}
        />
        {lastResult && (
          <p className="mt-2 text-xs text-emerald-600">
            Sesi terakhir: {lastResult.jumlah_disesuaikan} produk disesuaikan, {lastResult.jumlah_sesuai} produk sudah sesuai.
          </p>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-4">
          <h3 className="text-sm font-bold">Daftar Produk ({itemsToSubmit.length} terisi)</h3>
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input className="input pl-8" placeholder="Cari produk..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <table className="w-full">
          <thead className="table-head"><tr><th className="px-4 py-3">Produk</th><th>Stok Sistem</th><th>Stok Fisik (Hasil Hitung)</th><th>Selisih</th></tr></thead>
          <tbody>
            {filtered.map((p) => {
              const val = counts[p.id] ?? "";
              const selisih = val === "" ? null : Number(val) - p.stok_tersedia;
              return (
                <tr key={p.id}>
                  <td className="table-cell"><div className="font-semibold">{p.nama}</div><div className="text-[11px] text-slate-500">{p.sku}</div></td>
                  <td className="table-cell">{p.stok_tersedia}</td>
                  <td className="table-cell">
                    <input
                      type="number"
                      min={0}
                      className="input w-24"
                      value={val}
                      onChange={(e) => setCounts((c) => ({ ...c, [p.id]: e.target.value }))}
                      aria-label={`Stok fisik hasil hitung untuk ${p.nama}`}
                    />
                  </td>
                  <td className="table-cell">
                    {selisih === null ? <span className="text-slate-300">-</span> : (
                      <span className={`font-bold ${selisih === 0 ? "text-slate-400" : selisih > 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {selisih > 0 ? `+${selisih}` : selisih}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={4} className="table-cell text-center text-slate-400">Tidak ada produk ditemukan</td></tr>}
          </tbody>
        </table>
        <div className="flex justify-end border-t p-4">
          <button className="btn-primary" disabled={submitting} onClick={submit}>
            {submitting ? "Memposting..." : `Posting Hasil Opname (${itemsToSubmit.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}