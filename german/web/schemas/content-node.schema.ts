/**
 * Runtime (zod) validation schemas for the content-node tree.
 *
 * These MIRROR the pure domain types in `models/content-node.model.ts`.
 * The models remain the compile-time source of truth; these schemas are the
 * runtime boundary guard (parse untrusted extraction output before emit).
 * Values for the discriminant come from `models/enums.ts` so the two never
 * drift.
 */
import { z } from 'zod';
import { LINK_KINDS, MEDIA_KINDS } from '../models/enums.js';

const baseNode = {
  id: z.string().min(1),
  order: z.number().int().nonnegative(),
  sourceSelector: z.string().optional(),
};

/** Recursive list-item shape (sub-lists preserved). */
export type ListItemShape = { text: string; children?: ListItemShape[] };
export const listItemSchema: z.ZodType<ListItemShape> = z.lazy(() =>
  z.object({
    text: z.string(),
    children: z.array(listItemSchema).optional(),
  }),
);

export const headingNodeSchema = z.object({
  ...baseNode,
  type: z.literal('heading'),
  level: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
  text: z.string(),
});

export const paragraphNodeSchema = z.object({
  ...baseNode,
  type: z.literal('paragraph'),
  text: z.string(),
  html: z.string().optional(),
});

export const listNodeSchema = z.object({
  ...baseNode,
  type: z.literal('list'),
  ordered: z.boolean(),
  items: z.array(listItemSchema),
});

export const tableNodeSchema = z.object({
  ...baseNode,
  type: z.literal('table'),
  caption: z.string().optional(),
  headers: z.array(z.array(z.string())),
  rows: z.array(z.array(z.string())),
});

export const imageNodeSchema = z.object({
  ...baseNode,
  type: z.literal('image'),
  src: z.string(),
  alt: z.string(),
  title: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

export const figureNodeSchema = z.object({
  ...baseNode,
  type: z.literal('figure'),
  image: z.object({
    src: z.string(),
    alt: z.string(),
    title: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  }),
  caption: z.string().optional(),
});

export const mediaNodeSchema = z.object({
  ...baseNode,
  type: z.literal('media'),
  kind: z.enum(MEDIA_KINDS),
  src: z.string(),
  title: z.string().optional(),
});

export const linkNodeSchema = z.object({
  ...baseNode,
  type: z.literal('link'),
  href: z.string(),
  text: z.string(),
  kind: z.enum(LINK_KINDS),
});

export const quoteNodeSchema = z.object({
  ...baseNode,
  type: z.literal('quote'),
  text: z.string(),
  cite: z.string().optional(),
});

export const codeNodeSchema = z.object({
  ...baseNode,
  type: z.literal('code'),
  text: z.string(),
  language: z.string().optional(),
});

/**
 * The full node union, including the recursive `section` container. Declared
 * via `z.lazy` because `section.children` references the union itself.
 */
export const contentNodeSchema: z.ZodType<ContentNodeShape> = z.lazy(() =>
  z.union([
    sectionNodeSchema,
    headingNodeSchema,
    paragraphNodeSchema,
    listNodeSchema,
    tableNodeSchema,
    imageNodeSchema,
    figureNodeSchema,
    mediaNodeSchema,
    linkNodeSchema,
    quoteNodeSchema,
    codeNodeSchema,
  ]),
);

export const sectionNodeSchema: z.ZodType<SectionNodeShape> = z.lazy(() =>
  z.object({
    ...baseNode,
    type: z.literal('section'),
    heading: z.string().optional(),
    children: z.array(contentNodeSchema),
  }),
);

/** Structural mirrors used only to type the recursive lazy schemas. */
export type SectionNodeShape = {
  id: string;
  order: number;
  sourceSelector?: string;
  type: 'section';
  heading?: string;
  children: ContentNodeShape[];
};
export type ContentNodeShape =
  | SectionNodeShape
  | z.infer<typeof headingNodeSchema>
  | z.infer<typeof paragraphNodeSchema>
  | z.infer<typeof listNodeSchema>
  | z.infer<typeof tableNodeSchema>
  | z.infer<typeof imageNodeSchema>
  | z.infer<typeof figureNodeSchema>
  | z.infer<typeof mediaNodeSchema>
  | z.infer<typeof linkNodeSchema>
  | z.infer<typeof quoteNodeSchema>
  | z.infer<typeof codeNodeSchema>;
