/* Scanner de QR code de la page Admin > Commandes (fenêtre #scan-dialog).
 *
 * Pour l'instant : aperçu de la caméra + bouton « Simuler un scan ».
 * Pour le vrai décodage, brancher une bibliothèque (ex. jsQR / html5-qrcode) qui lit
 * les images de #scan-video, et appeler onQrDecoded(texte) quand un code est reconnu.
 *
 * initScanner({ onValidate }) : onValidate(id) valide le retrait et renvoie la commande à jour.
 */

function initScanner({ onValidate }) {

  const scanDialog = document.getElementById("scan-dialog");
  const scanVideo = document.getElementById("scan-video");
  const scanPlaceholder = document.getElementById("scan-placeholder");
  const scanPlaceholderText = document.getElementById("scan-placeholder-text");
  const stepCamera = document.getElementById("scan-step-camera");
  const stepResult = document.getElementById("scan-step-result");
  const scanResultEl = document.getElementById("scan-result");
  const scanActionsEl = document.getElementById("scan-result-actions");
  let cameraStream = null;

  async function startCamera() {
    scanPlaceholder.hidden = false;
    scanPlaceholderText.textContent = "Activation de la caméra…";
    if (!navigator.mediaDevices?.getUserMedia) {
      scanPlaceholderText.textContent = "Caméra indisponible sur cet appareil ou ce navigateur.";
      return;
    }
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      if (!scanDialog.open || stepCamera.hidden) { stopCamera(); return; } // fermé ou scan simulé entre-temps
      scanVideo.srcObject = cameraStream;
      await scanVideo.play();
      scanPlaceholder.hidden = true;
    } catch (error) {
      scanPlaceholderText.textContent = error.name === "NotAllowedError"
        ? "Accès à la caméra refusé. Autorisez-le dans le navigateur, ou saisissez le numéro."
        : "Impossible d'activer la caméra.";
    }
  }

  function stopCamera() {
    cameraStream?.getTracks().forEach((track) => track.stop());
    cameraStream = null;
    scanVideo.srcObject = null;
  }

  function showCameraStep() {
    stepCamera.hidden = false;
    stepResult.hidden = true;
    document.getElementById("scan-title").textContent = "Scanner un QR code";
    startCamera();
  }

  function openScanner() {
    scanDialog.showModal();
    showCameraStep();
  }

  /** À appeler par le décodeur quand un QR code est lu. */
  async function onQrDecoded(text) {
    stopCamera();
    stepCamera.hidden = true;
    stepResult.hidden = false;
    document.getElementById("scan-title").textContent = "Commande scannée";
    scanResultEl.innerHTML = `<p class="state">Recherche de la commande…</p>`;
    scanActionsEl.innerHTML = "";

    const id = parseOrderCode(text);
    let order = null;
    if (id) {
      try {
        order = (await OrderApi.adminList()).find((o) => o.id === id) ?? null;
      } catch (error) {
        renderScanError(escapeHtml(error.message));
        return;
      }
    }
    if (!order) {
      renderScanError(`Ce QR code ne correspond à aucune commande (${escapeHtml(String(text))}).`);
      return;
    }
    renderScanResult(order);
  }

  function renderScanError(message) {
    scanResultEl.innerHTML = `
      <div class="scan-result scan-result--warn">
        <div class="scan-result__head">
          <span class="scan-result__icon" aria-hidden="true">!</span>
          <p class="scan-result__title">Code inconnu</p>
        </div>
      </div>
      <p class="scan-result__warn">${message}</p>`;
    scanActionsEl.innerHTML = `
      <button class="btn" type="button" data-close>Fermer</button>
      <button class="btn btn--primary" type="button" data-rescan>Scanner un autre code</button>`;
  }

  function renderScanResult(order, justValidated = false) {
    const today = toIsoDate(new Date());
    const status = ORDER_STATUS[order.status] ?? { label: order.status, badge: "" };
    const lines = [...order.menus, ...order.products]
      .map((l) => `<li><span>${l.quantity} × ${escapeHtml(l.name)}</span><span>${formatPrice(l.unit_price * l.quantity)}</span></li>`)
      .join("");

    let notice = "";
    if (justValidated) notice = `<p class="scan-result__done">✓ Retrait validé. Encaissez ${formatPrice(order.total_price)}.</p>`;
    else if (order.status !== "pending") notice = `<p class="scan-result__warn">Cette commande a déjà été traitée (${status.label.toLowerCase()}).</p>`;
    else if (order.pickup_date !== today) notice = `<p class="scan-result__warn">Attention : retrait prévu le ${formatDate(parseDate(order.pickup_date))}, pas aujourd'hui.</p>`;

    const warn = !justValidated && (order.status !== "pending" || order.pickup_date !== today);
    scanResultEl.innerHTML = `
      <div class="scan-result ${warn ? "scan-result--warn" : ""}">
        <div class="scan-result__head">
          <span class="scan-result__icon" aria-hidden="true">${justValidated ? "✓" : warn ? "!" : "#"}</span>
          <div>
            <p class="scan-result__title">N°${order.id} · ${escapeHtml(order.user.username)}</p>
            <p class="scan-result__sub">Retrait ${formatDate(parseDate(order.pickup_date))} · <span class="badge ${status.badge}">${status.label}</span></p>
          </div>
        </div>
      </div>
      <ul class="reservation__lines">${lines}</ul>
      <div class="order-total"><span>À encaisser</span><span class="price">${formatPrice(order.total_price)}</span></div>
      ${notice}`;

    scanActionsEl.innerHTML = order.status === "pending"
      ? `<button class="btn" type="button" data-rescan>Annuler</button>
         <button class="btn btn--primary" type="button" data-validate="${order.id}">✓ Valider le retrait</button>`
      : `<button class="btn" type="button" data-close>Fermer</button>
         <button class="btn btn--primary" type="button" data-rescan>Scanner le suivant</button>`;
  }

  scanDialog.addEventListener("click", async (event) => {
    if (event.target.closest("[data-close]") || event.target === scanDialog) {
      scanDialog.close();
      return;
    }
    if (event.target.closest("[data-rescan]")) {
      showCameraStep();
      return;
    }
    const validateBtn = event.target.closest("[data-validate]");
    if (validateBtn) {
      validateBtn.disabled = true;
      try {
        const updated = await onValidate(Number(validateBtn.dataset.validate));
        renderScanResult(updated, true);
        flash(`Commande n°${updated.id} validée : ${formatPrice(updated.total_price)} à encaisser auprès de ${updated.user.username}.`);
      } catch (error) {
        renderScanError(escapeHtml(error.message));
      }
    }
  });
  scanDialog.addEventListener("close", stopCamera);

  // Démo : « scanne » le QR d'une commande à retirer (ou de n'importe quelle commande s'il n'y en a plus)
  document.getElementById("simulate-scan").addEventListener("click", async () => {
    const all = await OrderApi.adminList().catch(() => []);
    const pending = all.filter((o) => o.status === "pending");
    const pendingToday = pending.filter((o) => o.pickup_date === toIsoDate(new Date()));
    const pool = pendingToday.length ? pendingToday : pending.length ? pending : all;
    const order = pool[Math.floor(Math.random() * pool.length)];
    onQrDecoded(order ? reservationQrPayload(order) : "KFET-RES-0");
  });

  document.getElementById("open-scanner").addEventListener("click", openScanner);
}
