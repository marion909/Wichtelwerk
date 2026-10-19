/** Betreiberdaten für Impressum, Datenschutzerklärung und AV-Vertrag (per Umgebungsvariablen konfigurierbar). */
export const legal = {
  name: process.env.LEGAL_NAME ?? "Mario Neuhauser",
  address: process.env.LEGAL_ADDRESS ?? "[Anschrift – bitte in LEGAL_ADDRESS eintragen]",
  email: process.env.LEGAL_EMAIL ?? "hallo@neuhauser.cloud",
  uid: process.env.LEGAL_UID ?? "",
  phone: process.env.LEGAL_PHONE ?? "",
  domain: "wichtelwerk.neuhauser.cloud",
};
