/**
 * The content-node domain model.
 *
 * An extracted page is represented as an ORDERED TREE of typed nodes so that
 * document hierarchy and reading order are preserved. Nodes form a
 * discriminated union keyed on `type` (see {@link NodeType}).
 *
 * Pure domain types — no zod, no DOM, no framework references. Runtime
 * validation lives in `schemas/`.
 */
import type { NodeType, LinkKind, MediaKind } from './enums.js';

/** Fields shared by every node. */
export interface BaseNode {
  /** Stable id within a page (assigned at extraction time). */
  readonly id: string;
  readonly type: NodeType;
  /** 0-based reading order within the parent. */
  readonly order: number;
  /** Optional CSS path the node was extracted from (debug/provenance). */
  readonly sourceSelector?: string;
}

/** A container that groups child nodes, preserving hierarchy (e.g. an article <section>). */
export interface SectionNode extends BaseNode {
  readonly type: 'section';
  readonly heading?: string;
  readonly children: ContentNode[];
}

export interface HeadingNode extends BaseNode {
  readonly type: 'heading';
  /** H1–H6. */
  readonly level: 1 | 2 | 3 | 4 | 5 | 6;
  readonly text: string;
}

export interface ParagraphNode extends BaseNode {
  readonly type: 'paragraph';
  readonly text: string;
  /** Optional inline HTML if formatting must be preserved. */
  readonly html?: string;
}

export interface ListItem {
  readonly text: string;
  /** Nested sub-list items, preserving list hierarchy. */
  readonly children?: ListItem[];
}

export interface ListNode extends BaseNode {
  readonly type: 'list';
  readonly ordered: boolean;
  readonly items: ListItem[];
}

export interface TableNode extends BaseNode {
  readonly type: 'table';
  readonly caption?: string;
  /** Header rows (each a row of cell strings). */
  readonly headers: string[][];
  /** Body rows. */
  readonly rows: string[][];
}

export interface ImageNode extends BaseNode {
  readonly type: 'image';
  readonly src: string;
  readonly alt: string;
  readonly title?: string;
  readonly width?: number;
  readonly height?: number;
}

export interface FigureNode extends BaseNode {
  readonly type: 'figure';
  readonly image: Omit<ImageNode, keyof BaseNode | 'type'>;
  readonly caption?: string;
}

export interface MediaNode extends BaseNode {
  readonly type: 'media';
  readonly kind: MediaKind;
  readonly src: string;
  readonly title?: string;
}

export interface LinkNode extends BaseNode {
  readonly type: 'link';
  readonly href: string;
  readonly text: string;
  readonly kind: LinkKind;
}

export interface QuoteNode extends BaseNode {
  readonly type: 'quote';
  readonly text: string;
  readonly cite?: string;
}

export interface CodeNode extends BaseNode {
  readonly type: 'code';
  readonly text: string;
  readonly language?: string;
}

/** Discriminated union of every content node. */
export type ContentNode =
  | SectionNode
  | HeadingNode
  | ParagraphNode
  | ListNode
  | TableNode
  | ImageNode
  | FigureNode
  | MediaNode
  | LinkNode
  | QuoteNode
  | CodeNode;
