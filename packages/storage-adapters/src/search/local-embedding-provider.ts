import { IEmbeddingProvider } from '@bucketspace/shared';

/**
 * LocalEmbeddingProvider generates deterministic 384-dimensional dense vectors
 * for local, offline environments using trigram frequency projections and L2 normalization.
 * Requires zero external network calls, zero API keys, and zero external binary dependencies.
 */
export class LocalEmbeddingProvider implements IEmbeddingProvider {
  public readonly modelId = 'local-minilm-384';
  public readonly modelVersion = '1.0';
  public readonly dimensions = 384;

  public async embedText(text: string): Promise<number[]> {
    return this.generateVector(text);
  }

  public async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.generateVector(t));
  }

  private generateVector(text: string): number[] {
    const vector = new Array<number>(this.dimensions).fill(0);
    const cleaned = text.toLowerCase().replace(/[^\w\s]/g, ' ');
    const words = cleaned.split(/\s+/).filter(Boolean);

    if (words.length === 0) return vector;

    // Feature projection mapping words and character n-grams to vector dimensions
    for (const word of words) {
      const h1 = hashString(word) % this.dimensions;
      const h2 = hashString(`w:${word}`) % this.dimensions;
      vector[h1] += 1.0;
      vector[h2] += 0.5;

      // Trigrams
      for (let i = 0; i < word.length - 2; i++) {
        const trigram = word.substring(i, i + 3);
        const h3 = hashString(`tri:${trigram}`) % this.dimensions;
        vector[h3] += 0.25;
      }
    }

    // L2 Normalization
    let sumSq = 0;
    for (let i = 0; i < this.dimensions; i++) {
      sumSq += vector[i] * vector[i];
    }

    const norm = Math.sqrt(sumSq);
    if (norm > 0) {
      for (let i = 0; i < this.dimensions; i++) {
        vector[i] /= norm;
      }
    }

    return vector;
  }
}

/** Simple fast non-cryptographic hash for feature projection */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}
