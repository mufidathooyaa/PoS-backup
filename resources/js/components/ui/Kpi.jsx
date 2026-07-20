import React from "react";

export function Kpi({ icon: Icon, label, value, note, tone }) {
  const tones = { orange: "bg-orange-50 text-orange", blue: "bg-blue-50 text-blue-600", emerald: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600" };
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></div>
        <span className={`grid h-9 w-9 place-items-center rounded-lg ${tones[tone]}`}><Icon size={18} /></span>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">{note}</p>
    </div>
  );
}
