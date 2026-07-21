/**
 * Credential-provider port (OPT-IN authentication support).
 *
 * Some authorized crawls require a logged-in session. This port resolves a
 * named credential from a secret source (env var, secret manager) at
 * runtime. Rules enforced by every implementation:
 *   - Credentials are NEVER hardcoded, committed, or written to the corpus.
 *   - Credentials are NEVER logged (redact in the Logger).
 *   - Authenticated crawling of robots-disallowed / paywalled areas requires
 *     explicit written authorization (see the module README).
 *
 * This is an interface only — no implementation and no stored secrets ship
 * with the foundation.
 */
export interface Credential {
  readonly username: string;
  readonly secret: string;
}

export interface CredentialProvider {
  /**
   * Resolve the credential registered under `name` (e.g. an adapter id).
   * Returns undefined when none is configured — callers must treat the crawl
   * as anonymous rather than failing hard.
   */
  resolve(name: string): Promise<Credential | undefined>;
}
