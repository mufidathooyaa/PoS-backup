import React, { createContext, useContext, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

export const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const showToast = (message, tone = "success") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2600);
  };
  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-[100] flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-xl ${toast.tone === "danger" ? "bg-red-500" : "bg-slate-900"}`}>
          {toast.tone === "danger" ? <XCircle size={17} /> : <CheckCircle2 size={17} className="text-emerald-400" />}
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
