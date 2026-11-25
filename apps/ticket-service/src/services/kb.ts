import type { Category } from "@nexo/domain";

import type { Database } from "../db/client.ts";

export interface KbSearchResult {
  id: string;
  title: string;
  body: string;
  category: Category;
  score: number;
}

const STOPWORDS = new Set(
  "a o as os de da do das dos e em no na nos nas um uma com por para que nao meu minha seu sua esta estou ta".split(
    " ",
  ),
);

const WEIGHT = { title: 3, keywords: 2, body: 1 } as const;

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function tokenize(text: string): string[] {
  return [...new Set(normalize(text).split(/[^\p{L}\p{N}]+/u))].filter(
    (t) => t.length >= 2 && !STOPWORDS.has(t),
  );
}

export async function searchKb(
  db: Database,
  query: string,
  limit: number,
): Promise<KbSearchResult[]> {
  const terms = tokenize(query);
  if (terms.length === 0) return [];

  const articles = await db.query.kbArticles.findMany();

  return articles
    .map((a) => {
      const fields = {
        title: normalize(a.title),
        keywords: normalize(a.keywords),
        body: normalize(a.body),
      };
      const score = terms.reduce(
        (sum, term) =>
          sum +
          (fields.title.includes(term) ? WEIGHT.title : 0) +
          (fields.keywords.includes(term) ? WEIGHT.keywords : 0) +
          (fields.body.includes(term) ? WEIGHT.body : 0),
        0,
      );
      return { id: a.id, title: a.title, body: a.body, category: a.category, score };
    })
    .filter((r) => r.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
}
