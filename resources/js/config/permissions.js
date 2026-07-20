export const roleHome = (role) =>
  role === "Admin" ? "/dashboard" : role === "Kasir" ? "/transaksi/kasir" : "/inventaris";

export const permissions = {
  Admin: ["*"],
  Kasir: ["/transaksi", "/transaksi/kasir", "/shift"],
  "Operator Inventaris": ["/inventaris"],
};
