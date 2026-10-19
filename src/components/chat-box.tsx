"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useT, useLocale } from "@/lib/i18n/client";
import { intlLocale } from "@/lib/i18n";
import { loadChat, postChat, type ChatDto } from "@/app/app/c/[id]/actions";

export function ChatBox({
  campaignId,
  side,
  title,
  initial,
  peerLabel,
}: {
  campaignId: string;
  side: "giver" | "receiver";
  title: string;
  initial: ChatDto;
  peerLabel: string;
}) {
  const t = useT();
  const locale = useLocale();
  const [messages, setMessages] = useState(initial.messages);
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const dto = await loadChat(campaignId, side);
    setMessages(dto.messages);
  }, [campaignId, side]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 8000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setBody("");
    start(async () => {
      const dto = await postChat(campaignId, side, text);
      setMessages(dto.messages);
    });
  }

  return (
    <section className="card" aria-label={title}>
      <h3 className="font-extrabold text-green">💬 {title}</h3>
      <p className="mb-3 text-xs text-muted">{t("chat.anonymous")}</p>
      <div className="mb-3 max-h-72 min-h-24 space-y-2 overflow-y-auto rounded-xl bg-cream p-3" role="log" aria-live="polite">
        {messages.length === 0 && <p className="text-center text-xs text-muted">{t("chat.empty", { peer: peerLabel })}</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.mine ? "bg-green text-cream" : "bg-surface ring-1 ring-line"}`}>
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className={`mt-1 text-[10px] ${m.mine ? "text-cream/60" : "text-muted"}`}>
                {new Date(m.at).toLocaleString(intlLocale(locale), { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Vienna" })}
              </p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="flex gap-2">
        <input value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} className="input" placeholder={t("chat.placeholder")} aria-label={t("chat.placeholder")} />
        <button className="btn-primary" disabled={pending || !body.trim()}>{t("chat.send")}</button>
      </form>
    </section>
  );
}
