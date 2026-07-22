import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { roleHome } from "./config/permissions";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppShell } from "./components/layout/AppShell";
import { Login } from "./components/layout/Login";
import { Unauthorized } from "./components/layout/Unauthorized";
import { Dashboard } from "./features/dashboard/Dashboard";
import { UsersPage } from "./features/users/UsersPage";
import { OutletsPage } from "./features/outlets/OutletsPage";
import { ShiftPage } from "./features/shift/ShiftPage";
import { TransactionsPage } from "./features/transactions/TransactionsPage";
import { CashierPage } from "./features/cashier/CashierPage";
import { ReportsPage } from "./features/reports/ReportsPage";
import { InventoryPage } from "./features/inventory/InventoryPage";
import { AuditLogPage } from "./features/audit/AuditLogPage";
import { ObservabilityPage } from "./features/observability/ObservabilityPage";

export default function App() {
  return <AuthProvider><ToastProvider><Routes>
    <Route path="/login" element={<Login/>}/>
    <Route element={<ProtectedRoute><AppShell/></ProtectedRoute>}>
      <Route path="/dashboard" element={<ProtectedRoute allowed={["Admin"]}><Dashboard/></ProtectedRoute>}/>
      <Route path="/outlet" element={<ProtectedRoute allowed={["Admin"]}><OutletsPage/></ProtectedRoute>}/>
      <Route path="/pengguna-role" element={<ProtectedRoute allowed={["Admin"]}><UsersPage/></ProtectedRoute>}/>
      <Route path="/shift" element={<ProtectedRoute allowed={["Admin","Kasir"]}><ShiftPage/></ProtectedRoute>}/>
      <Route path="/transaksi" element={<ProtectedRoute allowed={["Admin","Kasir"]}><TransactionsPage/></ProtectedRoute>}/>
      <Route path="/transaksi/kasir" element={<ProtectedRoute allowed={["Admin","Kasir"]}><CashierPage/></ProtectedRoute>}/>
      <Route path="/laporan" element={<ProtectedRoute allowed={["Admin"]}><ReportsPage/></ProtectedRoute>}/>
      <Route path="/inventaris" element={<ProtectedRoute allowed={["Admin","Operator Inventaris"]}><InventoryPage/></ProtectedRoute>}/>
      <Route path="/audit-log" element={<ProtectedRoute allowed={["Admin"]}><AuditLogPage/></ProtectedRoute>}/>
      <Route path="/observability" element={<ProtectedRoute allowed={["Admin"]}><ObservabilityPage/></ProtectedRoute>}/>
      <Route path="/unauthorized" element={<Unauthorized/>}/>
      <Route index element={<NavigateToHome/>}/>
      <Route path="*" element={<Navigate to="/unauthorized" replace/>}/>
    </Route>
    <Route path="*" element={<Navigate to="/login" replace/>}/>
  </Routes></ToastProvider></AuthProvider>;
}

function NavigateToHome(){const {user}=useAuth();return <Navigate to={roleHome(user.role)} replace/>}
