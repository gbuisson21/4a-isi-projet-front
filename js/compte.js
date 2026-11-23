/* Page Mon compte : GET /api/user/profile et PUT /api/user/change-password. */

if (requireRole("user")) {
  const profileEl = document.getElementById("profile");
  const form = document.getElementById("password-form");
  const errorEl = document.getElementById("password-error");
  const okEl = document.getElementById("password-ok");

  async function loadProfile() {
    showLoading(profileEl);
    try {
      const user = await AuthApi.profile();
      const since = new Date(user.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
      profileEl.innerHTML = `
        <div class="profile__avatar" aria-hidden="true">${escapeHtml(user.username.slice(0, 1).toUpperCase())}</div>
        <div>
          <p class="profile__name">${escapeHtml(user.username)}</p>
          <p class="profile__meta">
            <span class="badge ${user.role === "admin" ? "badge--admin" : "badge--role"}">${user.role === "admin" ? "Administrateur" : "Étudiant"}</span>
            Membre depuis le ${since}
          </p>
        </div>`;
    } catch (error) {
      // Compte bloqué depuis la connexion (le 401 « session expirée » est géré par api.js)
      if (error.status === 403) Session.clear();
      showError(profileEl, error);
      form.hidden = true;
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    okEl.hidden = true;
    const oldPassword = form.old_password.value;
    const newPassword = form.new_password.value;

    let message = null;
    if (!oldPassword || !newPassword) message = "Remplissez tous les champs.";
    else if (newPassword.length < 8) message = "Le nouveau mot de passe doit faire au moins 8 caractères.";
    else if (newPassword === oldPassword) message = "Le nouveau mot de passe doit être différent de l'ancien.";
    else if (newPassword !== form.confirm.value) message = "Les deux nouveaux mots de passe ne correspondent pas.";
    errorEl.textContent = message ?? "";
    errorEl.hidden = !message;
    if (message) return;

    const submit = form.querySelector("[type=submit]");
    submit.disabled = true;
    try {
      await AuthApi.changePassword(oldPassword, newPassword);
      form.reset();
      okEl.hidden = false;
    } catch (error) {
      errorEl.textContent = error.message;
      errorEl.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });

  /* Résumé des réservations (le détail est sur reservations.html) */
  async function loadReservationsSummary() {
    try {
      const upcoming = (await OrderApi.list("pending")).filter((r) => r.pickup_date >= toIsoDate(new Date()));
      document.getElementById("reservations-summary").textContent = upcoming.length
        ? `${upcoming.length} commande${upcoming.length > 1 ? "s" : ""} à récupérer`
        : "Rien à récupérer · voir l'historique";
    } catch { /* le lien reste utilisable */ }
  }

  document.getElementById("logout").addEventListener("click", logout);

  showMockBanner();
  loadProfile();
  loadReservationsSummary();
}
