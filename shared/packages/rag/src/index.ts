export type RagDocument = { id?: string; content: string; metadata?: Record<string, unknown> };
export type RagResult = RagDocument & { score: number };
const tokenize = (value: string): string[] => value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
export const queryRag = async (query = "", documents: RagDocument[] = [], limit = 8): Promise<RagResult[]> => {
  const queryTerms = new Set(tokenize(query));
  if (!queryTerms.size || !documents.length) return [];
  return documents.map((document, index) => {
    const counts = new Map<string, number>();
    for (const term of tokenize(document.content)) counts.set(term, (counts.get(term) ?? 0) + 1);
    let score = 0;
    for (const term of queryTerms) { const count = counts.get(term) ?? 0; if (count) score += 1 + Math.min(count, 3) * 0.1; }
    return { ...document, id: document.id ?? String(index), score: score / queryTerms.size };
  }).filter((result) => result.score > 0).sort((a, b) => b.score - a.score).slice(0, Math.max(1, limit));
};
export default { queryRag };
