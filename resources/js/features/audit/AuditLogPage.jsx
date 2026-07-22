import React, { useEffect, useState, useCallback } from "react";
import { Activity, CheckCircle2, Eye, FileClock, XCircle } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { Kpi } from "../../components/ui/Kpi";
import { Status } from "../../components/ui/Status";
import { Drawer } from "../../components/ui/Drawer";
import { useToast } from "../../context/ToastContext";
import { api } from "../../lib/apiClient";

const ACTION_LABEL = {
  void_transaction: "Void Transaksi",
  refund_transaction: "Refund Transaksi",
  resume_transaction: "Lanjutkan Keranjang Tertahan",
  archive_product: "Arsipkan Produk",
  reactivate_product: "Aktifkan Produk",
  close_shift: "Tutup Shift",
  review_shift_variance: "Tinjau Selisih Shift",
  stock_receipt: "Penerimaan Stok",
  stock_adjustment: "Penyesuaian Stok",
  stock_adjustment_request: "Pengajuan Penyesuaian Stok",
  approve_stock_adjustment: "Setujui Penyesuaian Stok",
  reject_stock_adjustment: "Tolak Penyesuaian Stok",
  authorize_price_override: "Otorisasi Override Harga",
  apply_price_override: "Terapkan Override Harga",
  change_own_password: "Ganti Password Sendiri",
  create_user: "Tambah Pengguna",
  update_user: "Ubah Data Pengguna",
  activate_user: "Aktifkan Pengguna",
  deactivate_user: "Nonaktifkan Pengguna",
  create_outlet: "Tambah Outlet",
  update_outlet: "Ubah Data Outlet",
  activate_outlet: "Aktifkan Outlet",
  deactivate_outlet: "Nonaktifkan Outlet",
};

const TABLE_LABEL = {
  users: "Pengguna",
  outlets: "Outlet",
  products: "Produk",
  transactions: "Transaksi",
  shifts: "Shift",
  stock_movements: "Pergerakan Stok",
};

