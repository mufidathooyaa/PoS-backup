import React from "react";

export function Status({ value }) {
  const styles = {
    Berhasil: "bg-emerald-50 text-emerald-700", Aktif: "bg-emerald-50 text-emerald-700",
    Disetujui: "bg-emerald-50 text-emerald-700", Refund: "bg-red-50 text-red-700",
    Menunggu: "bg-amber-50 text-amber-700", "Menunggu Admin": "bg-amber-50 text-amber-700",
    "Menunggu Sinkronisasi": "bg-blue-50 text-blue-700", Nonaktif: "bg-slate-100 text-slate-600",
    Ditolak: "bg-red-50 text-red-700",
    Selesai: "bg-emerald-50 text-emerald-700", // <-- baris baru
    "Pending Review": "bg-amber-50 text-amber-700", // <-- baris baru
  };
  return <span className={`badge ${styles[value] || "bg-slate-100 text-slate-600"}`}>{value}</span>;
}
