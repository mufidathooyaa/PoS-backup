import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CircleDollarSign, ClipboardCheck, Clock3, History, Package, ReceiptText } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "../../components/ui/PageHeader";
import { Kpi } from "../../components/ui/Kpi";
import { Status } from "../../components/ui/Status";
import { useToast } from "../../context/ToastContext";
import { formatIDR } from "../../mockData";
import { api } from "../../lib/apiClient";

const ACTION_LABEL = {
  void_transaction: "Void Transaksi", refund_transaction: "Refund Transaksi", archive_product: "Arsipkan Produk",
  reactivate_product: "Aktifkan Produk", close_shift: "Tutup Shift", stock_receipt: "Penerimaan Stok",
  stock_adjustment: "Penyesuaian Stok", stock_adjustment_request: "Pengajuan Penyesuaian Stok",
  approve_stock_adjustment: "Setujui Penyesuaian Stok", reject_stock_adjustment: "Tolak Penyesuaian Stok",
  review_shift_variance: "Tinjau Selisih Shift",
};

export function Dashboard() {
  const navigate = useNavigate();
  const toast = useToast();

  const [today, setToday] = useState(null);
  const [yesterday, setYesterday] = useState(null);
  const [trend, setTrend] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [openShifts, setOpenShifts] = useState([]);
  const [recentAudits, setRecentAudits] = useState([]);
  const [pendingApproval, setPendingApproval] = useState(0);
  const [pendingShiftReviews, setPendingShiftReviews] = useState(0); // State baru
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const y = new Date(); y.setDate(y.getDate() - 1);
      const yesterdayStr = y.toISOString().slice(0, 10);

      const trendDays = [];
      for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); trendDays.push(d.toISOString().slice(0, 10)); }

      const [todayRes, yesterdayRes, trendRes, catalogRes, shiftsRes, auditsRes, pendingRes, pendingShiftRes] = await Promise.all([
        api.get("/reports/daily", { tanggal_mulai: todayStr, tanggal_selesai: todayStr }),
        api.get("/reports/daily", { tanggal_mulai: yesterdayStr, tanggal_selesai: yesterdayStr }),
        Promise.all(trendDays.map((d) => api.get("/reports/daily", { tanggal_mulai: d, tanggal_selesai: d }))),
        api.get("/catalog"),
        api.get("/shifts"),
        // Tangkap error diam-diam agar jika Kasir yang login, Dashboard tidak crash karena error 403 Forbidden
        api.get("/audit-logs").catch(() => ({ logs: { data: [] } })),
        api.get("/stock-adjustments/pending").catch(() => ({ pending: [] })),
        api.get("/shifts/pending-review").catch(() => ({ shifts: [] })),
      ]);

      setToday(todayRes);
      setYesterday(yesterdayRes);
      setTrend(trendRes.map((res, i) => ({ day: new Date(trendDays[i]).toLocaleDateString("id-ID", { weekday: "short" }), sales: res.ringkasan.penjualan_kotor })));
      setCatalog(catalogRes.products);
      setOpenShifts(shiftsRes.shifts.filter((s) => s.status === "OPEN"));
      setRecentAudits(auditsRes.logs.data.slice(0, 3));
      setPendingApproval(pendingRes.pending?.length || 0);
      setPendingShiftReviews(pendingShiftRes.shifts?.length || 0);
    } catch (err) {
      toast(err.message || "Gagal memuat dashboard", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  if (loading || !today) return <div className="p-6 text-sm text-slate-500">Memuat dashboard...</div>;

  const penjualanHariIni = today.ringkasan.penjualan_kotor;
  const penjualanKemarin = yesterday.ringkasan.penjualan_kotor;
  const persenPerubahan = penjualanKemarin > 0 ? (((penjualanHariIni - penjualanKemarin) / penjualanKemarin) * 100).toFixed(1) : null;

  const stokRendah = catalog.filter((p) => p.track_stock && p.stok_tersedia <= p.stok_minimum);
  const kasirAktif = openShifts.filter((s) => s.user?.role?.nama_peran === "Kasir").length;
  const operatorAktif = openShifts.filter((s) => s.user?.role?.nama_peran === "Operator Inventaris").length;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Ringkasan operasional hari ini"
        actions={
          <div className="flex gap-2">
            {pendingShiftReviews > 0 && (
              <button className="btn-danger" onClick={() => navigate("/shift")}>
                <AlertTriangle size={16} /> Tinjau Selisih Shift ({pendingShiftReviews})
              </button>
            )}
            {pendingApproval > 0 && (
              <button className="btn-primary" onClick={() => navigate("/inventaris", { state: { tab: "Penyesuaian Stok" } })}>
                <ClipboardCheck size={16} /> Setujui Stok ({pendingApproval})
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-4 gap-3">
        <Kpi icon={CircleDollarSign} label="Penjualan Hari Ini" value={formatIDR(penjualanHariIni)} note={persenPerubahan !== null ? `${persenPerubahan >= 0 ? "↑" : "↓"} ${Math.abs(persenPerubahan)}% dari kemarin` : "Belum ada data kemarin"} tone="orange" />
        <Kpi icon={ReceiptText} label="Transaksi" value={today.ringkasan.jumlah_transaksi} note={today.ringkasan.jumlah_transaksi > 0 ? `Rata-rata ${formatIDR(penjualanHariIni / today.ringkasan.jumlah_transaksi)}` : "Belum ada transaksi"} tone="blue" />
        <Kpi icon={AlertTriangle} label="Stok Rendah" value={stokRendah.length} note={`${stokRendah.length} produk perlu segera dipesan`} tone="amber" />
        <Kpi icon={Clock3} label="Shift Aktif" value={openShifts.length} note={`${kasirAktif} kasir • ${operatorAktif} operator`} tone="emerald" />
      </div>

      <div className="mt-3 grid grid-cols-12 gap-3">
        <div className="card col-span-8 p-4">
          <div className="flex items-center justify-between">
            <div><h3 className="text-sm font-bold">Tren Penjualan 7 Hari</h3><p className="mt-1 text-xs text-slate-500">Total penjualan kotor per hari</p></div>
          </div>
          <div className="mt-3 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs><linearGradient id="sales" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F97316" stopOpacity={0.25} /><stop offset="95%" stopColor="#F97316" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(v) => formatIDR(v)} />
                <Area type="monotone" dataKey="sales" stroke="#F97316" strokeWidth={2} fill="url(#sales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card col-span-4 p-4">
          <h3 className="text-sm font-bold">Produk Terlaris</h3>
          <p className="mt-1 text-xs text-slate-500">Berdasarkan jumlah terjual hari ini</p>
          <div className="mt-4 space-y-4">
            {today.produk_terlaris.length === 0 && <p className="text-xs text-slate-400">Belum ada penjualan hari ini</p>}
            {today.produk_terlaris.slice(0, 4).map((p) => {
              const max = today.produk_terlaris[0]?.total_terjual || 1;
              return (
                <div key={p.nama_produk}>
                  <div className="mb-1.5 flex justify-between text-xs"><span className="font-medium">{p.nama_produk}</span><span className="text-slate-500">{p.total_terjual}</span></div>
                  <div className="h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-orange" style={{ width: `${(p.total_terjual / max) * 100}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card col-span-7 p-4">
          <div className="flex items-center justify-between"><h3 className="text-sm font-bold">Aktivitas Sensitif Terbaru</h3><button className="text-xs font-semibold text-orange" onClick={() => navigate("/audit-log")}>Lihat semua</button></div>
          <div className="mt-2">
            {recentAudits.length === 0 && <p className="py-4 text-center text-xs text-slate-400">Belum ada aktivitas</p>}
            {recentAudits.map((a) => (
              <div key={a.id} className="flex items-center gap-3 border-b py-2.5 last:border-0">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-600"><History size={15} /></span>
                <div className="min-w-0 flex-1"><div className="text-xs font-semibold">{ACTION_LABEL[a.action] ?? a.action}</div><div className="truncate text-[11px] text-slate-500">{a.user?.nama}</div></div>
                <Status value={a.hasil === "success" ? "Berhasil" : "Gagal"} />
                <span className="text-[11px] text-slate-400">{new Date(a.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card col-span-5 p-4">
          <h3 className="text-sm font-bold">Peringatan Stok</h3>
          <div className="mt-2">
            {stokRendah.length === 0 && <p className="py-4 text-center text-xs text-slate-400">Semua stok aman</p>}
            {stokRendah.map((p) => (
              <div key={p.id} className="flex items-center gap-3 border-b py-2.5 last:border-0">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-50 text-amber-600"><Package size={15} /></span>
                <div className="flex-1"><div className="text-xs font-semibold">{p.nama}</div><div className="text-[11px] text-slate-500">{p.sku}</div></div>
                <span className="text-xs font-bold text-amber-600">{p.stok_tersedia} {p.unit}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}