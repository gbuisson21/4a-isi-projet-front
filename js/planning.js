/* Page Planning : PlanningApi (GET /api/planning), 7 jours à partir d'aujourd'hui.
 * Les jours passés ne sont jamais affichés (on ne peut plus réserver pour eux). */

const DAYS_SHOWN = 7;

const planningEl = document.getElementById("planning");
const periodLabelEl = document.getElementById("week-label");
const prevBtn = document.getElementById("prev-week");

function today() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

let startDate = today();

function renderMenu(menu, date) {
  const products = menu.products.map((p) => escapeHtml(p.name)).join(", ");
  return `
    <div class="menu-slot">
      <a class="menu-link" href="menu.html?id=${menu.id}">
        <div class="menu-link__top">
          <span>${escapeHtml(menu.name)}</span>
          <span class="price">${formatPrice(menu.price)}</span>
        </div>
        <div class="menu-link__products">${products || "—"}</div>
      </a>
      ${orderButton(menu, date, "menu-slot__order")}
    </div>`;
}

function renderDay(day) {
  const isToday = day.date === toIsoDate(today());

  const classes = ["card", "day"];
  if (isToday) classes.push("day--today");
  if (day.is_closed) classes.push("day--closed");

  let badge;
  if (day.is_closed) badge = `<span class="badge badge--closed">Fermé</span>`;
  else if (isToday) badge = `<span class="badge badge--today">Aujourd'hui</span>`;
  else badge = `<span class="badge badge--open">Ouvert</span>`;

  let content;
  if (day.is_closed) {
    content = `<p class="day__empty">${escapeHtml(day.closure_reason || "Fermeture exceptionnelle")}</p>`;
  } else if (day.menus.length === 0) {
    content = `<p class="day__empty">Pas de menu ce jour-là, produits à la carte uniquement.</p>`;
  } else {
    content = day.menus.map((menu) => renderMenu(menu, day.date)).join("");
  }

  return `
    <article class="${classes.join(" ")}">
      <div class="day__header">
        <span class="day__name">${formatDate(parseDate(day.date))}</span>
        ${badge}
      </div>
      ${content}
    </article>`;
}

async function loadPeriod() {
  const endDate = addDays(startDate, DAYS_SHOWN - 1);
  periodLabelEl.textContent =
    `Du ${formatDate(startDate, { day: "numeric", month: "long" })} ` +
    `au ${formatDate(endDate, { day: "numeric", month: "long", year: "numeric" })}`;

  // Impossible de reculer avant aujourd'hui
  prevBtn.disabled = startDate <= today();

  showLoading(planningEl);
  try {
    const days = await PlanningApi.get({ start_date: toIsoDate(startDate), end_date: toIsoDate(endDate) });
    days.forEach((day) => registerMenus(day.menus));
    planningEl.innerHTML = days.map(renderDay).join("");
  } catch (error) {
    showError(planningEl, error);
  }
}

prevBtn.addEventListener("click", () => {
  const candidate = addDays(startDate, -DAYS_SHOWN);
  startDate = candidate < today() ? today() : candidate;
  loadPeriod();
});
document.getElementById("next-week").addEventListener("click", () => {
  startDate = addDays(startDate, DAYS_SHOWN);
  loadPeriod();
});
document.getElementById("this-week").addEventListener("click", () => {
  startDate = today();
  loadPeriod();
});

loadPeriod();
