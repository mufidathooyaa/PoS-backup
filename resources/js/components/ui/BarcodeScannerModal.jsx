import React, { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { RefreshCw, ScanBarcode } from "lucide-react";
import { Modal } from "./Modal";

export function BarcodeScannerModal({ open, onClose, onDetected }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const [status, setStatus] = useState("idle"); // idle | requesting | active | error
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setStatus("requesting");
    setError("");

    const reader = new BrowserMultiFormatReader();

    reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
      if (result && !cancelled) {
        onDetected(result.getText());
        stop();
      }
    }).then((controls) => {
      if (cancelled) { controls.stop(); return; }
      controlsRef.current = controls;
      setStatus("active");
    }).catch((err) => {
      if (cancelled) return;
      setStatus("error");
      setError(err?.name === "NotAllowedError" ? "Izin kamera ditolak. Aktifkan izin kamera pada browser lalu coba lagi." : "Kamera tidak tersedia atau sedang digunakan aplikasi lain.");
    });

    function stop() {
      controlsRef.current?.stop();
      controlsRef.current = null;
    }

    return () => {
      cancelled = true;
      stop();
    };
  }, [open, onDetected]);

  const retry = () => {
    setStatus("requesting");
    setError("");
    // trigger useEffect ulang dengan cara sederhana: tutup lalu buka lagi dari parent tidak selalu praktis,
    // jadi kita panggil ulang manual di sini
    const reader = new BrowserMultiFormatReader();
    reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
      if (result) { onDetected(result.getText()); controlsRef.current?.stop(); }
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
            <div className="pointer-events-none absolute inset-[14%] rounded-lg border-2 border-white/80" />
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
        <ScanBarcode size={20} className="shrink-0" /><span>Arahkan barcode produk ke dalam bingkai. Barcode akan terisi otomatis begitu terdeteksi.</span>
      </div>
      {status === "error" && (
        <div className="mt-4 flex justify-end"><button className="btn-secondary" onClick={retry}><RefreshCw size={15} /> Coba Lagi</button></div>
      )}
    </Modal>
  );
}