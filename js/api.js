/* Client HTTP commun à toutes les pages + configuration.
 *
 * - Servi par FastAPI (port 8000)  -> appels relatifs sur /api
 * - Servi ailleurs (Live Server…)  -> appels vers http://localhost:8000/api
 *   (nécessite CORSMiddleware côté back)
 */
const API_BASE = location.port === "8000" ? "/api" : "http://localhost:8000/api";

/* Données simulées dans le navigateur (js/mock.js) tant que les routes du back ne sont pas prêtes.
 * Passer un domaine à false pour utiliser le vrai back sur ce domaine :
 *   - catalog : produits, menus (public + admin), planning
 *   - auth    : inscription, connexion, profil, comptes (admin)
 *   - orders  : réservations (utilisateur + admin)
 * ⚠️ orders: true nécessite auth: true (la simulation reconnaît ses propres jetons « mock.<id> »). */
const USE_MOCK = {
  catalog: true,
  auth: true,
  orders: true,
};

/** true si au moins un domaine est simulé (pour le bandeau « Mode démo »). */
const ANY_MOCK = Object.values(USE_MOCK).some(Boolean);

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* ---------- Session expirée (401) : traitée ici une seule fois pour tout le site ---------- */

/** Défini par auth.js : vide la session et renvoie vers la connexion. */
let onUnauthorized = null;

/** À appeler sur toute erreur d'API (vraie ou simulée). Ne fait rien si on n'était pas connecté. */
function handleAuthError(error) {
  if (error?.status === 401 && localStorage.getItem("token") && onUnauthorized) onUnauthorized();
}

/** Transforme le champ `detail` de FastAPI (chaîne ou tableau de 422) en texte. */
function errorMessage(detail) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => `${e.loc.at(-1)} : ${e.msg}`).join(", ");
  return "Erreur inconnue";
}

/**
 * Appel générique à l'API.
 * @param {string} path    ex. "/products"
 * @param {object} options { method, body, params, handleAuth }
 *   handleAuth: false pour les routes où un 401 ne veut pas dire « session expirée »
 *   (connexion, changement de mot de passe avec un mauvais ancien mot de passe).
 */
async function api(path, { method = "GET", body, params, handleAuth = true } = {}) {
  const url = new URL(API_BASE + path, location.href);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
    }
  }

  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = localStorage.getItem("token");
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Impossible de joindre le serveur. Le back-end est-il lancé ?");
  }

  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new ApiError(response.status, errorMessage(data?.detail));
    if (handleAuth) handleAuthError(error);
    throw error;
  }
  return data;
}

/** Bandeau affiché tant que des données sont simulées. */
function showMockBanner(text = "Mode démo : les données sont simulées dans le navigateur (USE_MOCK dans js/api.js).") {
  if (!ANY_MOCK) return;
  const banner = document.createElement("p");
  banner.className = "mock-banner";
  banner.textContent = text;
  document.querySelector("main")?.prepend(banner);
}
