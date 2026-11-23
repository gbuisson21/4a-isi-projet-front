/* Page Détail d'un menu : GET /api/menus/{id} (via MenusApi), id lu dans l'URL (menu.html?id=2). */

const menuEl = document.getElementById("menu");

function renderMenu(menu) {
  const start = parseDate(menu.start_date);
  const end = parseDate(menu.end_date);
  const period = menu.start_date === menu.end_date
    ? `Disponible le ${formatDate(start)}`
    : `Disponible du ${formatDate(start)} au ${formatDate(end)}`;

  // Économie réalisée par rapport à l'achat des produits séparément
  const separateTotal = menu.products.reduce((sum, p) => sum + p.price, 0);
  const saving = separateTotal - menu.price;

  const items = menu.products.map((p) => `
    <li>
      <span>${escapeHtml(p.name)} ${p.stock === 0 ? `<span class="badge badge--out">Épuisé</span>` : ""}</span>
      <span class="stock">${formatPrice(p.price)}</span>
    </li>`).join("");

  document.title = `${menu.name} — Kfet Polytech Dijon`;
  menuEl.innerHTML = `
    <article class="card menu-detail">
      <div class="menu-detail__head">
        <div>
          <h1>${escapeHtml(menu.name)}</h1>
          <p class="subtitle" style="margin: 0.5rem 0 0">${period}</p>
        </div>
        <span class="menu-detail__price">${formatPrice(menu.price)}</span>
      </div>
      <ul>${items}</ul>
      ${saving > 0 ? `<p class="menu-detail__saving">Soit ${formatPrice(saving)} d'économie par rapport aux produits à l'unité.</p>` : ""}
      <div class="menu-detail__order">${orderButton(menu, "", "btn--block btn--big")}</div>
    </article>`;
  registerMenus([menu]);
}

async function loadMenu() {
  const id = new URLSearchParams(location.search).get("id");
  if (!id || !/^\d+$/.test(id)) {
    showError(menuEl, new Error("Aucun menu sélectionné."));
    return;
  }

  showLoading(menuEl);
  try {
    renderMenu(await MenusApi.get(id));
  } catch (error) {
    if (error.status === 404) error.message = "Ce menu n'existe pas ou n'est plus disponible.";
    showError(menuEl, error);
  }
}

// Retour vers la page d'où l'on vient (planning, liste des menus ou admin)
const backLinkEl = document.getElementById("back-link");
const from = document.referrer && new URL(document.referrer);
if (from && from.origin === location.origin) {
  const page = from.pathname.split("/").pop();
  const labels = { "menus.html": "aux menus", "admin-menus.html": "à la gestion des menus" };
  const label = labels[page];
  if (label) {
    backLinkEl.href = page;
    backLinkEl.textContent = `← Retour ${label}`;
  }
}

showMockBanner();
loadMenu();
