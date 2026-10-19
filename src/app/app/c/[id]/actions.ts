"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrgUser } from "@/lib/access";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { flashUrl } from "@/components/flash";
import { appUrl } from "@/lib/mail";
import { rateLimit } from "@/lib/rate-limit";
import { mailUser } from "@/lib/notifications";
import {
  getChat,
  saveVoucher,
  sendChatMessage,
  submitGuess,
  type ChatSide,
} from "@/lib/data/assignments";
import { declineParticipation } from "@/lib/participation";

async function myParticipant(campaignId: string) {
  const user = await requireOrgUser(`/app/c/${campaignId}`);
  const participant = await db.participant.findUnique({
    where: { campaignId_userId: { campaignId, userId: user.id } },
    include: { campaign: true },
  });
  if (!participant || participant.status !== "joined" || participant.campaign.organizationId !== user.organizationId) {
    redirect("/app");
  }
  return { user, participant };
}

const here = (id: string) => `/app/c/${id}`;

function lines(value: FormDataEntryValue | null, max: number, itemMax: number): string[] {
  return String(value ?? "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.slice(0, itemMax))
    .slice(0, max);
}

const linkSchema = z.string().url().refine((u) => /^https?:\/\//i.test(u));

export async function saveWishlist(formData: FormData) {
  const id = String(formData.get("id"));
  const { participant } = await myParticipant(id);
  if (participant.campaign.status === "closed") redirect(flashUrl(here(id), "err", "locked"));
  const links = lines(formData.get("links"), 10, 500).filter((l) => linkSchema.safeParse(l).success);
  const data = {
    text: String(formData.get("text") ?? "").slice(0, 3000),
    links,
    tags: lines(formData.get("tags"), 15, 40).map((s) => s.toLowerCase()),
    noGos: String(formData.get("noGos") ?? "").slice(0, 500),
  };
  await db.wishlist.upsert({ where: { participantId: participant.id }, create: { participantId: participant.id, ...data }, update: data });
  redirect(flashUrl(here(id), "ok", "wishlist_saved"));
}

export async function saveAddress(formData: FormData) {
  const id = String(formData.get("id"));
  const { participant } = await myParticipant(id);
  if (participant.campaign.mode === "onsite") redirect(here(id));
  const address = String(formData.get("address") ?? "").trim().slice(0, 500);
  await db.participant.update({
    where: { id: participant.id },
    data: { shippingAddressEnc: address ? encrypt(address) : null },
  });
  redirect(flashUrl(here(id), "ok", "address_saved"));
}

export async function leaveCampaign(formData: FormData) {
  const id = String(formData.get("id"));
  const { user } = await myParticipant(id);
  await declineParticipation(user.id, id);
  redirect(flashUrl("/app", "ok", "left"));
}

// --- Chat (Aufruf aus dem Client-Component) -------------------------------

export interface ChatDto {
  messages: { id: string; mine: boolean; body: string; at: string }[];
}

export async function loadChat(campaignId: string, side: ChatSide): Promise<ChatDto> {
  const { participant } = await myParticipant(campaignId);
  const chat = await getChat(participant.id, side);
  return {
    messages: (chat?.messages ?? []).map((m) => ({ id: m.id, mine: m.mine, body: m.body, at: m.createdAt.toISOString() })),
  };
}

export async function postChat(campaignId: string, side: ChatSide, body: string): Promise<ChatDto> {
  const { user, participant } = await myParticipant(campaignId);
  if (!rateLimit(`chat:${user.id}`, 30, 60_000)) return loadChat(campaignId, side);
  const sent = await sendChatMessage(participant.id, side, body);
  if (sent?.notify) {
    // Nur ein Hinweis ohne Inhalt und ohne Identität des Absenders.
    await mailUser(sent.recipient, "chat", { title: sent.campaignTitle }, appUrl(here(sent.campaignId))).catch(console.error);
  }
  return loadChat(campaignId, side);
}

// --- V2 -------------------------------------------------------------------

export async function guessAction(formData: FormData) {
  const id = String(formData.get("id"));
  const { participant } = await myParticipant(id);
  if (!participant.campaign.guessGameEnabled || participant.campaign.status === "closed") redirect(here(id));
  const ok = await submitGuess(id, participant.id, String(formData.get("guess")));
  redirect(flashUrl(here(id), ok ? "ok" : "err", ok ? "guess_saved" : "invalid"));
}

export async function voucherAction(formData: FormData) {
  const id = String(formData.get("id"));
  const { participant } = await myParticipant(id);
  const amount = Math.round(Number(String(formData.get("amount") ?? "").replace(",", ".")) * 100);
  const ok = await saveVoucher(participant.id, {
    provider: String(formData.get("provider") ?? "").trim(),
    amountCents: amount,
    code: String(formData.get("code") ?? "").trim(),
  });
  redirect(flashUrl(here(id), ok ? "ok" : "err", ok ? "voucher_saved" : "invalid"));
}

export async function feedbackAction(formData: FormData) {
  const id = String(formData.get("id"));
  const { participant } = await myParticipant(id);
  const c = participant.campaign;
  if ((c.status !== "revealed" && c.status !== "closed") || participant.feedbackGiven) redirect(here(id));
  const rating = Math.min(5, Math.max(1, Number(formData.get("rating")) || 0));
  if (!rating) redirect(flashUrl(here(id), "err", "invalid"));
  const comment = String(formData.get("comment") ?? "").trim().slice(0, 1000) || null;
  await db.$transaction([
    db.feedback.create({ data: { campaignId: id, rating, comment } }),
    db.participant.update({ where: { id: participant.id }, data: { feedbackGiven: true } }),
  ]);
  redirect(flashUrl(here(id), "ok", "feedback_saved"));
}
