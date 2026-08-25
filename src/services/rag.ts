export type RagDocument = {
  id: string;
  text: string;
  title?: string;
  metadata?: Record<string, unknown>;
};

export type RagResult = RagDocument & { score: number };

const tokenize = (value: string): string[] =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

const scoreDocument = (queryTokens: string[], document: RagDocument): number => {
  if (!queryTokens.length || !document.text) return 0;
  const tokens = new Set(tokenize(document.text));
  const matches = queryTokens.reduce((count, token) => count + (tokens.has(token) ? 1 : 0), 0);
  return matches / queryTokens.length;
};

class LocalRagService {
  private documents: RagDocument[] = [];

  setDocuments(documents: RagDocument[]): void {
    this.documents = documents;
  }

  addDocuments(documents: RagDocument[]): void {
    const existing = new Set(this.documents.map(document => document.id));
    this.documents = [
      ...this.documents,
      ...documents.filter(document => !existing.has(document.id)),
    ];
  }

  removeDocument(id: string): void {
    this.documents = this.documents.filter(document => document.id !== id);
  }

  clear(): void {
    this.documents = [];
  }

  search(query: string, limit = 5): RagResult[] {
    const queryTokens = tokenize(query);
    return this.documents
      .map(document => ({ ...document, score: scoreDocument(queryTokens, document) }))
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(0, limit));
  }

  retrieve(query: string, limit = 5): RagResult[] {
    return this.search(query, limit);
  }
}

export const ragService = new LocalRagService();
export const retrievalService = ragService;
