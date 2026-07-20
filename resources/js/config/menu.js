import {
  BarChart3, Boxes, Clock3, LayoutDashboard, ReceiptText, ShieldCheck, ShoppingCart, UserCog,
} from "lucide-react";

export const menuByRole = {
  Admin: [
    ["Dashboard", "/dashboard", LayoutDashboard], ["Pengguna & Role", "/pengguna-role", UserCog],
    ["Shift", "/shift", Clock3], ["Transaksi", "/transaksi", ReceiptText], ["Laporan", "/laporan", BarChart3],
    ["Inventaris", "/inventaris", Boxes], ["Audit Log", "/audit-log", ShieldCheck],
  ],
  Kasir: [["Transaksi", "/transaksi/kasir", ShoppingCart], ["Shift", "/shift", Clock3]],
  "Operator Inventaris": [["Inventaris", "/inventaris", Boxes]],
};
