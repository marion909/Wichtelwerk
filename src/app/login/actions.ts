"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn } from "@/auth";
import { clientIp, safeNext } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const emailSchema = z.string().trim().toLowerCase().email().max(200);

export async function requestLoginLink(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) redirect(`/login?err=email&next=${encodeURIComponent(next)}`);
  const email = parsed.data;
  const ip = await clientIp();
  if (!rateLimit(`login:ip:${ip}`, 20, 15 * 60_000) || !rateLimit(`login:mail:${email}`, 5, 15 * 60_000)) {
    redirect(`/login?err=rate&next=${encodeURIComponent(next)}`);
  }
  await signIn("nodemailer", { email, redirect: false, redirectTo: next });
  redirect(`/login/check?email=${encodeURIComponent(email)}`);
}

export async function ssoLogin(formData: FormData) {
  const provider = String(formData.get("provider"));
  if (provider !== "google" && provider !== "microsoft-entra-id") redirect("/login");
  await signIn(provider, { redirectTo: safeNext(formData.get("next")) });
}
