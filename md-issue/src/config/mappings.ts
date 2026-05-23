import picomatch from 'picomatch';
import type { Config, Mapping, Provider } from './schema.ts';

export type CompiledMapping = {
  mapping: Mapping;
  match: (path: string) => boolean;
};

/**
 * Compile glob mappings once so repeated lookups are cheap. First match wins.
 */
export function compileMappings(config: Config): CompiledMapping[] {
  return config.mappings.map((mapping) => ({
    mapping,
    match: picomatch(mapping.glob, { dot: true }),
  }));
}

/**
 * Resolve a workspace-relative `path` to its `Provider`. Returns null if no
 * mapping matches (caller decides whether that's an error).
 */
export function providerForPath(
  path: string,
  config: Config,
  compiled?: CompiledMapping[],
): Provider | null {
  const mappings = compiled ?? compileMappings(config);
  for (const c of mappings) {
    if (c.match(path)) {
      const provider = config.providers.find((p) => p.name === c.mapping.provider);
      return provider ?? null;
    }
  }
  return null;
}
