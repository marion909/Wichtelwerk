"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canManageCampaign, requireManagedCampaign, requireManager } from "@/lib/access";
import { db } from "@/lib/db";
import { fromViennaInput } from "@/lib/time";
import { PAID_TIERS, atLeast, planFor } from "@/lib/plans";
import { parseParticipants } from "@/lib/csv";
import { importPeople, inviteUser } from "@/lib/participation";
import { revealAll, revealNext, runDraw } from "@/lib/data/assignments";
import { announceDraw, purgeCampaign, startReveal } from "@/worker/jobs";
import { createCheckoutSession, stripeConfigured } from "@/lib/stripe";
import { getLocale } from "@/lib/i18n/server";
import { flashUrl } from "@/components/flash";
import type { Plan } from "@prisma/client";

const base = (id: string) => `/admin/campaigns/${id}`;

function date(formData: FormData, key: string) {
  const v = String(formData.get(key) ?? "");
  return v ? fromViennaInput(v) : null;
}

const campaignSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  budget: z.coerce.number().min(1).max(1000),
  mode: z.enum(["onsite", "shipping", "mixed"]),
  place: z.string().trim().max(200).optional(),
  deleteAfterDays: z.coerce.number().int().min(1).max(180),
});

function readCampaign(formData: FormData) {
  const parsed = campaignSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    budget: String(formData.get("budget") ?? "").replace(",", "."),
    mode: formData.get("mode"),
    place: formData.get("place") || undefined,
    deleteAfterDays: formData.get("deleteAfterDays") || 30,
  });
  const signupDeadline = date(formData, "signupDeadline");
  const drawAt = date(formData, "drawAt");
  const revealAt = date(formData, "revealAt");
  const handoverAt = date(formData, "handoverAt");
  if (!parsed.success || !signupDeadline || !drawAt || !revealAt) return { error: "invalid" as const };
  if (signupDeadline > drawAt || drawAt > revealAt) return { error: "dates" as const };
  return { data: parsed.data, signupDeadline, drawAt, revealAt, handoverAt };
}

export async function createCampaign(formData: FormData) {
  const user = await requireManager();
  const read = readCampaign(formData);
  if (read.error) redirect(flashUrl("/admin/campaigns/new", "err", read.error));

  let scopeLocation = String(formData.get("scopeLocation") ?? "").trim() || null;
  if (user.role === "location_admin") {
    if (!scopeLocation || !user.managedLocations.includes(scopeLocation)) scopeLocation = user.managedLocations[0] ?? null;
    if (!scopeLocation) redirect(flashUrl("/admin", "err", "forbidden"));
  } else if (scopeLocation && !atLeast(user.organization.plan, "business")) {
    scopeLocation = null; // Mehrere Standorte erst ab Business
  }

  const c = await db.campaign.create({
    data: {
      organizationId: user.organizationId,
      title: read.data.title,
      description: read.data.description ?? null,
      budgetCents: Math.round(read.data.budget * 100),
      mode: read.data.mode,
      place: read.data.place ?? null,
      deleteAfterDays: read.data.deleteAfterDays,
      signupDeadline: read.signupDeadline,
      drawAt: read.drawAt,
      revealAt: read.revealAt,
      handoverAt: read.handoverAt,
      scopeLocation,
      tier: user.organization.plan === "enterprise" ? "enterprise" : "free",
    },
  });
  redirect(flashUrl(base(c.id), "ok", "created"));
}

export async function updateCampaign(formData: FormData) {
  const id = String(formData.get("id"));
  const { campaign } = await requireManagedCampaign(id);
  const read = readCampaign(formData);
  if (read.error) redirect(flashUrl(`${base(id)}/edit`, "err", read.error));
  const locked = campaign.status !== "draft" && campaign.status !== "open";
  if (locked) redirect(flashUrl(base(id), "err", "locked"));
  await db.campaign.update({
    where: { id },
    data: {
      title: read.data.title,
      description: read.data.description ?? null,
      budgetCents: Math.round(read.data.budget * 100),
      mode: read.data.mode,
      place: read.data.place ?? null,
      deleteAfterDays: read.data.deleteAfterDays,
      signupDeadline: read.signupDeadline,
      drawAt: read.drawAt,
      revealAt: read.revealAt,
      handoverAt: read.handoverAt,
      allowLateJoin: formData.get("allowLateJoin") === "on",
    },
  });
  redirect(flashUrl(base(id), "ok", "saved"));
}

