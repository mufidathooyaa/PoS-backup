export const USERS = [
  { id: 1, name: "Alya Pratama", email: "admin@poskasir.id", password: "admin123", role: "Admin", active: true },
  { id: 2, name: "Raka Saputra", email: "kasir@poskasir.id", password: "kasir123", role: "Kasir", active: true },
  { id: 3, name: "Dina Maharani", email: "operator@poskasir.id", password: "operator123", role: "Operator Inventaris", active: true },
];

export const PRODUCTS = [
  { id: 1, name: "Kopi Susu Gula Aren", sku: "MNM-001", category: "Minuman", unit: "Cup", price: 22000, stock: 34, color: "bg-amber-100 text-amber-700" },
  { id: 2, name: "Americano", sku: "MNM-002", category: "Minuman", unit: "Cup", price: 18000, stock: 27, color: "bg-stone-100 text-stone-700" },
  { id: 3, name: "Matcha Latte", sku: "MNM-003", category: "Minuman", unit: "Cup", price: 25000, stock: 12, color: "bg-emerald-100 text-emerald-700" },
  { id: 4, name: "Croissant Butter", sku: "MKN-001", category: "Makanan", unit: "Pcs", price: 20000, stock: 8, color: "bg-orange-100 text-orange-700" },
  { id: 5, name: "Nasi Ayam Sambal Matah", sku: "MKN-002", category: "Makanan", unit: "Porsi", price: 35000, stock: 16, color: "bg-red-100 text-red-700" },
  { id: 6, name: "French Fries", sku: "MKN-003", category: "Makanan", unit: "Porsi", price: 24000, stock: 21, color: "bg-yellow-100 text-yellow-700" },
  { id: 7, name: "Mineral Water", sku: "MNM-004", category: "Minuman", unit: "Botol", price: 8000, stock: 62, color: "bg-blue-100 text-blue-700" },
  { id: 8, name: "Chocolate Cookies", sku: "MKN-004", category: "Makanan", unit: "Pcs", price: 15000, stock: 9, color: "bg-violet-100 text-violet-700" },
];

export const TRANSACTIONS = [
  { invoice: "INV-2026-0709-0128", time: "13:42", cashier: "Raka Saputra", total: 72000, method: "QRIS Manual", status: "Berhasil" },
  { invoice: "INV-2026-0709-0127", time: "13:35", cashier: "Raka Saputra", total: 105000, method: "Tunai", status: "Berhasil" },
  { invoice: "LOCAL-2026-07-00002", time: "13:20", cashier: "Raka Saputra", total: 44000, method: "Tunai", status: "Menunggu Sinkronisasi" },
  { invoice: "INV-2026-0709-0125", time: "12:57", cashier: "Nisa Rahma", total: 68000, method: "Transfer Manual", status: "Refund" },
  { invoice: "INV-2026-0709-0124", time: "12:38", cashier: "Raka Saputra", total: 125000, method: "Tunai", status: "Berhasil" },
];

export const SALES_TREND = [
  { day: "Kam", sales: 3100000 }, { day: "Jum", sales: 3800000 }, { day: "Sab", sales: 4900000 },
  { day: "Min", sales: 5250000 }, { day: "Sen", sales: 3450000 }, { day: "Sel", sales: 3950000 }, { day: "Rab", sales: 4250000 },
];

export const AUDITS = [
  { id: "APR-097", action: "Penyesuaian stok", actor: "Dina Maharani", detail: "Croissant Butter: 10 → 8", time: "13:28", status: "Menunggu" },
  { id: "APR-096", action: "Total manual", actor: "Raka Saputra", detail: "Rp 86.000 → Rp 85.000", time: "12:45", status: "Menunggu" },
  { id: "APR-095", action: "Selisih shift", actor: "Nisa Rahma", detail: "Selisih kas -Rp 15.000", time: "11:16", status: "Menunggu" },
  { id: "AUD-094", action: "Refund transaksi", actor: "Alya Pratama", detail: "INV-2026-0709-0125", time: "10:32", status: "Disetujui" },
];

export const formatIDR = (value) => new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0,
}).format(value);
