import type { Plan } from "@prisma/client";

export interface PlanInfo {
  id: Plan;
  maxParticipants: number;
  /** Nettopreis pro Aktion in Cent; null = auf Anfrage. */
  priceCents: number | null;
  exclusionRules: boolean;
  revealMode: boolean;
  invoice: boolean;
  multiLocation: boolean;
  branding: boolean;
  sso: boolean;
  poweredBy: boolean;
}

export const PLANS: Record<Plan, PlanInfo> = {
  free: {
    id: "free",
    maxParticipants: 25,
    priceCents: 0,
    exclusionRules: false,
    revealMode: false,
    invoice: false,
    multiLocation: false,
    branding: false,
    sso: false,
    poweredBy: true,
  },
  team: {
    id: "team",
    maxParticipants: 100,
    priceCents: 4900,
    exclusionRules: true,
    revealMode: true,
    invoice: true,
    multiLocation: false,
    branding: false,
    sso: false,
    poweredBy: false,
  },
  business: {
    id: "business",
    maxParticipants: 500,
    priceCents: 14900,
    exclusionRules: true,
    revealMode: true,
    invoice: true,
    multiLocation: true,
    branding: true,
    sso: false,
    poweredBy: false,
  },
  enterprise: {
    id: "enterprise",
    maxParticipants: Number.MAX_SAFE_INTEGER,
    priceCents: null,
    exclusionRules: true,
    revealMode: true,
    invoice: true,
    multiLocation: true,
    branding: true,
    sso: true,
    poweredBy: false,
  },
};

export const PAID_TIERS: Plan[] = ["team", "business"];

/**
 * Die Funktionen einer Aktion richten sich nach dem für diese Aktion gekauften Paket;
 * Branding, SSO und Standort-Rollen hängen am höchsten Paket der Firma.
 */
export function planFor(tier: Plan): PlanInfo {
  return PLANS[tier];
}

const ORDER: Plan[] = ["free", "team", "business", "enterprise"];

export function atLeast(plan: Plan, min: Plan): boolean {
  return ORDER.indexOf(plan) >= ORDER.indexOf(min);
}

/** Kleinstes Paket, das für n Teilnehmer reicht. */
export function tierForParticipants(n: number): Plan {
  return ORDER.find((p) => PLANS[p].maxParticipants >= n) ?? "enterprise";
}

export function formatMoney(cents: number, currency = "EUR", locale = "de-AT"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}
