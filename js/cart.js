/* Panier : menus + produits, gardé dans le navigateur (même sans être connecté),
 * puis envoyé en une seule réservation (OrderApi.create).
 *
 * Dans une page :
 *   registerMenus(menus);       html += orderButton(menu, "2026-11-24");
 *   registerProducts(produits); html += productButton(produit);
 */

/* ---------- Panier (gardé dans le navigateur, même sans être connecté) ---------- */

const MAX_QUANTITY = 10;
const clampQuantity = (value) => Math.min(MAX_QUANTITY, Math.max(1, Math.round(Number(value)) || 1));

const Cart = {
  KEY: "kfet-cart",

  /** { date: "YYYY-MM-DD" | "", lines: [{ type: "menu"|"product", id, name, unit_price, quantity, start_date?, end_date? }] } */
  get() {
    try {
      const cart = JSON.parse(localStorage.getItem(this.KEY));
      if (cart && Array.isArray(cart.lines)) return cart;
    } catch { /* panier vide */ }
    return { date: "", lines: [] };
  },

  save(cart) {
    try { localStorage.setItem(this.KEY, JSON.stringify(cart)); } catch { /* ignoré */ }
    document.dispatchEvent(new CustomEvent("cart:change"));
  },

  count() {
    return this.get().lines.reduce((sum, l) => sum + l.quantity, 0);
  },

  add(item, date) {
    const cart = this.get();
    const line = cart.lines.find((l) => l.type === item.type && l.id === item.id);
    if (line) line.quantity = clampQuantity(line.quantity + 1);
    else cart.lines.push({ ...item, quantity: 1 });
    if (date) cart.date = date;
    this.save(cart);
  },

  setQuantity(type, id, quantity) {
    const cart = this.get();
    const line = cart.lines.find((l) => l.type === type && l.id === id);
    if (line) line.quantity = clampQuantity(quantity);
    this.save(cart);
  },

  remove(type, id) {
    const cart = this.get();
    cart.lines = cart.lines.filter((l) => !(l.type === type && l.id === id));
    this.save(cart);
  },

  setDate(date) {
    const cart = this.get();
    cart.date = date;
    this.save(cart);
  },

  clear() {
    this.save({ date: "", lines: [] });
  },

  /** Jours de retrait possibles : aujourd'hui ou plus tard, et dans la période de chaque menu. */
  dateRange(cart = this.get()) {
    let min = toIsoDate(new Date());
    let max = "";
    for (const l of cart.lines.filter((line) => line.type === "menu")) {
      if (l.start_date > min) min = l.start_date;
      if (!max || l.end_date < max) max = l.end_date;
    }
    return { min, max };
  },

  total(cart = this.get()) {
    return Math.round(cart.lines.reduce((s, l) => s + l.unit_price * l.quantity, 0) * 100) / 100;
  },
};

/* ---------- Boutons « Ajouter au panier » ---------- */

const orderableMenus = new Map();
const orderableProducts = new Map();

/** Les pages déclarent ce qu'elles affichent pour que les boutons retrouvent l'objet. */
function registerMenus(menus) {
  menus.forEach((m) => orderableMenus.set(m.id, m));
}
function registerProducts(products) {
  products.forEach((p) => orderableProducts.set(p.id, p));
}

const CART_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2"/><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/></svg>`;

/** Bouton d'un menu. `date` : jour de retrait proposé (ex. depuis le planning). */
function orderButton(menu, date = "", extraClass = "") {
  if (menu.end_date < toIsoDate(new Date())) {
    return `<button class="btn btn--order ${extraClass}" type="button" disabled>Terminé</button>`;
  }
  return `<button class="btn btn--primary btn--order ${extraClass}" type="button" data-add-menu="${menu.id}" data-date="${date}">${CART_ICON} Ajouter au panier</button>`;
}

function productButton(product, extraClass = "") {
  if (product.stock === 0) {
    return `<button class="btn btn--order ${extraClass}" type="button" disabled>Épuisé</button>`;
  }
  return `<button class="btn btn--primary btn--order ${extraClass}" type="button" data-add-product="${product.id}">${CART_ICON} Ajouter</button>`;
}

