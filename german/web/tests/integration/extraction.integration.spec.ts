import { describe, it } from 'vitest';

/**
 * Integration coverage for phase 2. These run the real stage implementations
 * against LOCAL HTML fixtures in `tests/fixtures/` — never live websites in
 * CI. A live-site smoke test may be gated behind an env flag + explicit
 * authorization.
 *
 * Planned cases:
 *  - static fixture  -> full PageDocument, schema-valid, correct node counts
 *  - dynamic fixture -> accordions/tabs expanded before extraction
 *  - chrome stripped -> nav/header/footer/ads excluded from output
 *  - Markdown emit   -> frontmatter matches webFrontmatterSchema
 *  - completeness    -> `incomplete` flagged when main content is empty
 */
describe('extraction (integration, fixtures)', () => {
  it.todo('extracts a static fixture into a schema-valid PageDocument');
  it.todo('expands dynamic UI before extraction');
  it.todo('excludes navigation/header/footer/ads');
  it.todo('emits French-compatible Markdown frontmatter');
});
