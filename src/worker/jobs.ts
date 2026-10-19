import type { Campaign, User } from "@prisma/client";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/mail";
import { mailUser } from "@/lib/notifications";
import { notifyOrganization } from "@/lib/notify";
import { formatDate } from "@/lib/i18n";
import { archivePairs, purgeCampaignData, revealAll, runDraw } from "@/lib/data/assignments";

const HOUR = 3_600_000;

/** Reserviert eine Erinnerung genau einmal pro Aktion (auch bei mehreren Worker-Läufen). */
async function claim(campaignId: string, kind: string): Promise<boolean> {
  const res = await db.reminderLog.createMany({ data: [{ campaignId, kind }], skipDuplicates: true });
  return res.count === 1;
}

function dateVars(c: Campaign, user: Pick<User, "locale">) {
  const locale = user.locale === "en" ? "en" : "de";
  return {
    title: c.title,
    deadline: formatDate(c.signupDeadline, locale, true),
    drawAt: formatDate(c.drawAt, locale, true),
    revealAt: formatDate(c.revealAt, locale, true),
    handoverAt: c.handoverAt ? formatDate(c.handoverAt, locale, true) : "",
  };
}

async function admins(c: Campaign) {
  return db.user.findMany({
    where: {
      organizationId: c.organizationId,
      OR: [{ role: "admin" }, { role: "location_admin", managedLocations: { has: c.scopeLocation ?? "" } }],
    },
  });
}

/** Versendet ausstehende Einladungen (aus CSV-Import) für offene Aktionen. */
export async function sendPendingInvites(limit = 100): Promise<number> {
  const pending = await db.participant.findMany({
    where: { status: "invited", inviteSentAt: null, campaign: { status: "open" } },
    include: { user: true, campaign: true },
    take: limit,
  });
  for (const p of pending) {
    try {
      await mailUser(p.user, "invite", dateVars(p.campaign, p.user), appUrl(`/join/${p.campaign.inviteToken}`));
      await db.participant.update({ where: { id: p.id }, data: { inviteSentAt: new Date() } });
    } catch (err) {
      console.error("[invite]", p.id, err);
    }
  }
  return pending.length;
}

export async function runDueDraws(now = new Date()): Promise<number> {
  const due = await db.campaign.findMany({ where: { status: "open", drawAt: { lte: now } } });
  let done = 0;
  for (const c of due) {
    const result = await runDraw(c.id);
    if (!result.ok) {
      if (await claim(c.id, "draw_failed")) {
        for (const a of await admins(c)) {
          await mailUser(a, "draw_failed", dateVars(c, a), appUrl(`/admin/campaigns/${c.id}`)).catch(console.error);
        }
      }
      continue;
    }
    done++;
    await announceDraw(c.id);
  }
  return done;
}

/** Mail an alle Teilnehmer nach der Ziehung. */
export async function announceDraw(campaignId: string): Promise<void> {
  const c = await db.campaign.findUniqueOrThrow({ where: { id: campaignId } });
  const people = await db.participant.findMany({ where: { campaignId, status: "joined" }, include: { user: true } });
  for (const p of people) {
    await mailUser(p.user, "drawn", dateVars(c, p.user), appUrl(`/app/c/${c.id}`)).catch(console.error);
  }
  await notifyOrganization(c.organizationId, {
    title: c.title,
    text: `Die Ziehung ist erfolgt – ${people.length} Teilnehmer wissen jetzt, wen sie beschenken.`,
    url: appUrl(`/app/c/${c.id}`),
    linkLabel: "Wichtelwerk öffnen",
  });
}

