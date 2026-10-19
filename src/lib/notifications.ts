import { sendMail } from "@/lib/mail";
import { isLocale, translate, type Locale, type TKey, type Vars } from "@/lib/i18n";

export type MailKind =
  | "invite"
  | "signup_reminder"
  | "wishlist_reminder"
  | "drawn"
  | "draw_failed"
  | "handover_reminder"
  | "reveal"
  | "chat"
  | "feedback"
  | "purge"
  | "admin_invite";

export function userLocale(value: string | null | undefined): Locale {
  return isLocale(value) ? value : "de";
}

/** Verschickt eine lokalisierte Vorlagen-Mail (mail.<kind>.subject|body|action). */
export async function mailUser(
  user: { email: string; name?: string | null; locale?: string | null },
  kind: MailKind,
  vars: Vars,
  url: string,
): Promise<void> {
  const locale = userLocale(user.locale);
  const all: Vars = { name: user.name ?? "", ...vars };
  await sendMail({
    to: user.email,
    subject: translate(locale, `mail.${kind}.subject` as TKey, all),
    text: translate(locale, `mail.${kind}.body` as TKey, all),
    action: { label: translate(locale, `mail.${kind}.action` as TKey, all), url },
  });
}
