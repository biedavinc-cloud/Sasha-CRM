// Frontend client for the Cloudflare Pages Functions backend (see /functions).
// Mirrors the small slice of the former Base44 SDK that the app used, so pages need few changes.

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.response = { status, data }; // axios-style, used by existing catch blocks
  }
}

async function request(method, path, { body } = {}) {
  let res;
  try {
    res = await fetch("/api" + path, {
      method,
      credentials: "same-origin",
      headers: body !== undefined ? { "content-type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Network error — please check your connection", 0, null);
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: text.slice(0, 200) }; }
  if (!res.ok) throw new ApiError((data && data.error) || res.statusText || "Request failed", res.status, data);
  return data;
}

const enc = encodeURIComponent;
const post = (path, body = {}) => request("POST", path, { body });

function entity(name) {
  const base = `/entities/${enc(name)}`;
  async function filter(query = {}, options = {}) {
    if (typeof options === "string") options = { sort: options };
    const p = new URLSearchParams();
    if (query && Object.keys(query).length) p.set("q", JSON.stringify(query));
    if (options.sort) p.set("sort", options.sort);
    if (options.limit) p.set("limit", String(options.limit));
    if (options.skip) p.set("skip", String(options.skip));
    if (options.fields) p.set("fields", options.fields.join(","));
    const qs = p.toString();
    const { items } = await request("GET", base + (qs ? "?" + qs : ""));
    items.items = items; // callers use either the array or `.items`
    return items;
  }
  return {
    filter,
    list: (sort, limit) => filter({}, { sort, limit }),
    get: (id) => request("GET", `${base}/${enc(id)}`),
    create: (data) => post(base, data),
    update: (id, data) => request("PATCH", `${base}/${enc(id)}`, { body: data }),
    delete: (id) => request("DELETE", `${base}/${enc(id)}`),
    async count(query = {}) {
      const qs = Object.keys(query).length ? "?q=" + enc(JSON.stringify(query)) : "";
      return (await request("GET", `${base}/count${qs}`)).count;
    },
    aggregate: (opts) => post(`${base}/aggregate`, opts),
  };
}

// Users live in their own table behind admin-only endpoints.
const userEntity = {
  async list() {
    const { items } = await request("GET", "/users");
    items.items = items;
    return items;
  },
  update: (id, data) => request("PATCH", `/users/${enc(id)}`, { body: data }),
};

export const api = {
  auth: {
    me: () => request("GET", "/auth/me"),
    config: () => request("GET", "/auth/config"),
    login: (email, password) => post("/auth/login", { email, password }),
    register: ({ email, password, full_name }) => post("/auth/register", { email, password, full_name }),
    verifyOtp: ({ email, otpCode }) => post("/auth/verify-otp", { email, otpCode }),
    resendOtp: (email) => post("/auth/resend-otp", { email }),
    changePassword: (currentPassword, newPassword) => post("/auth/change-password", { currentPassword, newPassword }),
    resetPasswordRequest: (email) => post("/auth/password-reset/request", { email }),
    resetPassword: ({ resetToken, newPassword }) => post("/auth/password-reset/confirm", { resetToken, newPassword }),
    loginWithGoogle: (returnTo = "/") => { window.location.href = "/api/auth/google/start?returnTo=" + enc(returnTo); },
    async logout(redirectUrl) {
      try { await post("/auth/logout"); } catch { /* cookie is cleared server-side when reachable */ }
      if (redirectUrl !== undefined) window.location.href = redirectUrl || "/login";
    },
  },
  entities: new Proxy({}, { get: (_t, name) => (name === "User" ? userEntity : entity(String(name))) }),
  users: {
    inviteUser: (email, role = "user") => post("/users/invite", { email, role }),
    resetPassword: (id) => post(`/users/${enc(id)}/reset-password`),
  },
  config: () => request("GET", "/config"),
  functions: {
    async invoke(name, body = {}) {
      const data = await post(`/fn/${enc(name)}`, body);
      return { data, status: 200 };
    },
  },
};
