/**
 * Asset-management port.
 *
 * Handles the images / media / downloadable files referenced by a page:
 * normalising URLs to absolute, optional local persistence, de-duplication
 * by content hash, and rewriting node references to their stored location.
 * Concrete behaviour (download vs. reference-only) is configuration-driven.
 */
import type { ImageNode, MediaNode, LinkNode } from '../models/content-node.model.js';

export interface ManagedAsset {
  /** Original absolute URL. */
  readonly url: string;
  /** Content hash once fetched (for dedupe), if persisted. */
  readonly hash?: string;
  /** Local path relative to the corpus, if persisted. */
  readonly localPath?: string;
}

export interface AssetManager {
  /** Resolve a possibly-relative asset URL against the page URL. */
  resolveUrl(assetUrl: string, pageUrl: string): string;
  /** Process a page's assets (persist/dedupe as configured). */
  process(assets: {
    images: ImageNode[];
    media: MediaNode[];
    links: LinkNode[];
  }): Promise<ManagedAsset[]>;
}
