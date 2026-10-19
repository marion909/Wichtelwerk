import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Nodemailer from "next-auth/providers/nodemailer";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { translate } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";

function emailDomain(email: string | null | undefined): string | null {
  const at = email?.lastIndexOf("@") ?? -1;
  return email && at > 0 ? email.slice(at + 1).toLowerCase() : null;
}

async function verifiedDomain(email: string | null | undefined) {
  const domain = emailDomain(email);
  if (!domain) return null;
  return db.ssoDomain.findFirst({ where: { domain, verifiedAt: { not: null } } });
}

export const ssoProviders = {
  microsoft: Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_ID),
  google: Boolean(process.env.AUTH_GOOGLE_ID),
};

const providers: Provider[] = [
  Nodemailer({
    server: { host: process.env.SMTP_HOST ?? "localhost" },
    from: process.env.MAIL_FROM ?? "Wichtelwerk <noreply@wichtelwerk.neuhauser.cloud>",
    maxAge: 60 * 30,
    async sendVerificationRequest({ identifier, url }) {
      let locale: "de" | "en" = "de";
      try {
        locale = await getLocale();
      } catch {
        // außerhalb eines Requests (z. B. Worker): Standardsprache
      }
      await sendMail({
        to: identifier,
        subject: translate(locale, "mail.login.subject"),
        text: translate(locale, "mail.login.body"),
        action: { label: translate(locale, "mail.login.action"), url },
      });
    },
  }),
];

if (ssoProviders.microsoft) {
  providers.push(
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      // Multi-Tenant: Der Tenant wird gegen die verifizierte Domain geprüft (siehe signIn).
      issuer: "https://login.microsoftonline.com/organizations/v2.0",
      allowDangerousEmailAccountLinking: true,
    }),
  );
}
if (ssoProviders.google) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login", verifyRequest: "/login/check", error: "/login" },
  trustHost: true,
  callbacks: {
    async signIn({ account, profile, user }) {
      if (!account || account.type === "email") return true;
      // SSO nur für Firmen mit verifizierter Domain.
      const sso = await verifiedDomain(user.email);
      if (!sso) return false;
      if (account.provider === "google") {
        return (profile as { email_verified?: boolean } | undefined)?.email_verified === true;
      }
      if (account.provider === "microsoft-entra-id") {
        const tid = (profile as { tid?: string } | undefined)?.tid;
        return Boolean(sso.entraTenantId && tid && tid.toLowerCase() === sso.entraTenantId.toLowerCase());
      }
      return false;
    },
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.uid && session.user) session.user.id = token.uid as string;
      return session;
    },
  },
  events: {
    /** Domain-basierter Beitritt: Wer eine verifizierte Firmen-Domain hat, gehört zur Firma. */
    async signIn({ user }) {
      if (!user.id) return;
      const current = await db.user.findUnique({ where: { id: user.id }, select: { organizationId: true, email: true } });
      if (!current || current.organizationId) return;
      const sso = await verifiedDomain(current.email);
      if (sso) {
        await db.user.update({ where: { id: user.id }, data: { organizationId: sso.organizationId, emailVerified: new Date() } });
      }
    },
  },
});
