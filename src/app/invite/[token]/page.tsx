import { redirect } from "next/navigation";
import { requireUser } from "@/lib/access";
import { db } from "@/lib/db";
import { PublicShell } from "@/components/shell";
import { SubmitButton } from "@/components/ui";
import { Flash, type SearchParams } from "@/components/flash";
import { getT } from "@/lib/i18n/server";

async function acceptInvite(formData: FormData) {
  "use server";
  const token = String(formData.get("token"));
  const user = await requireUser(`/invite/${token}`);
  const invite = await db.adminInvite.findUnique({ where: { token } });
  const back = `/invite/${token}`;
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) redirect(`${back}?err=invite_invalid`);
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) redirect(`${back}?err=invite_email`);
  if (user.organizationId && user.organizationId !== invite.organizationId) redirect(`${back}?err=other_org`);
  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: { organizationId: invite.organizationId, role: invite.role, managedLocations: invite.locations },
    }),
    db.adminInvite.update({ where: { id: invite.id }, data: { usedAt: new Date() } }),
  ]);
  redirect("/admin");
}

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: SearchParams;
}) {
  const { token } = await params;
  const user = await requireUser(`/invite/${token}`);
  const invite = await db.adminInvite.findUnique({ where: { token }, include: { organization: true } });
  const { t } = await getT();
  const valid = invite && !invite.usedAt && invite.expiresAt > new Date();

  return (
    <PublicShell back={`/invite/${token}`}>
      <div className="card mx-auto max-w-md space-y-4 text-center">
        <Flash searchParams={searchParams} />
        {valid ? (
          <>
            <h1 className="text-xl font-extrabold text-green">{t("invite.title", { org: invite.organization.name })}</h1>
            <p className="text-sm text-muted">{t("invite.body", { role: t(`role.${invite.role}`), email: user.email })}</p>
            <form action={acceptInvite}>
              <input type="hidden" name="token" value={token} />
              <SubmitButton>{t("invite.accept")}</SubmitButton>
            </form>
          </>
        ) : (
          <p className="font-bold">{t("flash.invite_invalid")}</p>
        )}
      </div>
    </PublicShell>
  );
}