export async function openCampaign(formData: FormData) {
  const id = String(formData.get("id"));
  const { campaign } = await requireManagedCampaign(id);
  if (campaign.status === "draft") await db.campaign.update({ where: { id }, data: { status: "open" } });
  redirect(flashUrl(base(id), "ok", "opened"));
}

export async function deleteCampaign(formData: FormData) {
  const id = String(formData.get("id"));
  const { campaign } = await requireManagedCampaign(id);
  if (campaign.status !== "draft") redirect(flashUrl(base(id), "err", "locked"));
  await db.campaign.delete({ where: { id } });
  redirect(flashUrl("/admin", "ok", "deleted"));
}

// --- Teilnehmer -------------------------------------------------------------

export async function addParticipant(formData: FormData) {
  const id = String(formData.get("id"));
  const { campaign } = await requireManagedCampaign(id);
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(120),
      email: z.string().trim().toLowerCase().email().max(200),
      department: z.string().trim().max(80).optional(),
      location: z.string().trim().max(80).optional(),
    })
    .safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      department: formData.get("department") || undefined,
      location: formData.get("location") || undefined,
    });
  if (!parsed.success) redirect(flashUrl(`${base(id)}/participants`, "err", "invalid"));
  const res = await inviteUser(campaign, parsed.data, { notify: true });
  if ("error" in res) redirect(flashUrl(`${base(id)}/participants`, "err", "other_org"));
  redirect(flashUrl(`${base(id)}/participants`, "ok", "participant_added"));
}

export async function importCsv(formData: FormData) {
  const id = String(formData.get("id"));
  const { campaign } = await requireManagedCampaign(id);
  const file = formData.get("file");
  let text = String(formData.get("csv") ?? "");
  if (file instanceof File && file.size > 0) {
    if (file.size > 1_000_000) redirect(flashUrl(`${base(id)}/participants`, "err", "file_size"));
    text = await file.text();
  }
  const { people, errors } = parseParticipants(text);
  if (people.length === 0) redirect(flashUrl(`${base(id)}/participants`, "err", "csv_empty"));
  const { added, skipped } = await importPeople(campaign, people);
  const params = new URLSearchParams({ ok: "csv_imported", added: String(added), errors: String(errors.length + skipped.length) });
  redirect(`${base(id)}/participants?${params}`);
}

export async function removeParticipant(formData: FormData) {
  const id = String(formData.get("id"));
  const participantId = String(formData.get("participantId"));
  const { campaign } = await requireManagedCampaign(id);
  if (campaign.status === "drawn" || campaign.status === "revealed" || campaign.status === "closed") {
    redirect(flashUrl(`${base(id)}/participants`, "err", "locked"));
  }
  await db.participant.deleteMany({ where: { id: participantId, campaignId: id } });
  revalidatePath(`${base(id)}/participants`);
  redirect(flashUrl(`${base(id)}/participants`, "ok", "participant_removed"));
}

// --- Regeln -----------------------------------------------------------------

export async function saveRuleFlags(formData: FormData) {
  const id = String(formData.get("id"));
  const { campaign } = await requireManagedCampaign(id);
  if (!planFor(campaign.tier).exclusionRules) redirect(flashUrl(`${base(id)}/rules`, "err", "upgrade"));
  if (campaign.status !== "draft" && campaign.status !== "open") redirect(flashUrl(`${base(id)}/rules`, "err", "locked"));
  await db.campaign.update({
    where: { id },
    data: {
      excludeSameDepartment: formData.get("excludeSameDepartment") === "on",
      excludePreviousYear: formData.get("excludePreviousYear") === "on",
    },
  });
  redirect(flashUrl(`${base(id)}/rules`, "ok", "saved"));
}