document.addEventListener("click", (event) => {
  const menuBtn = event.target.closest("[data-add-menu]");
  const productBtn = event.target.closest("[data-add-product]");
  if (!menuBtn && !productBtn) return;
  event.preventDefault();

  if (menuBtn) {
    const menu = orderableMenus.get(Number(menuBtn.dataset.addMenu));
    if (!menu) return;
    Cart.add({
      type: "menu", id: menu.id, name: menu.name, unit_price: menu.price,
      start_date: menu.start_date, end_date: menu.end_date,
      detail: menu.products.map((p) => p.name).join(", "),
    }, menuBtn.dataset.date);
  } else {
    const product = orderableProducts.get(Number(productBtn.dataset.addProduct));
    if (!product) return;
    Cart.add({ type: "product", id: product.id, name: product.name, unit_price: product.price, stock: product.stock });
  }
  openCart();
});

/* ---------- Fenêtre du panier ---------- */

let cartDialog = null;

function buildCartDialog() {
  document.body.insertAdjacentHTML("beforeend", `
    <dialog class="dialog dialog--small" id="cart-dialog" aria-labelledby="cart-title">
      <div class="dialog__head">
        <h2 id="cart-title">Mon panier</h2>
        <button class="btn" type="button" data-close aria-label="Fermer">✕</button>
      </div>
      <div id="cart-content"></div>
    </dialog>`);
  cartDialog = document.getElementById("cart-dialog");

  cartDialog.addEventListener("click", (event) => {
    if (event.target.closest("[data-close]") || event.target === cartDialog) {
      cartDialog.close();
      return;
    }
    const step = event.target.closest("[data-step]");
    if (step) {
      const { type, id } = step.dataset;
      const line = Cart.get().lines.find((l) => l.type === type && l.id === Number(id));
      if (line) Cart.setQuantity(type, Number(id), line.quantity + Number(step.dataset.step));
      renderCart();
      return;
    }
    const remove = event.target.closest("[data-remove]");
    if (remove) {
      Cart.remove(remove.dataset.type, Number(remove.dataset.remove));
      renderCart();
      return;
    }
    if (event.target.closest("[data-login]")) {
      // Retour automatique sur le panier après la connexion
      try { sessionStorage.setItem("kfet-open-cart", "1"); } catch { /* ignoré */ }
      location.href = loginUrl();
    }
  });

  cartDialog.addEventListener("change", (event) => {
    if (event.target.name === "pickup_date") {
      Cart.setDate(event.target.value);
      renderCart();
    }
  });

  cartDialog.addEventListener("submit", submitCart);
}

function openCart() {
  if (!cartDialog) buildCartDialog();
  renderCart();
  if (!cartDialog.open) cartDialog.showModal();
}

