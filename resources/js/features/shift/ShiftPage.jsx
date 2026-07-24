import React, { useEffect, useState, useCallback } from "react";
import {
    Clock3,
    ReceiptText,
    TrendingUp,
    Wallet,
    AlertTriangle,
} from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { Kpi } from "../../components/ui/Kpi";
import { Status } from "../../components/ui/Status";
import { Modal } from "../../components/ui/Modal";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { formatIDR } from "../../mockData";
import { api, ApiError } from "../../lib/apiClient";

export function ShiftPage() {
    const { user, activeOutlet } = useAuth();
    const toast = useToast();

    const [currentShift, setCurrentShift] = useState(null);
    const [shiftList, setShiftList] = useState([]);
    const [pendingReviews, setPendingReviews] = useState([]); // State baru untuk review
    const [selectedReviewShift, setSelectedReviewShift] = useState(null); // Shift yang sedang di-review
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const isAdmin = user?.role === "Admin";
            const [listRes] = await Promise.all([
                api.get(
                    "/shifts",
                    isAdmin ? { outlet_id: activeOutlet?.id } : {},
                ),
            ]);
            setShiftList(listRes.shifts);

            // Jika yang login Admin, tarik juga data shift yang pending review
            if (user?.role === "Admin") {
                const pendingRes = await api.get("/shifts/pending-review");
                setPendingReviews(pendingRes.shifts);
            }
        } catch (err) {
            toast(err.message || "Gagal memuat data shift", "error");
        }

        try {
            const curRes = await api.get("/shifts/current", {
                outlet_id: activeOutlet?.id ?? user?.outlet_id,
            });
            setCurrentShift(curRes.shift); // null kalau memang tidak ada shift terbuka
        } catch (err) {
            toast(err.message || "Gagal memuat status shift", "danger");
        }

        setLoading(false);
    }, [toast, user, activeOutlet]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleOpen = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        const fd = new FormData(e.currentTarget);
        try {
            await api.post("/shifts/open", {
                kas_awal: Number(fd.get("cash")),
                outlet_id: activeOutlet?.id ?? user?.outlet_id,
            });
            toast("Shift berhasil dibuka");
            setModal(null);
            await loadData();
        } catch (err) {
            setError(err.message || "Gagal membuka shift");
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const counted = fd.get("counted");
        const note = fd.get("note");

        if (!counted) return setError("Kas dihitung wajib diisi.");

        setSubmitting(true);
        try {
            await api.post(`/shifts/${currentShift.id}/close`, {
                kas_dihitung: Number(counted),
                catatan_penutup: note || null,
                outlet_id: activeOutlet?.id ?? user?.outlet_id,
            });
            toast("Shift ditutup dan dicatat di audit");
            setModal(null);
            await loadData();
        } catch (err) {
            setError(err.message || "Gagal menutup shift");
        } finally {
            setSubmitting(false);
        }
    };

    const handleReview = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const catatanAdmin = fd.get("catatan_admin");

        if (!catatanAdmin) return setError("Catatan tinjauan wajib diisi.");

        setSubmitting(true);
        try {
            await api.post(`/shifts/${selectedReviewShift.id}/review`, {
                catatan_admin: catatanAdmin,
            });
            toast("Shift berhasil ditinjau");
            setModal(null);
            setSelectedReviewShift(null);
            await loadData();
        } catch (err) {
            setError(err.message || "Gagal mengirim tinjauan");
        } finally {
            setSubmitting(false);
        }
    };

    const open = !!currentShift;
    const kasDiharapkanTampil = open
        ? (currentShift.kas_diharapkan_sementara ?? currentShift.kas_awal)
        : null;

    if (loading) {
        return (
            <div className="p-6 text-sm text-slate-500">
                Memuat data shift...
            </div>
        );
    }

    return (
        <>
            <PageHeader
                title="Shift"
                subtitle={
                    user.role === "Admin"
                        ? "Pantau penutupan shift kasir"
                        : "Kelola shift kasir Anda"
                }
                actions={
                    user.role === "Admin" ? null : (
                        <button
                            className={open ? "btn-danger" : "btn-primary"}
                            onClick={() => {
                                setError("");
                                setModal(open ? "close" : "open");
                            }}
                        >
                            {open ? "Tutup Shift" : "Buka Shift"}
                        </button>
                    )
                }
            />

            <div className="grid grid-cols-4 gap-3">
                <Kpi
                    icon={Clock3}
                    label={
                        user.role === "Admin"
                            ? "Status Shift Outlet"
                            : "Status Shift Saya"
                    }
                    value={open ? "Aktif" : "Belum Dibuka"}
                    note={
                        open
                            ? `Dibuka ${new Date(currentShift.waktu_buka).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
                            : user.role === "Admin"
                              ? "Admin hanya meninjau penutupan shift kasir"
                              : "Buka shift untuk mulai transaksi"
                    }
                    tone={open ? "emerald" : "amber"}
                />
                <Kpi
                    icon={Wallet}
                    label="Kas Awal"
                    value={open ? formatIDR(currentShift.kas_awal) : "—"}
                    note="Modal tunai awal"
                    tone="blue"
                />
                <Kpi
                    icon={TrendingUp}
                    label="Kas Diharapkan"
                    value={open ? formatIDR(kasDiharapkanTampil) : "—"}
                    note="Berdasarkan transaksi tunai"
                    tone="orange"
                />
                <Kpi
                    icon={ReceiptText}
                    label="Transaksi Shift"
                    value={open ? (currentShift.jumlah_transaksi ?? 0) : 0}
                    note="Jumlah transaksi selesai"
                    tone="blue"
                />
            </div>

            {/* WIDGET KHUSUS ADMIN: SHIFT MENUNGGU TINJAUAN */}
            {user.role === "Admin" && pendingReviews.length > 0 && (
                <div className="card mt-3 overflow-hidden border border-red-200">
                    <div className="flex items-center gap-2 bg-red-50 p-4 text-red-700">
                        <AlertTriangle size={18} />
                        <h3 className="text-sm font-bold">
                            Menunggu Tinjauan Selisih ({pendingReviews.length})
                        </h3>
                    </div>
                    <table className="w-full bg-white">
                        <thead className="table-head">
                            <tr>
                                <th className="px-4 py-3">Kasir</th>
                                <th>Waktu Shift</th>
                                <th>Selisih</th>
                                <th>Catatan Kasir</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pendingReviews.map((s) => (
                                <tr
                                    key={s.id}
                                    className="border-b last:border-0"
                                >
                                    <td className="table-cell font-medium">
                                        {s.user?.nama ?? "-"}
                                    </td>
                                    <td className="table-cell text-xs text-slate-500">
                                        {new Date(
                                            s.waktu_buka,
                                        ).toLocaleTimeString("id-ID", {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                        {" - "}
                                        {new Date(
                                            s.waktu_tutup,
                                        ).toLocaleTimeString("id-ID", {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </td>
                                    <td className="table-cell font-bold text-red-600">
                                        {formatIDR(s.selisih)}
                                    </td>
                                    <td className="table-cell text-xs text-slate-500 italic">
                                        "{s.catatan_penutup}"
                                    </td>
                                    <td className="table-cell">
                                        <button
                                            className="rounded bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200"
                                            onClick={() => {
                                                setSelectedReviewShift(s);
                                                setError("");
                                                setModal("review");
                                            }}
                                        >
                                            Tinjau
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* TABEL DAFTAR SHIFT UMUM */}
            <div className="card mt-3 overflow-hidden">
                <div className="p-4">
                    <h3 className="text-sm font-bold">
                        {user.role === "Admin"
                            ? "Shift Hari Ini"
                            : "Riwayat Shift Saya"}
                    </h3>
                </div>
                <table className="w-full">
                    <thead className="table-head">
                        <tr>
                            <th className="px-4 py-3">Kasir</th>
                            <th>Waktu</th>
                            <th>Kas Awal</th>
                            <th>Kas Diharapkan</th>
                            <th>Kas Dihitung</th>
                            <th>Selisih</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {shiftList.map((s) => (
                            <tr key={s.id}>
                                <td className="table-cell">
                                    {s.user?.nama ?? "-"}
                                </td>
                                <td className="table-cell">
                                    {new Date(s.waktu_buka).toLocaleTimeString(
                                        "id-ID",
                                        { hour: "2-digit", minute: "2-digit" },
                                    )}
                                    {" – "}
                                    {s.waktu_tutup
                                        ? new Date(
                                              s.waktu_tutup,
                                          ).toLocaleTimeString("id-ID", {
                                              hour: "2-digit",
                                              minute: "2-digit",
                                          })
                                        : "Sekarang"}
                                </td>
                                <td className="table-cell">
                                    {formatIDR(s.kas_awal)}
                                </td>
                                <td className="table-cell">
                                    {s.status === "OPEN"
                                        ? formatIDR(
                                              s.kas_diharapkan_sementara ??
                                                  s.kas_awal,
                                          )
                                        : s.kas_diharapkan
                                          ? formatIDR(s.kas_diharapkan)
                                          : "—"}
                                </td>
                                <td className="table-cell">
                                    {s.kas_dihitung
                                        ? formatIDR(s.kas_dihitung)
                                        : "—"}
                                </td>
                                <td className="table-cell">
                                    <span
                                        className={
                                            s.selisih != 0
                                                ? "text-red-600 font-medium"
                                                : ""
                                        }
                                    >
                                        {s.selisih ? formatIDR(s.selisih) : "—"}
                                    </span>
                                </td>
                                <td className="table-cell">
                                    <Status
                                        value={
                                            s.status === "OPEN"
                                                ? "Aktif"
                                                : s.selisih != 0 &&
                                                    !s.approved_by_user_id
                                                  ? "Pending Review"
                                                  : "Selesai"
                                        }
                                        tone={
                                            s.selisih != 0 &&
                                            !s.approved_by_user_id
                                                ? "amber"
                                                : "default"
                                        }
                                    />
                                </td>
                            </tr>
                        ))}
                        {shiftList.length === 0 && (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="table-cell text-center text-slate-400"
                                >
                                    Belum ada data shift hari ini
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Modal
                open={modal === "open"}
                title="Buka Shift"
                onClose={() => setModal(null)}
            >
                <form onSubmit={handleOpen}>
                    <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
                        Pastikan kas awal sesuai dengan uang tunai di laci
                        kasir.
                    </div>
                    <div className="mt-4">
                        <label className="label">Kas awal</label>
                        <input
                            name="cash"
                            type="number"
                            required
                            defaultValue="500000"
                            className="input"
                        />
                    </div>
                    {error && (
                        <p className="mt-3 text-xs font-semibold text-red-500">
                            {error}
                        </p>
                    )}
                    <div className="mt-5 flex justify-end gap-2">
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setModal(null)}
                        >
                            Batal
                        </button>
                        <button className="btn-primary" disabled={submitting}>
                            {submitting ? "Memproses..." : "Buka Shift"}
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal
                open={modal === "close"}
                title="Tutup Shift"
                onClose={() => setModal(null)}
            >
                <form onSubmit={handleClose}>
                    <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-xs">
                        <div>
                            <span className="text-slate-500">
                                Kas diharapkan
                            </span>
                            <div className="mt-1 font-bold">
                                {open ? formatIDR(kasDiharapkanTampil) : "—"}
                            </div>
                        </div>
                        <div>
                            <span className="text-slate-500">Transaksi</span>
                            <div className="mt-1 font-bold">
                                {open
                                    ? (currentShift.jumlah_transaksi ?? 0)
                                    : 0}{" "}
                                transaksi
                            </div>
                        </div>
                    </div>
                    <div className="mt-4">
                        <label className="label">Kas dihitung</label>
                        <input
                            name="counted"
                            type="number"
                            className="input"
                            onChange={() => setError("")}
                        />
                    </div>
                    <div className="mt-4">
                        <label className="label">Catatan selisih</label>
                        <textarea
                            name="note"
                            rows="3"
                            className="input h-auto py-2"
                            placeholder="Wajib jika terdapat selisih..."
                        />
                    </div>
                    {error && (
                        <p className="mt-3 text-xs font-semibold text-red-500">
                            {error}
                        </p>
                    )}
                    <div className="mt-5 flex justify-end gap-2">
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setModal(null)}
                        >
                            Batal
                        </button>
                        <button className="btn-danger" disabled={submitting}>
                            {submitting ? "Memproses..." : "Tutup Shift"}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* MODAL BARU KHUSUS ADMIN UNTUK TINJAU SELISIH */}
            <Modal
                open={modal === "review"}
                title="Tinjau Selisih Shift"
                onClose={() => {
                    setModal(null);
                    setSelectedReviewShift(null);
                }}
            >
                <form onSubmit={handleReview}>
                    {selectedReviewShift && (
                        <div className="mb-4 grid gap-2 rounded-lg bg-red-50 p-3 text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Kasir</span>
                                <span className="font-bold">
                                    {selectedReviewShift.user?.nama}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">
                                    Kas Diharapkan
                                </span>
                                <span className="font-bold">
                                    {formatIDR(
                                        selectedReviewShift.kas_diharapkan,
                                    )}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">
                                    Kas Dihitung
                                </span>
                                <span className="font-bold">
                                    {formatIDR(
                                        selectedReviewShift.kas_dihitung,
                                    )}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">
                                    Total Selisih
                                </span>
                                <span className="font-bold text-red-600">
                                    {formatIDR(selectedReviewShift.selisih)}
                                </span>
                            </div>
                            <div className="mt-2 border-t border-red-200 pt-2">
                                <span className="block mb-1 text-slate-500">
                                    Alasan Kasir:
                                </span>
                                <span className="font-medium italic text-red-700">
                                    "{selectedReviewShift.catatan_penutup}"
                                </span>
                            </div>
                        </div>
                    )}
                    <div className="mt-4">
                        <label className="label">
                            Keputusan / Catatan Admin
                        </label>
                        <textarea
                            name="catatan_admin"
                            rows="3"
                            className="input h-auto py-2"
                            placeholder="Masukkan keputusan tindak lanjut selisih ini..."
                        />
                    </div>
                    {error && (
                        <p className="mt-3 text-xs font-semibold text-red-500">
                            {error}
                        </p>
                    )}
                    <div className="mt-5 flex justify-end gap-2">
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                                setModal(null);
                                setSelectedReviewShift(null);
                            }}
                        >
                            Batal
                        </button>
                        <button className="btn-primary" disabled={submitting}>
                            {submitting ? "Memproses..." : "Simpan Tinjauan"}
                        </button>
                    </div>
                </form>
            </Modal>
        </>
    );
}
