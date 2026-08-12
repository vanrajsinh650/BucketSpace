import {
  ExtractedContent,
  FileId,
  IContentExtractor,
  ITranscriptionProvider,
  SegmentProvenance,
} from '@bucketspace/shared';

/**
 * AudioTranscriptionAdapter wraps any pluggable ITranscriptionProvider (e.g., Whisper, Local Speech)
 * for audio/video transcription (`audio/mpeg`, `audio/wav`, `video/mp4`, `video/mkv`).
 * Preserves startTimeSeconds and endTimeSeconds timestamp provenance in segments.
 */
export class AudioTranscriptionAdapter implements IContentExtractor {
  public readonly extractorId = 'audio-transcription-extractor';

  private static readonly SUPPORTED_TYPES = new Set([
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/mp4',
    'audio/m4a',
    'audio/ogg',
    'audio/webm',
    'video/mp4',
    'video/mkv',
    'video/webm',
    'video/avi',
  ]);

  constructor(private readonly transcriptionProvider: ITranscriptionProvider) {}

  public canHandle(mimeType: string, filename?: string): boolean {
    if (AudioTranscriptionAdapter.SUPPORTED_TYPES.has(mimeType.toLowerCase())) return true;
    if (filename) {
      const ext = filename.split('.').pop()?.toLowerCase();
      if (['mp3', 'wav', 'm4a', 'ogg', 'mp4', 'mkv', 'webm', 'avi'].includes(ext ?? '')) {
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

    const transcription = await this.transcriptionProvider.transcribe(
      (async function* () { yield fullBuffer; })(),
      mimeType
    );

    const segments: SegmentProvenance[] = transcription.segments.map((seg, idx) => ({
      ...seg,
      id: seg.id || `seg-${fileId}-audio-${idx}`,
      segmentIndex: idx,
    }));

    return {
      fileId,
      extractorId: `${this.extractorId}:${this.transcriptionProvider.providerId}`,
      mimeType,
      fullText: transcription.text,
      segments: segments.length > 0 ? segments : [
        {
          id: `seg-${fileId}-audio-0`,
          segmentIndex: 0,
          text: transcription.text,
          startTimeSeconds: 0,
        }
      ],
      metadata: {
        transcriptionEngine: this.transcriptionProvider.providerId,
        language: transcription.language,
        filename,
      },
      language: transcription.language,
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
