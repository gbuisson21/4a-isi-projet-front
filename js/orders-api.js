/* Réservations : /api/user/reservations (client) et /api/admin/reservations (admin).
 * Simulation dans js/mock.js ; USE_MOCK.orders choisit. */

/* ---------- Statuts d'une commande (partagés par toutes les pages) ---------- */
const ORDER_STATUS = {
  pending: { label: "À retirer", badge: "badge--pending" },
  completed: { label: "Retirée", badge: "badge--done" },
  no_show: { label: "Non retirée", badge: "badge--out" },
};

function orderStatusBadge(status) {
  const s = ORDER_STATUS[status] ?? { label: status, badge: "" };
  return `<span class="badge ${s.badge}">${s.label}</span>`;
}

/* ---------- Vraie API ---------- */
const realOrderApi = {
  /** POST /api/user/reservations — body { pickup_date, products?, menus? } -> Reservation */
  create: (body) => api("/user/reservations", { method: "POST", body }),
  /** GET /api/user/reservations?status= -> Reservation[] (plus récentes d'abord) */
  list: (status) => api("/user/reservations", { params: { status } }),
  /** DELETE /api/user/reservations/{id} -> 204 */
  cancel: (id) => api(`/user/reservations/${id}`, { method: "DELETE" }),

  /** GET /api/admin/reservations — filtres optionnels { pickup_date, status, user_id } */
  adminList: (params = {}) => api("/admin/reservations", { params }),
  /** POST /api/admin/reservations/{id}/check — status "completed" (récupérée) ou "no_show" */
  check: (id, status) => api(`/admin/reservations/${id}/check`, { method: "POST", body: { status } }),
  /** DELETE /api/admin/reservations/{id} -> 204 */
  adminRemove: (id) => api(`/admin/reservations/${id}`, { method: "DELETE" }),
};

const OrderApi = USE_MOCK.orders ? mockOrderApi : realOrderApi;
