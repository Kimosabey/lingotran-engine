/**
 * Barrel for the adapter layer.
 *
 * Exposes the port, the abstract base, the generic fallback, the registry
 * and the template. Concrete site adapters are added here as they are
 * implemented (none yet).
 */
export * from './adapter.interface.js';
export * from './base.adapter.js';
export * from './generic.adapter.js';
export * from './adapter.registry.js';
export { TemplateAdapter } from './_template.adapter.js';
