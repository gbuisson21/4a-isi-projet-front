# 4a-isi-projet-front

Front-end de la Kfet (HTML / CSS / JavaScript sans framework ni build), servi par le back FastAPI.

## Lancer

Le back sert le front : lancer le back (`uvicorn app.main:app --reload` dans `4a-isi-projet-back`) puis ouvrir <http://localhost:8000/>.

## Données simulées et branchement du back

Tant que les routes ne sont pas toutes codées côté back, les données sont **simulées dans le navigateur** (`js/mock.js`), en respectant le contrat de `API.md` : mêmes formats, mêmes codes d'erreur. Un bandeau « Mode démo » le signale.

Le choix se fait par domaine dans `js/api.js` :

```js
const USE_MOCK = {
  catalog: true, // produits, menus (public + admin), planning
  auth: true,    // inscription, connexion, profil, comptes (admin)
  orders: true,  // réservations (utilisateur + admin)
};
```

Passer un domaine à `false` dès que ses routes sont prêtes côté back. **`orders: true` nécessite `auth: true`** : la simulation ne reconnaît que ses propres jetons.

Quand tout est à `false`, `js/mock.js` peut être supprimé, avec sa balise `<script>` dans chaque page.

Comptes de démo : `admin` / `admin1234`, `alice` / `alice1234`, `bob` / `bob12345`, `chloe` / `chloe1234` (bloqué), `dylan` / `dylan1234`.

## Ce que le front attend du back, en plus d'`API.md`

| Besoin | Utilisé par | État |
|---|---|---|
| `GET /api/admin/users` → `User[]` | Admin › Comptes | ❌ absent d'`API.md` |
| `GET /api/menus` avec `date` **optionnel** | Page Menus, filtre « Tous » | ⚠️ optionnel dans `API.md`, mais obligatoire dans le back actuel |
| Champ `validation_token` dans `Reservation` | QR code de retrait (`js/qrcode.js`) | ❌ absent : un faux QR est généré à partir du numéro de commande en attendant |

## Organisation du code

Toutes les pages chargent les mêmes scripts communs, dans cet ordre, puis le script de la page :

| Fichier | Rôle |
|---|---|
| `js/api.js` | Configuration (`USE_MOCK`), client HTTP `api()`, `ApiError`, gestion unique du 401 (session expirée) |
| `js/utils.js` | Formats (prix, dates), helpers DOM, `flash()`, affichage des menus |
| `js/mock.js` | **Simulation du back** (données de démo + faux services) |
| `js/auth.js` | Session, `AuthApi`, `requireRole()`, `loginUrl()` |
| `js/catalog-api.js` | `ProductsApi`, `MenusApi`, `PlanningApi` |
| `js/orders-api.js` | `OrderApi`, statuts de commande (`ORDER_STATUS`) |
| `js/cart.js` | Panier, boutons « Ajouter », fenêtre de réservation |
| `js/layout.js` | En-tête et sous-menu admin (générés, une seule source) |

Scripts spécifiques : `js/qrcode.js` (QR des réservations), `js/admin-scanner.js` (scanner de la page Admin › Commandes), et un script par page (`planning.js`, `menus.js`, …).

Règles suivies :

- **Les pages n'appellent jamais `api()` ni `mock.js` directement** : uniquement `ProductsApi`, `MenusApi`, `PlanningApi`, `AuthApi`, `OrderApi`. Chaque service a une version réelle et une version simulée de même forme.
- **Le 401 est géré une seule fois** (`handleAuthError` dans `api.js`) : la session est vidée et l'utilisateur renvoyé vers la connexion. Les routes où un 401 a un autre sens (connexion, ancien mot de passe faux) passent `handleAuth: false`.
- **Tout texte venant de l'API passe par `escapeHtml()`** avant d'être inséré dans la page.
- **Les droits côté front ne servent qu'à l'affichage** (`requireRole`) : le back doit vérifier le rôle sur chaque route admin.
