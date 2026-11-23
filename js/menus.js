/* Page Menus : GET /api/menus (filtre ?date= côté serveur), recherche côté client. */

const menusEl = document.getElementById("menus");
const searchEl = document.getElementById("search");
const dateEl = document.getElementById("date");
const todayBtn = document.getElementById("today");
const allBtn = document.getElementById("all");

let menus = [];

const STATUS_ORDER = { current: 0, upcoming: 1, past: 2 };

function renderMenuCard(menu) {
  const status = menuStatus(menu);
  const separateTotal = menu.products.reduce((sum, p) => sum + p.price, 0);
  const saving = separateTotal - menu.price;
  const products = menu.products.map((p) => `<li>${escapeHtml(p.name)}</li>`).join("");

  return `
    <article class="card menu-card menu-card--${status.key}">
      <div class="menu-card__top">
        <span class="badge badge--${status.key}">${status.label}</span>
        ${saving > 0 ? `<span class="menu-card__saving">−${formatPrice(saving)}</span>` : ""}
      </div>
      <a class="menu-card__name" href="menu.html?id=${menu.id}">${escapeHtml(menu.name)}</a>
      <p class="menu-card__period">${menuPeriod(menu)}</p>
      <ul class="menu-card__products">${products}</ul>
      <div class="product__footer">
        <span class="price">${formatPrice(menu.price)}</span>
        ${saving > 0 ? `<span class="stock"><s>${formatPrice(separateTotal)}</s> à l'unité</span>` : ""}
      </div>
      <div class="menu-card__actions">
        <a class="btn" href="menu.html?id=${menu.id}">Détails</a>
        ${orderButton(menu, dateEl.value)}
      </div>
    </article>`;
}

function render() {
  const query = searchEl.value.trim().toLowerCase();
  const filtered = menus
    .filter((m) => m.name.toLowerCase().includes(query)
      || m.products.some((p) => p.name.toLowerCase().includes(query)))
    .sort((a, b) => STATUS_ORDER[menuStatus(a).key] - STATUS_ORDER[menuStatus(b).key]
      || a.start_date.localeCompare(b.start_date));

  let empty = "Aucun menu ne correspond à la recherche.";
  if (!query) empty = dateEl.value ? "Aucun menu n'est proposé ce jour-là." : "Aucun menu pour le moment.";

  menusEl.innerHTML = filtered.length
    ? filtered.map(renderMenuCard).join("")
    : `<p class="state">${empty}</p>`;
}

async function loadMenus() {
  // Bouton actif = filtre en cours
  allBtn.classList.toggle("btn--primary", !dateEl.value);
  todayBtn.classList.toggle("btn--primary", dateEl.value === toIsoDate(new Date()));

  showLoading(menusEl);
  try {
    menus = await MenusApi.list({ date: dateEl.value || undefined });
    registerMenus(menus);
    render();
  } catch (error) {
    showError(menusEl, error);
  }
}

searchEl.addEventListener("input", render);
dateEl.addEventListener("change", loadMenus);
todayBtn.addEventListener("click", () => {
  dateEl.value = toIsoDate(new Date());
  loadMenus();
});
allBtn.addEventListener("click", () => {
  dateEl.value = "";
  loadMenus();
});

showMockBanner();
loadMenus();
