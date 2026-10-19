import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { getT } from "@/lib/i18n/server";
import { setLocaleAction, signOutAction } from "@/lib/actions-common";
import { isManager, type SessionUser } from "@/lib/access";
import { atLeast } from "@/lib/plans";

export async function LocaleSwitch({ back = "/" }: { back?: string }) {
  const { locale } = await getT();
  const other = locale === "de" ? "en" : "de";
  return (
    <form action={setLocaleAction}>
      <input type="hidden" name="locale" value={other} />
      <input type="hidden" name="back" value={back} />
      <button className="rounded-lg px-2 py-1 text-xs font-bold uppercase text-muted hover:bg-line/50" aria-label={`Sprache: ${other}`}>
        {other}
      </button>
    </form>
  );
}

export function Logo({ height = 36 }: { height?: number }) {
  return (
    <Image
      src="/brand/wichtelwerk-logo.png"
      alt="Wichtelwerk"
      width={Math.round((height * 1360) / 416)}
      height={height}
      priority
    />
  );
}

/** Rahmen für angemeldete Bereiche; wendet das Firmen-Branding an (Business+). */
export async function PortalShell({ user, children, back = "/app" }: { user: SessionUser; children: ReactNode; back?: string }) {
  const { t } = await getT();
  const org = user.organization;
  const branded = org && atLeast(org.plan, "business");
  const brandColor = branded && org.brandColor && /^#[0-9a-f]{6}$/i.test(org.brandColor) ? org.brandColor : null;

  return (
    <div className="flex min-h-screen flex-col" style={brandColor ? ({ "--brand": brandColor } as React.CSSProperties) : undefined}>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href={isManager(user.role) ? "/admin" : "/app"} className="flex items-center gap-3" aria-label="Wichtelwerk">
            {branded && org.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/org-logo/${org.id}`} alt={org.name} className="h-9 w-auto max-w-40 object-contain" />
            ) : (
              <Logo height={32} />
            )}
          </Link>
          <nav className="flex flex-1 flex-wrap items-center gap-1 text-sm font-bold">
            <Link href="/app" className="rounded-lg px-3 py-1.5 hover:bg-cream">{t("nav.mine")}</Link>
            {isManager(user.role) && (
              <>
                <Link href="/admin" className="rounded-lg px-3 py-1.5 hover:bg-cream">{t("nav.admin")}</Link>
                {user.role === "admin" && (
                  <>
                    <Link href="/admin/team" className="rounded-lg px-3 py-1.5 hover:bg-cream">{t("nav.team")}</Link>
                    <Link href="/admin/settings" className="rounded-lg px-3 py-1.5 hover:bg-cream">{t("nav.settings")}</Link>
                  </>
                )}
              </>
            )}
          </nav>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-muted sm:inline">{user.name ?? user.email}</span>
            <LocaleSwitch back={back} />
            <form action={signOutAction}>
              <button className="btn-ghost !py-1.5">{t("nav.logout")}</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-line py-5 text-center text-xs text-muted">
        <Link href="/impressum" className="hover:underline">{t("legal.imprint")}</Link>
        {" · "}
        <Link href="/datenschutz" className="hover:underline">{t("legal.privacy")}</Link>
        {" · "}
        <Link href="/avv" className="hover:underline">{t("legal.dpa")}</Link>
      </footer>
    </div>
  );
}

/** Rahmen für öffentliche Seiten. */
export async function PublicShell({ children, back = "/" }: { children: ReactNode; back?: string }) {
  const { t } = await getT();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" aria-label="Wichtelwerk"><Logo height={36} /></Link>
        <div className="flex items-center gap-2">
          <LocaleSwitch back={back} />
          <Link href="/login" className="btn-ghost">{t("nav.login")}</Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t border-line py-6 text-center text-xs text-muted">
        <Link href="/impressum" className="hover:underline">{t("legal.imprint")}</Link>
        {" · "}
        <Link href="/datenschutz" className="hover:underline">{t("legal.privacy")}</Link>
        {" · "}
        <Link href="/avv" className="hover:underline">{t("legal.dpa")}</Link>
        <p className="mt-2">© Wichtelwerk · {t("legal.hosting")}</p>
      </footer>
    </div>
  );
}
