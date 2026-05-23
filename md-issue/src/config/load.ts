import { readFile } from 'node:fs/promises';
import { parse as parseToml } from 'smol-toml';
import { Check, Errors } from 'typebox/value';
import { ConfigSchema, type Config } from './schema.ts';

export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly path: string,
    public readonly issues: readonly { path: string; message: string }[] = [],
  ) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Load `.md-issue/config.toml` from `configPath` and validate against the
 * typebox schema. Throws `ConfigError` with a human-readable message on
 * failure.
 */
export async function loadConfig(configPath: string): Promise<Config> {
  let raw: string;
  try {
    raw = await readFile(configPath, 'utf8');
  } catch (err) {
    throw new ConfigError(
      `Cannot read config at ${configPath}: ${(err as Error).message}`,
      configPath,
    );
  }

  let parsed: unknown;
  try {
    parsed = parseToml(raw);
  } catch (err) {
    throw new ConfigError(
      `Invalid TOML in ${configPath}: ${(err as Error).message}`,
      configPath,
    );
  }

  if (!Check(ConfigSchema, parsed)) {
    const issues = Errors(ConfigSchema, parsed).map((e) => ({
      path: e.instancePath,
      message: e.message,
    }));
    const summary = issues
      .map((i) => `  - ${i.path || '(root)'}: ${i.message}`)
      .join('\n');
    throw new ConfigError(
      `Config validation failed for ${configPath}:\n${summary}`,
      configPath,
      issues,
    );
  }

  // Cross-field check: every mapping.provider must reference a declared provider.
  const providerNames = new Set(parsed.providers.map((p) => p.name));
  for (const m of parsed.mappings) {
    if (!providerNames.has(m.provider)) {
      throw new ConfigError(
        `Mapping references unknown provider "${m.provider}" (glob: ${m.glob})`,
        configPath,
      );
    }
  }

  return parsed;
}
