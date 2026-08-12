import {
  ExtractedContent,
  FileId,
  IContentExtractor,
  IOCRProvider,
  SegmentProvenance,
} from '@bucketspace/shared';

/**
 * OcrExtractorAdapter wraps any pluggable IOCRProvider (e.g. Tesseract, Local OCR, Cloud OCR)
 * for image text recognition (`image/jpeg`, `image/png`, `image/webp`).
 * Preserves OCR confidence scores and bounding boxes in segment provenance.
 */
export class OcrExtractorAdapter implements IContentExtractor {
  public readonly extractorId = 'ocr-extractor';

  private static readonly SUPPORTED_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/bmp',
    'image/tiff',
  ]);

  constructor(private readonly ocrProvider: IOCRProvider) {}

  public canHandle(mimeType: string, filename?: string): boolean {
    if (OcrExtractorAdapter.SUPPORTED_TYPES.has(mimeType.toLowerCase())) return true;
    if (filename) {
      const ext = filename.split('.').pop()?.toLowerCase();
      if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff'].includes(ext ?? '')) {
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

    const recognition = await this.ocrProvider.recognizeText(
      (async function* () { yield fullBuffer; })(),
      mimeType
    );

    const segments: SegmentProvenance[] = recognition.segments.map((seg, idx) => ({
      ...seg,
      id: seg.id || `seg-${fileId}-ocr-${idx}`,
      segmentIndex: idx,
    }));

    return {
      fileId,
      extractorId: `${this.extractorId}:${this.ocrProvider.providerId}`,
      mimeType,
      fullText: recognition.text,
      segments: segments.length > 0 ? segments : [
        {
          id: `seg-${fileId}-ocr-0`,
          segmentIndex: 0,
          text: recognition.text,
          confidence: recognition.confidence,
        }
      ],
      metadata: {
        ocrEngine: this.ocrProvider.providerId,
        averageConfidence: recognition.confidence,
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
