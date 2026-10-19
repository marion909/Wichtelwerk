"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn } from "@/auth";
import { requireUser } from "@/lib/access";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { confirmParticipation, declineParticipation, inviteUser } from "@/lib/participation";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  department: z.string().trim().max(80).optional(),
});

/** Schritt 1: Name + E-Mail → Magic Link. Die Teilnahme wird erst nach dem Login bestätigt. */
export async function requestJoin(formData: FormData) {
  const token = String(formData.get("token"));
  const here = `/join/${token}`;
  const campaign = await db.campaign.findUnique({ where: { inviteToken: token } });
  if (!campaign) redirect("/");
  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    department: formData.get("department") || undefined,
  });
  if (!parsed.success) redirect(`${here}?err=invalid`);
  const ip = await clientIp();
  if (!rateLimit(`join:ip:${ip}`, 15, 15 * 60_000) || !rateLimit(`join:mail:${parsed.data.email}`, 4, 15 * 60_000)) {
    redirect(`${here}?err=rate`);
  }
  const res = await inviteUser(campaign, parsed.data, { notify: false });
  if ("error" in res) redirect(`${here}?err=other_org`);
  await signIn("nodemailer", { email: parsed.data.email, redirect: false, redirectTo: here });
  redirect(`/login/check?email=${encodeURIComponent(parsed.data.email)}`);
}

/** Schritt 2 (angemeldet): Teilnahme bestätigen. */
export async function confirmJoin(formData: FormData) {
  const token = String(formData.get("token"));
  const here = `/join/${token}`;
  const user = await requireUser(here);
  const campaign = await db.campaign.findUnique({ where: { inviteToken: token } });
  if (!campaign) redirect("/");
  if (!user.organizationId) {
    await db.user.update({ where: { id: user.id }, data: { organizationId: campaign.organizationId } });
  }
  const res = await confirmParticipation(user.id, campaign.id);
  if (!res.ok) redirect(`${here}?err=${res.error}`);
  redirect(`/app/c/${campaign.id}?ok=joined`);
}

export async function declineJoin(formData: FormData) {
  const token = String(formData.get("token"));
  const user = await requireUser(`/join/${token}`);
  const campaign = await db.campaign.findUnique({ where: { inviteToken: token } });
  if (!campaign || user.organizationId !== campaign.organizationId) redirect("/");
  await declineParticipation(user.id, campaign.id);
  redirect(`/join/${token}?ok=declined`);
}
