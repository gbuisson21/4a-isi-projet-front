/* Page Connexion / Création de compte :
 * POST /api/user/login et POST /api/user/register (via AuthApi, js/auth.js). */

const authEl = document.getElementById("auth");
const alreadyEl = document.getElementById("already");
const loginForm = document.getElementById("login-form");
const loginErrorEl = document.getElementById("login-error");
const registerPanel = document.getElementById("register-panel");
const registerForm = document.getElementById("register-form");
const registerErrorEl = document.getElementById("register-error");
const createdEl = document.getElementById("created");
const tabs = { login: document.getElementById("tab-login"), register: document.getElementById("tab-register") };

let createdAccount = null; // { username, password } juste après une inscription

/** Page où renvoyer après connexion : ?next= (limitée aux pages du site), sinon
 * Admin → Commandes pour un admin et le planning pour les autres. */
function nextPage(role) {
  const next = new URLSearchParams(location.search).get("next") ?? "";
  if (/^[\w-]+\.html(\?[\w=&%-]*)?$/.test(next) && !next.startsWith("connexion.html")) return next;
  return role === "admin" ? "admin-commandes.html" : "index.html";
}

function setError(el, message) {
  el.textContent = message ?? "";
  el.hidden = !message;
}

/* ---------- Onglets ---------- */

function showTab(name) {
  const isLogin = name === "login";
  tabs.login.setAttribute("aria-selected", isLogin);
  tabs.register.setAttribute("aria-selected", !isLogin);
  loginForm.hidden = !isLogin;
  registerPanel.hidden = isLogin;
  (isLogin ? loginForm.username : registerForm.username).focus();
}

tabs.login.addEventListener("click", () => showTab("login"));
tabs.register.addEventListener("click", () => showTab("register"));
document.querySelectorAll("[data-goto]").forEach((link) => link.addEventListener("click", (event) => {
  event.preventDefault();
  showTab(link.dataset.goto);
}));

/* ---------- Connexion ---------- */

async function login(username, password) {
  const result = await AuthApi.login(username, password);
  Session.set(result, username);
  location.href = nextPage(result.role);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = loginForm.username.value.trim();
  const password = loginForm.password.value;
  if (!username || !password) {
    setError(loginErrorEl, "Renseignez votre nom d'utilisateur et votre mot de passe.");
    return;
  }

  setError(loginErrorEl, null);
  const submit = loginForm.querySelector("[type=submit]");
  submit.disabled = true;
  try {
    await login(username, password);
  } catch (error) {
    setError(loginErrorEl, error.message);
    loginForm.password.select();
  } finally {
    submit.disabled = false;
  }
});

// Afficher / masquer le mot de passe
loginForm.querySelector(".password__toggle").addEventListener("click", (event) => {
  const input = loginForm.password;
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  event.currentTarget.textContent = show ? "Cacher" : "Voir";
  event.currentTarget.setAttribute("aria-label", show ? "Cacher le mot de passe" : "Afficher le mot de passe");
});

/* ---------- Création de compte ---------- */

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = registerForm.username.value.trim();
  if (username.length < 3 || username.length > 30) {
    setError(registerErrorEl, "Le nom d'utilisateur doit faire entre 3 et 30 caractères.");
    return;
  }

  setError(registerErrorEl, null);
  const submit = registerForm.querySelector("[type=submit]");
  submit.disabled = true;
  try {
    createdAccount = await AuthApi.register(username);
    document.getElementById("created-username").textContent = createdAccount.username;
    document.getElementById("created-password").textContent = createdAccount.password;
    registerForm.hidden = true;
    createdEl.hidden = false;
    tabs.login.disabled = true; // évite de perdre le mot de passe en changeant d'onglet
  } catch (error) {
    if (error.status === 409) error.message = "Ce nom d'utilisateur est déjà pris.";
    setError(registerErrorEl, error.message);
  } finally {
    submit.disabled = false;
  }
});

document.getElementById("copy-password").addEventListener("click", async (event) => {
  const btn = event.currentTarget;
  try {
    await navigator.clipboard.writeText(createdAccount.password);
    btn.textContent = "Copié ✓";
  } catch {
    btn.textContent = "Copie impossible, notez-le";
  }
});

document.getElementById("created-login").addEventListener("click", async (event) => {
  event.currentTarget.disabled = true;
  try {
    await login(createdAccount.username, createdAccount.password);
  } catch (error) {
    event.currentTarget.disabled = false;
    alert(error.message);
  }
});

// Prévenir avant de quitter tant que le mot de passe généré est affiché
window.addEventListener("beforeunload", (event) => {
  if (createdAccount && !createdEl.hidden && !Session.get()) event.preventDefault();
});

/* ---------- Démarrage ---------- */

const session = Session.get();
if (session) {
  document.getElementById("already-name").textContent = session.username || "?";
  document.getElementById("already-logout").addEventListener("click", logout);
  alreadyEl.hidden = false;
} else {
  authEl.hidden = false;
  // Arrivée ici après un 401 (jeton expiré) : on explique pourquoi
  if (new URLSearchParams(location.search).has("expired")) {
    setError(loginErrorEl, "Votre session a expiré. Reconnectez-vous pour continuer.");
  }
  if (location.hash === "#inscription") showTab("register");
}

showMockBanner("Mode démo : comptes simulés. Essayez admin / admin1234 ou alice / alice1234 (chloe / chloe1234 est bloqué).");
