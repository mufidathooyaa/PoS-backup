import jsPDF from "jspdf";
import { formatIDR } from "../mockData";

const PAGE_WIDTH = 80; // mm, mengikuti lebar kertas thermal umum
const MARGIN_X = 5;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

function formatTanggal(timestamp) {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function drawDashedLine(doc, y) {
  doc.setLineDashPattern([0.8, 0.8], 0);
  doc.line(MARGIN_X, y, PAGE_WIDTH - MARGIN_X, y);
  doc.setLineDashPattern([], 0);
}

/**
 * Membangun dokumen jsPDF dari data transaksi.
 * Dipisah dari fungsi download supaya bisa dites atau dipakai ulang
 * (mis. dibuka di tab baru) tanpa langsung memicu unduhan file.
 */
export function buildReceiptPdf(transaction) {
  const items = transaction?.items ?? [];
  const payment = transaction?.payments?.[0] ?? null;

  // Perkirakan tinggi halaman berdasarkan jumlah baris agar struk tidak terpotong
  const baseHeight = 55; // header + footer
  const perItemHeight = 8; // nama produk + baris qty/total
  const paymentHeight = payment ? 14 : 4;
  const estimatedHeight = baseHeight + items.length * perItemHeight + paymentHeight;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [PAGE_WIDTH, Math.max(estimatedHeight, 90)],
  });

  let y = 8;

  doc.setFont("courier", "bold");
  doc.setFontSize(12);
  doc.text("POS KASIR", PAGE_WIDTH / 2, y, { align: "center" });
  y += 5;

  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  doc.text(transaction?.outlet?.nama ?? "Outlet", PAGE_WIDTH / 2, y, { align: "center" });
  y += 5;

  drawDashedLine(doc, y);
  y += 4;

  doc.setFontSize(7.5);
  doc.text(transaction?.nomor_transaksi ?? "-", MARGIN_X, y);
  y += 3.5;
  doc.text(formatTanggal(transaction?.timestamp), MARGIN_X, y);
  y += 3.5;
  if (transaction?.cashier?.nama) {
    doc.text(`Kasir: ${transaction.cashier.nama}`, MARGIN_X, y);
    y += 3.5;
  }

  drawDashedLine(doc, y);
  y += 4;

  doc.setFontSize(7.5);
  items.forEach((it) => {
    const nama = doc.splitTextToSize(it.snapshot_nama_produk ?? "-", CONTENT_WIDTH);
    doc.text(nama, MARGIN_X, y);
    y += nama.length * 3.2;

    const qtyLabel = `${it.jumlah} x`;
    doc.text(qtyLabel, MARGIN_X, y);
    doc.text(formatIDR(it.total_baris ?? 0), PAGE_WIDTH - MARGIN_X, y, { align: "right" });
    y += 4.5;
  });

  drawDashedLine(doc, y);
  y += 4.5;

  doc.setFont("courier", "bold");
  doc.setFontSize(9);
  doc.text("TOTAL", MARGIN_X, y);
  doc.text(formatIDR(transaction?.grand_total ?? 0), PAGE_WIDTH - MARGIN_X, y, { align: "right" });
  y += 5;

  if (payment) {
    doc.setFont("courier", "normal");
    doc.setFontSize(7.5);
    const metode = payment.paymentMethod?.nama ?? payment.metode ?? "-";
    doc.text(`Bayar (${metode})`, MARGIN_X, y);
    doc.text(formatIDR(payment.jumlah_dibayar ?? 0), PAGE_WIDTH - MARGIN_X, y, { align: "right" });
    y += 3.5;
    doc.text("Kembalian", MARGIN_X, y);
    doc.text(formatIDR(payment.kembalian ?? 0), PAGE_WIDTH - MARGIN_X, y, { align: "right" });
    y += 5;
  }

  drawDashedLine(doc, y);
  y += 4.5;

  doc.setFont("courier", "normal");
  doc.setFontSize(7.5);
  doc.text("Terima kasih telah berbelanja", PAGE_WIDTH / 2, y, { align: "center" });

  return doc;
}

/**
 * Membuat file PDF struk dan langsung memicu unduhan di browser.
 * Nama file mengikuti nomor transaksi supaya mudah dicari ulang.
 */
export function downloadReceiptPdf(transaction) {
  const doc = buildReceiptPdf(transaction);
  const nomor = transaction?.nomor_transaksi ?? "transaksi";
  doc.save(`Struk-${nomor}.pdf`);
}