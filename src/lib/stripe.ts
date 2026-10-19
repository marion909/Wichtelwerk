import Stripe from "stripe";
import type { Campaign, Plan } from "@prisma/client";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/mail";
import { PAID_TIERS, PLANS, atLeast } from "@/lib/plans";

let client: Stripe | null = null;

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY ist nicht gesetzt");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

export async function createCheckoutSession(opts: {
  campaign: Pick<Campaign, "id" | "title" | "organizationId">;
  tier: Plan;
  email: string;
  locale: "de" | "en";
  uid?: string | null;
}): Promise<string> {
  if (!PAID_TIERS.includes(opts.tier)) throw new Error("Paket nicht kaufbar");
  const price = PLANS[opts.tier].priceCents!;
  const back = appUrl(`/admin/campaigns/${opts.campaign.id}`);
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    locale: opts.locale,
    customer_email: opts.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: price,
          tax_behavior: "exclusive",
          product_data: {
            name: `Wichtelwerk ${opts.tier === "team" ? "Team" : "Business"} – ${opts.campaign.title}`,
            description: `Bis zu ${PLANS[opts.tier].maxParticipants} Teilnehmer, eine Aktion`,
          },
        },
      },
    ],
    automatic_tax: { enabled: process.env.STRIPE_AUTOMATIC_TAX === "true" },
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    invoice_creation: {
      enabled: true,
      invoice_data: {
        description: `Wichtelwerk – ${opts.campaign.title}`,
        footer: opts.uid ? `UID: ${opts.uid}` : undefined,
        metadata: { campaignId: opts.campaign.id },
      },
    },
    metadata: { campaignId: opts.campaign.id, organizationId: opts.campaign.organizationId, tier: opts.tier },
    success_url: `${back}?paid=1`,
    cancel_url: `${back}?paid=0`,
  });
  await db.campaign.update({ where: { id: opts.campaign.id }, data: { stripeSessionId: session.id } });
  if (!session.url) throw new Error("Stripe lieferte keine Checkout-URL");
  return session.url;
}

/** Schaltet das gekaufte Paket frei (idempotent). */
export async function fulfillCheckout(session: Stripe.Checkout.Session): Promise<boolean> {
  if (session.payment_status !== "paid") return false;
  const campaignId = session.metadata?.campaignId;
  const tier = session.metadata?.tier as Plan | undefined;
  if (!campaignId || !tier || !PAID_TIERS.includes(tier)) return false;
  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return false;
  const expected = PLANS[tier].priceCents!;
  if ((session.amount_subtotal ?? expected) !== expected) return false;

  await db.campaign.update({
    where: { id: campaignId },
    data: { tier: atLeast(campaign.tier, tier) ? campaign.tier : tier, paidAt: new Date(), stripeSessionId: session.id },
  });
  const org = await db.organization.findUnique({ where: { id: campaign.organizationId }, select: { plan: true } });
  if (org && !atLeast(org.plan, tier)) {
    await db.organization.update({ where: { id: campaign.organizationId }, data: { plan: tier } });
  }
  return true;
}
