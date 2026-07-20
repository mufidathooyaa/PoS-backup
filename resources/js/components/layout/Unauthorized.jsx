import React from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { roleHome } from "../../config/permissions";

export function Unauthorized() {
  const { user } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="grid h-full min-h-[520px] place-items-center">
      <div className="max-w-lg text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-50 text-red-500"><ShieldCheck size={30} /></div>
        <p className="mt-5 text-sm font-bold uppercase tracking-widest text-red-500">Akses Ditolak</p>
        <h1 className="mt-2 text-3xl font-bold">Anda tidak bisa mengakses ini</h1>
        <p className="mt-3 text-sm text-slate-500">Halaman ini hanya dapat dibuka oleh role yang memiliki izin.</p>
        <button className="btn-primary mt-6" onClick={() => navigate(roleHome(user.role))}>Kembali ke Halaman Saya</button>
      </div>
    </div>
  );
}
