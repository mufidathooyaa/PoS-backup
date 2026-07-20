import React, { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { Modal } from "../../components/ui/Modal";
import { useAuth } from "../../context/AuthContext";
import { InventorySummary } from "./InventorySummary";
import { ProductsTab } from "./ProductsTab";
import { CategoriesTab } from "./CategoriesTab";
import { StockReceipt } from "./StockReceipt";
import { StockAdjustment } from "./StockAdjustment";
import { StockMovements } from "./StockMovements";
import { useLocation } from "react-router-dom";

export function InventoryPage() {
  const { user } = useAuth();
  const isAdmin = user.role === "Admin";
  const tabs = ["Ringkasan", "Produk", "Kategori", "Penerimaan Stok", "Penyesuaian Stok", "Pergerakan Stok"];
  const location = useLocation();
  const [tab, setTab] = useState(location.state?.tab ?? "Ringkasan");
  const [unauthorized, setUnauthorized] = useState(false);

  const switchTab = (name) => {
    if (!isAdmin && ["Produk", "Kategori"].includes(name)) { setUnauthorized(true); return; }
    setTab(name);
  };

  return (
    <>
      <PageHeader title="Inventaris" subtitle={isAdmin ? "Kelola produk, kategori, dan pergerakan stok" : "Operasional stok outlet"} />
      <div className="mb-3 flex overflow-x-auto border-b">
        {tabs.map((t) => (
          <button key={t} onClick={() => switchTab(t)} className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-semibold ${tab === t ? "border-orange text-orange" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {t}{!isAdmin && ["Produk", "Kategori"].includes(t) && <ShieldCheck size={11} className="ml-1 inline" />}
          </button>
        ))}
      </div>
      {tab === "Ringkasan" && <InventorySummary />}
      {tab === "Produk" && <ProductsTab />}
      {tab === "Kategori" && <CategoriesTab />}
      {tab === "Penerimaan Stok" && <StockReceipt />}
      {tab === "Penyesuaian Stok" && <StockAdjustment />}
      {tab === "Pergerakan Stok" && <StockMovements />}
      <Modal open={unauthorized} title="Akses Ditolak" onClose={() => setUnauthorized(false)} width="max-w-md">
        <div className="text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-500"><ShieldCheck size={23} /></span>
          <h3 className="mt-4 text-lg font-bold">Anda tidak bisa mengakses ini</h3>
          <p className="mt-2 text-xs text-slate-500">Tab Produk dan Kategori hanya dapat dikelola oleh Admin.</p>
          <button className="btn-primary mt-5" onClick={() => setUnauthorized(false)}>Kembali ke Ringkasan</button>
        </div>
      </Modal>
    </>
  );
}