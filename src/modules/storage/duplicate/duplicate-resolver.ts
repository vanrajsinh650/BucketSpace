import {
  DuplicateAction,
  DuplicateCheckResult,
  DuplicatePolicySettings,
  DuplicateScenario,
  FileMetadata,
} from '@/shared';

export const DEFAULT_DUPLICATE_POLICY: DuplicatePolicySettings = {
  identicalContentPolicy: 'ASK',
  nameConflictPolicy: 'ASK',
};

/**
 * DuplicateResolver handles collision detection, duplicate checking,
 * and auto-numbering resolution (e.g. `report.pdf` -> `report (1).pdf`).
 *
 * Architecture Invariant:
 * Evaluated strictly ABOVE storage providers (at the application/orchestration layer).
 */
export class DuplicateResolver {
  /**
   * Evaluates an incoming file against existing active files to identify duplicate scenarios.
   */
  public static checkDuplicate(
    incomingName: string,
    incomingHash: string,
    existingFiles: FileMetadata[],
    policy: Partial<DuplicatePolicySettings> = {}
  ): DuplicateCheckResult {
    const activeFiles = existingFiles.filter((f) => f.status === 'ACTIVE');
    const existingNames = new Set(activeFiles.map((f) => f.name.toLowerCase()));

    // 1. Look for same-name match (case-insensitive)
    const sameNameFile = activeFiles.find(
      (f) => f.name.toLowerCase() === incomingName.toLowerCase()
    );

    // 2. Look for same-content match by SHA-256 hash
    const sameHashFile = activeFiles.find(
      (f) => f.wholeFileHash.toLowerCase() === incomingHash.toLowerCase()
    );

    let scenario: DuplicateScenario = 'UNIQUE';
    let existingFile: FileMetadata | undefined = undefined;

    if (sameNameFile) {
      existingFile = sameNameFile;
      if (sameNameFile.wholeFileHash.toLowerCase() === incomingHash.toLowerCase()) {
        scenario = 'SAME_NAME_IDENTICAL_CONTENT';
      } else {
        scenario = 'SAME_NAME_DIFFERENT_CONTENT';
      }
    } else if (sameHashFile) {
      // Different name, but identical content hash
      existingFile = sameHashFile;
      scenario = 'DIFFERENT_NAME_IDENTICAL_CONTENT';
    }

    const suggestedName = this.generateNumberedName(
      incomingName,
      Array.from(existingNames)
    );

    return {
      scenario,
      existingFile,
      suggestedName,
    };
  }

  /**
   * Generates a numbered filename (e.g. `document.pdf` -> `document (1).pdf` -> `document (2).pdf`)
   * avoiding collisions with any existing names in the target scope.
   */
  public static generateNumberedName(
    filename: string,
    existingNames: string[] | Set<string>
  ): string {
    const namesSet =
      existingNames instanceof Set
        ? new Set(Array.from(existingNames).map((n) => n.toLowerCase()))
        : new Set(existingNames.map((n) => n.toLowerCase()));

    if (!namesSet.has(filename.toLowerCase())) {
      return filename;
    }

    // Split filename into base and extension
    const lastDotIndex = filename.lastIndexOf('.');
    let baseName = filename;
    let extension = '';

    if (lastDotIndex > 0) {
      baseName = filename.substring(0, lastDotIndex);
      extension = filename.substring(lastDotIndex);
    }

    // Check if baseName already ends with (N)
    const copyMatch = baseName.match(/^(.*?)\s*\((\d+)\)$/);
    let cleanBase = baseName;
    let counter = 1;

    if (copyMatch) {
      cleanBase = copyMatch[1];
      counter = parseInt(copyMatch[2], 10) + 1;
    }

    let candidateName = `${cleanBase} (${counter})${extension}`;
    while (namesSet.has(candidateName.toLowerCase())) {
      counter++;
      candidateName = `${cleanBase} (${counter})${extension}`;
    }

    return candidateName;
  }

  /**
   * Resolves the automated action according to user policy if not set to 'ASK'.
   */
  public static resolvePolicyAction(
    result: DuplicateCheckResult,
    policy: DuplicatePolicySettings = DEFAULT_DUPLICATE_POLICY
  ): DuplicateAction | 'PROMPT_USER' {
    if (result.scenario === 'SAME_NAME_IDENTICAL_CONTENT') {
      if (policy.identicalContentPolicy === 'SKIP') return 'SKIP';
      if (policy.identicalContentPolicy === 'UPLOAD_ANYWAY') return 'UPLOAD_ANYWAY';
      return 'PROMPT_USER';
    }

    if (result.scenario === 'SAME_NAME_DIFFERENT_CONTENT') {
      if (policy.nameConflictPolicy === 'KEEP_BOTH') return 'KEEP_BOTH';
      if (policy.nameConflictPolicy === 'REPLACE_EXISTING') return 'REPLACE_EXISTING';
      return 'PROMPT_USER';
    }

    if (result.scenario === 'DIFFERENT_NAME_IDENTICAL_CONTENT') {
      // Preserves intentional alias naming by default
      return 'UPLOAD_ANYWAY';
    }

    return 'UPLOAD_ANYWAY';
  }
}
