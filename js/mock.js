/* =====================================================================
 * SIMULATION DU BACK — à supprimer quand toutes les routes existent.
 * =====================================================================
 * Reproduit le contrat d'API.md dans le navigateur : mêmes formats de réponse,
 * mêmes codes d'erreur (ApiError 400/401/403/404/409/422). Les données modifiées
 * sont gardées dans le localStorage pour survivre à un rechargement.
 *
 * Les services (catalog-api.js, auth.js, orders-api.js) choisissent entre la vraie
 * API et ces objets selon USE_MOCK (api.js). Les pages n'utilisent jamais ce fichier
 * directement.
 *
 * Comptes de démo : admin / admin1234 · alice / alice1234 · bob / bob12345 ·
 *                   chloe / chloe1234 (bloqué) · dylan / dylan1234
 */

/* ---------- Base de données simulée (partagée par toutes les simulations) ---------- */
const MockDb = (() => {
  // Repris de 4a-isi-projet-db/data.sql (prix en euros comme dans l'API)
  const products = [
    [1, "Salade", 4, 20], [2, "Pizza", 3.5, 30], [3, "Pastabox", 3, 25], [4, "Wraps", 3, 25],
    [5, "Sandwichs", 2.5, 40], [6, "Nouilles", 1.7, 50], [7, "Café vanille ou noisette", 0.7, 100],
    [8, "Café", 0.5, 150], [9, "Thé", 0.3, 100], [10, "Red-bull", 1.5, 48],
    [11, "Coca-cola (Zéro, Cherry)", 0.8, 72], [12, "Fanta (Citron, FD)", 0.8, 48],
    [13, "Fuze-tea", 0.8, 48], [14, "Oasis (Tropical, PCF)", 0.8, 48], [15, "Orangina", 0.8, 48],
    [16, "Eau gazeuse", 0.6, 48], [17, "Eau (bouteille)", 0.5, 96], [18, "Caprisun", 0.5, 60],
    [19, "Jus de fruit", 0.4, 60], [20, "Kinder bueno", 0.8, 40], [21, "Kinder bueno white", 0.8, 40],
    [22, "Kitkat", 0.8, 40], [23, "Lion", 0.8, 40], [24, "Oreo", 0.8, 40], [25, "Twix", 0.8, 40],
    [26, "Snickers", 0.8, 40], [27, "Sucette", 0.2, 100], [28, "Barre protéiné", 1, 30],
    [29, "Gaufre chocolat", 0.6, 40], [30, "Gaufre nature", 0.5, 40], [31, "Pom'Pote", 0.5, 60],
    [32, "Chips", 0.5, 60],
  ].map(([id, name, price, stock]) => ({ id, name, price, stock }));

  const closures = { "2026-11-20": "Formation du personnel", "2026-12-25": "Noël", "2027-01-01": "Jour de l'an" };

  const seedMenus = () => [
    { id: 1, name: "Formule Pizza + soda", price: 4, start_date: "2026-11-01", end_date: "2026-12-31", product_ids: [2, 11] },
    { id: 2, name: "Formule Sandwich + Orangina + Chips", price: 3.5, start_date: "2026-11-16", end_date: "2026-11-22", product_ids: [5, 15, 32] },
    { id: 3, name: "Menu du jour : Pastabox", price: 4.2, start_date: "2026-11-24", end_date: "2026-11-24", product_ids: [3, 17, 29] },
    { id: 4, name: "Petit-déj révisions", price: 1.2, start_date: "2026-11-23", end_date: "2026-12-18", product_ids: [8, 30] },
    { id: 5, name: "Formule Wrap + Fuze-tea", price: 3.6, start_date: "2026-12-01", end_date: "2026-12-12", product_ids: [4, 13] },
  ];

  const seedUsers = () => [
    { id: 1, username: "admin", password: "admin1234", role: "admin", is_locked: false, created_at: "2026-09-01T08:00:00" },
    { id: 2, username: "alice", password: "alice1234", role: "user", is_locked: false, created_at: "2026-09-12T12:04:31" },
    { id: 3, username: "bob", password: "bob12345", role: "user", is_locked: false, created_at: "2026-10-02T09:47:10" },
    { id: 4, username: "chloe", password: "chloe1234", role: "user", is_locked: true, created_at: "2026-10-15T18:22:05" },
    { id: 5, username: "dylan", password: "dylan1234", role: "user", is_locked: false, created_at: "2026-11-17T13:58:40" },
  ];

  /** Commandes de démo, datées autour d'aujourd'hui pour que la page admin ait du contenu. */
  function seedReservations() {
    const day = (offset) => toIsoDate(addDays(new Date(), offset));
    const now = new Date().toISOString().slice(0, 19);
    const pizza = { id: 1, name: "Formule Pizza + soda", unit_price: 4 };
    const dej = { id: 4, name: "Petit-déj révisions", unit_price: 1.2 };
    const make = (id, user, offset, status, menus, lines = []) => ({
      id, user, pickup_date: day(offset), status, created_at: now, products: lines, menus,
      total_price: round([...menus, ...lines].reduce((s, l) => s + l.unit_price * l.quantity, 0)),
    });
    const alice = { id: 2, username: "alice" }, bob = { id: 3, username: "bob" }, dylan = { id: 5, username: "dylan" };
    return [
      make(1, bob, -2, "no_show", [{ ...pizza, quantity: 1 }]),
      make(7, bob, -6, "no_show", [{ ...pizza, quantity: 1 }]),
      make(2, alice, -1, "completed", [{ ...pizza, quantity: 1 }], [{ id: 8, name: "Café", unit_price: 0.5, quantity: 1 }]),
      make(3, bob, 0, "pending", [{ ...pizza, quantity: 2 }]),
      make(4, dylan, 0, "pending", [{ ...dej, quantity: 1 }]),
      make(5, alice, 0, "completed", [{ ...dej, quantity: 1 }]),
      make(6, dylan, 1, "pending", [{ ...pizza, quantity: 1 }]),
    ];
  }

  /** Collection gardée dans le localStorage (clé versionnée : changer le n° remet à zéro). */
  function collection(key, seed) {
    let items;
    try { items = JSON.parse(localStorage.getItem(key)); } catch { /* stockage indisponible */ }
    if (!Array.isArray(items)) items = seed();
    return {
      get all() { return items; },
      set all(value) { items = value; },
      save() { try { localStorage.setItem(key, JSON.stringify(items)); } catch { /* ignoré */ } },
      nextId() { return Math.max(0, ...items.map((i) => i.id)) + 1; },
    };
  }

  const round = (n) => Math.round(n * 100) / 100;

  const db = {
    products,
    closures,
    menus: collection("kfet-mock-menus-v1", seedMenus),
    users: collection("kfet-mock-users-v1", seedUsers),
    reservations: collection("kfet-mock-reservations-v3", seedReservations),
    round,

    /** Réponse simulée : copie (comme un vrai JSON) renvoyée après un petit délai réseau. */
    respond(fn, { handleAuth = true } = {}) {
      return new Promise((resolve, reject) => setTimeout(() => {
        try {
          resolve(structuredClone(fn()));
        } catch (e) {
          const error = e instanceof ApiError ? e : new ApiError(500, e.message);
          if (handleAuth) handleAuthError(error);
          reject(error);
        }
      }, 250));
    },

    /** Utilisateur du jeton envoyé (jeton simulé « mock.<id> »), sinon 401 / 403. */
    currentUser() {
      const id = Number((localStorage.getItem("token") ?? "").replace("mock.", ""));
      const user = db.users.all.find((u) => u.id === id);
      if (!user) throw new ApiError(401, "Votre session a expiré, reconnectez-vous.");
      if (user.is_locked) throw new ApiError(403, "Votre compte est bloqué.");
      return user;
    },

    currentAdmin() {
      const user = db.currentUser();
      if (user.role !== "admin") throw new ApiError(403, "Accès réservé aux administrateurs.");
      return user;
    },

    /** Menu stocké -> format `Menu` de l'API (produits complets). */
    menuToPublic({ product_ids, ...menu }) {
      return { ...menu, products: product_ids.map((id) => products.find((p) => p.id === id)) };
    },

    findMenu(id) {
      const menu = db.menus.all.find((m) => m.id === Number(id));
      if (!menu) throw new ApiError(404, "Menu introuvable.");
      return menu;
    },
  };
  return db;
})();

