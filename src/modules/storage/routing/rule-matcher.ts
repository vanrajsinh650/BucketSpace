import {
  ConditionField,
  ConditionOperator,
  FileRoutingInfo,
  RuleCondition,
  StorageRule,
} from '@/shared';

/**
 * Pure function: extract the file extension from a filename.
 * Returns the extension without the dot, lowercased. E.g., "report.PDF" → "pdf"
 */
function extractExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === filename.length - 1) return '';
  return filename.substring(lastDot + 1).toLowerCase();
}

/**
 * Evaluate a single condition against a file's routing info.
 * String operators (equals, startsWith, endsWith, contains) work on mimeType and extension.
 * Numeric operators (gt, gte, lt, lte) work on size.
 */
export function matchesCondition(condition: RuleCondition, fileInfo: FileRoutingInfo): boolean {
  const { field, operator, value } = condition;

  // Resolve the actual value from the file based on the condition field
  let fieldValue: string | number;

  switch (field) {
    case 'mimeType':
      fieldValue = fileInfo.mimeType.toLowerCase();
      break;
    case 'extension':
      fieldValue = extractExtension(fileInfo.name);
      break;
    case 'size':
      fieldValue = fileInfo.size;
      break;
    default:
      return false;
  }

  // String field operators
  if (field === 'mimeType' || field === 'extension') {
    const target = value.toLowerCase();
    const strValue = fieldValue as string;

    switch (operator) {
      case 'equals':     return strValue === target;
      case 'startsWith': return strValue.startsWith(target);
      case 'endsWith':   return strValue.endsWith(target);
      case 'contains':   return strValue.includes(target);
      default:           return false;
    }
  }

  // Numeric field operators (size)
  if (field === 'size') {
    const numValue = fieldValue as number;
    const threshold = Number(value);

    if (Number.isNaN(threshold)) return false;

    switch (operator) {
      case 'gt':  return numValue > threshold;
      case 'gte': return numValue >= threshold;
      case 'lt':  return numValue < threshold;
      case 'lte': return numValue <= threshold;
      default:    return false;
    }
  }

  return false;
}

/**
 * Evaluate ALL conditions in a rule against a file. Uses AND logic:
 * every condition must pass for the rule to match.
 * A rule with zero conditions never matches (safety guard).
 */
export function matchesRule(rule: StorageRule, fileInfo: FileRoutingInfo): boolean {
  if (rule.conditions.length === 0) return false;
  return rule.conditions.every((cond) => matchesCondition(cond, fileInfo));
}
