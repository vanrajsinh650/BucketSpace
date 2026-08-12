import {
  ExtractedContent,
  FileId,
  IContentExtractor,
  SegmentProvenance,
} from '@bucketspace/shared';

/**
 * PlainTextExtractor extracts structured text and segment provenance from
 * plain text, markdown, CSV, JSON, and code files.
 * Tracks character offsets and line/paragraph segments.
 */
export class PlainTextExtractor implements IContentExtractor {
  public readonly extractorId = 'text-extractor';

  private static readonly SUPPORTED_TYPES = new Set([
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json',
    'text/html',
    'text/css',
    'text/javascript',
    'application/javascript',
  ]);

  public canHandle(mimeType: string, filename?: string): boolean {
    if (PlainTextExtractor.SUPPORTED_TYPES.has(mimeType.toLowerCase())) return true;
    if (filename) {
      const ext = filename.split('.').pop()?.toLowerCase();
      if (['txt', 'md', 'csv', 'json', 'html', 'js', 'ts', 'py', 'css', 'jsonl'].includes(ext ?? '')) {
        return true;
      }
    }
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
    const fullText = new TextDecoder('utf-8').decode(fullBuffer);

    // Segment by paragraphs / non-empty blocks
    const lines = fullText.split(/\r?\n/);
    const segments: SegmentProvenance[] = [];

    let currentOffset = 0;
    let segmentIndex = 0;
    let blockText = '';
    let blockStartOffset = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLen = line.length + 1; // +1 for newline

      if (line.trim().length === 0) {
        if (blockText.trim().length > 0) {
          segments.push({
            id: `seg-${fileId}-${segmentIndex}`,
            segmentIndex: segmentIndex++,
            text: blockText.trim(),
            charOffset: blockStartOffset,
          });
          blockText = '';
        }
        blockStartOffset = currentOffset + lineLen;
      } else {
        if (blockText.length === 0) blockStartOffset = currentOffset;
        blockText += line + '\n';
      }

      currentOffset += lineLen;
    }

    if (blockText.trim().length > 0) {
      segments.push({
        id: `seg-${fileId}-${segmentIndex}`,
        segmentIndex,
        text: blockText.trim(),
        charOffset: blockStartOffset,
      });
    }

    return {
      fileId,
      extractorId: this.extractorId,
      mimeType,
      fullText,
      segments: segments.length > 0 ? segments : [
        { id: `seg-${fileId}-0`, segmentIndex: 0, text: fullText, charOffset: 0 }
      ],
      metadata: {
        lineCount: lines.length,
        characterCount: fullText.length,
        filename,
      },
      extractedAt: new Date(),
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
