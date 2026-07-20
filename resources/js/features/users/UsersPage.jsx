import React, { useEffect, useState, useCallback } from "react";
import { Archive, Boxes, Check, Pencil, Plus, Search, ShieldCheck, ShoppingCart } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { Status } from "../../components/ui/Status";
import { Modal } from "../../components/ui/Modal";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { api } from "../../lib/apiClient";

const ROLE_INFO = {
  Admin: { desc: "Akses penuh, approval, konfigurasi", icon: ShieldCheck, color: "bg-blue-50 text-blue-600" },
  Kasir: { desc: "Transaksi kasir dan shift sendiri", icon: ShoppingCart, color: "bg-orange-50 text-orange" },
  "Operator Inventaris": { desc: "Operasional stok dan pengajuan", icon: Boxes, color: "bg-emerald-50 text-emerald-600" },
};

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const toast = useToast();

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([api.get("/users"), api.get("/roles")]);
      setUsers(usersRes.users);
      setRoles(rolesRes.roles);
    } catch (err) {
      toast(err.message || "Gagal memuat data pengguna", "danger");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.nama.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
  });

  const save = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      nama: fd.get("nama"),
      username: fd.get("username"),
      email: fd.get("email"),
      role_id: Number(fd.get("role_id")),
    };
    const password = fd.get("password");
    if (password) payload.password = password;

    try {
      if (editing) {
        await api.put(`/users/${editing.id}`, payload);
        toast("Data pengguna diperbarui");
      } else {
        if (!password) { toast("Password wajib diisi untuk pengguna baru", "danger"); setSubmitting(false); return; }
        await api.post("/users", payload);
        toast("Pengguna baru ditambahkan");
      }
      setModal(false);
      setEditing(null);
      await loadData();
    } catch (err) {
      toast(err.message || "Gagal menyimpan pengguna", "danger");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (u) => {
    try {
      await api.post(`/users/${u.id}/toggle-active`);
      toast(u.is_active ? "Pengguna dinonaktifkan" : "Pengguna diaktifkan");
      await loadData();
    } catch (err) {
      toast(err.message || "Gagal mengubah status pengguna", "danger");
    }
  };

  if (loading) return <div className="p-6 text-sm text-slate-500">Memuat pengguna...</div>;

  return (
    <>
      <PageHeader
        title="Pengguna & Role"
        subtitle="Kelola akun dan izin akses sistem"
        actions={<button className="btn-primary" onClick={() => { setEditing(null); setModal(true); }}><Plus size={16} /> Tambah User</button>}
      />

      <div className="mb-3 grid grid-cols-3 gap-3">
        {Object.entries(ROLE_INFO).map(([role, { desc, icon: Icon, color }]) => (
          <div className="card flex items-center gap-3 p-4" key={role}>
            <span className={`grid h-10 w-10 place-items-center rounded-lg ${color}`}><Icon size={18} /></span>
            <div><div className="text-sm font-bold">{role}</div><div className="mt-0.5 text-[11px] text-slate-500">{desc}</div></div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-4">
          <div><h3 className="text-sm font-bold">Daftar Pengguna</h3><p className="mt-1 text-xs text-slate-500">{users.length} akun terdaftar</p></div>
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input className="input pl-8" placeholder="Cari pengguna..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <table className="w-full">
          <thead className="table-head"><tr><th className="px-4 py-3">Pengguna</th><th>Role</th><th>Status</th><th className="pr-4 text-right">Aksi</th></tr></thead>
          <tbody>
            {filteredUsers.map((u) => (
              <tr key={u.id}>
                <td className="table-cell">
                  <div className="font-semibold">{u.nama} {u.id === currentUser.id && <span className="ml-1 text-[10px] text-slate-400">(Anda)</span>}</div>
                  <div className="text-[11px] text-slate-500">{u.email} • {u.username}</div>
                </td>
                <td className="table-cell">{u.role?.nama_peran}</td>
                <td className="table-cell"><Status value={u.is_active ? "Aktif" : "Nonaktif"} /></td>
                <td className="table-cell text-right">
                  <button className="mr-2 rounded-md border p-2 hover:bg-slate-50" onClick={() => { setEditing(u); setModal(true); }}><Pencil size={14} /></button>
                  <button
                    className={`rounded-md border p-2 ${u.active ? "text-red-500" : "text-emerald-600"} ${u.id === currentUser.id ? "cursor-not-allowed opacity-30" : ""}`}
                    disabled={u.id === currentUser.id}
                    onClick={() => toggleActive(u)}
                  >
                    {u.is_active ? <Archive size={14} /> : <Check size={14} />}
                  </button>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && <tr><td colSpan={4} className="table-cell text-center text-slate-400">Tidak ada pengguna ditemukan</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={modal} title={editing ? "Edit Pengguna" : "Tambah Pengguna"} onClose={() => { setModal(false); setEditing(null); }}>
        <form className="space-y-4" onSubmit={save}>
          <div><label className="label">Nama lengkap</label><input name="nama" required className="input" defaultValue={editing?.nama} /></div>
          <div><label className="label">Username</label><input name="username" required className="input" defaultValue={editing?.username} /></div>
          <div><label className="label">Email</label><input name="email" required type="email" className="input" defaultValue={editing?.email} /></div>
          <div>
            <label className="label">{editing ? "Password baru (kosongkan jika tidak diubah)" : "Password"}</label>
            <input name="password" type="password" className="input" placeholder={editing ? "••••••••" : ""} />
          </div>
          <div>
            <label className="label">Role</label>
            <select name="role_id" required className="input" defaultValue={editing?.role_id}>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.nama_peran}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Batal</button>
            <button className="btn-primary" disabled={submitting}>{submitting ? "Menyimpan..." : "Simpan Pengguna"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}