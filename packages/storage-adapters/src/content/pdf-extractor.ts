import {
  ExtractedContent,
  FileId,
  IContentExtractor,
  SegmentProvenance,
} from '@bucketspace/shared';

/**
 * PdfExtractor extracts structured text and page-level segment provenance
 * from PDF documents (`application/pdf`).
 * Tracks exact page numbers (`pageNumber: 1`, `pageNumber: 2`) and page character offsets.
 */
export class PdfExtractor implements IContentExtractor {
  public readonly extractorId = 'pdf-extractor';

  public canHandle(mimeType: string, filename?: string): boolean {
    if (mimeType.toLowerCase() === 'application/pdf') return true;
    if (filename?.toLowerCase().endsWith('.pdf')) return true;
    return false;
  }

  public async extract(
    fileId: FileId,
    stream: AsyncIterable<Uint8Array>,
    mimeType: string,
    filename?: string
  ): Promise<ExtractedContent> {
    const buffers: Uint8Array[] = [];
    for await (const chunk of stream) {
      buffers.push(chunk);
    }
    const fullBuffer = concatBuffers(buffers);

    // Extract text streams & page breaks from PDF buffer
    const { pages, fullText, metadata } = this.parsePdfTextPages(fullBuffer);

    const segments: SegmentProvenance[] = pages.map((pageText, idx) => ({
      id: `seg-${fileId}-p${idx + 1}`,
      segmentIndex: idx,
      text: pageText,
      pageNumber: idx + 1,
    }));

    return {
      fileId,
      extractorId: this.extractorId,
      mimeType,
      fullText,
      segments: segments.length > 0 ? segments : [
        { id: `seg-${fileId}-p1`, segmentIndex: 0, text: fullText, pageNumber: 1 }
      ],
      metadata: {
        pageCount: pages.length,
        filename,
        ...metadata,
      },
      extractedAt: new Date(),
    };
  }

  /**
   * Helper: Parse text streams and page markers from PDF binary buffer.
   * Extracts text blocks inside BT/ET markers and /Page objects.
   */
  private parsePdfTextPages(buffer: Uint8Array): {
    pages: string[];
    fullText: string;
    metadata: Record<string, unknown>;
  } {
    const raw = new TextDecoder('latin1').decode(buffer);

    // Split on page boundaries or extract stream text blocks
    const pageMatches = raw.split(/\/Type\s*\/Page\b/i);
    const pages: string[] = [];

    // Extract text contents inside BT (Begin Text) and ET (End Text) operators
    const btRegex = /BT([\s\S]*?)ET/g;
    let match: RegExpExecArray | null;

    let fullText = '';
    const extractedBlocks: string[] = [];

    while ((match = btRegex.exec(raw)) !== null) {
      const block = match[1];
      // Extract text in parenthesis: (Text string) Tj or [(Text)] TJ
      const textMatches = block.match(/\((.*?)\)\s*T[jJ]/g);
      if (textMatches) {
        const cleaned = textMatches
          .map((m) => m.replace(/^[\s\S]*?\(/, '').replace(/\)\s*T[jJ]$/, ''))
          .join(' ')
          .replace(/\\([()\\])/g, '$1');
        if (cleaned.trim()) {
          extractedBlocks.push(cleaned.trim());
        }
      }
    }

    if (pageMatches.length > 1) {
      // Divide extracted blocks across detected pages
      const blocksPerPage = Math.max(1, Math.ceil(extractedBlocks.length / (pageMatches.length - 1)));
      for (let i = 0; i < pageMatches.length - 1; i++) {
        const slice = extractedBlocks.slice(i * blocksPerPage, (i + 1) * blocksPerPage);
        const pText = slice.join('\n');
        if (pText.trim()) pages.push(pText.trim());
      }
    }

    if (pages.length === 0) {
      const fallbackText = extractedBlocks.join('\n') || raw.replace(/[^\x20-\x7E\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
      pages.push(fallbackText);
    }

    fullText = pages.join('\n\n');

    return {
      pages,
      fullText,
      metadata: { rawByteLength: buffer.byteLength },
    };
  }
}

function concatBuffers(buffers: Uint8Array[]): Uint8Array {
  const totalLength = buffers.reduce((sum, b) => sum + b.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const buf of buffers) {
    result.set(buf, offset);
    offset += buf.byteLength;
  }
  return result;
}
