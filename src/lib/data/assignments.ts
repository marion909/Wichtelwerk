/**
 * EINZIGER Zugriffspunkt auf die Tabelle `assignment` (und `message`).
 *
 * Geheimhaltung: Admin-Seiten dürfen die Zuordnung nie lesen. Hier gibt es nur
 *  - Funktionen, die ausschließlich die eigene Zeile eines Teilnehmers liefern,
 *  - die Ziehung selbst (schreibend, ohne Rückgabe der Paare),
 *  - die Reveal-Funktionen, die erst nach dem Aufdecken Paare liefern.
 * `src/lib/data/assignments.guard.test.ts` stellt sicher, dass kein anderes Modul
 * `assignment` anfasst.
 */
import type { Campaign, ExclusionRule, Participant, SenderRole, User } from "@prisma/client";
import { db } from "@/lib/db";
import { decrypt, encrypt, pseudonym } from "@/lib/crypto";
import { diagnose, drawCycle, insertIntoCycle, type DrawFailure, type Edge } from "@/lib/draw";
import { planFor } from "@/lib/plans";

type ParticipantWithUser = Participant & { user: User };

// ---------------------------------------------------------------------------
// Ziehung
// ---------------------------------------------------------------------------

export function buildForbiddenEdges(
  campaign: Pick<Campaign, "excludeSameDepartment" | "excludePreviousYear">,
  participants: ParticipantWithUser[],
  rules: ExclusionRule[],
  previousPairs: Set<string>,
  organizationId: string,
): Edge[] {
  const edges: Edge[] = [];
  const byUser = new Map(participants.map((p) => [p.id, p]));

  if (campaign.excludeSameDepartment) {
    for (const a of participants) {
      for (const b of participants) {
        if (a.id !== b.id && a.user.department && a.user.department === b.user.department) {
          edges.push([a.id, b.id]);
        }
      }
    }
  }
  for (const rule of rules) {
    if (rule.type === "pair" && rule.participantAId && rule.participantBId) {
      if (byUser.has(rule.participantAId) && byUser.has(rule.participantBId)) {
        edges.push([rule.participantAId, rule.participantBId], [rule.participantBId, rule.participantAId]);
      }
    }
  }
  if (campaign.excludePreviousYear) {
    const hashes = new Map(participants.map((p) => [p.id, pseudonym(p.user.email, organizationId)]));
    for (const a of participants) {
      for (const b of participants) {
        if (a.id !== b.id && previousPairs.has(`${hashes.get(a.id)}>${hashes.get(b.id)}`)) {
          edges.push([a.id, b.id]);
        }
      }
    }
  }
  return edges;
}

export type DrawOutcome =
  | { ok: true; count: number }
  | { ok: false; error: "wrong_status" | "no_solution"; reasons?: DrawFailure[]; groups?: Record<string, string> };

