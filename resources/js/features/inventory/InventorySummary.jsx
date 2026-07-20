import React, { useEffect, useState } from "react";
import { AlertTriangle, ArrowDownToLine, Boxes, Package } from "lucide-react";
import { Kpi } from "../../components/ui/Kpi";
import { useToast } from "../../context/ToastContext";
import { formatIDR } from "../../mockData";
import { api } from "../../lib/apiClient";

export function InventorySummary() {
  const toast = useToast();
  const [catalog, setCatalog] = useState([]);
  const [receiptToday, setReceiptToday] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [catalogRes, movementsRes] = await Promise.all([
          api.get("/catalog", { include_inactive: false }),
          api.get("/stock-movements", { jenis_pergerakan: "penerimaan", tanggal: today }),
        ]);
        setCatalog(catalogRes.products);
        setReceiptToday(movementsRes.movements.data);
      } catch (err) {
        toast(err.message || "Gagal memuat ringkasan inventaris", "danger");
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  if (loading) return <div className="p-6 text-sm text-slate-500">Memuat ringkasan...</div>;

  const totalProduk = catalog.length;
  const nilaiPersediaan = catalog.reduce((s, p) => s + (p.track_stock ? p.harga * (p.stok_tersedia ?? 0) : 0), 0);
  const stokRendah = catalog.filter((p) => p.track_stock && p.stok_tersedia <= p.stok_minimum);
  const totalMasukHariIni = receiptToday.reduce((s, m) => s + m.jumlah, 0);

  return (
    <>
      <div className="grid grid-cols-4 gap-3">
        <Kpi icon={Package} label="Total Produk Aktif" value={totalProduk} tone="blue" />
        <Kpi icon={Boxes} label="Nilai Persediaan" value={formatIDR(nilaiPersediaan)} note="Berdasarkan harga jual" tone="orange" />
        <Kpi icon={AlertTriangle} label="Stok Rendah" value={stokRendah.length} note="Perlu segera dipesan" tone="amber" />
        <Kpi icon={ArrowDownToLine} label="Stok Masuk Hari Ini" value={totalMasukHariIni} note={`${receiptToday.length} penerimaan`} tone="emerald" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <h3 className="text-sm font-bold">Produk Stok Rendah</h3>
          <div className="mt-2">
            {stokRendah.length === 0 && <p className="py-4 text-center text-xs text-slate-400">Tidak ada produk dengan stok rendah</p>}
            {stokRendah.map((p) => (
              <div key={p.id} className="flex items-center gap-3 border-b py-3 last:border-0">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-50 text-amber-600"><Package size={15} /></span>
                <div className="flex-1"><div className="text-xs font-semibold">{p.nama}</div><div className="text-[10px] text-slate-400">{p.sku}</div></div>
                <div className="text-right"><div className="text-xs font-bold text-amber-600">{p.stok_tersedia} {p.unit}</div><div className="text-[10px] text-slate-400">Min. {p.stok_minimum}</div></div>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-4">
          <h3 className="text-sm font-bold">Penerimaan Stok Hari Ini</h3>
          <div className="mt-2">
            {receiptToday.length === 0 && <p className="py-4 text-center text-xs text-slate-400">Belum ada penerimaan hari ini</p>}
            {receiptToday.map((m) => (
              <div key={m.id} className="flex items-center gap-3 border-b py-3 last:border-0">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600"><ArrowDownToLine size={14} /></span>
                <div className="flex-1"><div className="text-xs font-semibold">{m.product?.nama}</div><div className="text-[10px] text-slate-400">{m.user?.nama} • {new Date(m.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</div></div>
                <b className="text-xs text-emerald-600">+{m.jumlah}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}