/* ---------- Catalogue : produits, menus, planning ---------- */

const mockProductsApi = {
  list: () => MockDb.respond(() => MockDb.products),
  get: (id) => MockDb.respond(() => {
    const product = MockDb.products.find((p) => p.id === Number(id));
    if (!product) throw new ApiError(404, "Produit introuvable.");
    return product;
  }),
};

const mockMenusApi = (() => {
  /** Mêmes règles que le back (400 / 404 / 422). */
  function validate(data) {
    if (typeof data.name !== "string" || !data.name.trim()) throw new ApiError(422, "name : champ requis");
    if (typeof data.price !== "number" || Number.isNaN(data.price) || data.price < 0) throw new ApiError(422, "price : doit être ≥ 0");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.start_date ?? "")) throw new ApiError(422, "start_date : date invalide");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.end_date ?? "")) throw new ApiError(422, "end_date : date invalide");
    if (data.end_date < data.start_date) throw new ApiError(400, "La date de fin est avant la date de début.");
    if (!Array.isArray(data.product_ids) || data.product_ids.length === 0) throw new ApiError(400, "Un menu doit contenir au moins un produit.");
    if (data.product_ids.some((id) => !MockDb.products.some((p) => p.id === id))) throw new ApiError(404, "Un des produits n'existe pas.");
  }

  return {
    list: ({ date } = {}) => MockDb.respond(() => MockDb.menus.all
      .filter((m) => !date || (m.start_date <= date && date <= m.end_date))
      .map(MockDb.menuToPublic)),

    get: (id) => MockDb.respond(() => MockDb.menuToPublic(MockDb.findMenu(id))),

    create: (body) => MockDb.respond(() => {
      MockDb.currentAdmin();
      const data = { ...body, product_ids: [...new Set(body.product_ids ?? [])] };
      validate(data);
      const menu = {
        id: MockDb.menus.nextId(),
        name: data.name.trim(),
        price: data.price,
        start_date: data.start_date,
        end_date: data.end_date,
        product_ids: data.product_ids,
      };
      MockDb.menus.all.push(menu);
      MockDb.menus.save();
      return MockDb.menuToPublic(menu);
    }),

    update: (id, body) => MockDb.respond(() => {
      MockDb.currentAdmin();
      const menu = MockDb.findMenu(id);
      const merged = { ...menu, ...body };
      if (body.product_ids) merged.product_ids = [...new Set(body.product_ids)];
      validate(merged);
      Object.assign(menu, merged, { name: merged.name.trim() });
      MockDb.menus.save();
      return MockDb.menuToPublic(menu);
    }),

    remove: (id) => MockDb.respond(() => {
      MockDb.currentAdmin();
      MockDb.findMenu(id);
      if (MockDb.reservations.all.some((r) => r.status === "pending" && r.menus.some((l) => l.id === Number(id)))) {
        throw new ApiError(409, "Ce menu fait partie d'une réservation en cours.");
      }
      MockDb.menus.all = MockDb.menus.all.filter((m) => m.id !== Number(id));
      MockDb.menus.save();
      return null;
    }),
  };
})();

