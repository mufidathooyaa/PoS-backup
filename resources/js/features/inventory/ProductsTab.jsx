import React, { useEffect, useState, useCallback } from "react";
import { Archive, CheckCircle2, Pencil, Plus } from "lucide-react";
import { Modal } from "../../components/ui/Modal";
import { Status } from "../../components/ui/Status";
import { useToast } from "../../context/ToastContext";
import { formatIDR } from "../../mockData";
import { api } from "../../lib/apiClient";
import { ScanBarcode } from "lucide-react";
import { BarcodeScannerModal } from "../../components/ui/BarcodeScannerModal";

export function ProductsTab() {
    const toast = useToast();
    const [products, setProducts] = useState([]);
    const [stockMap, setStockMap] = useState({});
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);
    const [scannerOpen, setScannerOpen] = useState(false);
    const [barcodeValue, setBarcodeValue] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [productsRes, catalogRes, categoriesRes] = await Promise.all([
                api.get("/products", { include_inactive: true }),
                api.get("/catalog"),
                api.get("/categories"),
            ]);
            setProducts(productsRes.products);
            setCategories(categoriesRes.categories);
            const map = {};
            catalogRes.products.forEach((p) => {
                map[p.id] = p.stok_tersedia;
            });
            setStockMap(map);
        } catch (err) {
            toast(err.message || "Gagal memuat produk", "danger");
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const save = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        const fd = new FormData(e.currentTarget);
        const payload = {
            category_id: Number(fd.get("category_id")),
            sku: fd.get("sku"),
            barcode: barcodeValue || null,
            nama: fd.get("nama"),
            unit: fd.get("unit"),
            harga: Number(fd.get("harga")),
            track_stock: true,
        };
        try {
            if (modal?.id) {
                await api.put(`/products/${modal.id}`, payload);
                toast("Produk berhasil diperbarui");
            } else {
                const res = await api.post("/products", payload);
                const stokAwal = Number(fd.get("stok_awal"));
                if (stokAwal > 0) {
                    await api.post(
                        `/products/${res.product.id}/initial-stock`,
                        { jumlah: stokAwal },
                    );
                }
                toast("Produk berhasil dibuat");
            }
            setModal(null);
            await loadData();
        } catch (err) {
            toast(err.message || "Gagal menyimpan produk", "danger");
        } finally {
            setSubmitting(false);
        }
    };

    const archive = async (p) => {
        try {
            await api.post(`/products/${p.id}/archive`);
            toast("Produk diarsipkan");
            await loadData();
        } catch (err) {
            toast(err.message || "Gagal mengarsipkan produk", "danger");
        }
    };

    const reactivate = async (p) => {
        try {
            await api.post(`/products/${p.id}/reactivate`);
            toast("Produk diaktifkan kembali");
            await loadData();
        } catch (err) {
            toast(err.message || "Gagal mengaktifkan produk", "danger");
        }
    };

    const handleBarcodeDetected = (text) => {
      setBarcodeValue(text);
      setScannerOpen(false);
      toast(`Barcode terdeteksi: ${text}`);
    };

    useEffect(() => {
      setBarcodeValue(modal?.barcode ?? "");
    }, [modal]);

    if (loading)
        return (
            <div className="p-6 text-sm text-slate-500">Memuat produk...</div>
        );

    return (
        <>
            <div className="card overflow-hidden">
                <div className="flex items-center justify-between p-4">
                    <div>
                        <h3 className="text-sm font-bold">Manajemen Produk</h3>
                        <p className="mt-1 text-xs text-slate-500">
                            {products.length} produk
                        </p>
                    </div>
                    <button
                        className="btn-primary"
                        onClick={() => setModal({})}
                    >
                        <Plus size={15} />
                        Tambah Produk
                    </button>
                </div>
                <table className="w-full">
                    <thead className="table-head">
                        <tr>
                            <th className="px-4 py-3">Produk</th>
                            <th>Kategori</th>
                            <th>Unit</th>
                            <th>Harga</th>
                            <th>Stok</th>
                            <th>Status</th>
                            <th className="pr-4 text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.map((p) => (
                            <tr key={p.id}>
                                <td className="table-cell">
                                    <div className="font-semibold">
                                        {p.nama}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                        {p.sku}
                                    </div>
                                </td>
                                <td className="table-cell">
                                    {p.category?.nama ?? "-"}
                                </td>
                                <td className="table-cell">{p.unit}</td>
                                <td className="table-cell font-semibold">
                                    {formatIDR(p.harga)}
                                </td>
                                <td className="table-cell">
                                    {p.is_active
                                        ? (stockMap[p.id] ?? "—")
                                        : "—"}
                                </td>
                                <td className="table-cell">
                                    <Status
                                        value={
                                            p.is_active ? "Aktif" : "Nonaktif"
                                        }
                                    />
                                </td>
                                <td className="table-cell text-right">
                                    <button
                                        className="mr-2 rounded-md border p-2"
                                        onClick={() => setModal(p)}
                                    >
                                        <Pencil size={14} />
                                    </button>
                                    {p.is_active ? (
                                        <button
                                            className="rounded-md border p-2 text-red-500"
                                            onClick={() => archive(p)}
                                        >
                                            <Archive size={14} />
                                        </button>
                                    ) : (
                                        <button
                                            className="rounded-md border p-2 text-emerald-600"
                                            onClick={() => reactivate(p)}
                                        >
                                            <CheckCircle2 size={14} />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal
                open={!!modal}
                title={modal?.id ? "Edit Produk" : "Tambah Produk"}
                onClose={() => setModal(null)}
            >
                <form onSubmit={save} className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="label">Nama produk</label>
                        <input
                            name="nama"
                            required
                            className="input"
                            defaultValue={modal?.nama}
                        />
                    </div>
                    <div>
                        <label className="label">SKU</label>
                        <input
                            name="sku"
                            required
                            className="input"
                            defaultValue={modal?.sku}
                        />
                    </div>
                    <div>
                      <label className="label">Barcode (opsional)</label>
                      <div className="flex gap-2">
                        <input
                          name="barcode"
                          className="input"
                          autoComplete="off"
                          value={barcodeValue}
                          onChange={(e) => setBarcodeValue(e.target.value)}
                        />
                        <button type="button" className="btn-secondary shrink-0 px-3" onClick={() => setScannerOpen(true)}><ScanBarcode size={16} /></button>
                      </div>
                    </div>
                    <div>
                        <label className="label">Kategori</label>
                        <select
                            name="category_id"
                            required
                            className="input"
                            defaultValue={modal?.category?.id}
                        >
                            {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.nama}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="label">Unit</label>
                        <input
                            name="unit"
                            required
                            className="input"
                            defaultValue={modal?.unit ?? "pcs"}
                        />
                    </div>
                    <div>
                        <label className="label">Harga</label>
                        <input
                            name="harga"
                            type="number"
                            required
                            className="input"
                            defaultValue={modal?.harga}
                        />
                    </div>
                    {!modal?.id && (
                        <div>
                            <label className="label">Stok awal</label>
                            <input
                                name="stok_awal"
                                type="number"
                                className="input"
                                defaultValue={0}
                            />
                        </div>
                    )}
                    <div className="col-span-2 flex justify-end gap-2">
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setModal(null)}
                        >
                            Batal
                        </button>
                        <button className="btn-primary" disabled={submitting}>
                            {submitting ? "Menyimpan..." : "Simpan Produk"}
                        </button>
                    </div>
                </form>
            </Modal>

            <BarcodeScannerModal
                open={scannerOpen}
                onClose={() => setScannerOpen(false)}
                onDetected={handleBarcodeDetected}
            />
        </>
    );
}
