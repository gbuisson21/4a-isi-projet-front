/* Page Admin > Commandes :
 *   GET    /api/admin/reservations?pickup_date=…&user_id=…   liste filtrée côté serveur
 *          (?user_id= dans l'URL de la page : commandes d'un client, depuis Admin > Comptes)
 *   POST   /api/admin/reservations/{id}/check      { status: "completed" | "no_show" }
 *   DELETE /api/admin/reservations/{id}
 */

if (requireRole("admin")) {
  const listEl = document.getElementById("orders");
  const statsEl = document.getElementById("stats");
  const dayLabelEl = document.getElementById("day-label");
  const searchEl = document.getElementById("search");
  const statusEl = document.getElementById("status");
  const quickForm = document.getElementById("quick-check");
  const quickInput = document.getElementById("quick-input");


  // ?user_id=… : commandes d'un seul client, toutes dates et tous statuts
  const userId = Number(new URLSearchParams(location.search).get("user_id")) || null;
  let day = userId ? null : toIsoDate(new Date()); // null = toutes les dates
  let orders = [];
  if (userId) statusEl.value = "";

  /* ---------- Affichage ---------- */

  function renderStats() {
    const count = (status) => orders.filter((o) => o.status === status).length;
    const sum = (status) => orders.filter((o) => o.status === status).reduce((s, o) => s + o.total_price, 0);
    const stat = (value, label) => `<div class="stats__item"><span class="stats__value">${value}</span><span class="stats__label">${label}</span></div>`;
    statsEl.innerHTML =
      stat(count("pending"), "À retirer") +
      stat(count("completed"), "Retirées") +
      stat(count("no_show"), "Non retirées") +
      stat(formatPrice(sum("completed")), `Encaissé · ${formatPrice(sum("pending"))} attendus`);
  }

  function renderOrder(order) {
    const status = ORDER_STATUS[order.status] ?? { label: order.status, badge: "" };
    const lines = [...order.menus, ...order.products]
      .map((l) => `<li><strong>${l.quantity} ×</strong> ${escapeHtml(l.name)}</li>`)
      .join("");
    const actions = order.status === "pending"
      ? `<button class="btn btn--primary" type="button" data-check="completed" data-id="${order.id}">✓ Récupérée</button>
         <button class="btn" type="button" data-check="no_show" data-id="${order.id}">Non venue</button>`
      : "";

    return `
      <article class="card admin-row order-row order-row--${order.status}" id="order-${order.id}">
        <div class="order-row__id">N°${order.id}</div>
        <div class="admin-row__main">
          <div class="admin-row__title">
            <a class="admin-row__name" href="admin-commandes.html?user_id=${order.user.id}" title="Toutes les commandes de ${escapeHtml(order.user.username)}">${escapeHtml(order.user.username)}</a>
            <span class="badge ${status.badge}">${status.label}</span>
          </div>
          <div class="admin-row__meta">Retrait ${formatDate(parseDate(order.pickup_date))}</div>
          <ul class="order-row__lines">${lines}</ul>
        </div>
        <span class="price admin-row__price">${formatPrice(order.total_price)}</span>
        <div class="admin-row__actions">
          ${actions}
          <button class="btn btn--danger" type="button" data-delete="${order.id}" aria-label="Supprimer la commande n°${order.id}">Suppr.</button>
        </div>
      </article>`;
  }

  function renderList() {
    const query = searchEl.value.trim().toLowerCase().replace(/^n°\s*/, "");
    const status = statusEl.value;
    const filtered = orders
      .filter((o) => !status || o.status === status)
      .filter((o) => !query || o.user.username.toLowerCase().includes(query) || String(o.id) === query);

    let empty = "Aucune commande ne correspond.";
    if (!orders.length) empty = day ? "Aucune commande pour ce jour." : "Aucune commande.";
    else if (status === "pending" && !query && !filtered.length) empty = "Toutes les commandes de ce jour ont été traitées. 🎉";

    listEl.innerHTML = filtered.length ? filtered.map(renderOrder).join("") : `<p class="state">${empty}</p>`;
  }

  function renderDayLabel() {
    const isToday = day === toIsoDate(new Date());
    dayLabelEl.textContent = day
      ? `${isToday ? "Aujourd'hui, " : ""}${formatDate(parseDate(day))}`
      : "Toutes les dates";
    document.getElementById("today").classList.toggle("btn--primary", isToday);
    document.getElementById("all-days").classList.toggle("btn--primary", !day);
    document.getElementById("prev-day").disabled = !day;
    document.getElementById("next-day").disabled = !day;
  }

  async function loadOrders() {
    renderDayLabel();
    showLoading(listEl);
    try {
      const params = {};
      if (day) params.pickup_date = day;
      if (userId) params.user_id = userId;
      orders = await OrderApi.adminList(params);
      renderStats();
      renderList();
    } catch (error) {
      statsEl.innerHTML = "";
      showError(listEl, error);
    }
  }


  /** Bandeau « Commandes de X » quand la page est filtrée sur un client. */
  async function renderUserFilter() {
    const el = document.getElementById("user-filter");
    if (!userId) return;
    let name = `client n°${userId}`;
    try {
      name = (await AuthApi.listUsers()).find((u) => u.id === userId)?.username ?? name;
    } catch { /* on garde le numéro */ }
    el.innerHTML = `Commandes de <strong>${escapeHtml(name)}</strong>
      <a class="btn" href="admin-comptes.html">← Comptes</a>
      <a class="btn" href="admin-commandes.html">✕ Tous les clients</a>`;
    el.hidden = false;
  }

  /* ---------- Actions ---------- */

  async function checkOrder(id, status) {
    const updated = await OrderApi.check(id, status);
    const index = orders.findIndex((o) => o.id === updated.id);
    if (index >= 0) orders[index] = updated;
    renderStats();
    renderList();
    return updated;
  }

  listEl.addEventListener("click", async (event) => {
    const checkBtn = event.target.closest("[data-check]");
    const deleteBtn = event.target.closest("[data-delete]");

    if (checkBtn) {
      const order = orders.find((o) => o.id === Number(checkBtn.dataset.id));
      const noShow = checkBtn.dataset.check === "no_show";
      if (noShow && !confirm(`Marquer la commande n°${order.id} de ${order.user.username} comme non retirée ?`)) return;
      checkBtn.disabled = true;
      try {
        await checkOrder(order.id, checkBtn.dataset.check);
        flash(noShow
          ? `Commande n°${order.id} marquée non retirée.`
          : `Commande n°${order.id} validée : ${formatPrice(order.total_price)} à encaisser auprès de ${order.user.username}.`);
      } catch (error) {
        flash(error.message, true);
        checkBtn.disabled = false;
      }
      return;
    }

    if (deleteBtn) {
      const order = orders.find((o) => o.id === Number(deleteBtn.dataset.delete));
      if (!confirm(`Supprimer définitivement la commande n°${order.id} de ${order.user.username} ?`)) return;
      deleteBtn.disabled = true;
      try {
        await OrderApi.adminRemove(order.id);
        orders = orders.filter((o) => o.id !== order.id);
        renderStats();
        renderList();
        flash(`Commande n°${order.id} supprimée.`);
      } catch (error) {
        flash(error.message, true);
        deleteBtn.disabled = false;
      }
    }
  });

  /** Valide le retrait d'une commande (saisie ou scan) et met la liste à jour. */
  async function validatePickup(id) {
    const order = await checkOrder(id, "completed");
    // Commande d'un autre jour que celui affiché : on recharge
    if (!orders.some((o) => o.id === order.id)) loadOrders();
    return order;
  }

  /* Validation rapide par saisie */
  quickForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = parseOrderCode(quickInput.value);
    if (!id) {
      flash("Saisissez un numéro de commande ou le code du QR.", true);
      return;
    }
    const submit = quickForm.querySelector("[type=submit]");
    submit.disabled = true;
    try {
      const order = await validatePickup(id);
      flash(`Commande n°${order.id} validée : ${formatPrice(order.total_price)} à encaisser auprès de ${order.user.username}.`);
      quickInput.value = "";
    } catch (error) {
      flash(error.message, true);
    } finally {
      submit.disabled = false;
      quickInput.focus();
    }
  });

  /* Scanner de QR code : js/admin-scanner.js */
  initScanner({ onValidate: validatePickup });

  /* ---------- Navigation entre les jours ---------- */

  const moveDay = (offset) => {
    day = toIsoDate(addDays(parseDate(day), offset));
    loadOrders();
  };
  document.getElementById("prev-day").addEventListener("click", () => moveDay(-1));
  document.getElementById("next-day").addEventListener("click", () => moveDay(1));
  document.getElementById("today").addEventListener("click", () => { day = toIsoDate(new Date()); loadOrders(); });
  document.getElementById("all-days").addEventListener("click", () => { day = null; loadOrders(); });
  searchEl.addEventListener("input", renderList);
  statusEl.addEventListener("change", renderList);

  showMockBanner();
  renderUserFilter();
  loadOrders();
}
