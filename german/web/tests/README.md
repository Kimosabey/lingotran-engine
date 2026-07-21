# Tests

| Suite | Location | Rule |
| --- | --- | --- |
| Unit | `tests/unit/**` | Pure, hermetic, **no network**. Test ports/adapters/validators in isolation. |
| Integration | `tests/integration/**` | Run real stages against local `tests/fixtures/`. No live sites in CI. |

Run: `npm test` (watch: `npm run test:watch`, coverage: `npm run test:coverage`).

## What ships in the foundation

Working unit tests cover the implemented pieces — domain enums, the adapter
registry + base slug logic, and the schema validator. Everything awaiting the
phase-2 implementation is marked `it.todo` so the intended coverage is
visible and tracked.

## Best practices

- One behaviour per test; name by behaviour, not by method.
- Fake the ports (Logger, PageLoader, …) — never reach the network in units.
- Add a golden `*.expected.json` per fixture; assert schema-validity first,
  then counts, then content.
- Keep fixtures small and from robots-allowed public pages only.
