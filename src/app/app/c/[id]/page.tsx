import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrgUser } from "@/lib/access";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { PortalShell } from "@/components/shell";
import { Flash, type SearchParams } from "@/components/flash";
import { ConfirmButton, SubmitButton } from "@/components/ui";
import { ChatBox } from "@/components/chat-box";
import { AutoRefresh } from "@/components/auto-refresh";
import { getT } from "@/lib/i18n/server";
import { formatDate } from "@/lib/i18n";
import { formatMoney } from "@/lib/plans";
import { searchUrl, suggestIdeas } from "@/lib/ideas";
import {
  getChat,
  getGuessResult,
  getMyGivenVoucher,
  getMyReceivedVoucher,
  getMyReceiver,
  getMyRevealedGiver,
} from "@/lib/data/assignments";
import { feedbackAction, guessAction, leaveCampaign, saveAddress, saveWishlist, voucherAction } from "./actions";

export default async function ParticipantCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const user = await requireOrgUser(`/app/c/${id}`);
  const { t, locale } = await getT();
  const participant = await db.participant.findUnique({
    where: { campaignId_userId: { campaignId: id, userId: user.id } },
    include: { campaign: true, wishlist: true },
  });
  if (!participant || participant.campaign.organizationId !== user.organizationId) redirect("/app");
  const c = participant.campaign;

  if (participant.status !== "joined") {
    return (
      <PortalShell user={user} back={`/app/c/${id}`}>
        <h1 className="mb-4 text-2xl font-extrabold text-green">{c.title}</h1>
        <div className="card text-center">
          <p className="mb-3 font-bold">{t("participant.notJoined")}</p>
          <Link href={`/join/${c.inviteToken}`} className="btn-primary">{t("participant.joinNow")}</Link>
        </div>
      </PortalShell>
    );
  }

  const drawn = c.status === "drawn" || c.status === "revealed" || c.status === "closed";
  const revealed = c.status === "revealed" || c.status === "closed";
  const receiver = drawn ? await getMyReceiver(participant.id) : null;
  const wishlist = participant.wishlist;
  const address = participant.shippingAddressEnc ? decrypt(participant.shippingAddressEnc) : "";
  const [asGiver, asReceiver] = receiver
    ? await Promise.all([getChat(participant.id, "giver"), getChat(participant.id, "receiver")])
    : [null, null];
  const toDto = (chat: Awaited<ReturnType<typeof getChat>>) => ({
    messages: (chat?.messages ?? []).map((m) => ({ id: m.id, mine: m.mine, body: m.body, at: m.createdAt.toISOString() })),
  });
  const myGiver = revealed ? await getMyRevealedGiver(participant.id) : null;
  const ideas =
    receiver && !revealed
      ? await suggestIdeas({ tags: receiver.wishlist?.tags ?? [], noGos: receiver.wishlist?.noGos ?? "", budgetCents: c.budgetCents })
      : [];

  // V2: Ratespiel
  const guessing = c.guessGameEnabled && drawn;
  const candidates = guessing
    ? await db.participant.findMany({
        where: { campaignId: id, status: "joined", id: { not: participant.id } },
        include: { user: true },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const guess = guessing ? await getGuessResult(id, participant.id) : null;
  // V2: Gutschein
  const givenVoucher = c.vouchersEnabled && receiver ? await getMyGivenVoucher(participant.id) : null;
  const receivedVoucher = c.vouchersEnabled && revealed ? await getMyReceivedVoucher(participant.id) : null;

  return (
    <PortalShell user={user} back={`/app/c/${id}`}>
      {!revealed && c.status === "open" && <AutoRefresh seconds={30} />}
      <Link href="/app" className="text-sm font-bold text-muted hover:underline">← {t("nav.mine")}</Link>
      <div className="mb-6 mt-2">
        <h1 className="text-2xl font-extrabold text-green">🎁 {c.title}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
          <span className="badge">{t(`status.${c.status}`)}</span>
          <span>{t("join.budget", { amount: formatMoney(c.budgetCents, c.currency) })}</span>
          {c.place && <span>📍 {c.place}</span>}
          {c.handoverAt && <span>🎀 {formatDate(c.handoverAt, locale, true)}</span>}
        </p>
      </div>
      <Flash searchParams={searchParams} />

      {c.status === "open" && (
        <p className="mb-6 rounded-xl border border-gold/50 bg-gold/10 px-4 py-3 text-sm font-semibold">
          {t("participant.waitDraw", { date: formatDate(c.drawAt, locale, true) })}
        </p>
      )}

      {/* Wen beschenke ich? */}
      {receiver && (
        <section className="card mb-6 border-coral/40">
          <p className="text-xs font-bold uppercase text-coral">{t("participant.youGift")}</p>
          <h2 className="text-3xl font-extrabold text-green">{receiver.name}</h2>
          {receiver.department && <p className="text-sm text-muted">{receiver.department}</p>}
          {receiver.wishlist ? (
            <div className="mt-4 space-y-3 text-sm">
              {receiver.wishlist.text && <p className="whitespace-pre-line rounded-xl bg-cream p-3">{receiver.wishlist.text}</p>}
              {receiver.wishlist.tags.length > 0 && (
                <p className="flex flex-wrap gap-2">{receiver.wishlist.tags.map((tag) => <span key={tag} className="badge">#{tag}</span>)}</p>
              )}
              {receiver.wishlist.links.length > 0 && (
                <ul className="list-disc pl-5">
                  {receiver.wishlist.links.map((l) => (
                    <li key={l}><a href={l} target="_blank" rel="noopener noreferrer nofollow" className="break-all font-semibold text-brand underline">{l}</a></li>
                  ))}
                </ul>
              )}
              {receiver.wishlist.noGos && <p className="text-coral"><b>🚫 {t("wishlist.noGos")}:</b> {receiver.wishlist.noGos}</p>}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">{t("participant.noWishlist")}</p>
          )}
          {c.mode !== "onsite" && (
            <p className="mt-4 rounded-xl bg-cream p-3 text-sm">
              <b>📦 {t("participant.shipTo")}:</b>{" "}
              {receiver.shippingAddress ? <span className="whitespace-pre-line">{receiver.shippingAddress}</span> : <span className="text-muted">{t("participant.noAddress")}</span>}
            </p>
          )}
        </section>
      )}

      {/* Revealed */}
      {revealed && (
        <section className="card mb-6 text-center">
          {myGiver ? (
            <>
              <p className="text-sm font-bold text-muted">{t("participant.giverWas")}</p>
              <p className="text-3xl font-extrabold text-green">🎅 {myGiver}</p>
            </>
          ) : (
            <p className="text-sm text-muted">{t("participant.giverPending")}</p>
          )}
        </section>
      )}

      {receivedVoucher && (
        <section className="card mb-6">
          <h2 className="font-extrabold text-green">🎟️ {t("voucher.received")}</h2>
          <p className="mt-1 text-sm">{receivedVoucher.provider} · {formatMoney(receivedVoucher.amountCents, c.currency)}</p>
          <p className="mt-2 break-all rounded-xl bg-cream p-3 font-mono text-sm">{receivedVoucher.code}</p>
        </section>
      )}

      {/* Chats */}
      {receiver && !revealed && asGiver && (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <ChatBox campaignId={id} side="giver" title={t("chat.toReceiver")} initial={toDto(asGiver)} peerLabel={t("chat.peer.receiver")} />
          {asReceiver && <ChatBox campaignId={id} side="receiver" title={t("chat.toGiver")} initial={toDto(asReceiver)} peerLabel={t("chat.peer.giver")} />}
        </div>
      )}

      {/* Geschenkideen */}
      {ideas.length > 0 && (
        <section className="card mb-6">
          <h2 className="font-extrabold text-green">💡 {t("ideas.title")}</h2>
          <p className="mb-3 text-xs text-muted">{t("ideas.hint")}</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {ideas.map((i) => (
              <li key={i.id} className="rounded-xl border border-line p-3 text-sm">
                <p className="font-bold">{i.title}</p>
                <p className="text-xs text-muted">{i.description}</p>
                <p className="mt-1 text-xs text-muted">{formatMoney(i.minCents, c.currency)} – {formatMoney(i.maxCents, c.currency)}</p>
                <a href={i.url ?? searchUrl(i.title)} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-block text-xs font-bold text-brand underline">{t("ideas.search")}</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Gutschein (V2) */}
      {c.vouchersEnabled && receiver && !revealed && (
        <section className="card mb-6">
          <h2 className="font-extrabold text-green">🎟️ {t("voucher.title")}</h2>
          <p className="mb-3 text-xs text-muted">{t("voucher.hint")}</p>
          {givenVoucher && <p className="mb-3 text-sm font-semibold text-green">✅ {t("voucher.saved", { provider: givenVoucher.provider, amount: formatMoney(givenVoucher.amountCents, c.currency) })}</p>}
          <form action={voucherAction} className="grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="id" value={id} />
            <input name="provider" required maxLength={80} placeholder={t("voucher.provider")} className="input" aria-label={t("voucher.provider")} />
            <input name="amount" required inputMode="decimal" placeholder={t("voucher.amount")} className="input" aria-label={t("voucher.amount")} />
            <input name="code" required maxLength={500} placeholder={t("voucher.code")} className="input" aria-label={t("voucher.code")} />
            <div className="sm:col-span-3"><SubmitButton className="btn-ghost">{t("common.save")}</SubmitButton></div>
          </form>
        </section>
      )}

      {/* Wer war's? (V2) */}
      {guessing && guess && (
        <section className="card mb-6">
          <h2 className="font-extrabold text-green">🕵️ {t("guess.title")}</h2>
          <p className="mb-3 text-xs text-muted">{t("guess.hint")}</p>
          {guess.mine && revealed && (
            <p className="mb-3 text-sm font-bold">{guess.mine.correct ? "🎉" : "🙈"} {t(guess.mine.correct ? "guess.right" : "guess.wrong", { name: guess.mine.guessedName })}</p>
          )}
          {guess.mine && !revealed && <p className="mb-3 text-sm font-semibold text-green">✅ {t("guess.saved", { name: guess.mine.guessedName })}</p>}
          {!revealed && (
            <form action={guessAction} className="flex flex-wrap gap-3">
              <input type="hidden" name="id" value={id} />
              <select name="guess" required className="input max-w-xs" aria-label={t("guess.title")}>
                {candidates.map((p) => <option key={p.id} value={p.id}>{p.user.name ?? p.user.email}</option>)}
              </select>
              <SubmitButton className="btn-ghost">{t("guess.submit")}</SubmitButton>
            </form>
          )}
          {revealed && <p className="text-xs text-muted">{t("guess.stats", { correct: guess.correct, total: guess.total })}</p>}
        </section>
      )}

      {/* Wunschzettel */}
      {c.status !== "closed" && (
        <section className="card mb-6">
          <h2 className="mb-1 font-extrabold text-green">📝 {t("wishlist.title")}</h2>
          <p className="mb-4 text-xs text-muted">{t("wishlist.hint")}</p>
          <form action={saveWishlist} className="space-y-4">
            <input type="hidden" name="id" value={id} />
            <div>
              <label htmlFor="text" className="label">{t("wishlist.text")}</label>
              <textarea id="text" name="text" rows={4} maxLength={3000} defaultValue={wishlist?.text ?? ""} className="input" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="tags" className="label">{t("wishlist.tags")}</label>
                <input id="tags" name="tags" defaultValue={wishlist?.tags.join(", ") ?? ""} className="input" placeholder="Kaffee, Bücher, Wandern" />
                <p className="hint">{t("wishlist.tags.hint")}</p>
              </div>
              <div>
                <label htmlFor="noGos" className="label">{t("wishlist.noGos")}</label>
                <input id="noGos" name="noGos" maxLength={500} defaultValue={wishlist?.noGos ?? ""} className="input" placeholder={t("wishlist.noGos.hint")} />
              </div>
            </div>
            <div>
              <label htmlFor="links" className="label">{t("wishlist.links")}</label>
              <textarea id="links" name="links" rows={2} defaultValue={wishlist?.links.join("\n") ?? ""} className="input" placeholder="https://…" />
            </div>
            <SubmitButton>{t("common.save")}</SubmitButton>
          </form>
        </section>
      )}

      {/* Versandadresse */}
      {c.mode !== "onsite" && c.status !== "closed" && (
        <section className="card mb-6">
          <h2 className="mb-1 font-extrabold text-green">📦 {t("address.title")}</h2>
          <p className="mb-4 text-xs text-muted">{t("address.hint")}</p>
          <form action={saveAddress} className="space-y-3">
            <input type="hidden" name="id" value={id} />
            <textarea name="address" rows={3} maxLength={500} defaultValue={address} className="input" placeholder={"Max Muster\nMusterstraße 1\n1010 Wien"} aria-label={t("address.title")} />
            <SubmitButton>{t("common.save")}</SubmitButton>
          </form>
        </section>
      )}

      {/* Feedback */}
      {revealed && !participant.feedbackGiven && c.status === "revealed" && (
        <section className="card mb-6">
          <h2 className="mb-1 font-extrabold text-green">⭐ {t("feedback.ask")}</h2>
          <form action={feedbackAction} className="space-y-3">
            <input type="hidden" name="id" value={id} />
            <fieldset className="flex gap-3" aria-label={t("feedback.ask")}>
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="flex items-center gap-1 text-sm font-bold"><input type="radio" name="rating" value={n} required /> {n}</label>
              ))}
            </fieldset>
            <textarea name="comment" rows={2} maxLength={1000} className="input" placeholder={t("feedback.comment")} aria-label={t("feedback.comment")} />
            <SubmitButton className="btn-ghost">{t("feedback.send")}</SubmitButton>
          </form>
        </section>
      )}

      {c.status === "open" && (
        <form action={leaveCampaign} className="mt-8 text-center">
          <input type="hidden" name="id" value={id} />
          <ConfirmButton className="text-xs font-bold text-muted hover:underline" message={t("confirm.leave")}>{t("participant.leave")}</ConfirmButton>
        </form>
      )}
    </PortalShell>
  );
}
