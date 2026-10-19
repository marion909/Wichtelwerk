import Link from "next/link";
import { redirect } from "next/navigation";
import { requireManagedCampaign } from "@/lib/access";
import { listRevealed } from "@/lib/data/assignments";
import { planFor } from "@/lib/plans";
import { getT } from "@/lib/i18n/server";
import { AutoRefresh } from "@/components/auto-refresh";
import { Logo } from "@/components/shell";
import { db } from "@/lib/db";
import { revealAllAction, revealNextAction } from "../../actions";

/** Beamer-Ansicht für die Weihnachtsfeier: Paare werden live aufgedeckt. */
export default async function RevealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { campaign: c } = await requireManagedCampaign(id);
  if (!planFor(c.tier).revealMode || (c.status !== "revealed" && c.status !== "closed")) redirect(`/admin/campaigns/${id}`);
  const { t } = await getT();
  const { pairs, total } = await listRevealed(id);
  const latest = pairs[pairs.length - 1];
  const done = pairs.length >= total;
  const guesses = c.guessGameEnabled
    ? await db.guessVote.findMany({ where: { campaignId: id }, select: { id: true } })
    : [];

  return (
    <div className="min-h-screen bg-green text-cream">
      <AutoRefresh seconds={2} />
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-6">
        <header className="flex items-center justify-between">
          <div className="rounded-xl bg-cream px-3 py-2"><Logo height={34} /></div>
          <h1 className="text-xl font-extrabold sm:text-3xl">{c.title}</h1>
          <Link href={`/admin/campaigns/${id}`} className="text-xs font-bold text-cream/60 hover:text-cream">✕ {t("common.close")}</Link>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          {latest ? (
            <div key={latest.assignmentId} className="animate-[pop_.6s_ease-out]">
              <p className="mb-4 text-lg font-bold text-gold sm:text-2xl">{t("reveal.latest")}</p>
              <p className="text-4xl font-extrabold sm:text-7xl">{latest.giver}</p>
              <p className="my-4 text-3xl text-coral sm:text-5xl" aria-hidden>🎁 ⟶</p>
              <p className="text-4xl font-extrabold sm:text-7xl">{latest.receiver}</p>
            </div>
          ) : (
            <p className="text-3xl font-extrabold sm:text-5xl">{t("reveal.waiting")}</p>
          )}
          <p className="mt-10 text-sm text-cream/70">{t("reveal.progress", { n: pairs.length, total })}</p>
          {c.guessGameEnabled && <p className="mt-1 text-sm text-cream/70">🕵️ {t("reveal.guesses", { n: guesses.length })}</p>}
        </main>

        {pairs.length > 1 && (
          <ul className="mb-6 flex flex-wrap justify-center gap-2 text-sm">
            {pairs.slice(0, -1).reverse().map((p) => (
              <li key={p.assignmentId} className="rounded-full bg-cream/10 px-3 py-1">{p.giver} → {p.receiver}</li>
            ))}
          </ul>
        )}

        {c.status === "revealed" && !done && (
          <footer className="flex justify-center gap-3 opacity-40 transition hover:opacity-100">
            <form action={revealNextAction}><input type="hidden" name="id" value={id} /><button className="btn-accent !px-6 !py-3 text-base">{t("reveal.next")}</button></form>
            <form action={revealAllAction}><input type="hidden" name="id" value={id} /><button className="btn-ghost !bg-cream/10 !text-cream !px-6 !py-3 text-base">{t("reveal.all")}</button></form>
          </footer>
        )}
      </div>
    </div>
  );
}
