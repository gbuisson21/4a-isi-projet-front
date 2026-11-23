/* Page Admin > Menus : liste + création (POST), modification (PUT) et suppression (DELETE)
 * sur /api/admin/menus. Les appels passent par MenusApi (js/catalog-api.js). */

const listEl = document.getElementById("menus");
const searchEl = document.getElementById("search");
const hidePastEl = document.getElementById("hide-past");

const dialog = document.getElementById("menu-dialog");
const form = document.getElementById("menu-form");
const dialogTitle = document.getElementById("dialog-title");
const productSearchEl = document.getElementById("product-search");
const productListEl = document.getElementById("product-list");
const pickedCountEl = document.getElementById("picked-count");
const summaryEl = document.getElementById("summary");
const formErrorEl = document.getElementById("form-error");
const submitBtn = document.getElementById("submit-btn");

let menus = [];
let products = [];
let editingId = null;          // null = création
let picked = new Set();        // ids des produits cochés

/* ---------- Liste ---------- */

function renderRow(menu) {
  const status = menuStatus(menu);
  const names = menu.products.map((p) => escapeHtml(p.name)).join(", ");
  return `
    <article class="card admin-row admin-row--${status.key}">
      <div class="admin-row__main">
        <div class="admin-row__title">
          <span class="admin-row__name">${escapeHtml(menu.name)}</span>
          <span class="badge badge--${status.key}">${status.label}</span>
        </div>
        <div class="admin-row__meta">${menuPeriod(menu)} · ${menu.products.length} produit${menu.products.length > 1 ? "s" : ""}</div>
        <div class="admin-row__products">${names}</div>
      </div>
      <span class="price admin-row__price">${formatPrice(menu.price)}</span>
      <div class="admin-row__actions">
        <a class="btn" href="menu.html?id=${menu.id}">Voir</a>
        <button class="btn" type="button" data-edit="${menu.id}">Modifier</button>
        <button class="btn btn--danger" type="button" data-delete="${menu.id}">Supprimer</button>
      </div>
    </article>`;
}

function renderList() {
  const query = searchEl.value.trim().toLowerCase();
  const filtered = menus
    .filter((m) => !hidePastEl.checked || menuStatus(m).key !== "past")
    .filter((m) => m.name.toLowerCase().includes(query))
    .sort((a, b) => b.start_date.localeCompare(a.start_date));

  listEl.innerHTML = filtered.length
    ? filtered.map(renderRow).join("")
    : `<p class="state">${menus.length ? "Aucun menu ne correspond." : "Aucun menu. Créez le premier !"}</p>`;
}

async function loadMenus() {
  showLoading(listEl);
  try {
    menus = await MenusApi.list();
    renderList();
  } catch (error) {
    showError(listEl, error);
  }
}


/* ---------- Sélecteur de produits ---------- */

function renderPicker() {
  const query = productSearchEl.value.trim().toLowerCase();
  const visible = products.filter((p) => p.name.toLowerCase().includes(query));

  productListEl.innerHTML = visible.length
    ? visible.map((p) => `
      <label class="picker__item ${picked.has(p.id) ? "is-picked" : ""}">
        <input type="checkbox" value="${p.id}" ${picked.has(p.id) ? "checked" : ""}>
        <span class="picker__name">${escapeHtml(p.name)}${p.stock === 0 ? ` <span class="badge badge--out">Épuisé</span>` : ""}</span>
        <span class="picker__price">${formatPrice(p.price)}</span>
      </label>`).join("")
    : `<p class="picker__empty">Aucun produit.</p>`;

  updateSummary();
}

function updateSummary() {
  pickedCountEl.textContent = picked.size ? `(${picked.size} sélectionné${picked.size > 1 ? "s" : ""})` : "";

  const total = products.filter((p) => picked.has(p.id)).reduce((sum, p) => sum + p.price, 0);
  const price = parseFloat(form.price.value);
  if (!picked.size) {
    summaryEl.textContent = "Cochez au moins un produit.";
    summaryEl.className = "summary";
    return;
  }
  let text = `Total à l'unité : ${formatPrice(total)}`;
  let cls = "summary";
  if (!Number.isNaN(price)) {
    const diff = total - price;
    if (diff > 0) text += `, soit ${formatPrice(diff)} d'économie pour le client.`;
    else if (diff < 0) { text += `. Attention, le menu coûte ${formatPrice(-diff)} de plus que les produits à l'unité.`; cls += " summary--warn"; }
    else text += ", aucune économie pour le client.";
  }
  summaryEl.textContent = text;
  summaryEl.className = cls;
}

