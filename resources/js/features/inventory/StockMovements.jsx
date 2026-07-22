import React, { useEffect, useState, useCallback } from "react";
import { useToast } from "../../context/ToastContext";
import { api } from "../../lib/apiClient";
import { useAuth } from "../../context/AuthContext";

const JENIS_LABEL = {
  penjualan: "Penjualan",
  retur: "Retur",
  penyesuaian: "Penyesuaian",
  penerimaan: "Penerimaan",
  saldo_awal: "Saldo Awal",
};

export function StockMovements() {
  const { user, activeOutlet } = useAuth();
  const toast = useToast();
  const [movements, setMovements] = useState([]);
  const [filterJenis, setFilterJenis] = useState("");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const params = filterJenis
        ? { jenis_pergerakan: filterJenis }
        : {};

      if (user?.role === "Admin") {
        params.outlet_id = activeOutlet?.id;
      }

      const res = await api.get("/stock-movements", params);
      setMovements(res.movements.data);
    } catch (err) {
      toast(err.message || "Gagal memuat pergerakan stok", "danger");
    } finally {
      setLoading(false);
    }
  }, [toast, filterJenis, user, activeOutlet]);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <h3 className="text-sm font-bold">Pergerakan Stok</h3>
        <select className="input h-9 w-48" value={filterJenis} onChange={(e) => setFilterJenis(e.target.value)}>
          <option value="">Semua jenis</option>
          {Object.entries(JENIS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <table className="w-full">
        <thead className="table-head"><tr><th className="px-4 py-3">Produk</th><th>Tipe</th><th>Perubahan</th><th>Oleh</th><th>Waktu</th></tr></thead>
        <tbody>
          {loading && <tr><td colSpan={5} className="table-cell text-center text-slate-400">Memuat...</td></tr>}
          {!loading && movements.map((m) => (
            <tr key={m.id}>
              <td className="table-cell">{m.product?.nama}</td>
              <td className="table-cell">{JENIS_LABEL[m.jenis_pergerakan] ?? m.jenis_pergerakan}</td>
              <td className={`table-cell font-bold ${m.jumlah >= 0 ? "text-emerald-600" : "text-red-500"}`}>{m.jumlah >= 0 ? "+" : ""}{m.jumlah}</td>
              <td className="table-cell">{m.user?.nama ?? "-"}</td>
              <td className="table-cell">{new Date(m.timestamp).toLocaleString("id-ID")}</td>
            </tr>
          ))}
          {!loading && movements.length === 0 && <tr><td colSpan={5} className="table-cell text-center text-slate-400">Belum ada pergerakan stok</td></tr>}
        </tbody>
      </table>
    </div>
  );
}