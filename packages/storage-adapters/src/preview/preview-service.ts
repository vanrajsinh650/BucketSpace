import { FileMetadata } from '@bucketspace/shared';

export type PreviewFormat =
  | 'IMAGE'
  | 'VIDEO'
  | 'AUDIO'
  | 'PDF'
  | 'MARKDOWN'
  | 'TEXT_CODE'
  | 'EXTRACTED_TEXT'
  | 'UNSUPPORTED';

export interface PreviewInfo {
  format: PreviewFormat;
  canStream: boolean;
  canInlineView: boolean;
  mimeType: string;
  hasExtractedText: boolean;
  extractedSnippet?: string;
}

/**
 * PreviewService provides provider-agnostic classification, stream routing,
 * and preview capabilities for all stored files.
 */
export class PreviewService {
  /**
   * Classifies a file into a preview category based on its MIME type and file extension.
   */
  public static classifyFormat(mimeType: string, filename: string): PreviewFormat {
    const lowerMime = (mimeType || '').toLowerCase();
    const ext = filename.includes('.') ? filename.substring(filename.lastIndexOf('.')).toLowerCase() : '';

    // 1. Image
    if (
      lowerMime.startsWith('image/') ||
      ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'].includes(ext)
    ) {
      return 'IMAGE';
    }

    // 2. Video
    if (
      lowerMime.startsWith('video/') ||
      ['.mp4', '.webm', '.ogg', '.mov', '.mkv', '.avi'].includes(ext)
    ) {
      return 'VIDEO';
    }

    // 3. Audio
    if (
      lowerMime.startsWith('audio/') ||
      ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'].includes(ext)
    ) {
      return 'AUDIO';
    }

    // 4. PDF
    if (lowerMime.includes('pdf') || ext === '.pdf') {
      return 'PDF';
    }

    // 5. Markdown
    if (
      lowerMime === 'text/markdown' ||
      lowerMime === 'text/x-markdown' ||
      ['.md', '.markdown'].includes(ext)
    ) {
      return 'MARKDOWN';
    }

    // 6. Text / Code
    if (
      lowerMime.startsWith('text/') ||
      lowerMime === 'application/json' ||
      lowerMime === 'application/xml' ||
      lowerMime === 'application/javascript' ||
      lowerMime === 'application/typescript' ||
      [
        '.txt',
        '.json',
        '.js',
        '.ts',
        '.tsx',
        '.jsx',
        '.html',
        '.css',
        '.scss',
        '.xml',
        '.yaml',
        '.yml',
        '.csv',
        '.py',
        '.rs',
        '.go',
        '.c',
        '.cpp',
        '.h',
        '.sh',
        '.sql',
        '.env',
      ].includes(ext)
    ) {
      return 'TEXT_CODE';
    }

    // 7. Documents that support extracted text viewing
    if (
      ['.doc', '.docx', '.odt', '.rtf', '.epub'].includes(ext) ||
      lowerMime.includes('word') ||
      lowerMime.includes('document')
    ) {
      return 'EXTRACTED_TEXT';
    }

    return 'UNSUPPORTED';
  }

  /**
   * Determine if the file format supports progressive streaming (e.g. video/audio).
   */
  public static isStreamableMedia(format: PreviewFormat): boolean {
    return format === 'VIDEO' || format === 'AUDIO';
  }

  /**
   * Determine if the file format supports direct inline viewing in the browser.
   */
  public static supportsInlineViewing(format: PreviewFormat): boolean {
    return format !== 'UNSUPPORTED';
  }

  /**
   * Get preview metadata and capabilities for a file.
   */
  public static getPreviewInfo(
    file: FileMetadata,
    extractedText?: string | null
  ): PreviewInfo {
    const format = this.classifyFormat(file.mimeType, file.name);
    const hasExtractedText = Boolean(extractedText && extractedText.trim().length > 0);

    let finalFormat = format;
    if (format === 'UNSUPPORTED' && hasExtractedText) {
      finalFormat = 'EXTRACTED_TEXT';
    }

    return {
      format: finalFormat,
      canStream: this.isStreamableMedia(finalFormat),
      canInlineView: this.supportsInlineViewing(finalFormat) || hasExtractedText,
      mimeType: file.mimeType,
      hasExtractedText,
      extractedSnippet: hasExtractedText
        ? (extractedText!.length > 500 ? extractedText!.substring(0, 500) + '...' : extractedText!)
        : undefined,
    };
  }
}
