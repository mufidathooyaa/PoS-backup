import React from "react";
import { X } from "lucide-react";

export function Modal({ open, title, children, onClose, width = "max-w-lg" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[1px]" onMouseDown={onClose}>
      <div className={`w-full ${width} max-h-[90vh] overflow-auto rounded-xl bg-white shadow-2xl`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4">
          <h3 className="font-bold text-slate-900">{title}</h3>
          <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
