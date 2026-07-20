import React, { useEffect, useState, useCallback } from "react";
import { CircleDollarSign, Download, FileText, RefreshCw, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "../../components/ui/PageHeader";
import { Kpi } from "../../components/ui/Kpi";
import { useToast } from "../../context/ToastContext";
import { formatIDR } from "../../mockData";
import { api } from "../../lib/apiClient";

const PAYMENT_COLORS = ["#F97316", "#2563EB", "#10B981", "#8B5CF6"];

export function ReportsPage() {
  const toast = useToast();
  const [range, setRange] = useState("today");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [trend, setTrend] = useState([]);
  const [loadingTrend, setLoadingTrend] = useState(true);
  const [shiftSummary, setShiftSummary] = useState({ selesai: 0, adaSelisih: 0, totalSelisih: 0 });
  const [pendingApproval, setPendingApproval] = useState(0);
  const [loadingShiftSummary, setLoadingShiftSummary] = useState(true);

  const getDateRange = useCallback(() => {
    const today = new Date();
    const end = today.toISOString().slice(0, 10);
    let start = end;
    if (range === "7days") {
      const d = new Date(today); d.setDate(d.getDate() - 6);
      start = d.toISOString().slice(0, 10);
    } else if (range === "month") {
      start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    }
    return { tanggal_mulai: start, tanggal_selesai: end };
  }, [range]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/reports/daily", getDateRange());
      setReport(res);
    } catch (err) {
      toast(err.message || "Gagal memuat laporan", "danger");
    } finally {
      setLoading(false);
    }
  }, [getDateRange, toast]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const loadTrend = useCallback(async () => {
    setLoadingTrend(true);
    try {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().slice(0, 10));
      }

      const results = await Promise.all(
        days.map((tanggal) => api.get("/reports/daily", { tanggal_mulai: tanggal, tanggal_selesai: tanggal }))
      );

      const data = results.map((res, i) => ({
        day: new Date(days[i]).toLocaleDateString("id-ID", { weekday: "short" }),
        sales: res.ringkasan.penjualan_kotor,
      }));
      setTrend(data);
    } catch (err) {
      toast(err.message || "Gagal memuat tren penjualan", "danger");
    } finally {
      setLoadingTrend(false);
    }
  }, [toast]);

  useEffect(() => { loadTrend(); }, [loadTrend]);

  const loadShiftSummary = useCallback(async () => {
    setLoadingShiftSummary(true);
    try {
      const [shiftsRes, pendingRes] = await Promise.all([
        api.get("/shifts"), // default: hari ini
        api.get("/stock-adjustments/pending"),
      ]);

      const closedShifts = shiftsRes.shifts.filter((s) => s.status === "CLOSED");
      const withSelisih = closedShifts.filter((s) => Number(s.selisih) !== 0);
      const totalSelisih = closedShifts.reduce((sum, s) => sum + Number(s.selisih || 0), 0);

      setShiftSummary({ selesai: closedShifts.length, adaSelisih: withSelisih.length, totalSelisih });
      setPendingApproval(pendingRes.pending.length);
    } catch (err) {
      toast(err.message || "Gagal memuat ringkasan shift", "danger");
    } finally {
      setLoadingShiftSummary(false);
    }
  }, [toast]);

  useEffect(() => { loadShiftSummary(); }, [loadShiftSummary]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { tanggal_mulai, tanggal_selesai } = getDateRange();
      const token = localStorage.getItem("pos_token");
      const response = await fetch(`/api/reports/daily/export?tanggal_mulai=${tanggal_mulai}&tanggal_selesai=${tanggal_selesai}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Gagal mengekspor laporan");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `laporan-harian-${tanggal_mulai}-sd-${tanggal_selesai}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Laporan CSV berhasil diekspor");
    } catch (err) {
      toast(err.message || "Gagal mengekspor laporan", "danger");
    } finally {
      setExporting(false);
    }
  };

  if (loading || !report) return <div className="p-6 text-sm text-slate-500">Memuat laporan...</div>;

  const { ringkasan, komposisi_pembayaran, produk_terlaris } = report;
  const totalPembayaran = komposisi_pembayaran.reduce((s, p) => s + Number(p.total), 0);

  return (
    <>
      <PageHeader
        title="Laporan"
        subtitle="Analisis penjualan dan operasional outlet"
        actions={
          <>
            <select className="input w-44" value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="today">Hari ini</option>
              <option value="7days">7 hari terakhir</option>
              <option value="month">Bulan ini</option>
            </select>
            <button className="btn-primary" disabled={exporting} onClick={exportCsv}><Download size={15} /> {exporting ? "Mengekspor..." : "Ekspor CSV"}</button>
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3">
        <Kpi icon={TrendingUp} label="Penjualan Kotor" value={formatIDR(ringkasan.penjualan_kotor)} note={`${ringkasan.jumlah_transaksi} transaksi`} tone="orange" />
        <Kpi icon={CircleDollarSign} label="Penjualan Bersih" value={formatIDR(ringkasan.penjualan_bersih_setelah_refund)} note="Setelah refund" tone="emerald" />
        <Kpi icon={FileText} label="Pajak Tercatat" value={formatIDR(ringkasan.total_pajak)} note="Total periode ini" tone="blue" />
        <Kpi icon={RefreshCw} label="Refund" value={formatIDR(ringkasan.total_refund)} note={`${ringkasan.jumlah_refund} transaksi`} tone="amber" />
      </div>
      
      <div className="card mt-3 p-4">
        <h3 className="text-sm font-bold">Penjualan 7 Hari</h3>
        {loadingTrend ? (
          <div className="flex h-56 items-center justify-center text-xs text-slate-400">Memuat tren...</div>
        ) : (
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} />
                <YAxis hide />
                <Tooltip formatter={(v) => formatIDR(v)} />
                <Bar dataKey="sales" fill="#F97316" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-12 gap-3">
        <div className="card col-span-4 p-4">
          <h3 className="text-sm font-bold">Metode Pembayaran</h3>
          {komposisi_pembayaran.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">Belum ada data</p>
          ) : (
            <>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={komposisi_pembayaran.map(p => ({ ...p, total: Number(p.total) }))} dataKey="total" nameKey="metode" cx="50%" cy="50%" innerRadius={48} outerRadius={68} paddingAngle={3}>
                      {komposisi_pembayaran.map((x, i) => <Cell key={x.metode} fill={PAYMENT_COLORS[i % PAYMENT_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => formatIDR(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                {komposisi_pembayaran.map((x, i) => (
                  <span key={x.metode} className="text-[10px] text-slate-500">
                    <i className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: PAYMENT_COLORS[i % PAYMENT_COLORS.length] }} />
                    {x.metode} {totalPembayaran ? Math.round((x.total / totalPembayaran) * 100) : 0}%
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card col-span-8 p-4">
          <h3 className="text-sm font-bold">Produk Terlaris</h3>
          <div className="mt-3 space-y-3">
            {produk_terlaris.length === 0 && <p className="py-4 text-center text-xs text-slate-400">Belum ada penjualan pada periode ini</p>}
            {produk_terlaris.map((p, i) => (
              <div key={p.nama_produk} className="flex items-center gap-3">
                <span className="grid h-7 w-7 place-items-center rounded-md bg-slate-100 text-xs font-bold">{i + 1}</span>
                <span className="flex-1 text-xs font-semibold">{p.nama_produk}</span>
                <span className="text-xs text-slate-500">{p.total_terjual} terjual</span>
                <b className="w-28 text-right text-xs">{formatIDR(p.total_pendapatan)}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="card mt-3 p-4">
        <h3 className="text-sm font-bold">Ringkasan Shift & Approval Hari Ini</h3>
        {loadingShiftSummary ? (
          <div className="py-8 text-center text-xs text-slate-400">Memuat...</div>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-3 divide-x rounded-lg bg-slate-50 p-4 text-center">
              <div><div className="text-lg font-bold">{shiftSummary.selesai}</div><div className="text-[10px] text-slate-500">Shift selesai</div></div>
              <div><div className="text-lg font-bold text-amber-600">{shiftSummary.adaSelisih}</div><div className="text-[10px] text-slate-500">Ada selisih</div></div>
              <div><div className="text-lg font-bold text-red-500">{pendingApproval}</div><div className="text-[10px] text-slate-500">Butuh approval</div></div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-slate-500">Total selisih shift hari ini</span>
              <b className={shiftSummary.totalSelisih < 0 ? "text-red-500" : "text-emerald-600"}>{formatIDR(shiftSummary.totalSelisih)}</b>
            </div>
          </>
        )}
      </div>
    </>
  );
}