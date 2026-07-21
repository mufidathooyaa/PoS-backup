import React, { useEffect, useState, useCallback } from "react";
import { Archive, Check, MapPin, Pencil, Plus, Search, Store } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { Status } from "../../components/ui/Status";
import { Modal } from "../../components/ui/Modal";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { api } from "../../lib/apiClient";

export function OutletsPage() {
  const { user: currentUser } = useAuth();
  const toast = useToast();

  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // include_inactive supaya outlet yang sudah diarsipkan tetap terlihat di layar admin
      const res = await api.get("/outlets?include_inactive=1");
      setOutlets(res.outlets);
    } catch (err) {
      toast(err.message || "Gagal memuat data outlet", "danger");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredOutlets = outlets.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return o.nama.toLowerCase().includes(q) || (o.kode ?? "").toLowerCase().includes(q);
  });

  const save = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      nama: fd.get("nama"),
      kode: fd.get("kode"),
      alamat: fd.get("alamat"),
    };

    try {
      if (editing) {
        await api.put(`/outlets/${editing.id}`, payload);
        toast("Data outlet diperbarui");
      } else {
        await api.post("/outlets", payload);
        toast("Outlet baru ditambahkan");
      }
      setModal(false);
      setEditing(null);
      await loadData();
    } catch (err) {
      toast(err.message || "Gagal menyimpan outlet", "danger");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (o) => {
    try {
      await api.post(`/outlets/${o.id}/toggle-active`);
      toast(o.is_active ? "Outlet dinonaktifkan" : "Outlet diaktifkan");
      await loadData();
    } catch (err) {
      toast(err.message || "Gagal mengubah status outlet", "danger");
    }
  };

  if (loading) return <div className="p-6 text-sm text-slate-500">Memuat outlet...</div>;

  return (
    <>
      <PageHeader
        title="Outlet"
        subtitle="Kelola toko/cabang yang beroperasi di sistem ini"
        actions={<button className="btn-primary" onClick={() => { setEditing(null); setModal(true); }}><Plus size={16} /> Tambah Outlet</button>}
      />

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-4">
          <div><h3 className="text-sm font-bold">Daftar Outlet</h3><p className="mt-1 text-xs text-slate-500">{outlets.length} outlet terdaftar</p></div>
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input className="input pl-8" placeholder="Cari outlet..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <table className="w-full">
          <thead className="table-head"><tr><th className="px-4 py-3">Outlet</th><th>Kode</th><th>Alamat</th><th>Status</th><th className="pr-4 text-right">Aksi</th></tr></thead>
          <tbody>
            {filteredOutlets.map((o) => {
              const isCurrentOutlet = o.id === currentUser.outlet_id;
              return (
                <tr key={o.id}>
                  <td className="table-cell">
                    <div className="flex items-center gap-2 font-semibold">
                      <Store size={14} className="text-slate-400" /> {o.nama}
                      {isCurrentOutlet && <span className="ml-1 text-[10px] text-slate-400">(Outlet Anda)</span>}
                    </div>
                  </td>
                  <td className="table-cell">{o.kode ?? "-"}</td>
                  <td className="table-cell">
                    <div className="flex items-start gap-1 text-xs text-slate-500">
                      <MapPin size={12} className="mt-0.5 shrink-0" /> {o.alamat || "-"}
                    </div>
                  </td>
                  <td className="table-cell"><Status value={o.is_active ? "Aktif" : "Nonaktif"} /></td>
                  <td className="table-cell text-right">
                    <button className="mr-2 rounded-md border p-2 hover:bg-slate-50" onClick={() => { setEditing(o); setModal(true); }}><Pencil size={14} /></button>
                    <button
                      className={`rounded-md border p-2 ${o.is_active ? "text-red-500" : "text-emerald-600"} ${isCurrentOutlet && o.is_active ? "cursor-not-allowed opacity-30" : ""}`}
                      disabled={isCurrentOutlet && o.is_active}
                      title={isCurrentOutlet && o.is_active ? "Tidak dapat menonaktifkan outlet tempat Anda login" : undefined}
                      onClick={() => toggleActive(o)}
                    >
                      {o.is_active ? <Archive size={14} /> : <Check size={14} />}
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredOutlets.length === 0 && <tr><td colSpan={5} className="table-cell text-center text-slate-400">Tidak ada outlet ditemukan</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={modal} title={editing ? "Edit Outlet" : "Tambah Outlet"} onClose={() => { setModal(false); setEditing(null); }}>
        <form className="space-y-4" onSubmit={save}>
          <div><label className="label">Nama outlet</label><input name="nama" required className="input" defaultValue={editing?.nama} /></div>
          <div>
            <label className="label">Kode outlet</label>
            <input name="kode" required maxLength={10} className="input uppercase" placeholder="mis. OUT1" defaultValue={editing?.kode} />
          </div>
          <div><label className="label">Alamat</label><textarea name="alamat" rows={3} className="input" defaultValue={editing?.alamat} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Batal</button>
            <button className="btn-primary" disabled={submitting}>{submitting ? "Menyimpan..." : "Simpan Outlet"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}