"use server";

import { promises as dns } from "node:dns";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/access";
import { db } from "@/lib/db";
import { flashUrl } from "@/components/flash";
import { PLANS } from "@/lib/plans";
import { isAllowedWebhook, sendTestWebhook } from "@/lib/notify";
import { uploadDir } from "@/lib/uploads";

const SETTINGS = "/admin/settings";

export async function saveOrganization(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(120),
      uid: z.string().trim().max(20).regex(/^([A-Z]{2}[A-Z0-9]{2,12})?$/i),
    })
    .safeParse({ name: formData.get("name"), uid: String(formData.get("uid") ?? "").replace(/\s/g, "") });
  if (!parsed.success) redirect(flashUrl(SETTINGS, "err", "invalid"));
  await db.organization.update({
    where: { id: admin.organizationId },
    data: { name: parsed.data.name, uidNummer: parsed.data.uid ? parsed.data.uid.toUpperCase() : null },
  });
  redirect(flashUrl(SETTINGS, "ok", "saved"));
}

// --- Branding (Business+) ----------------------------------------------------

function sniffImage(buf: Buffer): "png" | "jpg" | "webp" | null {
  if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "webp";
  return null;
}

export async function saveBranding(formData: FormData) {
  const admin = await requireAdmin();
  if (!PLANS[admin.organization.plan].branding) redirect(flashUrl(SETTINGS, "err", "upgrade"));
  const color = String(formData.get("brandColor") ?? "").trim();
  if (color && !/^#[0-9a-f]{6}$/i.test(color)) redirect(flashUrl(SETTINGS, "err", "invalid"));

  const data: { brandColor: string | null; logoUrl?: string | null } = { brandColor: color || null };
  const file = formData.get("logo");
  if (file instanceof File && file.size > 0) {
    if (file.size > 512 * 1024) redirect(flashUrl(SETTINGS, "err", "file_size"));
    const buf = Buffer.from(await file.arrayBuffer());
    const ext = sniffImage(buf);
    if (!ext) redirect(flashUrl(SETTINGS, "err", "file_type"));
    await mkdir(uploadDir(), { recursive: true });
    const name = `${admin.organizationId}.${ext}`;
    await writeFile(path.join(uploadDir(), name), buf);
    data.logoUrl = name;
  }
  if (formData.get("removeLogo") === "on") data.logoUrl = null;
  await db.organization.update({ where: { id: admin.organizationId }, data });
  redirect(flashUrl(SETTINGS, "ok", "saved"));
}

// --- Slack / Teams ------------------------------------------------------------

export async function saveWebhooks(formData: FormData) {
  const admin = await requireAdmin();
  const slack = String(formData.get("slack") ?? "").trim();
  const teams = String(formData.get("teams") ?? "").trim();
  if ((slack && !isAllowedWebhook("slack", slack)) || (teams && !isAllowedWebhook("teams", teams))) {
    redirect(flashUrl(SETTINGS, "err", "invalid_webhook"));
  }
  await db.organization.update({
    where: { id: admin.organizationId },
    data: { slackWebhookUrl: slack || null, teamsWebhookUrl: teams || null },
  });
  if (formData.get("test") === "on") {
    try {
      if (slack) await sendTestWebhook("slack", slack);
      if (teams) await sendTestWebhook("teams", teams);
    } catch {
      redirect(flashUrl(SETTINGS, "err", "webhook_failed"));
    }
  }
  redirect(flashUrl(SETTINGS, "ok", "saved"));
}

// --- SSO (Enterprise) ---------------------------------------------------------

const domainRe = /^(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/;

export async function addSsoDomain(formData: FormData) {
  const admin = await requireAdmin();
  if (!PLANS[admin.organization.plan].sso) redirect(flashUrl(SETTINGS, "err", "upgrade"));
  const domain = String(formData.get("domain") ?? "").trim().toLowerCase().replace(/^@/, "");
  const tenant = String(formData.get("tenant") ?? "").trim();
  if (!domainRe.test(domain) || (tenant && !/^[0-9a-f-]{36}$/i.test(tenant))) redirect(flashUrl(SETTINGS, "err", "invalid"));
  const existing = await db.ssoDomain.findUnique({ where: { domain } });
  if (existing && existing.organizationId !== admin.organizationId) redirect(flashUrl(SETTINGS, "err", "domain_taken"));
  if (existing) {
    await db.ssoDomain.update({ where: { id: existing.id }, data: { entraTenantId: tenant || null } });
  } else {
    await db.ssoDomain.create({
      data: { organizationId: admin.organizationId, domain, verifyToken: randomBytes(16).toString("hex"), entraTenantId: tenant || null },
    });
  }
  redirect(flashUrl(SETTINGS, "ok", "saved"));
}

export async function verifySsoDomain(formData: FormData) {
  const admin = await requireAdmin();
  const d = await db.ssoDomain.findFirst({ where: { id: String(formData.get("id")), organizationId: admin.organizationId } });
  if (!d) redirect(SETTINGS);
  let ok = false;
  try {
    const records = await dns.resolveTxt(`_wichtelwerk.${d.domain}`);
    ok = records.some((parts) => parts.join("") === `wichtelwerk-verify=${d.verifyToken}`);
  } catch {
    ok = false;
  }
  if (!ok) redirect(flashUrl(SETTINGS, "err", "dns_failed"));
  await db.ssoDomain.update({ where: { id: d.id }, data: { verifiedAt: new Date() } });
  redirect(flashUrl(SETTINGS, "ok", "domain_verified"));
}

export async function removeSsoDomain(formData: FormData) {
  const admin = await requireAdmin();
  await db.ssoDomain.deleteMany({ where: { id: String(formData.get("id")), organizationId: admin.organizationId } });
  redirect(flashUrl(SETTINGS, "ok", "saved"));
}
