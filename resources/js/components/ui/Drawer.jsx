import React from "react";
import { X } from "lucide-react";

export function Drawer({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/35" onMouseDown={onClose}>
      <div className="absolute inset-y-0 right-0 w-full max-w-md overflow-auto bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4">
          <h3 className="font-bold">{title}</h3>
          <button className="rounded-lg p-1.5 hover:bg-slate-100" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