productListEl.addEventListener("change", (event) => {
  const id = Number(event.target.value);
  if (event.target.checked) picked.add(id); else picked.delete(id);
  event.target.closest(".picker__item").classList.toggle("is-picked", event.target.checked);
  updateSummary();
});
productSearchEl.addEventListener("input", renderPicker);
form.price.addEventListener("input", updateSummary);

/* ---------- Formulaire ---------- */

async function openForm(menu = null) {
  editingId = menu?.id ?? null;
  dialogTitle.textContent = menu ? "Modifier le menu" : "Nouveau menu";
  submitBtn.textContent = menu ? "Enregistrer" : "Créer le menu";
  formErrorEl.hidden = true;

  const today = toIsoDate(new Date());
  form.name.value = menu?.name ?? "";
  form.price.value = menu?.price ?? "";
  form.start_date.value = menu?.start_date ?? today;
  form.end_date.value = menu?.end_date ?? today;
  picked = new Set(menu?.products.map((p) => p.id) ?? []);
  productSearchEl.value = "";

  dialog.showModal();
  form.name.focus();

  if (!products.length) {
    productListEl.innerHTML = `<p class="picker__empty">Chargement…</p>`;
    try {
      products = await ProductsApi.list();
    } catch (error) {
      productListEl.innerHTML = `<p class="picker__empty">${escapeHtml(error.message)}</p>`;
      return;
    }
  }
  renderPicker();
}

function showFormError(message) {
  formErrorEl.textContent = message;
  formErrorEl.hidden = false;
}

/** Vérifications côté client, avant d'appeler l'API (le back revalide de toute façon). */
function readForm() {
  const body = {
    name: form.name.value.trim(),
    price: parseFloat(form.price.value),
    start_date: form.start_date.value,
    end_date: form.end_date.value,
    product_ids: [...picked],
  };
  if (!body.name) return [null, "Le nom est obligatoire."];
  if (Number.isNaN(body.price) || body.price < 0) return [null, "Le prix doit être un nombre positif."];
  if (!body.start_date || !body.end_date) return [null, "Les dates de début et de fin sont obligatoires."];
  if (body.end_date < body.start_date) return [null, "La date de fin doit être après la date de début."];
  if (!body.product_ids.length) return [null, "Sélectionnez au moins un produit."];
  body.price = Math.round(body.price * 100) / 100;
  return [body, null];
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const [body, error] = readForm();
  if (error) { showFormError(error); return; }

  formErrorEl.hidden = true;
  submitBtn.disabled = true;
  try {
    if (editingId === null) {
      const created = await MenusApi.create(body);
      flash(`Menu « ${created.name} » créé.`);
    } else {
      const updated = await MenusApi.update(editingId, body);
      flash(`Menu « ${updated.name} » modifié.`);
    }
    dialog.close();
    loadMenus();
  } catch (err) {
    showFormError(err.message);
  } finally {
    submitBtn.disabled = false;
  }
});

dialog.addEventListener("click", (event) => {
  // Bouton ✕ / Annuler, ou clic sur le fond
  if (event.target.closest("[data-close]") || event.target === dialog) dialog.close();
});

/* ---------- Actions de la liste ---------- */

listEl.addEventListener("click", async (event) => {
  const editBtn = event.target.closest("[data-edit]");
  const deleteBtn = event.target.closest("[data-delete]");

  if (editBtn) {
    openForm(menus.find((m) => m.id === Number(editBtn.dataset.edit)));
    return;
  }

  if (deleteBtn) {
    const menu = menus.find((m) => m.id === Number(deleteBtn.dataset.delete));
    if (!confirm(`Supprimer le menu « ${menu.name} » ? Cette action est définitive.`)) return;
    deleteBtn.disabled = true;
    try {
      await MenusApi.remove(menu.id);
      flash(`Menu « ${menu.name} » supprimé.`);
      loadMenus();
    } catch (error) {
      if (error.status === 409) error.message = "Ce menu fait partie d'une réservation en cours, impossible de le supprimer.";
      flash(error.message, true);
      deleteBtn.disabled = false;
    }
  }
});

document.getElementById("new-menu").addEventListener("click", () => openForm());
searchEl.addEventListener("input", renderList);
hidePastEl.addEventListener("change", renderList);

// Page réservée aux admins (sinon <main> est remplacé par un message)
if (requireRole("admin")) {
  showMockBanner();
  loadMenus();
}
