import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { permissions } from "../config/permissions";

export function ProtectedRoute({ children, allowed }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (allowed && !allowed.includes(user.role)) return <Navigate to="/unauthorized" replace />;
  return children;
}

// NOTE: kept for parity with the original file. RouteGate is not currently
// wired into <Routes> (route-level access is handled by ProtectedRoute's
// `allowed` prop instead) — flagging this as a candidate for cleanup in a
// later refactor pass rather than silently dropping it now.
export function RouteGate({ path, children }) {
  const { user } = useAuth();
  const allowed = permissions[user.role];
  const ok = allowed.includes("*") || allowed.includes(path);
  return ok ? children : <Navigate to="/unauthorized" replace />;
}
