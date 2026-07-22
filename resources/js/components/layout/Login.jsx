import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { roleHome } from "../../config/permissions";
import { PasswordInput } from "../ui/PasswordInput";

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [loginInput, setLoginInput] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={roleHome(user.role)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const found = await login(loginInput.trim(), password);
      navigate(roleHome(found.role), { replace: true });
    } catch (err) {
      setError(err.message || "Username/email atau password salah.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen bg-slate-100">
      <section className="hidden w-[46%] flex-col justify-between overflow-hidden bg-navy p-12 text-white lg:flex">
        <div className="flex items-center gap-3 text-lg font-bold"><span className="grid h-9 w-9 place-items-center rounded-lg bg-orange">▣</span> POS Kasir</div>
        <div className="max-w-md">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[.25em] text-orange-400">Operasional dalam satu tempat</p>
          <h1 className="text-4xl font-bold leading-tight">Kasir lebih cepat.<br />Stok lebih terkendali.</h1>
          <p className="mt-5 text-sm leading-6 text-slate-300">Kelola transaksi, shift, inventaris, dan approval dengan alur yang aman untuk setiap role.</p>
        </div>
        <p className="text-xs text-slate-500">© 2026 POS Kasir • Outlet Utama</p>
      </section>
      <section className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-7 lg:hidden"><span className="font-bold text-navy">▣ POS Kasir</span></div>
          <div className="card p-7">
            <h2 className="text-2xl font-bold">Masuk ke POS Kasir</h2>
            <p className="mt-2 text-sm text-slate-500">Gunakan akun sesuai role untuk mengakses sistem.</p>
            <form className="mt-6 space-y-4" onSubmit={submit}>
              <div>
                <label className="label">Username atau Email</label>
                <input
                  className="input"
                  type="text"
                  placeholder="admin atau admin@posdb.test"
                  value={loginInput}
                  onChange={(e) => { setLoginInput(e.target.value); setError(""); }}
                />
              </div>
              <div>
                <label className="label">Password</label>
                <PasswordInput
                  placeholder="Masukkan password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                />
              </div>
              {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</div>}
              <button className="btn-primary w-full" disabled={submitting}>
                {submitting ? "Memproses..." : <>Masuk <ArrowRight size={16} /></>}
              </button>
            </form>
          </div>
          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/70 p-4 text-xs text-slate-600">
            <div className="mb-2 font-bold text-slate-800">Contoh akun</div>
            <div className="space-y-1.5">
              <button className="block w-full text-left hover:text-blue-700" onClick={() => { setLoginInput("admin"); setPassword("admin123"); }}><b>Admin:</b> admin / admin123</button>
              <button className="block w-full text-left hover:text-blue-700" onClick={() => { setLoginInput("kasirtest"); setPassword("kasir123"); }}><b>Kasir:</b> kasirtest / kasir123</button>
              <button className="block w-full text-left hover:text-blue-700" onClick={() => { setLoginInput("operatortest"); setPassword("operator123"); }}><b>Operator:</b> operatortest / operator123</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}