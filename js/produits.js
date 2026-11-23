/* Page Produits : GET /api/products, avec recherche et filtre côté client.
 * Chaque produit peut être ajouté au panier (réservation, cf. cart.js). */

const productsEl = document.getElementById("products");
const searchEl = document.getElementById("search");
const onlyAvailableEl = document.getElementById("only-available");

let allProducts = [];

function renderProduct(product) {
  const outOfStock = product.stock === 0;
  return `
    <article class="card product ${outOfStock ? "product--out" : ""}">
      <p class="product__name">${escapeHtml(product.name)}</p>
      ${outOfStock
        ? `<span class="badge badge--out">Épuisé</span>`
        : `<span class="stock">${product.stock} en stock</span>`}
      <div class="product__footer">
        <span class="price">${formatPrice(product.price)}</span>
      </div>
      ${productButton(product, "product__add")}
    </article>`;
}

function render() {
  const query = searchEl.value.trim().toLowerCase();
  const filtered = allProducts.filter((p) =>
    p.name.toLowerCase().includes(query) && (!onlyAvailableEl.checked || p.stock > 0)
  );
  productsEl.innerHTML = filtered.length
    ? filtered.map(renderProduct).join("")
    : `<p class="state">Aucun produit ne correspond à la recherche.</p>`;
}

async function loadProducts() {
  showLoading(productsEl);
  try {
    allProducts = await ProductsApi.list();
    registerProducts(allProducts);
    render();
  } catch (error) {
    showError(productsEl, error);
  }
}

searchEl.addEventListener("input", render);
onlyAvailableEl.addEventListener("change", render);

loadProducts();