export function AuditLogPage() {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [tanggalMulai, setTanggalMulai] = useState("");
  const [tanggalSelesai, setTanggalSelesai] = useState("");
  const [selected, setSelected] = useState(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (actionFilter) params.action = actionFilter;
      if (tanggalMulai) params.tanggal_mulai = tanggalMulai;
      if (tanggalSelesai) params.tanggal_selesai = tanggalSelesai;
      const res = await api.get("/audit-logs", params);
      setLogs(res.logs.data);
    } catch (err) {
      toast(err.message || "Gagal memuat audit log", "danger");
    } finally {
      setLoading(false);
    }
  }, [toast, actionFilter, tanggalMulai, tanggalSelesai]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const filteredLogs = logs.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return l.user?.nama?.toLowerCase().includes(q) || l.record_id?.toLowerCase().includes(q) || (ACTION_LABEL[l.action] ?? l.action).toLowerCase().includes(q);
  });

  const totalHariIni = logs.length;
  const sukses = logs.filter((l) => l.hasil === "success").length;
  const gagal = logs.filter((l) => l.hasil !== "success").length;
  const sensitif = logs.filter((l) => ["void_transaction", "refund_transaction", "stock_adjustment", "approve_stock_adjustment", "authorize_price_override", "apply_price_override"].includes(l.action)).length;

  return (
    <>
      <PageHeader title="Audit Log" subtitle="Riwayat tindakan sensitif — tidak dapat diedit" />

      <div className="grid grid-cols-4 gap-3">
        <Kpi icon={Activity} label="Total Aktivitas" value={totalHariIni} note="Hasil pencarian saat ini" tone="blue" />
        <Kpi icon={CheckCircle2} label="Berhasil" value={sukses} tone="emerald" />
        <Kpi icon={XCircle} label="Gagal / Ditolak" value={gagal} tone="orange" />
        <Kpi icon={FileClock} label="Tindakan Sensitif" value={sensitif} note="Void, refund, penyesuaian" tone="amber" />
      </div>

      <div className="card mt-3 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 p-4">
          <input className="input max-w-xs flex-1" placeholder="Cari pelaku, aksi, atau ID objek..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input w-52" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            <option value="">Semua tindakan</option>
            {Object.entries(ACTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input type="date" className="input w-40" value={tanggalMulai} onChange={(e) => setTanggalMulai(e.target.value)} />
          <span className="text-xs text-slate-400">s/d</span>
          <input type="date" className="input w-40" value={tanggalSelesai} onChange={(e) => setTanggalSelesai(e.target.value)} />
        </div>
        <table className="w-full">
          <thead className="table-head"><tr><th className="px-4 py-3">Waktu</th><th>Tindakan</th><th>Pelaku</th><th>Objek</th><th>Hasil</th><th className="pr-4 text-right">Detail</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="table-cell text-center text-slate-400">Memuat...</td></tr>}
            {!loading && filteredLogs.map((l) => (
              <tr key={l.id}>
                <td className="table-cell">{new Date(l.created_at).toLocaleString("id-ID")}</td>
                <td className="table-cell font-semibold">{ACTION_LABEL[l.action] ?? l.action}</td>
                <td className="table-cell">{l.user?.nama ?? "-"}</td>
                <td className="table-cell text-[11px] text-slate-500" title={l.record_id}>{TABLE_LABEL[l.table_name] ?? l.table_name} • {l.record_id?.slice(0, 8)}...</td>
                <td className="table-cell"><Status value={l.hasil === "success" ? "Berhasil" : l.hasil === "rejected" ? "Ditolak" : "Gagal"} /></td>
                <td className="table-cell text-right"><button className="btn-secondary h-8 px-2" onClick={() => setSelected(l)}><Eye size={14} /> Detail</button></td>
              </tr>
            ))}
            {!loading && filteredLogs.length === 0 && <tr><td colSpan={6} className="table-cell text-center text-slate-400">Tidak ada log ditemukan</td></tr>}
          </tbody>
        </table>
      </div>

      <Drawer open={!!selected} title="Detail Audit Log" onClose={() => setSelected(null)}>
        {selected && (
          <>
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="flex justify-between"><Status value={selected.hasil === "success" ? "Berhasil" : selected.hasil === "rejected" ? "Ditolak" : "Gagal"} /><span className="text-[11px] text-slate-400">{new Date(selected.created_at).toLocaleString("id-ID")}</span></div>
              <h3 className="mt-3 text-base font-bold">{ACTION_LABEL[selected.action] ?? selected.action}</h3>
              <p className="mt-1 text-xs text-slate-500">{TABLE_LABEL[selected.table_name] ?? selected.table_name} • {selected.record_id}</p>
            </div>
            <div className="mt-5 space-y-4 text-xs">
              <div><span className="text-slate-500">Pelaku</span><div className="mt-1 font-semibold">{selected.user?.nama ?? "Sistem"}</div></div>
              <div><span className="text-slate-500">Correlation ID</span><div className="mt-1 font-mono text-[11px] text-slate-600">{selected.correlation_id}</div></div>
              {selected.old_values && (
                <div><span className="text-slate-500">Data sebelum</span><pre className="mt-1 overflow-auto rounded-lg border bg-slate-50 p-3 text-[11px] leading-5">{JSON.stringify(selected.old_values, null, 2)}</pre></div>
              )}
              {selected.new_values && (
                <div><span className="text-slate-500">Data sesudah</span><pre className="mt-1 overflow-auto rounded-lg border bg-slate-50 p-3 text-[11px] leading-5">{JSON.stringify(selected.new_values, null, 2)}</pre></div>
              )}
              <div><span className="text-slate-500">IP Address</span><div className="mt-1 font-semibold">{selected.ip_address ?? "-"}</div></div>
            </div>
          </>
        )}
      </Drawer>
    </>
  );
}