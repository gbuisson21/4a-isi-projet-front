/* Comptes : session locale, appels /api/user/* et /api/admin/users/*, accès aux pages.
 * Simulation dans js/mock.js ; USE_MOCK.auth choisit. */

/* ---------- Session (jeton + rôle gardés dans le navigateur) ---------- */
const Session = {
  get() {
    try {
      const token = localStorage.getItem("token");
      if (!token) return null;
      return { token, role: localStorage.getItem("kfet-role") || "user", username: localStorage.getItem("kfet-username") || "" };
    } catch {
      return null;
    }
  },
  set({ access_token, role }, username) {
    try {
      localStorage.setItem("token", access_token); // lu par api.js pour l'en-tête Authorization
      localStorage.setItem("kfet-role", role);
      localStorage.setItem("kfet-username", username);
    } catch { /* stockage indisponible : la session ne survivra pas au rechargement */ }
  },
  clear() {
    try {
      ["token", "kfet-role", "kfet-username"].forEach((k) => localStorage.removeItem(k));
    } catch { /* ignoré */ }
  },
  isAdmin() {
    return this.get()?.role === "admin";
  },
};

/* ---------- Vraie API ---------- */
const realAuthApi = {
  /** POST /api/user/register -> { id, username, password } (mot de passe affiché une seule fois) */
  register: (username) => api("/user/register", { method: "POST", body: { username } }),
  /** POST /api/user/login -> { access_token, token_type, role } */
  login: (username, password) =>
    api("/user/login", { method: "POST", body: { username, password }, handleAuth: false }),
  /** GET /api/user/profile -> User */
  profile: () => api("/user/profile"),
  /** PUT /api/user/change-password -> 204 (401 = ancien mot de passe faux, pas une session expirée) */
  changePassword: (old_password, new_password) =>
    api("/user/change-password", { method: "PUT", body: { old_password, new_password }, handleAuth: false }),
  /** GET /api/admin/users -> User[]  ⚠️ route absente d'API.md, à ajouter côté back */
  listUsers: () => api("/admin/users"),
  /** PUT /api/admin/users/{id}/lock -> User */
  setLocked: (id, locked) => api(`/admin/users/${id}/lock`, { method: "PUT", body: { locked } }),
};

const AuthApi = USE_MOCK.auth ? mockAuthApi : realAuthApi;

/* ---------- Accès aux pages ---------- */

/** Lien vers la page de connexion qui ramène ensuite à la page actuelle. */
function loginUrl({ expired = false } = {}) {
  const page = location.pathname.split("/").pop() || "index.html";
  return `connexion.html?next=${encodeURIComponent(page + location.search)}${expired ? "&expired=1" : ""}`;
}

// Session expirée (401 sur n'importe quel appel) : on vide la session et on repasse par la connexion
onUnauthorized = () => {
  Session.clear();
  location.href = loginUrl({ expired: true });
};

/**
 * À appeler en haut des pages protégées. Si l'accès est refusé, remplace le contenu
 * de <main> par un message et renvoie false.
 */
function requireRole(role) {
  const session = Session.get();
  const main = document.querySelector("main");
  if (session && (role !== "admin" || session.role === "admin")) return true;

  const message = session
    ? "Cette page est réservée aux administrateurs de la Kfet."
    : "Connectez-vous pour accéder à cette page.";
  main.innerHTML = `
    <h1>Accès restreint</h1>
    <p class="state">${message}<br><br>
      <a class="btn btn--primary" href="${loginUrl()}">${session ? "Changer de compte" : "Se connecter"}</a>
    </p>`;
  return false;
}

function logout() {
  Session.clear();
  location.href = "index.html";
}
