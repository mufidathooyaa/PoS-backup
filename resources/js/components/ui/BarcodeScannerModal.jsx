import React, { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { CheckCircle2, RefreshCw, ScanBarcode } from "lucide-react";
import { Modal } from "./Modal";

const COOLDOWN_MS = 1500; // jeda supaya barcode yang sama tidak terdeteksi berkali-kali saat masih di depan kamera

export function BarcodeScannerModal({ open, onClose, onDetected }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const lastScanRef = useRef({ code: null, time: 0 });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(null); // teks kode terakhir yang berhasil, buat feedback visual sesaat

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setStatus("requesting");
    setError("");

    const reader = new BrowserMultiFormatReader();

    reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
      if (!result || cancelled) return;

      const code = result.getText();
      const now = Date.now();

      // Abaikan kalau kode yang sama baru saja diproses (masih dalam jeda cooldown)
      if (lastScanRef.current.code === code && now - lastScanRef.current.time < COOLDOWN_MS) {
        return;
      }

      lastScanRef.current = { code, time: now };
      onDetected(code);

      setFlash(code);
      setTimeout(() => setFlash(null), 700);
    }).then((controls) => {
      if (cancelled) { controls.stop(); return; }
      controlsRef.current = controls;
      setStatus("active");
    }).catch((err) => {
      if (cancelled) return;
      setStatus("error");
      setError(err?.name === "NotAllowedError" ? "Izin kamera ditolak. Aktifkan izin kamera pada browser lalu coba lagi." : "Kamera tidak tersedia atau sedang digunakan aplikasi lain.");
    });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
      lastScanRef.current = { code: null, time: 0 };
    };
  }, [open, onDetected]);

  const retry = () => {
    setStatus("requesting");
    setError("");
    const reader = new BrowserMultiFormatReader();
    reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
      if (!result) return;
      const code = result.getText();
      const now = Date.now();
      if (lastScanRef.current.code === code && now - lastScanRef.current.time < COOLDOWN_MS) return;
      lastScanRef.current = { code, time: now };
      onDetected(code);
      setFlash(code);
      setTimeout(() => setFlash(null), 700);
    }).then((controls) => { controlsRef.current = controls; setStatus("active"); })
      .catch((err) => { setStatus("error"); setError(err?.name === "NotAllowedError" ? "Izin kamera ditolak." : "Kamera tidak tersedia."); });
  };

  return (
    <Modal open={open} title="Scan Barcode Produk" onClose={onClose} width="max-w-xl">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-slate-950">
        <video ref={videoRef} muted playsInline className="h-full w-full object-cover" style={{ display: status === "active" ? "block" : "none" }} />
        {status === "active" && (
          <>
            <div className="pointer-events-none absolute inset-x-[14%] top-1/2 h-px -translate-y-1/2 bg-red-500 shadow-[0_0_10px_#ef4444]" />
            <div className={`pointer-events-none absolute inset-[14%] rounded-lg border-2 transition-colors ${flash ? "border-emerald-400" : "border-white/80"}`} />
            {flash && (
              <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/20">
                <span className="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-lg">
                  <CheckCircle2 size={18} /> Ditambahkan
                </span>
              </div>
            )}
          </>
        )}
        {status === "requesting" && (
          <div className="absolute inset-0 grid place-items-center text-center text-white">
            <div><RefreshCw size={28} className="mx-auto animate-spin text-orange" /><p className="mt-3 text-sm font-semibold">Meminta akses kamera...</p></div>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 grid place-items-center p-8 text-center text-white">
            <div><ScanBarcode size={34} className="mx-auto text-slate-500" /><p className="mt-3 text-sm font-semibold">Kamera belum dapat digunakan</p><p className="mt-2 text-xs leading-5 text-slate-400">{error}</p></div>
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center gap-3 rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-700">
        <ScanBarcode size={20} className="shrink-0" /><span>Scan berkelanjutan aktif — arahkan barcode satu per satu, produk otomatis masuk ke keranjang. Tekan <b>Selesai</b> kalau sudah selesai memindai.</span>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        {status === "error" && <button className="btn-secondary" onClick={retry}><RefreshCw size={15} /> Coba Lagi</button>}
        <button className="btn-primary" onClick={onClose}><CheckCircle2 size={16} /> Selesai</button>
      </div>
    </Modal>
  );
}