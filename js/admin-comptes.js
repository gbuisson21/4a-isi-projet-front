/* Page Admin > Comptes : GET /api/admin/users (⚠️ route à ajouter dans API.md)
 * et PUT /api/admin/users/{id}/lock. Les admins sont créés en CLI, jamais ici.
 * Le nombre de commandes par compte vient de GET /api/admin/reservations. */

if (requireRole("admin")) {
  const listEl = document.getElementById("users");
  const statsEl = document.getElementById("stats");
  const searchEl = document.getElementById("search");
  const filterEl = document.getElementById("filter");

  let users = [];
  let orderStats = new Map(); // id du compte -> { total, noShow }
  const NO_SHOW_ALERT = 2;    // à partir de combien de commandes non retirées on signale le compte
  const me = Session.get().username;

  const formatDay = (iso) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

  function renderStats() {
    const count = (fn) => users.filter(fn).length;
    const stat = (value, label) => `<div class="stats__item"><span class="stats__value">${value}</span><span class="stats__label">${label}</span></div>`;
    statsEl.innerHTML =
      stat(users.length, "Comptes") +
      stat(count((u) => u.role === "user"), "Étudiants") +
      stat(count((u) => u.role === "admin"), "Admins") +
      stat(count((u) => u.is_locked), "Bloqués") +
      stat(count((u) => (orderStats.get(u.id)?.noShow ?? 0) >= NO_SHOW_ALERT), `≥ ${NO_SHOW_ALERT} non retirées`);
  }

  function renderRow(user) {
    const isAdmin = user.role === "admin";
    const stats = orderStats.get(user.id) ?? { total: 0, noShow: 0 };
    const lockAction = isAdmin
      ? `<span class="admin-row__note">Non bloquable</span>`
      : `<button class="btn ${user.is_locked ? "" : "btn--danger"}" type="button" data-lock="${user.id}">
           ${user.is_locked ? "Débloquer" : "Bloquer"}
         </button>`;
    const ordersText = stats.total
      ? `${stats.total} commande${stats.total > 1 ? "s" : ""}`
        + (stats.noShow ? ` · <strong class="${stats.noShow >= NO_SHOW_ALERT ? "text-danger" : ""}">${stats.noShow} non retirée${stats.noShow > 1 ? "s" : ""}</strong>` : "")
      : "Aucune commande";

    return `
      <article class="card admin-row user-row ${user.is_locked ? "admin-row--past" : ""}">
        <div class="profile__avatar profile__avatar--small" aria-hidden="true">${escapeHtml(user.username.slice(0, 1).toUpperCase())}</div>
        <div class="admin-row__main">
          <div class="admin-row__title">
            <span class="admin-row__name">${escapeHtml(user.username)}</span>
            ${isAdmin ? `<span class="badge badge--admin">Admin</span>` : ""}
            ${user.is_locked ? `<span class="badge badge--out">Bloqué</span>` : ""}
            ${user.username === me ? `<span class="badge badge--role">Vous</span>` : ""}
          </div>
          <div class="admin-row__meta">#${user.id} · inscrit le ${formatDay(user.created_at)} · ${ordersText}</div>
        </div>
        <div class="admin-row__actions">
          <a class="btn" href="admin-commandes.html?user_id=${user.id}">Voir ses commandes</a>
          ${lockAction}
        </div>
      </article>`;
  }

  function renderList() {
    const query = searchEl.value.trim().toLowerCase();
    const filter = filterEl.value;
    const filtered = users
      .filter((u) => u.username.toLowerCase().includes(query))
      .filter((u) => {
        if (filter === "all") return true;
        if (filter === "locked") return u.is_locked;
        if (filter === "no_show") return (orderStats.get(u.id)?.noShow ?? 0) >= NO_SHOW_ALERT;
        return u.role === filter;
      })
      .sort((a, b) => (b.role === "admin") - (a.role === "admin") || a.username.localeCompare(b.username));

    listEl.innerHTML = filtered.length
      ? filtered.map(renderRow).join("")
      : `<p class="state">Aucun compte ne correspond.</p>`;
  }


  async function loadUsers() {
    showLoading(listEl);
    try {
      const [userList, orders] = await Promise.all([
        AuthApi.listUsers(),
        OrderApi.adminList().catch(() => []), // la liste des comptes reste utile sans les commandes
      ]);
      users = userList;
      orderStats = new Map();
      for (const order of orders) {
        const s = orderStats.get(order.user.id) ?? { total: 0, noShow: 0 };
        s.total += 1;
        if (order.status === "no_show") s.noShow += 1;
        orderStats.set(order.user.id, s);
      }
      renderStats();
      renderList();
    } catch (error) {
      if (error.status === 404 && !USE_MOCK.auth) error.message = "La route GET /api/admin/users n'existe pas encore côté back.";
      showError(listEl, error);
    }
  }

  listEl.addEventListener("click", async (event) => {
    const btn = event.target.closest("[data-lock]");
    if (!btn) return;
    const user = users.find((u) => u.id === Number(btn.dataset.lock));
    const lock = !user.is_locked;
    if (lock && !confirm(`Bloquer le compte « ${user.username} » ? Il ne pourra plus se connecter ni réserver.`)) return;

    btn.disabled = true;
    try {
      const updated = await AuthApi.setLocked(user.id, lock);
      Object.assign(user, updated);
      renderStats();
      renderList();
      flash(`Compte « ${user.username} » ${lock ? "bloqué" : "débloqué"}.`);
    } catch (error) {
      flash(error.message, true);
      btn.disabled = false;
    }
  });

  searchEl.addEventListener("input", renderList);
  filterEl.addEventListener("change", renderList);

  showMockBanner();
  loadUsers();
}