async function loadDrawContext(campaignId: string) {
  const campaign = await db.campaign.findUniqueOrThrow({ where: { id: campaignId } });
  const participants = await db.participant.findMany({
    where: { campaignId, status: "joined" },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
  const rules = await db.exclusionRule.findMany({ where: { campaignId } });
  const pairs = await db.previousPair.findMany({ where: { organizationId: campaign.organizationId } });
  const previous = new Set(pairs.map((p) => `${p.giverHash}>${p.receiverHash}`));
  const plan = planFor(campaign.tier);
  const effective = {
    ...campaign,
    excludeSameDepartment: plan.exclusionRules && campaign.excludeSameDepartment,
    excludePreviousYear: plan.exclusionRules && campaign.excludePreviousYear,
  };
  const activeRules = plan.exclusionRules ? rules : [];
  const forbidden = buildForbiddenEdges(effective, participants, activeRules, previous, campaign.organizationId);
  return { campaign, participants, forbidden, effective };
}

/** Führt die Ziehung durch (Aktion muss `open` sein). Gibt die Paare nie zurück. */
export async function runDraw(campaignId: string): Promise<DrawOutcome> {
  const { campaign, participants, forbidden, effective } = await loadDrawContext(campaignId);
  if (campaign.status !== "open") return { ok: false, error: "wrong_status" };

  const ids = participants.map((p) => p.id);
  const result = drawCycle(ids, forbidden);
  if (!result.ok) {
    const groups = new Map(participants.map((p) => [p.id, p.user.department]));
    const reasons = diagnose(ids, forbidden, groups, effective.excludeSameDepartment);
    const names: Record<string, string> = {};
    for (const p of participants) names[p.id] = p.user.name ?? p.user.email;
    return { ok: false, error: "no_solution", reasons, groups: names };
  }

  const purgeAt = new Date(campaign.revealAt.getTime() + campaign.deleteAfterDays * 86_400_000);
  await db.$transaction([
    db.assignment.deleteMany({ where: { campaignId } }),
    db.assignment.createMany({
      data: [...result.pairs].map(([giverId, receiverId]) => ({ campaignId, giverId, receiverId })),
    }),
    db.campaign.update({
      where: { id: campaignId },
      data: { status: "drawn", drawnAt: new Date(), purgeAt },
    }),
  ]);
  return { ok: true, count: ids.length };
}

export type Feasibility = { ok: true; count: number } | { ok: false; reasons: DrawFailure[]; names: Record<string, string> };

/** Probeziehung ohne Speicherung: sagt dem Admin, ob die Regeln erfüllbar sind (verrät keine Paare). */
export async function checkDrawFeasibility(campaignId: string): Promise<Feasibility> {
  const { participants, forbidden, effective } = await loadDrawContext(campaignId);
  const ids = participants.map((p) => p.id);
  const result = drawCycle(ids, forbidden, { timeoutMs: 800 });
  if (result.ok) return { ok: true, count: ids.length };
  const groups = new Map(participants.map((p) => [p.id, p.user.department]));
  const names: Record<string, string> = {};
  for (const p of participants) names[p.id] = p.user.name ?? p.user.email;
  return { ok: false, reasons: diagnose(ids, forbidden, groups, effective.excludeSameDepartment), names };
}

/**
 * Nachzügler nach der Ziehung: fügt den Teilnehmer in den Zyklus ein.
 * Gibt false zurück, wenn keine regelkonforme Stelle existiert.
 */
export async function insertLateJoiner(campaignId: string, participantId: string): Promise<boolean> {
  const { participants, forbidden } = await loadDrawContext(campaignId);
  const current = await db.assignment.findMany({ where: { campaignId } });
  if (current.some((a) => a.giverId === participantId || a.receiverId === participantId)) return true;
  const pairs = new Map(current.map((a) => [a.giverId, a.receiverId]));
  const known = new Set(participants.map((p) => p.id));
  if (!known.has(participantId)) return false;
  const next = insertIntoCycle(pairs, participantId, forbidden);
  if (!next) return false;

  // Einfügestelle ermitteln: nur geänderte/neue Zeilen schreiben.
  const giverOfNew = [...next].find(([, r]) => r === participantId)![0];
  const receiverOfNew = next.get(participantId)!;
  await db.$transaction([
    db.assignment.update({
      where: { campaignId_giverId: { campaignId, giverId: giverOfNew } },
      data: { receiverId: participantId },
    }),
    db.assignment.create({ data: { campaignId, giverId: participantId, receiverId: receiverOfNew } }),
    db.participant.update({ where: { id: participantId }, data: { lateJoiner: true } }),
  ]);
  return true;
}

/** Anzahl der vorhandenen Zuordnungen (ohne Inhalt) – für Statusanzeigen. */
export async function countAssignments(campaignId: string): Promise<number> {
  return db.assignment.count({ where: { campaignId } });
}

// ---------------------------------------------------------------------------
// Teilnehmer-Sicht (nur eigene Zeile)
// ---------------------------------------------------------------------------

export interface MyReceiver {
  assignmentId: string;
  name: string;
  department: string | null;
  wishlist: { text: string; links: string[]; tags: string[]; noGos: string } | null;
  shippingAddress: string | null;
}

/** Wen beschenke ich? Nur für den eingeloggten Teilnehmer selbst. */
export async function getMyReceiver(participantId: string): Promise<MyReceiver | null> {
  const a = await db.assignment.findFirst({
    where: { giverId: participantId },
    include: { receiver: { include: { user: true, wishlist: true, campaign: true } } },
  });
  if (!a) return null;
  const { receiver } = a;
  const needsAddress = receiver.campaign.mode !== "onsite";
  return {
    assignmentId: a.id,
    name: receiver.user.name ?? receiver.user.email,
    department: receiver.user.department,
    wishlist: receiver.wishlist
      ? { text: receiver.wishlist.text, links: receiver.wishlist.links, tags: receiver.wishlist.tags, noGos: receiver.wishlist.noGos }
      : null,
    shippingAddress: needsAddress && receiver.shippingAddressEnc ? decrypt(receiver.shippingAddressEnc) : null,
  };
}

export async function hasBeenDrawn(participantId: string): Promise<boolean> {
  return (await db.assignment.count({ where: { giverId: participantId } })) > 0;
}

// ---------------------------------------------------------------------------
// Anonymer Chat
// ---------------------------------------------------------------------------

export type ChatSide = "giver" | "receiver";

/** Findet die Zuordnung und die Rolle des Teilnehmers für den Chat. */
async function resolveThread(participantId: string, side: ChatSide) {
  const a = await db.assignment.findFirst({
    where: side === "giver" ? { giverId: participantId } : { receiverId: participantId },
    include: { campaign: { select: { status: true } } },
  });
  if (!a || a.campaign.status === "closed") return null;
  return a;
}

export interface ChatMessage {
  id: string;
  mine: boolean;
  body: string;
  createdAt: Date;
}

export async function getChat(participantId: string, side: ChatSide): Promise<{ assignmentId: string; messages: ChatMessage[] } | null> {
  const a = await resolveThread(participantId, side);
  if (!a) return null;
  const msgs = await db.message.findMany({ where: { assignmentId: a.id }, orderBy: { createdAt: "asc" }, take: 500 });
  await db.message.updateMany({
    where: { assignmentId: a.id, senderRole: side === "giver" ? "receiver" : "giver", readAt: null },
    data: { readAt: new Date() },
  });
  return {
    assignmentId: a.id,
    messages: msgs.map((m) => ({ id: m.id, mine: m.senderRole === side, body: m.body, createdAt: m.createdAt })),
  };
}

export interface SentMessage {
  /** Empfänger der Benachrichtigung (nie dem Absender offenbaren). */
  recipient: { email: string; name: string | null; locale: string };
  campaignTitle: string;
  campaignId: string;
  /** Aus Sicht des Empfängers: antwortet sein Wichtel oder sein Beschenkter? */
  recipientSide: ChatSide;
  /** false, wenn bereits eine ungelesene Nachricht wartet (keine Mail-Flut). */
  notify: boolean;
}

export async function sendChatMessage(participantId: string, side: ChatSide, body: string): Promise<SentMessage | null> {
  const a = await resolveThread(participantId, side);
  if (!a) return null;
  const text = body.trim().slice(0, 2000);
  if (!text) return null;
  const senderRole: SenderRole = side;
  const hadUnread = (await db.message.count({ where: { assignmentId: a.id, senderRole, readAt: null } })) > 0;
  await db.message.create({ data: { assignmentId: a.id, senderRole, body: text } });

  const recipientId = side === "giver" ? a.receiverId : a.giverId;
  const recipient = await db.participant.findUniqueOrThrow({
    where: { id: recipientId },
    include: { user: true, campaign: true },
  });
  return {
    recipient: { email: recipient.user.email, name: recipient.user.name, locale: recipient.user.locale },
    campaignTitle: recipient.campaign.title,
    campaignId: recipient.campaignId,
    recipientSide: side === "giver" ? "receiver" : "giver",
    notify: !hadUnread,
  };
}

/** Ungelesene Nachrichten für den Teilnehmer, getrennt nach Thread. */
export async function unreadCounts(participantId: string): Promise<{ asGiver: number; asReceiver: number }> {
  const [asGiver, asReceiver] = await Promise.all([
    db.message.count({ where: { readAt: null, senderRole: "receiver", assignment: { giverId: participantId } } }),
    db.message.count({ where: { readAt: null, senderRole: "giver", assignment: { receiverId: participantId } } }),
  ]);
  return { asGiver, asReceiver };
}

// ---------------------------------------------------------------------------
// Reveal
// ---------------------------------------------------------------------------

export interface RevealPair {
  assignmentId: string;
  giver: string;
  receiver: string;
  revealedAt: Date | null;
}

/** Bereits aufgedeckte Paare. Vor dem Reveal leer, auch für Admins. */
export async function listRevealed(campaignId: string): Promise<{ pairs: RevealPair[]; total: number }> {
  const campaign = await db.campaign.findUniqueOrThrow({ where: { id: campaignId }, select: { status: true } });
  if (campaign.status !== "revealed" && campaign.status !== "closed") return { pairs: [], total: 0 };
  const [rows, total] = await Promise.all([
    db.assignment.findMany({
      where: { campaignId, revealed: true },
      include: { giver: { include: { user: true } }, receiver: { include: { user: true } } },
      orderBy: { revealedAt: "asc" },
    }),
    db.assignment.count({ where: { campaignId } }),
  ]);
  return {
    total,
    pairs: rows.map((r) => ({
      assignmentId: r.id,
      giver: r.giver.user.name ?? r.giver.user.email,
      receiver: r.receiver.user.name ?? r.receiver.user.email,
      revealedAt: r.revealedAt,
    })),
  };
}

/** Deckt das nächste Paar zufällig auf. Gibt false zurück, wenn alle aufgedeckt sind. */
export async function revealNext(campaignId: string): Promise<boolean> {
  const campaign = await db.campaign.findUniqueOrThrow({ where: { id: campaignId }, select: { status: true } });
  if (campaign.status !== "revealed") return false;
  const rest = await db.assignment.findMany({ where: { campaignId, revealed: false }, select: { id: true } });
  if (rest.length === 0) return false;
  const pick = rest[Math.floor(Math.random() * rest.length)];
  await db.assignment.update({ where: { id: pick.id }, data: { revealed: true, revealedAt: new Date() } });
  return true;
}

export async function revealAll(campaignId: string): Promise<void> {
  const campaign = await db.campaign.findUniqueOrThrow({ where: { id: campaignId }, select: { status: true } });
  if (campaign.status !== "revealed") return;
  await db.assignment.updateMany({ where: { campaignId, revealed: false }, data: { revealed: true, revealedAt: new Date() } });
}

/** Wer war mein Wichtel? Erst sichtbar, wenn das Paar aufgedeckt wurde. */
export async function getMyRevealedGiver(participantId: string): Promise<string | null> {
  const a = await db.assignment.findFirst({
    where: { receiverId: participantId, revealed: true },
    include: { giver: { include: { user: true } } },
  });
  return a ? (a.giver.user.name ?? a.giver.user.email) : null;
}

// ---------------------------------------------------------------------------
// V2: „Wer war's?“ und Gutscheine (benötigen die Zuordnung)
// ---------------------------------------------------------------------------

export interface GuessResult {
  total: number;
  correct: number;
  /** Eigener Tipp (nur für den Tippenden). */
  mine: { guessedName: string; correct: boolean } | null;
}

export async function getGuessResult(campaignId: string, participantId: string): Promise<GuessResult> {
  const votes = await db.guessVote.findMany({ where: { campaignId } });
  const assignments = await db.assignment.findMany({ where: { campaignId }, select: { giverId: true, receiverId: true } });
  const giverOf = new Map(assignments.map((a) => [a.receiverId, a.giverId]));
  const correct = votes.filter((v) => giverOf.get(v.guesserId) === v.guessedGiverId).length;
  const mineVote = votes.find((v) => v.guesserId === participantId);
  let mine: GuessResult["mine"] = null;
  if (mineVote) {
    const guessed = await db.participant.findUnique({ where: { id: mineVote.guessedGiverId }, include: { user: true } });
    mine = {
      guessedName: guessed?.user.name ?? guessed?.user.email ?? "?",
      correct: giverOf.get(participantId) === mineVote.guessedGiverId,
    };
  }
  return { total: votes.length, correct, mine };
}

/** Tipp-Abgabe: ein Tipp pro Teilnehmer; man kann sich nicht selbst tippen. */
export async function submitGuess(campaignId: string, guesserId: string, guessedGiverId: string): Promise<boolean> {
  if (guesserId === guessedGiverId) return false;
  const assignment = await db.assignment.findFirst({ where: { campaignId, receiverId: guesserId } });
  if (!assignment) return false;
  const candidate = await db.participant.findFirst({ where: { id: guessedGiverId, campaignId, status: "joined" } });
  if (!candidate) return false;
  await db.guessVote.upsert({
    where: { campaignId_guesserId: { campaignId, guesserId } },
    create: { campaignId, guesserId, guessedGiverId },
    update: { guessedGiverId },
  });
  return true;
}

export interface VoucherView {
  provider: string;
  amountCents: number;
  code: string;
}

/** Wichtel hinterlegt den Gutschein für seinen Beschenkten. */
export async function saveVoucher(participantId: string, input: { provider: string; amountCents: number; code: string }): Promise<boolean> {
  const a = await db.assignment.findFirst({ where: { giverId: participantId }, include: { campaign: true } });
  if (!a || !a.campaign.vouchersEnabled) return false;
  if (input.amountCents <= 0 || input.amountCents > a.campaign.budgetCents * 2) return false;
  const data = {
    campaignId: a.campaignId,
    provider: input.provider.slice(0, 80),
    amountCents: input.amountCents,
    codeEnc: encrypt(input.code.slice(0, 500)),
  };
  await db.voucher.upsert({ where: { assignmentId: a.id }, create: { ...data, assignmentId: a.id }, update: data });
  return true;
}

export async function getMyGivenVoucher(participantId: string): Promise<Omit<VoucherView, "code"> | null> {
  const v = await db.voucher.findFirst({ where: { assignment: { giverId: participantId } } });
  return v ? { provider: v.provider, amountCents: v.amountCents } : null;
}

/** Empfänger sieht den Gutschein erst nach dem Aufdecken des Paars. */
export async function getMyReceivedVoucher(participantId: string): Promise<VoucherView | null> {
  const v = await db.voucher.findFirst({
    where: { assignment: { receiverId: participantId, revealed: true } },
  });
  return v ? { provider: v.provider, amountCents: v.amountCents, code: decrypt(v.codeEnc) } : null;
}

// ---------------------------------------------------------------------------
// Abschluss
// ---------------------------------------------------------------------------

/** Speichert die Paare pseudonymisiert als Vorjahres-Paare (Ausschlussregel im nächsten Jahr). */
export async function archivePairs(campaignId: string): Promise<number> {
  const campaign = await db.campaign.findUniqueOrThrow({ where: { id: campaignId } });
  const rows = await db.assignment.findMany({
    where: { campaignId },
    include: { giver: { include: { user: true } }, receiver: { include: { user: true } } },
  });
  const year = (campaign.revealedAt ?? campaign.revealAt).getFullYear();
  await db.previousPair.deleteMany({ where: { organizationId: campaign.organizationId, year } });
  await db.previousPair.createMany({
    data: rows.map((r) => ({
      organizationId: campaign.organizationId,
      giverHash: pseudonym(r.giver.user.email, campaign.organizationId),
      receiverHash: pseudonym(r.receiver.user.email, campaign.organizationId),
      year,
    })),
  });
  return rows.length;
}

/** Löscht alle personenbezogenen Daten einer Aktion (Zuordnung, Chat, Wunschzettel, Adressen …). */
export async function purgeCampaignData(campaignId: string): Promise<void> {
  await db.$transaction([
    db.message.deleteMany({ where: { assignment: { campaignId } } }),
    db.voucher.deleteMany({ where: { campaignId } }),
    db.guessVote.deleteMany({ where: { campaignId } }),
    db.assignment.deleteMany({ where: { campaignId } }),
  ]);
}