const mockPlanningApi = {
  /** GET /api/planning?start_date=&end_date= -> PlanningDay[] */
  get: ({ start_date, end_date }) => MockDb.respond(() => {
    const days = [];
    for (let d = parseDate(start_date); toIsoDate(d) <= end_date; d = addDays(d, 1)) {
      const date = toIsoDate(d);
      const reason = MockDb.closures[date];
      days.push({
        date,
        is_closed: Boolean(reason),
        closure_reason: reason ?? null,
        menus: reason ? [] : MockDb.menus.all
          .filter((m) => m.start_date <= date && date <= m.end_date)
          .map(MockDb.menuToPublic),
      });
    }
    return days;
  }),
};

/* ---------- Comptes ---------- */

const mockAuthApi = (() => {
  const toPublic = ({ password, ...user }) => user; // le mot de passe n'est jamais renvoyé

  /** Même format que celui annoncé par API.md : "k7Fq-2xPm-9Lzr". */
  function generatePassword() {
    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const raw = [...crypto.getRandomValues(new Uint8Array(12))].map((b) => chars[b % chars.length]).join("");
    return raw.match(/.{4}/g).join("-");
  }

  return {
    register: (username) => MockDb.respond(() => {
      const name = (username ?? "").trim();
      if (name.length < 3 || name.length > 30) throw new ApiError(422, "username : entre 3 et 30 caractères");
      if (MockDb.users.all.some((u) => u.username.toLowerCase() === name.toLowerCase())) {
        throw new ApiError(409, "Ce nom d'utilisateur est déjà pris.");
      }
      const user = {
        id: MockDb.users.nextId(),
        username: name,
        password: generatePassword(),
        role: "user",
        is_locked: false,
        created_at: new Date().toISOString().slice(0, 19),
      };
      MockDb.users.all.push(user);
      MockDb.users.save();
      return { id: user.id, username: user.username, password: user.password };
    }),

    login: (username, password) => MockDb.respond(() => {
      const user = MockDb.users.all.find((u) => u.username === username && u.password === password);
      if (!user) throw new ApiError(401, "Nom d'utilisateur ou mot de passe incorrect.");
      if (user.is_locked) throw new ApiError(403, "Ce compte est bloqué. Contactez la Kfet.");
      return { access_token: `mock.${user.id}`, token_type: "bearer", role: user.role };
    }, { handleAuth: false }),

    profile: () => MockDb.respond(() => toPublic(MockDb.currentUser())),

    changePassword: (oldPassword, newPassword) => MockDb.respond(() => {
      const user = MockDb.currentUser();
      if (user.password !== oldPassword) throw new ApiError(401, "L'ancien mot de passe est incorrect.");
      if ((newPassword ?? "").length < 8) throw new ApiError(400, "Le nouveau mot de passe doit faire au moins 8 caractères.");
      if (newPassword === oldPassword) throw new ApiError(400, "Le nouveau mot de passe doit être différent de l'ancien.");
      user.password = newPassword;
      MockDb.users.save();
      return null;
    }, { handleAuth: false }),

    listUsers: () => MockDb.respond(() => {
      MockDb.currentAdmin();
      return MockDb.users.all.map(toPublic);
    }),

    setLocked: (id, locked) => MockDb.respond(() => {
      MockDb.currentAdmin();
      const user = MockDb.users.all.find((u) => u.id === Number(id));
      if (!user) throw new ApiError(404, "Utilisateur introuvable.");
      if (user.role === "admin") throw new ApiError(400, "Un compte administrateur ne peut pas être bloqué.");
      user.is_locked = Boolean(locked);
      MockDb.users.save();
      return toPublic(user);
    }),
  };
})();

