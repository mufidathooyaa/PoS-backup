import React, { createContext, useContext, useState } from "react";
import { api, ApiError } from "../lib/apiClient";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("pos_user"));
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  const login = async (loginInput, password) => {
    setLoading(true);
    try {
      const data = await api.post("/login", { login: loginInput, password });

      const safeUser = {
        id: data.user.id,
        name: data.user.nama,
        username: data.user.username,
        role: data.user.role,
        outlet_id: data.user.outlet_id,
        outlet_nama: data.user.outlet_nama,
      };

      localStorage.setItem("pos_token", data.token);
      localStorage.setItem("pos_user", JSON.stringify(safeUser));
      setUser(safeUser);
      return safeUser;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError("Tidak bisa terhubung ke server", 0, null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post("/logout");
    } catch {
      // abaikan error logout — tetap bersihkan sesi lokal walau request gagal
    }
    localStorage.removeItem("pos_token");
    localStorage.removeItem("pos_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);