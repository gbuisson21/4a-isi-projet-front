/* Page Mes réservations : GET / DELETE /api/user/reservations.
 *   - « À récupérer » : réservations en attente dont la date n'est pas passée,
 *     de la plus proche à la plus lointaine, avec QR code et annulation ;
 *   - « Historique » : retirées, non retirées et dates dépassées, les plus récentes d'abord.
 * L'onglet Historique s'ouvre directement avec reservations.html#historique. */

if (requireRole("user")) {
  const panels = {
    upcoming: { tab: document.getElementById("tab-upcoming"), panel: document.getElementById("panel-upcoming"), label: "À récupérer" },
    history: { tab: document.getElementById("tab-history"), panel: document.getElementById("panel-history"), label: "Historique" },
  };
  let reservations = [];

  const today = () => toIsoDate(new Date());
  const isUpcoming = (r) => r.status === "pending" && r.pickup_date >= today();

  /* ---------- Onglets ---------- */

  function showTab(name) {
    for (const [key, { tab, panel }] of Object.entries(panels)) {
      tab.setAttribute("aria-selected", key === name);
      panel.hidden = key !== name;
    }
    history.replaceState(null, "", name === "history" ? "#historique" : location.pathname);
  }

  panels.upcoming.tab.addEventListener("click", () => showTab("upcoming"));
  panels.history.tab.addEventListener("click", () => showTab("history"));

  /* ---------- Affichage ---------- */

  function linesHtml(r) {
    return [...r.menus, ...r.products]
      .map((l) => `<li><span>${l.quantity} × ${escapeHtml(l.name)}</span><span>${formatPrice(l.unit_price * l.quantity)}</span></li>`)
      .join("");
  }

  /** Jours restants avant le retrait, en clair. */
  function countdown(date) {
    const days = Math.round((parseDate(date) - parseDate(today())) / 86400000);
    if (days === 0) return "Aujourd'hui";
    if (days === 1) return "Demain";
    return `Dans ${days} jours`;
  }

  function renderUpcoming(r, index) {
    return `
      <article class="reservation ${index === 0 ? "reservation--next" : ""}">
        <button class="reservation__qr" type="button" data-qr="${r.id}" aria-label="Agrandir le QR code de la réservation n°${r.id}">
          ${qrCodeSvg(reservationQrPayload(r), `QR code de la réservation n°${r.id}`)}
          <span class="reservation__qr-hint">Agrandir</span>
        </button>
        <div class="reservation__info">
          <div class="reservation__head">
            <span class="reservation__date">${formatDate(parseDate(r.pickup_date))}</span>
            <span class="badge badge--pending">${countdown(r.pickup_date)}</span>
          </div>
          <ul class="reservation__lines">${linesHtml(r)}</ul>
          <div class="reservation__foot">
            <span>N°${r.id} · <strong class="price">${formatPrice(r.total_price)}</strong></span>
            <button class="btn btn--danger" type="button" data-cancel="${r.id}">Annuler</button>
          </div>
        </div>
      </article>`;
  }

  function renderHistory(r) {
    // Une réservation encore « pending » mais dont la date est passée n'a pas été traitée
    const badge = r.status === "pending"
      ? `<span class="badge badge--past">Date passée</span>`
      : orderStatusBadge(r.status);
    return `
      <article class="reservation reservation--past">
        <div class="reservation__info">
          <div class="reservation__head">
            <span class="reservation__date">${formatDate(parseDate(r.pickup_date), { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
            ${badge}
          </div>
          <ul class="reservation__lines">${linesHtml(r)}</ul>
          <div class="reservation__foot">
            <span>N°${r.id} · <strong class="price">${formatPrice(r.total_price)}</strong></span>
          </div>
        </div>
      </article>`;
  }

  function render() {
    const upcoming = reservations.filter(isUpcoming)
      .sort((a, b) => a.pickup_date.localeCompare(b.pickup_date) || a.id - b.id);
    const past = reservations.filter((r) => !isUpcoming(r))
      .sort((a, b) => b.pickup_date.localeCompare(a.pickup_date) || b.id - a.id);

    panels.upcoming.tab.textContent = `${panels.upcoming.label} (${upcoming.length})`;
    panels.history.tab.textContent = `${panels.history.label} (${past.length})`;

    panels.upcoming.panel.innerHTML = upcoming.length
      ? upcoming.map(renderUpcoming).join("")
      : `<p class="state">Rien à récupérer pour le moment.<br><br><a class="btn btn--primary" href="menus.html">Voir les menus</a></p>`;
    panels.history.panel.innerHTML = past.length
      ? past.map(renderHistory).join("")
      : `<p class="state">Aucune réservation passée.</p>`;
  }

  async function loadReservations() {
    showLoading(panels.upcoming.panel);
    try {
      reservations = await OrderApi.list();
      render();
    } catch (error) {
      if (error.status === 403) Session.clear(); // compte bloqué (401 géré par api.js)
      showError(panels.upcoming.panel, error);
    }
  }

  /* ---------- QR code en grand ---------- */

  const qrDialog = document.getElementById("qr-dialog");

  function openQr(reservation) {
    document.getElementById("qr-dialog-code").innerHTML =
      qrCodeSvg(reservationQrPayload(reservation), `QR code de la réservation n°${reservation.id}`);
    document.getElementById("qr-dialog-info").textContent =
      `Réservation n°${reservation.id} · ${formatDate(parseDate(reservation.pickup_date))} · ${formatPrice(reservation.total_price)}`;
    qrDialog.showModal();
  }

  qrDialog.addEventListener("click", (event) => {
    if (event.target.closest("[data-close]") || event.target === qrDialog) qrDialog.close();
  });

  /* ---------- Actions ---------- */

  panels.upcoming.panel.addEventListener("click", async (event) => {
    const qrBtn = event.target.closest("[data-qr]");
    if (qrBtn) {
      openQr(reservations.find((r) => r.id === Number(qrBtn.dataset.qr)));
      return;
    }

    const btn = event.target.closest("[data-cancel]");
    if (!btn || !confirm("Annuler cette réservation ?")) return;
    btn.disabled = true;
    try {
      await OrderApi.cancel(btn.dataset.cancel);
      flash(`Réservation n°${btn.dataset.cancel} annulée.`);
      loadReservations();
    } catch (error) {
      flash(error.message, true);
      btn.disabled = false;
    }
  });

  showTab(location.hash === "#historique" ? "history" : "upcoming");
  showMockBanner();
  loadReservations();
}
