import React, { useEffect, useState, useCallback } from "react";
import { NavLink } from "react-router-dom";
import { CircleDollarSign, Eye, Plus, Printer, ReceiptText, XCircle } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { Kpi } from "../../components/ui/Kpi";
import { Status } from "../../components/ui/Status";
import { Drawer } from "../../components/ui/Drawer";
import { Modal } from "../../components/ui/Modal";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { formatIDR } from "../../mockData";
import { api } from "../../lib/apiClient";
import { ReceiptModal } from "./ReceiptModal";

const STATUS_LABEL = { completed: "Berhasil", void: "Dibatalkan", refunded: "Refund", hold: "Ditahan", pending: "Pending" };

export function TransactionsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user.role === "Admin";

  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({ total_transaksi: 0, nilai_transaksi: 0, jumlah_refund: 0, total_refund: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const [refundOpen, setRefundOpen] = useState(false);
  const [refundQty, setRefundQty] = useState({});
  const [refundReason, setRefundReason] = useState("");
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [voiding, setVoiding] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const [listRes, summaryRes] = await Promise.all([
        api.get("/transactions", params),
        api.get("/transactions/summary"),
      ]);
      setTransactions(listRes.transactions.data);
      setSummary(summaryRes);
    } catch (err) {
      toast(err.message || "Gagal memuat transaksi", "danger");
    } finally {
      setLoading(false);
    }
  }, [toast, search, statusFilter]);

  useEffect(() => { loadList(); }, [loadList]);

  const openDetail = async (id) => {
    setSelectedId(id);
    setLoadingDetail(true);
    try {
      const res = await api.get(`/transactions/${id}`);
      setSelected(res.transaction);
    } catch (err) {
      toast(err.message || "Gagal memuat detail transaksi", "danger");
      setSelectedId(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetail = () => { setSelectedId(null); setSelected(null); };

  const openRefund = () => {
    const initialQty = {};
    selected.items.forEach((it) => { initialQty[it.id] = 0; });
    setRefundQty(initialQty);
    setRefundReason("");
    setRefundOpen(true);
  };

  const submitRefund = async () => {
    const items = Object.entries(refundQty)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([transaction_item_id, jumlah]) => ({ transaction_item_id, jumlah: Number(jumlah) }));

    if (!items.length) return toast("Pilih minimal satu item untuk direfund", "danger");
    if (!refundReason.trim()) return toast("Alasan refund wajib diisi", "danger");

    setRefundSubmitting(true);
    try {
      await api.post(`/transactions/${selected.id}/refund`, { refund_reason: refundReason, items });
      toast("Refund berhasil diproses");
      setRefundOpen(false);
      closeDetail();
      await loadList();
    } catch (err) {
      toast(err.message || "Gagal memproses refund", "danger");
    } finally {
      setRefundSubmitting(false);
    }
  };

  const voidTransaction = async () => {
    setVoiding(true);
    try {
      await api.post(`/transactions/${selected.id}/void`, { void_reason: "Dibatalkan oleh Admin" });
      toast("Transaksi berhasil dibatalkan");
      closeDetail();
      await loadList();
    } catch (err) {
      toast(err.message || "Gagal membatalkan transaksi", "danger");
    } finally {
      setVoiding(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Transaksi"
        subtitle={isAdmin ? "Riwayat seluruh transaksi outlet" : "Riwayat transaksi milik Anda"}
        actions={user.role === "Kasir" && <NavLink to="/transaksi/kasir" className="btn-primary"><Plus size={15} /> Transaksi Baru</NavLink>}
      />

      <div className="grid grid-cols-4 gap-3">
        <Kpi icon={ReceiptText} label="Total Transaksi" value={summary.total_transaksi} note="Hari ini" tone="blue" />
        <Kpi icon={CircleDollarSign} label="Nilai Transaksi" value={formatIDR(summary.nilai_transaksi)} note="Sebelum refund" tone="orange" />
        <Kpi icon={XCircle} label="Refund" value={summary.jumlah_refund} note={formatIDR(summary.total_refund)} tone="emerald" />
        <Kpi icon={ReceiptText} label="Rata-rata Transaksi" value={summary.total_transaksi ? formatIDR(summary.nilai_transaksi / summary.total_transaksi) : formatIDR(0)} note="Per transaksi" tone="blue" />
      </div>

      <div className="card mt-3 overflow-hidden">
        <div className="flex items-center gap-3 p-4">
          <div className="relative max-w-sm flex-1">
            <input className="input" placeholder="Cari nomor transaksi..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input w-44" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Semua status</option>
            <option value="completed">Berhasil</option>
            <option value="void">Dibatalkan</option>
            <option value="refunded">Refund</option>
          </select>
        </div>
        <table className="w-full">
          <thead className="table-head"><tr><th className="px-4 py-3">Nomor Transaksi</th><th>Waktu</th><th>Kasir</th><th>Total</th><th>Status</th><th className="pr-4 text-right">Aksi</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="table-cell text-center text-slate-400">Memuat...</td></tr>}
            {!loading && transactions.map((t) => (
              <tr key={t.id}>
                <td className="table-cell font-semibold">{t.nomor_transaksi}</td>
                <td className="table-cell">{new Date(t.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</td>
                <td className="table-cell">{t.cashier?.nama}</td>
                <td className="table-cell font-semibold">{formatIDR(t.grand_total)}</td>
                <td className="table-cell"><Status value={STATUS_LABEL[t.status] ?? t.status} /></td>
                <td className="table-cell text-right"><button className="btn-secondary h-8 px-2" onClick={() => openDetail(t.id)}><Eye size={14} /> Detail</button></td>
              </tr>
            ))}
            {!loading && transactions.length === 0 && <tr><td colSpan={6} className="table-cell text-center text-slate-400">Tidak ada transaksi</td></tr>}
          </tbody>
        </table>
      </div>

      <Drawer open={!!selectedId} title="Detail Transaksi" onClose={closeDetail}>
        {loadingDetail && <p className="text-sm text-slate-500">Memuat...</p>}
        {selected && !loadingDetail && (
          <>
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="flex justify-between">
                <div><div className="text-[11px] text-slate-500">Nomor transaksi</div><div className="mt-1 text-sm font-bold">{selected.nomor_transaksi}</div></div>
                <Status value={STATUS_LABEL[selected.status] ?? selected.status} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div><span className="text-slate-500">Kasir</span><div className="mt-1 font-semibold">{selected.cashier?.nama}</div></div>
                <div><span className="text-slate-500">Waktu</span><div className="mt-1 font-semibold">{new Date(selected.timestamp).toLocaleString("id-ID")}</div></div>
              </div>
            </div>
            <div className="mt-5">
              <h4 className="text-xs font-bold">Item transaksi</h4>
              {selected.items.map((it) => (
                <div className="flex justify-between border-b py-3 text-xs" key={it.id}>
                  <div>
                    <div className="font-semibold">{it.snapshot_nama_produk}</div>
                    <div className="mt-1 text-slate-500">{it.jumlah} × {formatIDR(it.harga_satuan)}</div>
                    {it.sudah_direfund > 0 && <div className="mt-0.5 text-[10px] text-amber-600">{it.sudah_direfund} sudah direfund</div>}
                  </div>
                  <span className="font-semibold">{formatIDR(it.total_baris)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between text-sm font-bold"><span>Total</span><span>{formatIDR(selected.grand_total)}</span></div>

            {selected.status === "completed" && isAdmin && (
              <div className="mt-6 grid grid-cols-3 gap-2">
                <button className="btn-secondary" onClick={() => setReceiptOpen(true)}><Printer size={15} /> Struk</button>
                <button className="btn-danger" disabled={voiding} onClick={voidTransaction}><XCircle size={15} /> {voiding ? "..." : "Batalkan"}</button>
                <button className="btn-danger" onClick={openRefund}><ReceiptText size={15} /> Refund</button>
              </div>
            )}
            {selected.status === "completed" && !isAdmin && (
              <div className="mt-6"><button className="btn-secondary w-full" onClick={() => setReceiptOpen(true)}><Printer size={15} /> Cetak Struk</button></div>
            )}
          </>
        )}
      </Drawer>

      <Modal open={refundOpen} title="Ajukan Refund" onClose={() => setRefundOpen(false)}>
        <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700">Pilih jumlah item yang ingin direfund. Refund tidak bisa melebihi sisa yang belum direfund.</div>
        <div className="mt-4 space-y-3">
          {selected?.items.map((it) => (
            <div key={it.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-xs font-bold">{it.snapshot_nama_produk}</div>
                <div className="mt-0.5 text-[11px] text-slate-500">Sisa bisa direfund: {it.sisa_bisa_refund}</div>
              </div>
              <input
                type="number" min="0" max={it.sisa_bisa_refund}
                className="input w-20"
                value={refundQty[it.id] ?? 0}
                disabled={it.sisa_bisa_refund <= 0}
                onChange={(e) => setRefundQty((q) => ({ ...q, [it.id]: Math.min(Number(e.target.value), it.sisa_bisa_refund) }))}
              />
            </div>
          ))}
        </div>
        <div className="mt-4"><label className="label">Alasan refund</label><textarea className="input h-auto py-2" rows="3" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="Jelaskan alasan refund..." /></div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setRefundOpen(false)}>Batal</button>
          <button className="btn-danger" disabled={refundSubmitting} onClick={submitRefund}>{refundSubmitting ? "Memproses..." : "Proses Refund"}</button>
        </div>
      </Modal>

      <ReceiptModal open={receiptOpen} transaction={selected} onClose={() => setReceiptOpen(false)} />
    </>
  );
}