import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * Input password dengan tombol show/hide (ikon mata).
 * Menerima semua props standar <input> (name, value, onChange, required, minLength, placeholder, dst)
 * jadi bisa dipakai baik untuk form terkontrol (value+onChange) maupun form berbasis FormData (name saja).
 */
export function PasswordInput({ className = "input", ...props }) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input {...props} type={show ? "text" : "password"} className={`${className} pr-10`} />
      <button
        type="button"
        tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}