import React, { useEffect, useState, useCallback } from "react";
import { Activity, AlertTriangle, Clock3, Gauge, RefreshCw } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { Kpi } from "../../components/ui/Kpi";
import { Status } from "../../components/ui/Status";
import { useToast } from "../../context/ToastContext";
import { api } from "../../lib/apiClient";

export function ObservabilityPage() {
  const toast = useToast();
  const [health, setHealth] = useState(null);
  const [summary, setSummary] = useState(null);
  const [minutes, setMinutes] = useState(60);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [healthRes, summaryRes] = await Promise.all([
        api.get("/health"),
        api.get("/observability/summary", { minutes }),
      ]);
      setHealth(healthRes);
      setSummary(summaryRes);
    } catch (err) {
      toast(err.message || "Gagal memuat data observability", "danger");
    } finally {
      setLoading(false);
    }
  }, [toast, minutes]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading || !summary) return <div className="p-6 text-sm text-slate-500">Memuat status sistem...</div>;

  return (
    <>
      <PageHeader
        title="Observability"
        subtitle="Status layanan dan kesehatan sistem"
        actions={
          <>
            <select className="input w-44" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              <option value={15}>15 menit terakhir</option>
              <option value={60}>1 jam terakhir</option>
              <option value={360}>6 jam terakhir</option>
              <option value={1440}>24 jam terakhir</option>
            </select>
            <button className="btn-secondary" onClick={loadData}><RefreshCw size={15} /> Refresh</button>
          </>
        }
      />

      <div className="card mb-3 flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <span className={`grid h-10 w-10 place-items-center rounded-lg ${health?.status === "ok" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
            <Activity size={18} />
          </span>
          <div>
            <div className="text-sm font-bold">Status Layanan</div>
            <div className="text-[11px] text-slate-500">Database: {health?.checks?.database?.latency_ms ?? "-"}ms</div>
          </div>
        </div>
        <Status value={health?.status === "ok" ? "Aktif" : "Nonaktif"} />
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Kpi icon={Activity} label="Total Request" value={summary.total_requests} note={`${summary.periode_menit} menit terakhir`} tone="blue" />
        <Kpi icon={AlertTriangle} label="Tingkat Error" value={`${summary.error_rate}%`} note={`${summary.error_count} dari ${summary.total_requests} request`} tone={summary.error_rate > 5 ? "amber" : "emerald"} />
        <Kpi icon={Clock3} label="Latensi Rata-rata" value={`${summary.avg_latency_ms} ms`} tone="blue" />
        <Kpi icon={Gauge} label="Latensi p95" value={`${summary.p95_latency_ms} ms`} note="95% request lebih cepat dari ini" tone="orange" />
      </div>

      <div className="mt-3 grid grid-cols-12 gap-3">
        <div className="card col-span-6 p-4">
          <h3 className="text-sm font-bold">Endpoint Paling Sering Dipanggil</h3>
          <div className="mt-3 space-y-2">
            {Object.entries(summary.requests_per_endpoint).length === 0 && <p className="py-4 text-center text-xs text-slate-400">Belum ada data</p>}
            {Object.entries(summary.requests_per_endpoint).map(([endpoint, count]) => (
              <div key={endpoint} className="flex items-center justify-between text-xs">
                <span className="font-mono text-slate-600">{endpoint}</span>
                <span className="font-bold">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card col-span-6 p-4">
          <h3 className="text-sm font-bold">Error Terbaru</h3>
          <div className="mt-3 space-y-2">
            {summary.recent_errors.length === 0 && <p className="py-4 text-center text-xs text-slate-400">Tidak ada error tercatat</p>}
            {summary.recent_errors.map((e, i) => (
              <div key={i} className="rounded-lg border border-red-100 bg-red-50 p-2 text-[11px]">
                <div className="flex justify-between font-semibold text-red-700"><span>{e.method} /{e.path}</span><span>{e.status}</span></div>
                <div className="mt-0.5 text-red-500">{new Date(e.timestamp).toLocaleString("id-ID")} • {e.duration_ms}ms</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}