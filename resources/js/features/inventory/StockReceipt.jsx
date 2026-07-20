import React, { useEffect, useState, useCallback } from "react";
import { ArrowDownToLine } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { api } from "../../lib/apiClient";

export function StockReceipt() {
  const toast = useToast();
  const [catalog, setCatalog] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [catalogRes, movementsRes] = await Promise.all([
        api.get("/catalog"),
        api.get("/stock-movements", { jenis_pergerakan: "penerimaan" }),
      ]);
      setCatalog(catalogRes.products);
      setHistory(movementsRes.movements.data);
    } catch (err) {
      toast(err.message || "Gagal memuat data", "danger");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const submit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget; // simpan referensi SEBELUM await
    setSubmitting(true);
    const fd = new FormData(form);
    try {
      await api.post(`/products/${fd.get("product")}/stock-receipt`, {
        jumlah: Number(fd.get("amount")),
        sumber: fd.get("supplier"),
        alasan: fd.get("note") || null,
      });
      form.reset(); // pakai referensi yang sudah disimpan, bukan e.currentTarget
      toast("Penerimaan disimpan, stok diperbarui");
      await loadData();
    } catch (err) {
      toast(err.message || "Gagal menyimpan penerimaan", "danger");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-6 text-sm text-slate-500">Memuat...</div>;

  return (
    <div className="grid grid-cols-12 gap-3">
      <form onSubmit={submit} className="card col-span-4 p-4">
        <h3 className="text-sm font-bold">Penerimaan Stok Baru</h3>
        <div className="mt-4 space-y-4">
          <div><label className="label">Produk</label><select name="product" required className="input">{catalog.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}</select></div>
          <div><label className="label">Jumlah masuk</label><input name="amount" required min="1" type="number" className="input" /></div>
          <div><label className="label">Supplier / sumber</label><input name="supplier" className="input" /></div>
          <div><label className="label">Catatan</label><textarea name="note" className="input h-auto py-2" rows="3" /></div>
          <button className="btn-primary w-full" disabled={submitting}><ArrowDownToLine size={15} />{submitting ? "Menyimpan..." : "Simpan Penerimaan"}</button>
        </div>
      </form>
      <div className="card col-span-8 overflow-hidden">
        <div className="p-4"><h3 className="text-sm font-bold">Penerimaan Terbaru</h3></div>
        <table className="w-full">
          <thead className="table-head"><tr><th className="px-4 py-3">Produk</th><th>Jumlah</th><th>Oleh</th><th>Waktu</th></tr></thead>
          <tbody>
            {history.map((m) => (
              <tr key={m.id}>
                <td className="table-cell">{m.product?.nama}</td>
                <td className="table-cell font-bold text-emerald-600">+{m.jumlah}</td>
                <td className="table-cell">{m.user?.nama}</td>
                <td className="table-cell">{new Date(m.timestamp).toLocaleString("id-ID")}</td>
              </tr>
            ))}
            {history.length === 0 && <tr><td colSpan={4} className="table-cell text-center text-slate-400">Belum ada penerimaan</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}