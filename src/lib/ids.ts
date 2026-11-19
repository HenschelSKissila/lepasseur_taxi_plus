/* Identifiants générés côté appareil (indispensable pour créer des lignes hors ligne). */

export const uuid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });

/** Hachage 128 bits déterministe (cyrb128) → UUID. Deux appareils hors ligne qui
 *  saisissent la même journée du même taxi produisent le même identifiant :
 *  la synchronisation fusionne au lieu de créer un doublon. */
export function uuidStable(cle: string): string {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < cle.length; i++) {
    const k = cle.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067); h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213); h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4; h2 ^= h1; h3 ^= h1; h4 ^= h1;
  const hex = [h1, h2, h3, h4].map(h => (h >>> 0).toString(16).padStart(8, "0")).join("");
  // version 8 (« personnalisé ») et variante RFC 4122
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 3) | 8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export const idJournee = (taxiId: string, date: string) => uuidStable(`journee:${taxiId}:${date}`);
export const idPaiement = (chargeId: string, echeance: string) => uuidStable(`echeance:${chargeId}:${echeance}`);
