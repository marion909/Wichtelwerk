import type { GiftIdea } from "@prisma/client";
import { db } from "@/lib/db";

const STOPWORDS = new Set(["kein", "keine", "keinen", "keiner", "keines", "nichts", "ohne", "bitte", "nicht", "mag", "mochte", "gerne", "no", "not", "please"]);

export interface ScoredIdea extends GiftIdea {
  score: number;
}

/** Schlägt Geschenke passend zu Interessen-Tags und Budget vor; No-Gos werden herausgefiltert. */
export async function suggestIdeas(opts: { tags: string[]; noGos: string; budgetCents: number; limit?: number }): Promise<ScoredIdea[]> {
  const tags = opts.tags.map((t) => t.trim().toLowerCase()).filter(Boolean);
  const noGo = opts.noGos.toLowerCase();
  const ideas = await db.giftIdea.findMany({
    where: { active: true, minCents: { lte: opts.budgetCents } },
  });

  const noGoWords = noGo.split(/[\s,;.]+/).filter((w) => w.length > 3 && !STOPWORDS.has(w));

  const scored = ideas
    .filter((idea) => {
      // Wörter aus dem No-Go-Feld, die im Titel oder in den Tags vorkommen, schließen eine Idee aus.
      const hay = `${idea.title} ${idea.tags.join(" ")}`.toLowerCase();
      return !noGoWords.some((w) => hay.includes(w));
    })
    .map((idea) => {
      const overlap = idea.tags.filter((t) => tags.includes(t.toLowerCase())).length;
      const fits = idea.maxCents >= opts.budgetCents * 0.5 ? 1 : 0;
      return { ...idea, score: overlap * 10 + fits };
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  const matching = scored.filter((i) => i.score >= 10);
  return (matching.length >= 3 ? matching : scored).slice(0, opts.limit ?? 6);
}

export function searchUrl(title: string): string {
  return `https://www.idealo.at/preisvergleich/MainSearchProductCategory.html?q=${encodeURIComponent(title)}`;
}
