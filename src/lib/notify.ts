import { db } from "@/lib/db";

const SLACK_HOSTS = [/^hooks\.slack\.com$/];
const TEAMS_HOSTS = [
  /\.webhook\.office\.com$/,
  /^outlook\.office\.com$/,
  /\.logic\.azure\.com$/,
  /\.powerplatform\.com$/,
  /\.environment\.api\.powerplatform\.com$/,
];

/** Webhook-URLs müssen https sein und auf bekannte Dienste zeigen (SSRF-Schutz). */
export function isAllowedWebhook(kind: "slack" | "teams", raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    const hosts = kind === "slack" ? SLACK_HOSTS : TEAMS_HOSTS;
    return hosts.some((re) => re.test(url.hostname));
  } catch {
    return false;
  }
}

async function post(url: string, body: unknown): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
    redirect: "error",
  });
  if (!res.ok) throw new Error(`Webhook antwortete mit ${res.status}`);
}

export interface OrgMessage {
  title: string;
  text: string;
  url?: string;
  linkLabel?: string;
}

/** Schickt eine Nachricht an die in der Firma hinterlegten Slack-/Teams-Webhooks. Fehler brechen nichts ab. */
export async function notifyOrganization(organizationId: string, message: OrgMessage): Promise<void> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { slackWebhookUrl: true, teamsWebhookUrl: true },
  });
  if (!org) return;
  const jobs: Promise<void>[] = [];

  if (org.slackWebhookUrl && isAllowedWebhook("slack", org.slackWebhookUrl)) {
    const link = message.url ? `\n<${message.url}|${message.linkLabel ?? message.url}>` : "";
    jobs.push(post(org.slackWebhookUrl, { text: `*${message.title}*\n${message.text}${link}` }));
  }
  if (org.teamsWebhookUrl && isAllowedWebhook("teams", org.teamsWebhookUrl)) {
    jobs.push(
      post(org.teamsWebhookUrl, {
        type: "message",
        attachments: [
          {
            contentType: "application/vnd.microsoft.card.adaptive",
            content: {
              $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
              type: "AdaptiveCard",
              version: "1.4",
              body: [
                { type: "TextBlock", text: message.title, weight: "Bolder", size: "Medium", wrap: true },
                { type: "TextBlock", text: message.text, wrap: true },
              ],
              actions: message.url ? [{ type: "Action.OpenUrl", title: message.linkLabel ?? "Öffnen", url: message.url }] : [],
            },
          },
        ],
      }),
    );
  }
  const results = await Promise.allSettled(jobs);
  for (const r of results) if (r.status === "rejected") console.error("[notify]", r.reason);
}

/** Testnachricht aus den Einstellungen; wirft bei Fehlern, damit der Admin sie sieht. */
export async function sendTestWebhook(kind: "slack" | "teams", url: string): Promise<void> {
  if (!isAllowedWebhook(kind, url)) throw new Error("invalid_webhook");
  if (kind === "slack") await post(url, { text: "✅ Wichtelwerk ist verbunden." });
  else
    await post(url, {
      type: "message",
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.adaptive",
          content: {
            $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
            type: "AdaptiveCard",
            version: "1.4",
            body: [{ type: "TextBlock", text: "✅ Wichtelwerk ist verbunden.", wrap: true }],
          },
        },
      ],
    });
}
