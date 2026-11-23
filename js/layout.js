/* En-tête commun à toutes les pages : logo, navigation, panier, compte.
 * Une seule source pour la nav : les pages contiennent juste
 *   <header class="header" id="site-header"></header>
 * et, sur les pages admin, <nav class="subnav" data-subnav="admin"></nav>.
 * À charger après auth.js et cart.js, avant le script propre à la page. */

const NAV_LINKS = [
  { href: "index.html", label: "Planning" },
  { href: "menus.html", label: "Menus" },
  { href: "produits.html", label: "Produits" },
];

const ADMIN_LINKS = [
  { href: "admin-commandes.html", label: "Commandes" },
  { href: "admin-menus.html", label: "Menus" },
  { href: "admin-comptes.html", label: "Comptes" },
];

const currentPage = () => location.pathname.split("/").pop() || "index.html";

function navLink(href, html, current, className = "") {
  return `<a href="${href}"${className ? ` class="${className}"` : ""}${current ? ' aria-current="page"' : ""}>${html}</a>`;
}

function renderHeader() {
  const header = document.getElementById("site-header");
  if (!header) return;
  const page = currentPage();
  const session = Session.get();

  let links = NAV_LINKS.map((l) => navLink(l.href, l.label, page === l.href)).join("");
  if (session) links += navLink("reservations.html", "Réservations", page === "reservations.html");
  if (session?.role === "admin") links += navLink("admin-commandes.html", "Admin", page.startsWith("admin-"));

  const count = Cart.count();
  links += `<button class="nav__cart" type="button" id="nav-cart" aria-label="Panier, ${count} article${count > 1 ? "s" : ""}" ${count ? "" : "hidden"}>
      ${CART_ICON}<span class="nav__cart-count">${count}</span>
    </button>`;

  links += session
    ? navLink("compte.html", `<span class="nav__user">${escapeHtml(session.username || "Mon compte")}</span>`, page === "compte.html", "nav__account")
    : navLink("connexion.html", "Connexion", page === "connexion.html", "nav__account");

  header.innerHTML = `
    <div class="header__inner">
      <a class="logo" href="index.html">Kfet <small>Polytech Dijon</small></a>
      <nav class="nav" aria-label="Navigation principale">${links}</nav>
    </div>`;
}

function renderSubnav() {
  const page = currentPage();
  document.querySelectorAll('[data-subnav="admin"]').forEach((nav) => {
    nav.setAttribute("aria-label", "Administration");
    nav.innerHTML = ADMIN_LINKS.map((l) => navLink(l.href, l.label, page === l.href)).join("");
  });
}

renderHeader();
renderSubnav();

document.addEventListener("cart:change", renderHeader);
document.addEventListener("click", (event) => {
  if (event.target.closest("#nav-cart")) openCart();
});
reopenCartAfterLogin();
