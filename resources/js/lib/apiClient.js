// resources/js/lib/apiClient.js

const BASE_URL = "/api"; // path relatif, karena sekarang satu domain dengan Laravel

function getToken() {
  return localStorage.getItem("pos_token");
}

async function request(path, { method = "GET", body, params = {} } = {}) {
  let url = `${BASE_URL}${path}`;

  try {
    const storedOutlet = localStorage.getItem("pos_active_outlet");
    if (storedOutlet) {
      const parsedOutlet = JSON.parse(storedOutlet);
      if (parsedOutlet && parsedOutlet.id) {
        params.outlet_id = parsedOutlet.id;
      }
    }
  } catch (error) {
    // Abaikan secara diam-diam jika JSON tidak valid
  }

  if (Object.keys(params).length > 0) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
    ).toString();
    if (query) url += `?${query}`;
  }

  const headers = {
    Accept: "application/json",
  };

  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let fetchBody;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    fetchBody = JSON.stringify(body);
  }

  const response = await fetch(url, { method, headers, body: fetchBody });

  if (response.status === 401) {
    localStorage.removeItem("pos_token");
    localStorage.removeItem("pos_user");
    window.location.href = "/login";
    throw new ApiError("Sesi berakhir, silakan login kembali", 401, null);
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    throw new ApiError(data?.message || "Terjadi kesalahan", response.status, data);
  }

  return data;
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export const api = {
  get: (path, params) => request(path, { method: "GET", params }),
  post: (path, body) => request(path, { method: "POST", body }),
  put: (path, body) => request(path, { method: "PUT", body }),
};