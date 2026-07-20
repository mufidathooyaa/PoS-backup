import React, { useEffect, useState, useCallback } from "react";
import { CheckCircle2, ClipboardCheck, XCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { api } from "../../lib/apiClient";

export function StockAdjustment() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user.role === "Admin";

  const [catalog, setCatalog] = useState([]);
  const [pending, setPending] = useState([]);
  const [productId, setProductId] = useState("");
  const [systemStock, setSystemStock] = useState(0);
  const [physical, setPhysical] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const catalogRes = await api.get("/catalog");
      setCatalog(catalogRes.products);
      setProductId((prev) => prev || catalogRes.products[0]?.id || "");
      const p = catalogRes.products.find((x) => x.id === (productId || catalogRes.products[0]?.id));
      setSystemStock(p?.stok_tersedia ?? 0);

      if (isAdmin) {
        const pendingRes = await api.get("/stock-adjustments/pending");
        setPending(pendingRes.pending);
      }
    } catch (err) {
      toast(err.message || "Gagal memuat data", "danger");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast, isAdmin]);

  useEffect(() => { loadData(); }, [loadData]);

  const changeProduct = (id) => {
    setProductId(id);
    const p = catalog.find((x) => x.id === id);
    setSystemStock(p?.stok_tersedia ?? 0);
    setPhysical("");
  };

  const diff = Number(physical || systemStock) - systemStock;

  const submit = async () => {
    if (!reason.trim()) return toast("Alasan penyesuaian stok wajib diisi", "danger");
    if (physical === "") return toast("Stok fisik wajib diisi", "danger");
    setSubmitting(true);
    try {
      const res = await api.post(`/products/${productId}/stock-adjustment`, {
        stok_fisik: Number(physical),
        alasan: reason,
      });
      toast(res.message);
      setPhysical("");
      setReason("");
      await loadData();
    } catch (err) {
      toast(err.message || "Gagal menyimpan penyesuaian", "danger");
    } finally {
      setSubmitting(false);
    }
  };

  const approve = async (id) => {
    try {
      await api.post(`/stock-movements/${id}/approve`);
      toast("Penyesuaian disetujui dan stok diperbarui");
      await loadData();
    } catch (err) {
      toast(err.message || "Gagal menyetujui", "danger");
    }
  };

  const reject = async (id) => {
    try {
      await api.post(`/stock-movements/${id}/reject`);
      toast("Pengajuan ditolak");
      await loadData();
    } catch (err) {
      toast(err.message || "Gagal menolak", "danger");
    }
  };

  if (loading) return <div className="p-6 text-sm text-slate-500">Memuat...</div>;

  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="card col-span-5 p-4">
        <h3 className="text-sm font-bold">Penyesuaian Stok</h3>
        <div className="mt-4 space-y-4">
          <div><label className="label">Produk</label><select className="input" value={productId} onChange={(e) => changeProduct(e.target.value)}>{catalog.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}</select></div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="label">Stok sistem</label><div className="input flex items-center bg-slate-50">{systemStock}</div></div>
            <div><label className="label">Stok fisik</label><input type="number" className="input" value={physical} onChange={(e) => setPhysical(e.target.value)} /></div>
            <div><label className="label">Selisih</label><div className={`input flex items-center font-bold ${diff < 0 ? "text-red-500" : "text-emerald-600"}`}>{diff > 0 ? "+" : ""}{diff}</div></div>
          </div>
          <div><label className="label">Alasan *</label><textarea className="input h-auto py-2" rows="3" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Jelaskan penyebab selisih..." /></div>
          <button className="btn-primary w-full" disabled={submitting} onClick={submit}>{submitting ? "Menyimpan..." : (isAdmin ? "Simpan Penyesuaian" : "Ajukan ke Admin")}</button>
          {!isAdmin && (
            <div className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-700">
              <b>Perlu diketahui:</b> stok tidak akan berubah sampai pengajuan Anda disetujui Admin.
            </div>
          )}
        </div>
      </div>

      <div className="card col-span-7 p-4">
        {isAdmin ? (
          <>
            <div className="flex items-center gap-2"><ClipboardCheck size={18} className="text-amber-600" /><h3 className="text-sm font-bold">Menunggu Persetujuan ({pending.length})</h3></div>
            <div className="mt-4 space-y-2">
              {pending.length === 0 && <p className="py-6 text-center text-xs text-slate-400">Tidak ada pengajuan yang menunggu</p>}
              {pending.map((m) => (
                <div key={m.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-bold">{m.product?.nama}</div>
                      <div className={`mt-0.5 text-xs font-semibold ${m.jumlah < 0 ? "text-red-500" : "text-emerald-600"}`}>{m.jumlah > 0 ? "+" : ""}{m.jumlah}</div>
                      <div className="mt-1 text-[11px] text-slate-500">{m.alasan}</div>
                      <div className="mt-1 text-[10px] text-slate-400">Diajukan oleh {m.user?.nama} • {new Date(m.timestamp).toLocaleString("id-ID")}</div>
                    </div>
                    <div className="flex gap-1.5">
                      <button className="rounded-md bg-emerald-50 p-2 text-emerald-600" onClick={() => approve(m.id)}><CheckCircle2 size={15} /></button>
                      <button className="rounded-md bg-red-50 p-2 text-red-500" onClick={() => reject(m.id)}><XCircle size={15} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-3 text-xs leading-5 text-slate-600">
            <h3 className="text-sm font-bold text-slate-800">Bagaimana ini bekerja</h3>
            <p>Pengajuan Anda akan masuk ke antrean persetujuan Admin. Stok baru diterapkan setelah Admin menyetujui pengajuan.</p>
            <p>Semua pengajuan tercatat di <b>Pergerakan Stok</b> dan <b>Audit Log</b>, lengkap dengan status persetujuan, pelaku, dan waktu kejadian.</p>
          </div>
        )}
      </div>
    </div>
  );
}