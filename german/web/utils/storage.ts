/**
 * Concrete AssetManager + a manifest.tsv-backed StateStore.
 *
 * The state store is the web analogue of the French `manifest.tsv` — the
 * authoritative per-page resume anchor enabling incremental extraction.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ImageNode, MediaNode, LinkNode } from '../models/content-node.model.js';
import type { AssetManager, ManagedAsset } from './asset-manager.interface.js';
import type { StateStore, PageState } from './state-store.interface.js';
import type { ProcessingStatus, QaStatus } from '../models/enums.js';

export class AssetManagerImpl implements AssetManager {
  resolveUrl(assetUrl: string, pageUrl: string): string {
    try {
      return new URL(assetUrl, pageUrl).href;
    } catch {
      return assetUrl;
    }
  }

  async process(assets: {
    images: ImageNode[];
    media: MediaNode[];
    links: LinkNode[];
  }): Promise<ManagedAsset[]> {
    // Reference-only in phase 2 (no local persistence yet).
    return [
      ...assets.images.map((a) => ({ url: a.src })),
      ...assets.media.map((a) => ({ url: a.src })),
      ...assets.links.map((a) => ({ url: a.href })),
    ];
  }
}

const COLS = ['slug', 'url', 'status', 'qa', 'content_hash', 'updated_at'] as const;

export class ManifestStateStore implements StateStore {
  constructor(private readonly manifestPath: string) {}

  async list(): Promise<PageState[]> {
    let raw = '';
    try {
      raw = await readFile(this.manifestPath, 'utf8');
    } catch {
      return [];
    }
    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length <= 1) return [];
    return lines.slice(1).map((line) => {
      const cells = line.split('\t');
      const get = (name: string): string => cells[COLS.indexOf(name as (typeof COLS)[number])] ?? '';
      return {
        slug: get('slug'),
        sourceUrl: get('url'),
        status: (get('status') || 'pending') as ProcessingStatus,
        qa: (get('qa') || 'pending') as QaStatus,
        contentHash: get('content_hash') || undefined,
        updatedAt: get('updated_at') || undefined,
      };
    });
  }

  async get(slug: string): Promise<PageState | undefined> {
    return (await this.list()).find((s) => s.slug === slug);
  }

  async set(state: PageState): Promise<void> {
    const rows = await this.list();
    const idx = rows.findIndex((r) => r.slug === state.slug);
    if (idx >= 0) rows[idx] = state;
    else rows.push(state);
    await this.write(rows);
  }

  async isStale(slug: string, currentHash?: string): Promise<boolean> {
    const s = await this.get(slug);
    if (!s) return true;
    if (currentHash && s.contentHash && s.contentHash !== currentHash) return true;
    return s.status !== 'verified';
  }

  private async write(rows: PageState[]): Promise<void> {
    const esc = (v: string): string => v.replace(/[\t\r\n]+/g, ' ');
    const header = COLS.join('\t');
    const body = rows
      .map((r) =>
        [r.slug, r.sourceUrl, r.status, r.qa, r.contentHash ?? '', r.updatedAt ?? '']
          .map((c) => esc(String(c)))
          .join('\t'),
      )
      .join('\n');
    await mkdir(dirname(this.manifestPath), { recursive: true });
    await writeFile(this.manifestPath, `${header}\n${body}\n`, 'utf8');
  }
}
