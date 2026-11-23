/* Fonctions utilitaires : formatage des prix / dates et petits helpers DOM. */

const priceFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

function formatPrice(euros) {
  return priceFormatter.format(euros);
}

/** "2026-11-20" -> Date locale (évite le décalage UTC de new Date("2026-11-20")). */
function parseDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Date -> "2026-11-20" (heure locale). */
function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** Lundi de la semaine contenant `date`. */
function mondayOf(date) {
  const day = (date.getDay() + 6) % 7; // lundi = 0
  return addDays(new Date(date.getFullYear(), date.getMonth(), date.getDate()), -day);
}

function formatDate(date, options = { weekday: "long", day: "numeric", month: "long" }) {
  return date.toLocaleDateString("fr-FR", options);
}

/** Échappe le texte venant de l'API avant de l'insérer en HTML. */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

function showLoading(container) {
  container.innerHTML = `<p class="state">Chargement…</p>`;
}

function showError(container, error) {
  container.innerHTML = `<p class="state state--error">${escapeHtml(error.message)}</p>`;
}


/** Message de confirmation / d'erreur temporaire dans l'élément #flash de la page. */
let flashTimer;
function flash(message, isError = false, el = document.getElementById("flash")) {
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("flash--error", isError);
  el.hidden = false;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { el.hidden = true; }, 5000);
}

/* ---------- Menus : affichage partagé ---------- */

/** "En cours" / "À venir" / "Terminé" par rapport à aujourd'hui. */
function menuStatus(menu) {
  const today = toIsoDate(new Date());
  if (menu.end_date < today) return { key: "past", label: "Terminé" };
  if (menu.start_date > today) return { key: "upcoming", label: "À venir" };
  return { key: "current", label: "En cours" };
}

function menuPeriod(menu) {
  const opts = { day: "numeric", month: "long" };
  if (menu.start_date === menu.end_date) return `Le ${formatDate(parseDate(menu.start_date), { weekday: "long", ...opts })}`;
  return `Du ${formatDate(parseDate(menu.start_date), opts)} au ${formatDate(parseDate(menu.end_date), { ...opts, year: "numeric" })}`;
}