/* ---------- Réservations ---------- */

const mockOrderApi = {
  create: (body) => MockDb.respond(() => {
    const user = MockDb.currentUser();
    const date = body.pickup_date;
    const menuReqs = body.menus ?? [];
    const productReqs = body.products ?? [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) throw new ApiError(422, "pickup_date : date invalide");
    if (date < toIsoDate(new Date())) throw new ApiError(400, "La date de retrait est passée.");
    if (MockDb.closures[date]) throw new ApiError(400, `La Kfet est fermée ce jour-là (${MockDb.closures[date]}).`);
    if (!menuReqs.length && !productReqs.length) throw new ApiError(400, "La commande est vide.");
    if ([...menuReqs, ...productReqs].some((l) => !Number.isInteger(l.quantity) || l.quantity < 1)) {
      throw new ApiError(422, "quantity : doit être ≥ 1");
    }

    const menus = menuReqs.map((line) => {
      const menu = MockDb.findMenu(line.menu_id);
      if (date < menu.start_date || date > menu.end_date) {
        throw new ApiError(400, `« ${menu.name} » n'est pas disponible le ${formatDate(parseDate(date))}.`);
      }
      return { id: menu.id, name: menu.name, unit_price: menu.price, quantity: line.quantity };
    });
    const products = productReqs.map((line) => {
      const product = MockDb.products.find((p) => p.id === line.product_id);
      if (!product) throw new ApiError(404, "Un des produits n'existe pas.");
      if (product.stock < line.quantity) throw new ApiError(400, `Stock insuffisant pour « ${product.name} » (${product.stock} restants).`);
      return { id: product.id, name: product.name, unit_price: product.price, quantity: line.quantity };
    });

    const reservation = {
      id: MockDb.reservations.nextId(),
      user: { id: user.id, username: user.username },
      pickup_date: date,
      status: "pending",
      created_at: new Date().toISOString().slice(0, 19),
      products,
      menus,
      total_price: MockDb.round([...menus, ...products].reduce((s, l) => s + l.unit_price * l.quantity, 0)),
    };
    MockDb.reservations.all.push(reservation);
    MockDb.reservations.save();
    return reservation;
  }),

  list: (status) => MockDb.respond(() => {
    const user = MockDb.currentUser();
    return MockDb.reservations.all
      .filter((r) => r.user.id === user.id && (!status || r.status === status))
      .sort((a, b) => b.pickup_date.localeCompare(a.pickup_date) || b.id - a.id);
  }),

  cancel: (id) => MockDb.respond(() => {
    const user = MockDb.currentUser();
    const reservation = MockDb.reservations.all.find((r) => r.id === Number(id));
    if (!reservation) throw new ApiError(404, "Réservation introuvable.");
    if (reservation.user.id !== user.id) throw new ApiError(403, "Cette réservation ne vous appartient pas.");
    if (reservation.status !== "pending" || reservation.pickup_date < toIsoDate(new Date())) {
      throw new ApiError(400, "Cette réservation ne peut plus être annulée.");
    }
    MockDb.reservations.all = MockDb.reservations.all.filter((r) => r !== reservation);
    MockDb.reservations.save();
    return null;
  }),

  adminList: ({ pickup_date, status, user_id } = {}) => MockDb.respond(() => {
    MockDb.currentAdmin();
    return MockDb.reservations.all
      .filter((r) => (!pickup_date || r.pickup_date === pickup_date)
        && (!status || r.status === status)
        && (!user_id || r.user.id === Number(user_id)))
      .sort((a, b) => a.pickup_date.localeCompare(b.pickup_date) || a.id - b.id);
  }),

  check: (id, status) => MockDb.respond(() => {
    MockDb.currentAdmin();
    if (status !== "completed" && status !== "no_show") throw new ApiError(422, "status : completed ou no_show");
    const reservation = MockDb.reservations.all.find((r) => r.id === Number(id));
    if (!reservation) throw new ApiError(404, "Commande introuvable.");
    if (reservation.status !== "pending") throw new ApiError(400, `La commande n°${reservation.id} a déjà été traitée.`);
    reservation.status = status;
    MockDb.reservations.save();
    return reservation;
  }),

  adminRemove: (id) => MockDb.respond(() => {
    MockDb.currentAdmin();
    if (!MockDb.reservations.all.some((r) => r.id === Number(id))) throw new ApiError(404, "Commande introuvable.");
    MockDb.reservations.all = MockDb.reservations.all.filter((r) => r.id !== Number(id));
    MockDb.reservations.save();
    return null;
  }),
};
