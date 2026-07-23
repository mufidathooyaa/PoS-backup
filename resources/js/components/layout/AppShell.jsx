import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Bell, ChevronDown, KeyRound, LogOut, Menu, Search, Store, Wifi, WifiOff } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { menuByRole } from "../../config/menu";
import { api, ApiError } from "../../lib/apiClient";
import { Modal } from "../ui/Modal";
import { PasswordInput } from "../ui/PasswordInput";

export function AppShell() {
  const { user, logout, activeOutlet, setActiveOutlet } = useAuth();
  
  // 1. PINDAHKAN INI KE PALING ATAS
  const isAdmin = user.role === "Admin";
  const navigate = useNavigate();
  const toast = useToast();
  
  // 2. KUMPULKAN SEMUA STATE DI SINI
  const [outletSwitcherOpen, setOutletSwitcherOpen] = useState(false);
  const [outlets, setOutlets] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [online, setOnline] = useState(() => localStorage.getItem("pos_offline") !== "1");

  const currentOutletName = activeOutlet?.nama ?? user.outlet_nama;

  // Fungsi Fetch Notifikasi
  const fetchNotifications = async () => {
    if (!isAdmin) return;
    try {
      const res = await api.get("/notifications");
      setNotifications(res.notifications || []);
    } catch (err) {
      // Abaikan error diam-diam
    }
  };

  // Efek untuk memuat outlet dan notifikasi
  useEffect(() => {
    if (!isAdmin) return;
    api.get("/outlets").then((res) => setOutlets(res.outlets)).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    fetchNotifications();
  }, [activeOutlet, isAdmin]);

  // Fungsi saat notifikasi diklik
  const handleNotifClick = (notif) => {
    setNotifOpen(false); // Tutup dropdown
    // Kita hapus kode api.post('/notifications/read') dan setNotifications di sini
    
    if (notif.tipe === "shift_selisih") {
      navigate("/shift"); 
    } else if (notif.tipe === "stok_approval") {
      navigate("/inventory"); 
    }
  };

  const toggleOnline = () => {
    const next = !online; setOnline(next);
    localStorage.setItem("pos_offline", next ? "0" : "1");
    window.dispatchEvent(new Event("pos-connectivity"));
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className={`${collapsed ? "w-[72px]" : "w-[224px]"} flex shrink-0 flex-col bg-navy text-white transition-all`}>
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-orange text-sm">▣</span>
          {!collapsed && <span className="font-bold">POS Kasir</span>}
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {menuByRole[user.role].map(([label, path, Icon]) => (
            <NavLink key={path} to={path} className={({ isActive }) => `flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium ${isActive ? "bg-orange text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}>
              <Icon size={18} className="shrink-0" /> {!collapsed && label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"} rounded-lg bg-white/5 p-2`}>
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-500 text-xs font-bold">{user.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}</div>
            {!collapsed && <div className="min-w-0"><div className="truncate text-xs font-semibold">{user.name}</div><div className="truncate text-[10px] text-slate-400">{user.role}</div></div>}
          </div>
        </div>
      </aside>

      <section className="min-w-0 flex-1">
        <header className="flex h-16 items-center gap-4 border-b bg-white px-5">
          <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setCollapsed(!collapsed)}><Menu size={20} /></button>
          <div className="relative max-w-xl flex-1"><Search size={16} className="absolute left-3 top-2.5 text-slate-400" /><input className="input pl-9" placeholder="Cari menu, transaksi, produk, atau laporan..." aria-label="Cari menu, transaksi, produk, atau laporan" /></div>
          <button onClick={toggleOnline} className={`hidden items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold sm:flex ${online ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            {online ? <Wifi size={15} /> : <WifiOff size={15} />} {online ? "Mode Online" : "Mode Offline"}
          </button>

          {isAdmin ? (
            <div className="relative hidden md:block">
              <button
                className="flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => { setOutletSwitcherOpen(!outletSwitcherOpen); setProfileOpen(false); setNotifOpen(false); }}
              >
                <Store size={14} className="text-slate-400" /> {currentOutletName} <ChevronDown size={14} />
              </button>
              {outletSwitcherOpen && (
                <div className="absolute right-0 top-12 z-40 w-56 rounded-lg border bg-white p-2 shadow-xl">
                  <div className="px-2 py-1.5 text-[11px] font-bold uppercase text-slate-400">Lihat data outlet</div>
                  {outlets.map((o) => (
                    <button
                      key={o.id}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-medium hover:bg-slate-50 ${o.id === (activeOutlet?.id ?? user.outlet_id) ? "text-orange" : "text-slate-600"}`}
                      onClick={() => { setActiveOutlet({ id: o.id, nama: o.nama }); setOutletSwitcherOpen(false); }}
                    >
                      <Store size={13} /> {o.nama}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="hidden h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold text-slate-500 md:flex">
              <Store size={14} className="text-slate-400" /> {currentOutletName}
            </div>
          )}
          
          <div className="relative">
            <button 
              className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100" 
              onClick={() => { 
                setNotifOpen(!notifOpen); 
                setProfileOpen(false);
                if (!notifOpen) fetchNotifications(); // Tarik data terbaru tiap lonceng dibuka
              }} 
              aria-label="Notifikasi"
            >
              <Bell size={19} />
              {notifications.length > 0 && (
                <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {notifications.length}
                </span>
              )}
            </button>
            
            {notifOpen && (
              <div className="absolute right-0 top-12 z-40 w-80 max-h-96 overflow-y-auto rounded-lg border bg-white p-2 shadow-xl">
                <div className="px-2 py-2 text-xs font-bold flex justify-between items-center">
                  <span>Notifikasi terbaru</span>
                </div>
                
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">Tidak ada notifikasi baru</div>
                ) : (
                  <div className="space-y-1">
                    {notifications.map((n) => (
                      <button 
                        key={n.id} 
                        onClick={() => handleNotifClick(n)}
                        className="flex w-full items-start gap-3 rounded-lg p-2 text-left hover:bg-slate-50"
                      >
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.tipe === "shift_selisih" ? "bg-orange" : "bg-blue-500"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-slate-700 truncate">{n.judul}</div>
                          <div className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">{n.pesan}</div>
                          <div className="mt-1 text-[9px] font-medium text-slate-400">{n.created_at}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="relative">
            <button className="flex items-center gap-2" onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }} aria-label="Menu profil"><span className="grid h-9 w-9 place-items-center rounded-full bg-navy text-xs font-bold text-white">{user.name.slice(0, 1)}</span><ChevronDown size={14} className="text-slate-400" /></button>
            {profileOpen && <div className="absolute right-0 top-12 z-40 w-64 rounded-lg border bg-white p-3 shadow-xl">
              <div className="border-b pb-3"><div className="text-sm font-bold">{user.role}</div><div className="mt-1 text-xs text-slate-500">{user.email}</div></div>
              <button className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50" onClick={() => { setChangePasswordOpen(true); setProfileOpen(false); }}><KeyRound size={15} /> Ganti Password</button>
              <button className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-red-600 hover:bg-red-50" onClick={() => { logout(); navigate("/login"); }}><LogOut size={15} /> Logout</button>
            </div>}
          </div>
        </header>
        <main className="h-[calc(100vh-64px)] overflow-auto bg-canvas p-5"><Outlet context={{ online }} /></main>
      </section>

      <Modal open={changePasswordOpen} title="Ganti Password" onClose={() => setChangePasswordOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const formEl = e.currentTarget;
            const fd = new FormData(formEl);
            const password_lama = fd.get("password_lama");
            const password_baru = fd.get("password_baru");
            const konfirmasi = fd.get("konfirmasi");
            if (password_baru !== konfirmasi) {
              toast("Konfirmasi password baru tidak cocok", "danger");
              return;
            }
            setChangingPassword(true);
            try {
              await api.post("/me/change-password", { password_lama, password_baru });
              toast("Password berhasil diubah");
              setChangePasswordOpen(false);
              formEl.reset();
            } catch (err) {
              toast(err instanceof ApiError ? err.message : "Gagal mengubah password", "danger");
            } finally {
              setChangingPassword(false);
            }
          }}
        >
          <div><label className="label">Password lama</label><PasswordInput name="password_lama" required /></div>
          <div><label className="label">Password baru</label><PasswordInput name="password_baru" required minLength={6} /></div>
          <div><label className="label">Konfirmasi password baru</label><PasswordInput name="konfirmasi" required minLength={6} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setChangePasswordOpen(false)}>Batal</button>
            <button className="btn-primary" disabled={changingPassword}>{changingPassword ? "Menyimpan..." : "Simpan Password"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}