export async function addPairRule(formData: FormData) {
  const id = String(formData.get("id"));
  const { campaign } = await requireManagedCampaign(id);
  if (!planFor(campaign.tier).exclusionRules) redirect(flashUrl(`${base(id)}/rules`, "err", "upgrade"));
  if (campaign.status !== "draft" && campaign.status !== "open") redirect(flashUrl(`${base(id)}/rules`, "err", "locked"));
  const a = String(formData.get("a"));
  const b = String(formData.get("b"));
  if (!a || !b || a === b) redirect(flashUrl(`${base(id)}/rules`, "err", "invalid"));
  const count = await db.participant.count({ where: { campaignId: id, id: { in: [a, b] } } });
  if (count !== 2) redirect(flashUrl(`${base(id)}/rules`, "err", "invalid"));
  await db.exclusionRule.create({ data: { campaignId: id, type: "pair", participantAId: a, participantBId: b } });
  redirect(flashUrl(`${base(id)}/rules`, "ok", "saved"));
}

export async function removeRule(formData: FormData) {
  const id = String(formData.get("id"));
  await requireManagedCampaign(id);
  await db.exclusionRule.deleteMany({ where: { id: String(formData.get("ruleId")), campaignId: id } });
  redirect(flashUrl(`${base(id)}/rules`, "ok", "saved"));
}

// --- Ziehung & Reveal ------------------------------------------------------

export async function drawNow(formData: FormData) {
  const id = String(formData.get("id"));
  await requireManagedCampaign(id);
  const result = await runDraw(id);
  if (!result.ok) redirect(flashUrl(base(id), "err", result.error === "wrong_status" ? "locked" : "no_solution"));
  await announceDraw(id);
  redirect(flashUrl(base(id), "ok", "drawn"));
}

export async function startRevealAction(formData: FormData) {
  const id = String(formData.get("id"));
  const { campaign } = await requireManagedCampaign(id);
  if (campaign.status !== "drawn") redirect(flashUrl(base(id), "err", "locked"));
  const live = planFor(campaign.tier).revealMode;
  await startReveal(id, { all: !live });
  redirect(live ? `${base(id)}/reveal` : flashUrl(base(id), "ok", "revealed"));
}

export async function revealNextAction(formData: FormData) {
  const id = String(formData.get("id"));
  const { campaign } = await requireManagedCampaign(id);
  if (!planFor(campaign.tier).revealMode) return;
  await revealNext(id);
  revalidatePath(`${base(id)}/reveal`);
}

export async function revealAllAction(formData: FormData) {
  const id = String(formData.get("id"));
  const { campaign } = await requireManagedCampaign(id);
  if (!planFor(campaign.tier).revealMode) return;
  await revealAll(id);
  revalidatePath(`${base(id)}/reveal`);
}

export async function closeNow(formData: FormData) {
  const id = String(formData.get("id"));
  const { campaign } = await requireManagedCampaign(id);
  if (campaign.status !== "revealed") redirect(flashUrl(base(id), "err", "locked"));
  await purgeCampaign(id);
  redirect(flashUrl(base(id), "ok", "closed"));
}

// --- V2-Optionen ------------------------------------------------------------

export async function saveExtras(formData: FormData) {
  const id = String(formData.get("id"));
  const { campaign } = await requireManagedCampaign(id);
  if (campaign.status === "revealed" || campaign.status === "closed") redirect(flashUrl(base(id), "err", "locked"));
  await db.campaign.update({
    where: { id },
    data: {
      guessGameEnabled: formData.get("guessGameEnabled") === "on",
      vouchersEnabled: formData.get("vouchersEnabled") === "on" && campaign.mode !== "onsite",
    },
  });
  redirect(flashUrl(base(id), "ok", "saved"));
}

// --- Zahlung ---------------------------------------------------------------

export async function startCheckout(formData: FormData) {
  const id = String(formData.get("id"));
  const tier = String(formData.get("tier")) as Plan;
  const { user, campaign } = await requireManagedCampaign(id);
  if (!canManageCampaign(user, campaign) || !PAID_TIERS.includes(tier)) redirect(flashUrl(base(id), "err", "invalid"));
  if (!stripeConfigured()) redirect(flashUrl(base(id), "err", "payments_off"));
  const url = await createCheckoutSession({
    campaign,
    tier,
    email: user.email,
    locale: await getLocale(),
    uid: user.organization.uidNummer,
  });
  redirect(url);
}
