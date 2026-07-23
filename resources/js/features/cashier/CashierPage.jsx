import React, { useEffect, useRef, useState, useCallback } from "react";
import { NavLink } from "react-router-dom";
import {
  Archive, CheckCircle2, CreditCard, History, Minus, Package, Plus, Printer,
  RefreshCw, ScanBarcode, Search, ShoppingCart, Trash2, X,
} from "lucide-react";
import { Modal } from "../../components/ui/Modal";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { formatIDR } from "../../mockData";
import { api, ApiError } from "../../lib/apiClient";
import { BarcodeScannerModal } from "../../components/ui/BarcodeScannerModal";
import qrisImage from "../../assets/qris.jpeg";
import { downloadReceiptPdf } from "../../lib/receiptPdf";
import { PasswordInput } from "../../components/ui/PasswordInput";

export function CashierPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [shift, setShift] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [taxRule, setTaxRule] = useState(null);
  const [discountRules, setDiscountRules] = useState([]);
  const [discountRuleId, setDiscountRuleId] = useState(null);
  const [heldList, setHeldList] = useState([]);
  const [loadingPage, setLoadingPage] = useState(true);

  const [cart, setCart] = useState([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Semua");
  const [paymentMethodId, setPaymentMethodId] = useState(null);
  const [cash, setCash] = useState("");
  const [qrisModalOpen, setQrisModalOpen] = useState(false); // <-- pakai ini sekarang
  const [processing, setProcessing] = useState(false);
  const [successResult, setSuccessResult] = useState(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [heldModalOpen, setHeldModalOpen] = useState(false);
  const [resumeTarget, setResumeTarget] = useState(null);
  const [resumeCash, setResumeCash] = useState("");
  const [resumePaymentMethodId, setResumePaymentMethodId] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const [overrideTarget, setOverrideTarget] = useState(null); // item keranjang yang sedang di-override
  const [overridePrice, setOverridePrice] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideAdminLogin, setOverrideAdminLogin] = useState("");
  const [overrideAdminPassword, setOverrideAdminPassword] = useState("");
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);
  const [overrideStep, setOverrideStep] = useState("input"); // "input" | "auth"

  const shiftOpen = !!shift;

  const loadAll = useCallback(async () => {
    setLoadingPage(true);
    try {
      const [catalogRes, paymentRes, taxRes, discountRes, heldRes] = await Promise.all([
        api.get("/catalog", { for_checkout: true }),
        api.get("/payment-methods"),
        api.get("/tax-rules/active"),
        api.get("/discount-rules/active"), // <-- baris baru
        api.get("/transactions/held"),
      ]);
      setCatalog(catalogRes.products);
      setPaymentMethods(paymentRes.payment_methods);
      setTaxRule(taxRes.tax_rule);
      setDiscountRules(discountRes.discount_rules); // <-- baris baru
      setDiscountRuleId((prev) => prev ?? discountRes.discount_rules.find((d) => d.nama === "Tanpa Diskon")?.id ?? discountRes.discount_rules[0]?.id ?? null);
      setHeldList(heldRes.held_transactions);
      if (paymentRes.payment_methods.length) {
        setPaymentMethodId((prev) => prev ?? paymentRes.payment_methods[0].id);
      }
    } catch (err) {
      toast(err.message || "Gagal memuat data kasir", "danger");
    }

    try {
      const shiftRes = await api.get("/shifts/current");
      setShift(shiftRes.shift);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setShift(null);
      } else {
        toast(err.message || "Gagal memuat status shift", "danger");
      }
    }
    setLoadingPage(false);
  }, [toast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const categories = ["Semua", ...new Set(catalog.map((p) => p.category).filter(Boolean))];

  const filteredCatalog = catalog.filter((p) => {
    const matchQuery = p.nama.toLowerCase().includes(query.toLowerCase())
      || p.sku.toLowerCase().includes(query.toLowerCase())
      || (p.barcode && p.barcode === query);
    const matchCategory = categoryFilter === "Semua" || p.category === categoryFilter;
    return matchQuery && matchCategory;
  });

  const addToCart = (p) => {
    setCart((c) => {
      const existing = c.find((x) => x.product_id === p.id);
      const currentQty = existing ? existing.qty : 0;
      if (p.track_stock && currentQty + 1 > p.stok_tersedia) {
        toast(`Stok "${p.nama}" tidak mencukupi (tersedia: ${p.stok_tersedia})`, "danger");
        return c;
      }
      if (existing) {
        return c.map((x) => (x.product_id === p.id ? { ...x, qty: x.qty + 1 } : x));
      }
      return [...c, { product_id: p.id, nama: p.nama, harga: p.harga, unit: p.unit, qty: 1, stok_tersedia: p.stok_tersedia, track_stock: p.track_stock }];
    });
  };

  const changeQty = (id, delta) => {
    setCart((c) => c.map((x) => {
      if (x.product_id !== id) return x;
      const newQty = x.qty + delta;
      if (x.track_stock && newQty > x.stok_tersedia) {
        toast(`Stok "${x.nama}" tidak mencukupi (tersedia: ${x.stok_tersedia})`, "danger");
        return x;
      }
      return { ...x, qty: newQty };
    }).filter((x) => x.qty > 0));
  };

  const openOverride = (cartItem) => {
    setOverrideTarget(cartItem);
    setOverridePrice(String(cartItem.harga));
    setOverrideReason("");
    setOverrideAdminLogin("");
    setOverrideAdminPassword("");
    setOverrideStep("input");
  };

  const submitOverrideStepOne = (e) => {
    e.preventDefault();
    if (!overridePrice || Number(overridePrice) < 0) return toast("Harga baru tidak valid", "danger");
    if (!overrideReason.trim()) return toast("Alasan wajib diisi", "danger");
    setOverrideStep("auth");
  };

  const submitOverrideAuth = async (e) => {
    e.preventDefault();
    setOverrideSubmitting(true);
    try {
      const res = await api.post("/price-overrides/authorize", {
        login: overrideAdminLogin,
        password: overrideAdminPassword,
        product_id: overrideTarget.product_id,
        harga_baru: Number(overridePrice),
        alasan: overrideReason,
      });

      setCart((c) => c.map((x) =>
        x.product_id === overrideTarget.product_id
          ? { ...x, harga: Number(overridePrice), override_token: res.token, override_nama_admin: res.nama_admin, override_alasan: overrideReason }
          : x
      ));

      toast(`Harga diotorisasi oleh ${res.nama_admin}`);
      setOverrideTarget(null);
    } catch (err) {
      toast(err.message || "Otorisasi gagal", "danger");
    } finally {
      setOverrideSubmitting(false);
    }
  };

  const handleBarcodeDetected = (barcodeText) => {
    const product = catalog.find((p) => p.barcode === barcodeText);
    if (!product) {
      toast(`Produk dengan barcode "${barcodeText}" tidak ditemukan`, "danger");
      return;
    }
    addToCart(product);
    toast(`${product.nama} ditambahkan ke keranjang`);
  };

  const selectedMethodName = paymentMethods.find((m) => m.id === paymentMethodId)?.nama;
  const isTunai = selectedMethodName === "Tunai";

  const subtotal = cart.reduce((s, p) => s + p.harga * p.qty, 0);
  const selectedDiscount = discountRules.find((d) => d.id === discountRuleId);
  const discountAmount = selectedDiscount
    ? (selectedDiscount.tipe === "persentase" ? Math.round(subtotal * (selectedDiscount.nilai / 100)) : Number(selectedDiscount.nilai))
    : 0;
  const dasarPajak = subtotal - discountAmount;
  const taxAmount = taxRule ? dasarPajak * (taxRule.persentase / 100) : 0;
  const totalSebelumBulat = dasarPajak + taxAmount;
  const grandTotalEstimate = isTunai ? Math.round(totalSebelumBulat / 500) * 500 : Math.round(totalSebelumBulat);
  const pembulatanEstimate = grandTotalEstimate - totalSebelumBulat;

  const isQris = selectedMethodName === "QRIS";

  const validate = () => {
    if (!shiftOpen) return "Buka shift sebelum memulai transaksi.";
    if (!cart.length) return "Keranjang masih kosong.";
    if (!paymentMethodId) return "Pilih metode pembayaran.";
    if (isTunai && Number(cash) < grandTotalEstimate) return "Pembayaran kurang.";
    return "";
  };

  const pay = async () => {
    const errorMsg = validate();
    if (errorMsg) {
      toast(errorMsg, "danger");
      return false; // Gagal validasi
    }

    setProcessing(true);
    try {
      const payload = {
        idempotency_key: crypto.randomUUID(),
        items: cart.map((x) => ({ 
          product_id: x.product_id, 
          jumlah: x.qty, 
          price_override_token: x.override_token ?? undefined,
        })),
        tax_rule_id: taxRule?.id ?? null,
        discount_rule_id: discountRuleId,
        payment_method_id: paymentMethodId,
        jumlah_dibayar: isTunai ? Number(cash) : grandTotalEstimate,
      };
      const res = await api.post("/transactions", payload);
      setSuccessResult(res.transaction);
      setCart([]);
      setCash("");
      await loadAll(); 
      return true; // Sukses
    } catch (err) {
      toast(err.message || "Transaksi gagal diproses", "danger");
      return false; // Gagal API
    } finally {
      setProcessing(false);
    }
  };

  const handlePayClick = () => {
    const errorMsg = validate();
    if (errorMsg) return toast(errorMsg, "danger");

    if (isQris) {
      setQrisModalOpen(true);
      return;
    }
    pay();
  };

  const holdCart = async () => {
    if (!cart.length) return toast("Keranjang masih kosong", "danger");
    try {
      await api.post("/transactions/hold", {
        items: cart.map((x) => ({ product_id: x.product_id, jumlah: x.qty })),
      });
      setCart([]);
      toast("Keranjang berhasil ditahan");
      await loadAll();
    } catch (err) {
      toast(err.message || "Gagal menahan keranjang", "danger");
    }
  };

  const openResume = (heldTrx) => {
    setResumeTarget(heldTrx);
    setResumeCash("");
    setResumePaymentMethodId(paymentMethods[0]?.id ?? null);
    setHeldModalOpen(false);
  };

  const editHold = async (heldTrx) => {
    try {
      // Muat item-nya ke keranjang aktif dulu SEBELUM dibatalkan, supaya data tidak hilang kalau cancel gagal
      const newCartItems = heldTrx.items.map((item) => {
        const productInCatalog = catalog.find((p) => p.id === item.product_id);
        return {
          product_id: item.product_id,
          nama: item.snapshot_nama_produk,
          harga: Number(item.harga_satuan),
          unit: productInCatalog?.unit ?? "",
          qty: item.jumlah,
          stok_tersedia: productInCatalog?.stok_tersedia ?? 0,
          track_stock: productInCatalog?.track_stock ?? false,
        };
      });

      await api.post(`/transactions/${heldTrx.id}/cancel-hold`);
      setCart(newCartItems);
      setHeldModalOpen(false);
      toast("Keranjang dimuat ulang, silakan edit lalu tahan/bayar kembali");
      await loadAll();
    } catch (err) {
      toast(err.message || "Gagal memuat ulang keranjang", "danger");
    }
  };

  const deleteHold = async (heldTrx) => {
    try {
      await api.post(`/transactions/${heldTrx.id}/cancel-hold`);
      toast("Keranjang tertahan dibatalkan");
      await loadAll();
    } catch (err) {
      toast(err.message || "Gagal membatalkan keranjang", "danger");
    }
  };

  const confirmResume = async () => {
    if (!resumePaymentMethodId) return toast("Pilih metode pembayaran", "danger");
    const methodName = paymentMethods.find((m) => m.id === resumePaymentMethodId)?.nama;
    const amount = methodName === "Tunai" ? Number(resumeCash) : Number(resumeTarget.grand_total);
    if (methodName === "Tunai" && amount < Number(resumeTarget.grand_total)) {
      return toast("Pembayaran kurang", "danger");
    }
    try {
      const res = await api.post(`/transactions/${resumeTarget.id}/resume`, {
        payment_method_id: resumePaymentMethodId,
        jumlah_dibayar: amount,
      });
      setSuccessResult(res.transaction);
      setResumeTarget(null);
      await loadAll();
    } catch (err) {
      toast(err.message || "Gagal melanjutkan transaksi", "danger");
    }
  };

  const confirmCancel = () => {
    setCart([]);
    setCancelConfirm(false);
    toast("Keranjang dikosongkan");
  };

  if (loadingPage) {
    return <div className="p-6 text-sm text-slate-500">Memuat data kasir...</div>;
  }

  return (
    <div className="-m-5 flex h-[calc(100vh-64px)] overflow-hidden">
      <section className="flex min-w-0 flex-1 flex-col border-r bg-canvas p-4">
        <div className="mb-3 flex items-start justify-between">
          <div><h1 className="page-title">Kasir</h1><p className="page-subtitle">Pilih produk atau scan barcode</p></div>
          <span className={`badge ${shiftOpen ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{shiftOpen ? "Shift Aktif" : "Shift Belum Dibuka"}</span>
        </div>
        {!shiftOpen && (
          <div className="mb-3 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <span><b>Transaksi dinonaktifkan.</b> Anda harus membuka shift terlebih dahulu.</span>
            <NavLink to="/shift" className="font-bold underline">Buka shift</NavLink>
          </div>
        )}
        <div className="mb-3 flex gap-2">
          <div className="relative flex-1">
            <Search size={17} className="absolute left-3 top-3 text-slate-400" />
            <input className="input h-11 pl-10" placeholder="Cari nama produk, SKU, atau scan barcode..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <button className="btn-secondary h-11 shrink-0 border-orange text-orange hover:bg-orange-50" onClick={() => setScannerOpen(true)}><ScanBarcode size={18} /> Scan Barcode</button>
        </div>
        <div className="mb-3 flex gap-2 overflow-x-auto">
          {categories.map((c) => (
            <button key={c} onClick={() => setCategoryFilter(c)} className={`shrink-0 badge px-3 py-2 ${categoryFilter === c ? "bg-navy text-white" : "border bg-white text-slate-600"}`}>{c}</button>
          ))}
        </div>
        <div className="grid flex-1 grid-cols-4 content-start gap-2 overflow-auto pr-1">
          {filteredCatalog.map((p) => (
            <button key={p.id} onClick={() => addToCart(p)} className="card min-h-32 p-3 text-left hover:border-orange hover:shadow-md">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-600"><Package size={17} /></span>
              <div className="mt-3 line-clamp-2 text-xs font-bold">{p.nama}</div>
              <div className="mt-1 text-[10px] text-slate-400">{p.sku} • Stok {p.track_stock ? p.stok_tersedia : "∞"}</div>
              <div className="mt-2 text-xs font-bold text-orange">{formatIDR(p.harga)}</div>
            </button>
          ))}
          {filteredCatalog.length === 0 && <div className="col-span-4 py-10 text-center text-sm text-slate-400">Tidak ada produk ditemukan</div>}
        </div>
      </section>

      <aside className="flex w-[390px] shrink-0 flex-col bg-white">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div><h2 className="text-sm font-bold">Keranjang</h2><p className="text-[11px] text-slate-500">{cart.reduce((s, x) => s + x.qty, 0)} item</p></div>
          <div className="flex gap-1">
            <button title="Tahan keranjang" className="rounded-lg border p-2 text-slate-500 hover:bg-slate-50" onClick={holdCart}><Archive size={15} /></button>
            <button title="Keranjang tertahan" className="relative rounded-lg border p-2 text-slate-500 hover:bg-slate-50" onClick={() => setHeldModalOpen(true)}>
              <History size={15} />
              {heldList.length > 0 && <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-orange text-[9px] font-bold text-white">{heldList.length}</span>}
            </button>
            <button title="Kosongkan keranjang" aria-label="Kosongkan keranjang" disabled={!cart.length} className="rounded-lg border p-2 text-red-500 hover:bg-red-50 disabled:opacity-30" onClick={() => setCancelConfirm(true)}><Trash2 size={15} /></button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {!cart.length ? (
            <div className="grid h-full place-items-center text-center">
              <div>
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400"><ShoppingCart size={22} /></span>
                <p className="mt-3 text-sm font-semibold">Keranjang kosong</p>
                <p className="mt-1 text-xs text-slate-400">Klik produk untuk menambahkan</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((p) => (
                <div key={p.product_id} className="rounded-lg border p-3">
                   <div className="flex justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold">{p.nama}</div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                          {formatIDR(p.harga)}
                          {p.override_token && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Harga diubah</span>}
                          <button className="text-blue-500 underline" onClick={() => openOverride(p)}>Ubah Harga</button>
                        </div>
                      </div>
                      <button className="text-slate-400 hover:text-red-500" onClick={() => setCart((c) => c.filter((x) => x.product_id !== p.product_id))} aria-label={`Hapus ${p.nama} dari keranjang`}><X size={15} /></button>
                    </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center rounded-lg border">
                      <button className="p-1.5" onClick={() => changeQty(p.product_id, -1)} aria-label={`Kurangi jumlah ${p.nama}`}><Minus size={13} /></button>
                      <span className="w-8 text-center text-xs font-bold">{p.qty}</span>
                      <button className="p-1.5" onClick={() => changeQty(p.product_id, 1)} aria-label={`Tambah jumlah ${p.nama}`}><Plus size={13} /></button>
                    </div>
                    <span className="text-xs font-bold">{formatIDR(p.harga * p.qty)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="border-t bg-slate-50 p-4">
          <div className="mb-2">
            <label className="label">Diskon</label>
            <select className="input h-9" value={discountRuleId ?? ""} onChange={(e) => setDiscountRuleId(Number(e.target.value))}>
              {discountRules.map((d) => <option key={d.id} value={d.id}>{d.nama}</option>)}
            </select>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{formatIDR(subtotal)}</span></div>
            {discountAmount > 0 && <div className="flex justify-between text-emerald-600"><span>Diskon ({selectedDiscount?.nama})</span><span>-{formatIDR(discountAmount)}</span></div>}
            {pembulatanEstimate !== 0 && (
              <div className="flex justify-between text-slate-500"><span>Pembulatan</span><span>{pembulatanEstimate > 0 ? "+" : ""}{formatIDR(pembulatanEstimate)}</span></div>
            )}
            <div className="flex justify-between text-slate-500"><span>Pajak {taxRule ? `(${taxRule.persentase}%)` : ""}</span><span>{formatIDR(taxAmount)}</span></div>
            <div className="flex justify-between border-t pt-2 text-sm font-bold"><span>Total</span><span>{formatIDR(grandTotalEstimate)}</span></div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {paymentMethods.map((m) => (
              <button key={m.id} onClick={() => setPaymentMethodId(m.id)} className={`rounded-lg border p-2 text-[10px] font-semibold ${paymentMethodId === m.id ? "border-orange bg-orange-50 text-orange" : "bg-white text-slate-600"}`}>{m.nama}</button>
            ))}
          </div>

          {isTunai && (
            <div className="mt-2">
              <label className="label">Uang Diterima</label>
              <input type="number" className="input" placeholder="0" value={cash} onChange={(e) => setCash(e.target.value)} />
              {Number(cash) > 0 && (
                <div className={`mt-1.5 text-right text-xs font-semibold ${Number(cash) < grandTotalEstimate ? "text-red-500" : "text-emerald-600"}`}>
                  {Number(cash) < grandTotalEstimate ? "Pembayaran kurang" : `Kembalian ${formatIDR(Number(cash) - grandTotalEstimate)}`}
                </div>
              )}
            </div>
          )}

          <button className="btn-primary mt-3 h-11 w-full" disabled={processing || !shiftOpen} onClick={handlePayClick}>
            {processing ? <><RefreshCw size={16} className="animate-spin" />Memproses...</> : <><CreditCard size={17} />Bayar Sekarang • {formatIDR(grandTotalEstimate)}</>}
          </button>
        </div>
      </aside>

      {/* Modal sukses transaksi */}
      <Modal open={!!successResult} title="Transaksi Berhasil" onClose={() => setSuccessResult(null)} width="max-w-sm">
        <div className="text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 size={32} /></span>
          <h3 className="mt-4 text-lg font-bold">Transaksi Berhasil</h3>
          <p className="mt-1 text-xs text-slate-500">Pembayaran berhasil dicatat</p>
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm font-bold">{successResult?.nomor_transaksi}</div>
          {successResult?.payments?.[0]?.kembalian > 0 && (
            <div className="mt-2 text-xs text-slate-500">Kembalian: <span className="font-bold text-slate-800">{formatIDR(successResult.payments[0].kembalian)}</span></div>
          )}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              className="btn-secondary"
              onClick={() => {
                try {
                  downloadReceiptPdf(successResult);
                  toast("Struk berhasil diunduh sebagai PDF");
                } catch (err) {
                  toast(err.message || "Gagal membuat PDF struk", "danger");
                }
              }}
            >
              <Printer size={15} /> Cetak Struk
            </button>
            <button className="btn-primary" onClick={() => setSuccessResult(null)}>Transaksi Baru</button>
          </div>
        </div>
      </Modal>

      {/* Modal konfirmasi kosongkan keranjang */}
      <Modal open={cancelConfirm} title="Kosongkan Keranjang" onClose={() => setCancelConfirm(false)}>
        <p className="text-xs text-slate-500">Semua item di keranjang akan dihapus. Tindakan ini tidak memengaruhi data tersimpan karena keranjang belum dibayar.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setCancelConfirm(false)}>Kembali</button>
          <button className="btn-danger" onClick={confirmCancel}>Kosongkan</button>
        </div>
      </Modal>

      {/* Modal daftar keranjang tertahan */}
      <Modal open={heldModalOpen} title="Keranjang Tertahan" onClose={() => setHeldModalOpen(false)}>
        {heldList.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Tidak ada keranjang tertahan</p>
        ) : (
          <div className="space-y-2">
            {heldList.map((h) => (
              <div key={h.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold">{h.nomor_transaksi}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">{h.items.length} item • {formatIDR(h.grand_total)}</div>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  <button className="btn-secondary h-8 px-2 text-[11px]" onClick={() => editHold(h)}>Edit Keranjang</button>
                  <button className="btn-primary h-8 px-2 text-[11px]" onClick={() => openResume(h)}>Bayar Langsung</button>
                  <button className="rounded-lg border border-red-200 text-[11px] font-semibold text-red-500 hover:bg-red-50" onClick={() => deleteHold(h)}>Batalkan</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Modal bayar untuk resume keranjang tertahan */}
      <Modal open={!!resumeTarget} title={`Lanjutkan ${resumeTarget?.nomor_transaksi ?? ""}`} onClose={() => setResumeTarget(null)}>
        {resumeTarget && (
          <div>
            <div className="rounded-lg bg-slate-50 p-3 text-sm font-bold">{formatIDR(resumeTarget.grand_total)}</div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {paymentMethods.map((m) => (
                <button key={m.id} onClick={() => setResumePaymentMethodId(m.id)} className={`rounded-lg border p-2 text-[10px] font-semibold ${resumePaymentMethodId === m.id ? "border-orange bg-orange-50 text-orange" : "bg-white text-slate-600"}`}>{m.nama}</button>
              ))}
            </div>
            {paymentMethods.find((m) => m.id === resumePaymentMethodId)?.nama === "Tunai" && (
              <div className="mt-2">
                <label className="label">Uang Diterima</label>
                <input type="number" className="input" value={resumeCash} onChange={(e) => setResumeCash(e.target.value)} />
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setResumeTarget(null)}>Batal</button>
              <button className="btn-primary" onClick={confirmResume}>Bayar & Selesaikan</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal kamera scan barcode */}
      <BarcodeScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={handleBarcodeDetected} />

      {/* Modal Pembayaran QRIS */}
      <Modal open={qrisModalOpen} title="Pembayaran QRIS" onClose={() => setQrisModalOpen(false)} width="max-w-sm">
        <div className="text-center">
          <img src={qrisImage} alt="QRIS Toko" className="mx-auto h-72 w-72 object-contain" />
          <p className="mt-4 text-sm font-bold">{formatIDR(grandTotalEstimate)}</p>
          
          <button 
            className="btn-primary mt-5 w-full" 
            disabled={processing} 
            onClick={async () => { 
              const success = await pay(); 
              if (success) {
                setQrisModalOpen(false); 
              }
            }}
          >
            {processing ? <><RefreshCw size={16} className="animate-spin" />Memproses...</> : "Selesaikan Pembayaran"}
          </button>
          
          <button className="btn-secondary mt-2 w-full" onClick={() => setQrisModalOpen(false)}>Batal</button>
        </div>
      </Modal>

      <Modal open={!!overrideTarget} title={overrideStep === "input" ? "Ubah Harga Item" : "Otorisasi Admin"} onClose={() => setOverrideTarget(null)} width="max-w-sm">
        {overrideStep === "input" ? (
          <form onSubmit={submitOverrideStepOne}>
            <p className="text-xs text-slate-500">Harga saat ini: <b>{overrideTarget && formatIDR(overrideTarget.harga)}</b></p>
            <div className="mt-3"><label className="label">Harga baru</label><input type="number" className="input" value={overridePrice} onChange={(e) => setOverridePrice(e.target.value)} /></div>
            <div className="mt-3"><label className="label">Alasan perubahan harga</label><textarea className="input h-auto py-2" rows="3" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Jelaskan alasan perubahan harga..." /></div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setOverrideTarget(null)}>Batal</button>
              <button className="btn-primary">Lanjut ke Otorisasi</button>
            </div>
          </form>
        ) : (
          <form onSubmit={submitOverrideAuth}>
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700">Perubahan harga memerlukan otorisasi Admin/Supervisor. Minta Admin memasukkan kredensialnya di sini.</div>
            <div className="mt-3"><label className="label">Username atau Email Admin</label><input className="input" value={overrideAdminLogin} onChange={(e) => setOverrideAdminLogin(e.target.value)} /></div>
            <div className="mt-3"><label className="label">Password Admin</label><PasswordInput value={overrideAdminPassword} onChange={(e) => setOverrideAdminPassword(e.target.value)} /></div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setOverrideStep("input")}>Kembali</button>
              <button className="btn-primary" disabled={overrideSubmitting}>{overrideSubmitting ? "Memverifikasi..." : "Otorisasi"}</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}