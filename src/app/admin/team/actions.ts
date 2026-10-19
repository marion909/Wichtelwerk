"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/access";
import { db } from "@/lib/db";
import { flashUrl } from "@/components/flash";
import { appUrl } from "@/lib/mail";
import { mailUser } from "@/lib/notifications";
import { PLANS } from "@/lib/plans";

const TEAM = "/admin/team";

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(["admin", "location_admin"]),
  locations: z.string().optional(),
});

export async function inviteManager(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
    locations: String(formData.get("locations") ?? ""),
  });
  if (!parsed.success) redirect(flashUrl(TEAM, "err", "invalid"));
  const locations = (parsed.data.locations ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20);
  if (parsed.data.role === "location_admin") {
    if (!PLANS[admin.organization.plan].multiLocation) redirect(flashUrl(TEAM, "err", "upgrade"));
    if (locations.length === 0) redirect(flashUrl(TEAM, "err", "invalid"));
  }
  const invite = await db.adminInvite.create({
    data: {
      organizationId: admin.organizationId,
      email: parsed.data.email,
      role: parsed.data.role,
      locations: parsed.data.role === "location_admin" ? locations : [],
      token: randomBytes(24).toString("base64url"),
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
    },
  });
  await mailUser(
    { email: invite.email, locale: admin.locale },
    "admin_invite",
    { org: admin.organization.name, inviter: admin.name ?? admin.email },
    appUrl(`/invite/${invite.token}`),
  );
  redirect(flashUrl(TEAM, "ok", "invite_sent"));
}

export async function revokeInvite(formData: FormData) {
  const admin = await requireAdmin();
  await db.adminInvite.deleteMany({ where: { id: String(formData.get("id")), organizationId: admin.organizationId } });
  redirect(flashUrl(TEAM, "ok", "saved"));
}

export async function demoteManager(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  if (id === admin.id) redirect(flashUrl(TEAM, "err", "self"));
  await db.user.updateMany({
    where: { id, organizationId: admin.organizationId },
    data: { role: "member", managedLocations: [] },
  });
  redirect(flashUrl(TEAM, "ok", "saved"));
}

export async function updateLocations(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const locations = String(formData.get("locations") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20);
  if (locations.length === 0) redirect(flashUrl(TEAM, "err", "invalid"));
  await db.user.updateMany({
    where: { id, organizationId: admin.organizationId, role: "location_admin" },
    data: { managedLocations: locations },
  });
  redirect(flashUrl(TEAM, "ok", "saved"));
}