export async function sendReminders(now = new Date()): Promise<void> {
  // Anmeldeschluss in <24 h: Eingeladene, die noch nicht zugesagt haben.
  const closing = await db.campaign.findMany({
    where: { status: "open", signupDeadline: { gt: now, lte: new Date(now.getTime() + 24 * HOUR) } },
  });
  for (const c of closing) {
    if (!(await claim(c.id, "signup_24h"))) continue;
    const invited = await db.participant.findMany({ where: { campaignId: c.id, status: "invited", inviteSentAt: { not: null } }, include: { user: true } });
    for (const p of invited) await mailUser(p.user, "signup_reminder", dateVars(c, p.user), appUrl(`/join/${c.inviteToken}`)).catch(console.error);
    await notifyOrganization(c.organizationId, {
      title: c.title,
      text: "Anmeldeschluss in weniger als 24 Stunden.",
      url: appUrl(`/join/${c.inviteToken}`),
      linkLabel: "Jetzt anmelden",
    });
  }

  // Ziehung in <24 h: fehlende Wunschzettel.
  const drawing = await db.campaign.findMany({
    where: { status: "open", drawAt: { gt: now, lte: new Date(now.getTime() + 24 * HOUR) } },
  });
  for (const c of drawing) {
    if (!(await claim(c.id, "wishlist_24h"))) continue;
    const people = await db.participant.findMany({
      where: { campaignId: c.id, status: "joined" },
      include: { user: true, wishlist: true },
    });
    for (const p of people) {
      const empty = !p.wishlist || (!p.wishlist.text.trim() && p.wishlist.tags.length === 0 && p.wishlist.links.length === 0);
      if (empty) await mailUser(p.user, "wishlist_reminder", dateVars(c, p.user), appUrl(`/app/c/${c.id}`)).catch(console.error);
    }
  }

  // Übergabe in <48 h.
  const handover = await db.campaign.findMany({
    where: { status: { in: ["drawn", "revealed"] }, handoverAt: { gt: now, lte: new Date(now.getTime() + 48 * HOUR) } },
  });
  for (const c of handover) {
    if (!(await claim(c.id, "handover_48h"))) continue;
    const people = await db.participant.findMany({ where: { campaignId: c.id, status: "joined" }, include: { user: true } });
    for (const p of people) await mailUser(p.user, "handover_reminder", dateVars(c, p.user), appUrl(`/app/c/${c.id}`)).catch(console.error);
    await notifyOrganization(c.organizationId, {
      title: c.title,
      text: "Die Übergabe der Geschenke steht in weniger als 48 Stunden an.",
      url: appUrl(`/app/c/${c.id}`),
      linkLabel: "Wichtelwerk öffnen",
    });
  }
}

/** Ruft den Reveal-Modus auf (Status `revealed`) – manuell oder automatisch. */
export async function startReveal(campaignId: string, opts: { all: boolean }): Promise<void> {
  const c = await db.campaign.findUniqueOrThrow({ where: { id: campaignId } });
  if (c.status !== "drawn") return;
  const now = new Date();
  await db.campaign.update({
    where: { id: campaignId },
    data: { status: "revealed", revealedAt: now, purgeAt: new Date(now.getTime() + c.deleteAfterDays * 86_400_000) },
  });
  if (opts.all) await revealAll(campaignId);
  const people = await db.participant.findMany({ where: { campaignId, status: "joined" }, include: { user: true } });
  for (const p of people) await mailUser(p.user, "reveal", dateVars(c, p.user), appUrl(`/app/c/${c.id}`)).catch(console.error);
}

/**
 * Zum Stichtag: Aktionen ohne Reveal-Modus werden sofort komplett aufgedeckt;
 * bei Aktionen mit Reveal-Modus greift ein Fallback 24 h nach dem Termin.
 */
export async function runDueReveals(now = new Date()): Promise<void> {
  const due = await db.campaign.findMany({ where: { status: "drawn", revealAt: { lte: now } } });
  for (const c of due) {
    const live = c.tier !== "free";
    if (live && now.getTime() - c.revealAt.getTime() < 24 * HOUR) continue;
    await startReveal(c.id, { all: true });
  }
}

/** Löschfristen: Paare pseudonymisiert sichern, danach alles Personenbezogene entfernen. */
export async function runPurges(now = new Date()): Promise<number> {
  const due = await db.campaign.findMany({ where: { status: { in: ["revealed", "drawn"] }, purgeAt: { lte: now } } });
  for (const c of due) {
    await purgeCampaign(c.id);
  }
  return due.length;
}

export async function purgeCampaign(campaignId: string): Promise<void> {
  await archivePairs(campaignId);
  await purgeCampaignData(campaignId);
  await db.$transaction([
    db.wishlist.deleteMany({ where: { participant: { campaignId } } }),
    db.participant.deleteMany({ where: { campaignId } }),
    db.exclusionRule.deleteMany({ where: { campaignId } }),
    db.campaign.update({
      where: { id: campaignId },
      data: { status: "closed", closedAt: new Date(), purgedAt: new Date(), description: null, place: null },
    }),
  ]);
}

export async function runTick(now = new Date()): Promise<void> {
  await sendPendingInvites();
  await runDueDraws(now);
  await sendReminders(now);
  await runDueReveals(now);
  await runPurges(now);
}
