import React, { useState } from "react";
import { Printer } from "lucide-react";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../context/ToastContext";
import { formatIDR } from "../../mockData";
import { downloadReceiptPdf } from "../../lib/receiptPdf";

export function ReceiptModal({ open, transaction, onClose }) {
  const toast = useToast();
  const [printing, setPrinting] = useState(false);

  const handlePrint = () => {
    if (!transaction) return;
    setPrinting(true);
    try {
      downloadReceiptPdf(transaction);
      toast("Struk berhasil diunduh sebagai PDF");
    } catch (err) {
      toast(err.message || "Gagal membuat PDF struk", "danger");
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Modal open={open} title="Struk Transaksi" onClose={onClose} width="max-w-sm">
      <div className="mx-auto max-w-xs text-center">
        <div className="text-lg font-bold">▣ POS Kasir</div>
        <div className="mt-1 text-[11px] text-slate-500">{transaction?.outlet?.nama ?? "Outlet"}</div>
        <div className="my-4 border-t border-dashed" />
        <div className="flex justify-between text-[11px]">
          <span>{transaction?.nomor_transaksi}</span>
          <span>{transaction?.timestamp ? new Date(transaction.timestamp).toLocaleString("id-ID") : ""}</span>
        </div>
        <div className="my-3 border-t border-dashed" />
        {transaction?.items?.map((it) => (
          <div key={it.id} className="mb-2 flex justify-between text-xs">
            <span className="text-left">{it.snapshot_nama_produk}<small className="block text-slate-400">{it.jumlah} item</small></span>
            <b>{formatIDR(it.total_baris)}</b>
          </div>
        ))}
        <div className="my-3 border-t border-dashed" />
        <div className="space-y-1 text-[11px] text-slate-500">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatIDR(transaction?.subtotal ?? 0)}</span></div>
          {Number(transaction?.total_diskon) > 0 && <div className="flex justify-between"><span>Diskon</span><span>-{formatIDR(transaction.total_diskon)}</span></div>}
          {Number(transaction?.total_pajak) > 0 && <div className="flex justify-between"><span>Pajak</span><span>{formatIDR(transaction.total_pajak)}</span></div>}
          {Number(transaction?.pembulatan) !== 0 && <div className="flex justify-between"><span>Pembulatan</span><span>{Number(transaction?.pembulatan) > 0 ? "+" : ""}{formatIDR(transaction?.pembulatan)}</span></div>}
        </div>
        <div className="my-3 border-t border-dashed" />
        <div className="flex justify-between text-sm font-bold"><span>TOTAL</span><span>{formatIDR(transaction?.grand_total ?? 0)}</span></div>
        {transaction?.payments?.[0] && (
          <div className="mt-2 flex justify-between text-[11px] text-slate-500">
            <span>Kembalian</span><span>{formatIDR(transaction.payments[0].kembalian)}</span>
          </div>
        )}
        <p className="mt-5 text-[11px] text-slate-500">Terima kasih telah berbelanja</p>
      </div>
      <button className="btn-primary mt-5 w-full" onClick={handlePrint} disabled={printing || !transaction}>
        <Printer size={15} /> {printing ? "Membuat PDF..." : "Cetak Struk (PDF)"}
      </button>
    </Modal>
  );
}