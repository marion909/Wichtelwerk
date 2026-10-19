"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/access";
import { db } from "@/lib/db";

const schema = z.object({
  organization: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(120),
  uid: z
    .string()
    .trim()
    .max(20)
    .regex(/^([A-Z]{2}[A-Z0-9]{2,12})?$/i)
    .optional(),
});

/** Erster Nutzer einer Firma legt die Organisation an und wird Admin. */
export async function createOrganization(formData: FormData) {
  const user = await requireUser("/onboarding");
  if (user.organizationId) redirect("/admin");
  const parsed = schema.safeParse({
    organization: formData.get("organization"),
    name: formData.get("name"),
    uid: (formData.get("uid") as string | null)?.replace(/\s/g, "") || undefined,
  });
  if (!parsed.success) redirect("/onboarding?err=invalid");

  await db.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: { name: parsed.data.organization, uidNummer: parsed.data.uid?.toUpperCase() ?? null },
    });
    await tx.user.update({
      where: { id: user.id },
      data: { organizationId: org.id, name: parsed.data.name, role: "admin" },
    });
  });
  redirect("/admin/campaigns/new");
}
