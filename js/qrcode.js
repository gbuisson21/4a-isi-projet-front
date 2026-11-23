/* QR code de validation d'une réservation.
 *
 * ⚠️ Pour l'instant c'est un FAUX QR code : un motif qui en a l'apparence (repères dans
 * 3 coins, lignes de synchronisation) mais qui ne se scanne pas. Le motif dépend du
 * contenu, donc chaque réservation a toujours le même dessin.
 *
 * Pour passer à un vrai QR code plus tard : garder la signature qrCodeSvg(text)
 * et générer le SVG avec une bibliothèque (ex. qrcode-generator), à partir d'un
 * jeton de validation fourni par le back (ex. reservation.validation_token).
 */

const QR_SIZE = 25; // modules par côté (taille d'un QR « version 2 »)

/** Contenu encodé dans le QR d'une réservation. À remplacer par le jeton du back. */
function reservationQrPayload(reservation) {
  return reservation.validation_token ?? `KFET-RES-${reservation.id}-${reservation.pickup_date}`;
}

/** Inverse de reservationQrPayload : « 12 », « n°12 » ou « KFET-RES-12-2026-11-24 » -> 12 (ou null). */
function parseOrderCode(text) {
  const match = String(text).trim().match(/^(?:KFET-RES-|n°\s*)?(\d+)/i);
  return match ? Number(match[1]) : null;
}

/** Générateur pseudo-aléatoire déterministe (mulberry32) à partir d'un texte. */
function seededRandom(text) {
  let seed = 0;
  for (const char of text) seed = (Math.imul(seed, 31) + char.charCodeAt(0)) | 0;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Renvoie le SVG (chaîne) d'un faux QR code pour `text`. */
function qrCodeSvg(text, label = "QR code") {
  const n = QR_SIZE;
  const random = seededRandom(text);
  const grid = Array.from({ length: n }, () => Array(n).fill(null));

  // Repères de position (7×7) dans 3 coins + séparateur blanc autour
  const finder = (row, col) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const y = row + r, x = col + c;
        if (y < 0 || x < 0 || y >= n || x >= n) continue;
        const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
        grid[y][x] = ring !== 2 && ring !== 4;
      }
    }
  };
  finder(0, 0);
  finder(0, n - 7);
  finder(n - 7, 0);

  // Petit repère d'alignement (5×5) en bas à droite
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) grid[n - 7 + r][n - 7 + c] = Math.max(Math.abs(r), Math.abs(c)) !== 1;
  }

  // Lignes de synchronisation (alternance noir / blanc)
  for (let i = 8; i < n - 8; i++) {
    grid[6][i] = i % 2 === 0;
    grid[i][6] = i % 2 === 0;
  }

  // Le reste : « données » pseudo-aléatoires
  let path = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (grid[y][x] === null) grid[y][x] = random() < 0.5;
      if (grid[y][x]) path += `M${x + 4} ${y + 4}h1v1h-1z`;
    }
  }

  const total = n + 8; // marge blanche de 4 modules
  return `<svg class="qr" viewBox="0 0 ${total} ${total}" role="img" aria-label="${escapeHtml(label)}" shape-rendering="crispEdges">
    <rect width="${total}" height="${total}" fill="#fff"/>
    <path d="${path}" fill="currentColor"/>
  </svg>`;
}
