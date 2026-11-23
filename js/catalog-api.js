/* Catalogue : produits, menus (public + admin) et planning.
 * Chaque objet a la même forme en vrai et en simulé (js/mock.js) ; USE_MOCK.catalog choisit. */

const realProductsApi = {
  /** GET /api/products -> Product[] (le back pagine : on demande une grande page) */
  list: () => api("/products", { params: { page: 0, size: 100 } }),
  /** GET /api/products/{id} -> Product */
  get: (id) => api(`/products/${id}`),
};

const realMenusApi = {
  /** GET /api/menus — `date` optionnelle ("YYYY-MM-DD") -> Menu[] */
  list: ({ date } = {}) => api("/menus", { params: { date } }),
  /** GET /api/menus/{id} -> Menu */
  get: (id) => api(`/menus/${id}`),
  /** POST /api/admin/menus — body { name, price, start_date, end_date, product_ids } -> Menu */
  create: (body) => api("/admin/menus", { method: "POST", body }),
  /** PUT /api/admin/menus/{id} — mêmes champs, tous optionnels -> Menu */
  update: (id, body) => api(`/admin/menus/${id}`, { method: "PUT", body }),
  /** DELETE /api/admin/menus/{id} -> 204 */
  remove: (id) => api(`/admin/menus/${id}`, { method: "DELETE" }),
};

const realPlanningApi = {
  /** GET /api/planning?start_date=&end_date= -> PlanningDay[] */
  get: ({ start_date, end_date }) => api("/planning", { params: { start_date, end_date } }),
};

const ProductsApi = USE_MOCK.catalog ? mockProductsApi : realProductsApi;
const MenusApi = USE_MOCK.catalog ? mockMenusApi : realMenusApi;
const PlanningApi = USE_MOCK.catalog ? mockPlanningApi : realPlanningApi;