function renderCart(errorMessage = "") {
  const cart = Cart.get();
  const content = document.getElementById("cart-content");
  document.getElementById("cart-title").textContent = "Mon panier";

  if (!cart.lines.length) {
    content.innerHTML = `
      <div class="dialog__body">
        <p class="state">Votre panier est vide.</p>
      </div>
      <div class="dialog__foot">
        <a class="btn" href="produits.html">Voir les produits</a>
        <a class="btn btn--primary" href="menus.html">Voir les menus</a>
      </div>`;
    return;
  }

  const { min, max } = Cart.dateRange(cart);
  const conflict = max && min > max;
  const date = cart.date && cart.date >= min && (!max || cart.date <= max) ? cart.date : (conflict ? "" : min);
  if (date !== cart.date && !conflict) Cart.setDate(date);

  const lines = cart.lines.map((l) => `
    <li class="cart-line">
      <div class="cart-line__info">
        <span class="cart-line__name">${escapeHtml(l.name)}</span>
        <span class="cart-line__meta">${l.type === "menu" ? `Menu · ${escapeHtml(menuPeriod(l))}` : "Produit"} · ${formatPrice(l.unit_price)}</span>
      </div>
      <div class="stepper stepper--small" role="group" aria-label="Quantité de ${escapeHtml(l.name)}">
        <button class="btn" type="button" data-step="-1" data-type="${l.type}" data-id="${l.id}" aria-label="Retirer un" ${l.quantity <= 1 ? "disabled" : ""}>−</button>
        <span class="stepper__value">${l.quantity}</span>
        <button class="btn" type="button" data-step="1" data-type="${l.type}" data-id="${l.id}" aria-label="Ajouter un" ${l.quantity >= MAX_QUANTITY ? "disabled" : ""}>+</button>
      </div>
      <span class="cart-line__total">${formatPrice(l.unit_price * l.quantity)}</span>
      <button class="btn cart-line__remove" type="button" data-remove="${l.id}" data-type="${l.type}" aria-label="Retirer ${escapeHtml(l.name)} du panier">✕</button>
    </li>`).join("");

  const loggedIn = Boolean(Session.get());
  content.innerHTML = `
    <form id="cart-form" novalidate>
      <div class="dialog__body">
        <ul class="cart-lines">${lines}</ul>
        <label class="field">
          <span class="field__label">Retrait le</span>
          <input class="input" name="pickup_date" type="date" value="${date}" min="${min}" ${max ? `max="${max}"` : ""} required ${conflict ? "disabled" : ""}>
        </label>
        ${conflict
          ? `<p class="state state--error form-error">Les menus de votre panier ne sont pas disponibles le même jour. Retirez-en un pour continuer.</p>`
          : `<p class="order-date">${date ? `À récupérer à la Kfet le ${formatDate(parseDate(date))}. Paiement sur place.` : ""}</p>`}
        <div class="order-total">
          <span>Total à payer au retrait</span>
          <span class="price">${formatPrice(Cart.total(cart))}</span>
        </div>
        <p class="state state--error form-error" id="cart-error" ${errorMessage ? "" : "hidden"}>${escapeHtml(errorMessage)}</p>
      </div>
      <div class="dialog__foot">
        <button class="btn" type="button" data-close>Continuer mes achats</button>
        ${loggedIn
          ? `<button class="btn btn--primary" type="submit" id="cart-submit" ${conflict ? "disabled" : ""}>Réserver</button>`
          : `<button class="btn btn--primary" type="button" data-login>Se connecter pour réserver</button>`}
      </div>
    </form>`;
}

async function submitCart(event) {
  event.preventDefault();
  const cart = Cart.get();
  const submit = document.getElementById("cart-submit");
  if (!cart.date) {
    renderCart("Choisissez une date de retrait.");
    return;
  }

  submit.disabled = true;
  try {
    const reservation = await OrderApi.create({
      pickup_date: cart.date,
      menus: cart.lines.filter((l) => l.type === "menu").map((l) => ({ menu_id: l.id, quantity: l.quantity })),
      products: cart.lines.filter((l) => l.type === "product").map((l) => ({ product_id: l.id, quantity: l.quantity })),
    });
    Cart.clear();
    showOrderDone(reservation);
  } catch (error) {
    if (error.status === 401) {
      // Session expirée : api.js renvoie vers la connexion ; on rouvrira le panier au retour
      try { sessionStorage.setItem("kfet-open-cart", "1"); } catch { /* ignoré */ }
      return;
    }
    renderCart(error.message);
  }
}

function showOrderDone(reservation) {
  const lines = [...reservation.menus, ...reservation.products]
    .map((l) => `${l.quantity} × ${escapeHtml(l.name)}`).join("<br>");
  document.getElementById("cart-title").textContent = "Réservé !";
  document.getElementById("cart-content").innerHTML = `
    <div class="dialog__body">
      <p class="order-done__lead">Réservation n°${reservation.id} enregistrée.</p>
      <dl class="created__creds">
        <dt>Retrait</dt><dd>${formatDate(parseDate(reservation.pickup_date))}</dd>
        <dt>Commande</dt><dd>${lines}</dd>
        <dt>À payer</dt><dd>${formatPrice(reservation.total_price)}</dd>
      </dl>
      <p class="auth-card__hint">Présentez le QR code de « Mes réservations » au retrait. Paiement sur place.</p>
    </div>
    <div class="dialog__foot">
      <a class="btn" href="reservations.html">Mes réservations</a>
      <button class="btn btn--primary" type="button" data-close>Fermer</button>
    </div>`;
}

/** Après une connexion lancée depuis le panier : on le rouvre. */
function reopenCartAfterLogin() {
  let pending = false;
  try {
    pending = sessionStorage.getItem("kfet-open-cart") === "1";
    if (pending && Session.get()) sessionStorage.removeItem("kfet-open-cart");
  } catch { /* ignoré */ }
  if (pending && Session.get() && Cart.count()) openCart();
}
