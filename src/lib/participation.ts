import type { Campaign, Participant, User } from "@prisma/client";
import { db } from "@/lib/db";
import { planFor } from "@/lib/plans";
import { insertLateJoiner } from "@/lib/data/assignments";
import type { CsvPerson } from "@/lib/csv";

export type JoinError = "closed" | "full" | "other_org" | "not_invited";

export function signupOpen(campaign: Pick<Campaign, "status" | "signupDeadline" | "allowLateJoin" | "revealAt">, now = new Date()): boolean {
  if (campaign.status === "open") return now <= campaign.signupDeadline;
  if (campaign.status === "drawn") return campaign.allowLateJoin && now <= campaign.revealAt;
  return false;
}

/** Legt (oder findet) den Nutzer in der Firma der Aktion und verknüpft ihn als eingeladenen Teilnehmer. */
export async function inviteUser(
  campaign: Pick<Campaign, "id" | "organizationId">,
  person: Pick<CsvPerson, "name" | "email"> & { department?: string | null; location?: string | null },
  opts: { notify: boolean },
): Promise<{ participant: Participant; user: User } | { error: "other_org" }> {
  const email = person.email.trim().toLowerCase();
  let user = await db.user.findUnique({ where: { email } });
  if (user && user.organizationId && user.organizationId !== campaign.organizationId) return { error: "other_org" };
  if (!user) {
    user = await db.user.create({
      data: {
        email,
        name: person.name,
        department: person.department ?? null,
        location: person.location ?? null,
        organizationId: campaign.organizationId,
      },
    });
  } else {
    user = await db.user.update({
      where: { id: user.id },
      data: {
        organizationId: campaign.organizationId,
        name: user.name ?? person.name,
        department: user.department ?? person.department ?? null,
        location: user.location ?? person.location ?? null,
      },
    });
  }
  const participant = await db.participant.upsert({
    where: { campaignId_userId: { campaignId: campaign.id, userId: user.id } },
    create: { campaignId: campaign.id, userId: user.id, status: "invited", inviteSentAt: opts.notify ? null : new Date() },
    update: {},
  });
  return { participant, user };
}

/** CSV-Import: legt Teilnehmer an; Einladungsmails verschickt der Worker. */
export async function importPeople(campaign: Pick<Campaign, "id" | "organizationId">, people: CsvPerson[]) {
  let added = 0;
  const skipped: string[] = [];
  for (const person of people) {
    const res = await inviteUser(campaign, person, { notify: true });
    if ("error" in res) skipped.push(person.email);
    else added++;
  }
  return { added, skipped };
}

/** Nutzer bestätigt seine Teilnahme (nach Magic-Link-Login). Nachzügler werden in den Zyklus eingefügt. */
export async function confirmParticipation(userId: string, campaignId: string): Promise<{ ok: true; late: boolean } | { ok: false; error: JoinError }> {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!campaign || !user) return { ok: false, error: "closed" };
  if (user.organizationId !== campaign.organizationId) return { ok: false, error: "other_org" };

  const existing = await db.participant.findUnique({ where: { campaignId_userId: { campaignId, userId } } });
  if (existing?.status === "joined") return { ok: true, late: existing.lateJoiner };
  if (!signupOpen(campaign)) return { ok: false, error: "closed" };

  const joined = await db.participant.count({ where: { campaignId, status: "joined" } });
  if (joined >= planFor(campaign.tier).maxParticipants) return { ok: false, error: "full" };

  const participant = await db.participant.upsert({
    where: { campaignId_userId: { campaignId, userId } },
    create: { campaignId, userId, status: "joined", joinedAt: new Date(), inviteSentAt: new Date() },
    update: { status: "joined", joinedAt: new Date() },
  });
  await db.wishlist.upsert({ where: { participantId: participant.id }, create: { participantId: participant.id }, update: {} });

  if (campaign.status === "drawn") {
    await insertLateJoiner(campaignId, participant.id);
    return { ok: true, late: true };
  }
  return { ok: true, late: false };
}

export async function declineParticipation(userId: string, campaignId: string): Promise<void> {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId }, select: { status: true } });
  if (!campaign || campaign.status === "drawn" || campaign.status === "revealed" || campaign.status === "closed") return;
  await db.participant.updateMany({ where: { campaignId, userId }, data: { status: "declined" } });
}
