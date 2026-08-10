export interface StorageRoutingRule {
  id: string;
  name: string;
  match: {
    mimeTypePrefix?: string;
    extensions?: string[];
  };
  targetProviderId: string;
}

/**
 * StorageRouter evaluates user-configured rules to route files dynamically to
 * the appropriate target storage provider (Telegram, Local Disk, S3/R2, Supabase)
 * while presenting a single unified drive interface to the user.
 */
export class StorageRouter {
  private rules: StorageRoutingRule[] = [];
  private defaultProviderId: string;

  constructor(defaultProviderId: string = 'local-disk') {
    this.defaultProviderId = defaultProviderId;
    this.setupDefaultRules();
  }

  public addRule(rule: StorageRoutingRule): void {
    this.rules.unshift(rule);
  }

  public removeRule(ruleId: string): boolean {
    const idx = this.rules.findIndex((r) => r.id === ruleId);
    if (idx !== -1) {
      this.rules.splice(idx, 1);
      return true;
    }
    return false;
  }

  public getRules(): StorageRoutingRule[] {
    return [...this.rules];
  }

  public clearRules(): void {
    this.rules = [];
  }

  public setDefaultProvider(providerId: string): void {
    this.defaultProviderId = providerId;
  }

  public resolveProviderId(file: { name: string; mimeType: string; size?: number }): string {
    const filenameLower = file.name.toLowerCase();

    for (const rule of this.rules) {
      if (rule.match.mimeTypePrefix && file.mimeType.startsWith(rule.match.mimeTypePrefix)) {
        return rule.targetProviderId;
      }
      if (rule.match.extensions) {
        for (const ext of rule.match.extensions) {
          if (filenameLower.endsWith(ext.toLowerCase())) {
            return rule.targetProviderId;
          }
        }
      }
    }

    return this.defaultProviderId;
  }

  private setupDefaultRules(): void {
    this.rules = [
      {
        id: 'rule-photos-telegram',
        name: 'Photos to Telegram',
        match: { mimeTypePrefix: 'image/' },
        targetProviderId: 'telegram',
      },
      {
        id: 'rule-videos-s3',
        name: 'Videos to S3 / Cloudflare R2',
        match: { mimeTypePrefix: 'video/' },
        targetProviderId: 's3-r2',
      },
      {
        id: 'rule-docs-supabase',
        name: 'Documents to Supabase',
        match: { extensions: ['.pdf', '.doc', '.docx', '.txt', '.md'] },
        targetProviderId: 'supabase',
      },
    ];
  }
}
