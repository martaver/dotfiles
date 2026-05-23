import { describe, expect, test } from 'bun:test';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigError, loadConfig } from '../../src/config/load.ts';
import { compileMappings, providerForPath } from '../../src/config/mappings.ts';

const VALID_TOML = `
[status]
" " = "<default>"
"x" = "Done"

[[providers]]
name = "jira-main"
type = "jira"
host = "company.atlassian.net"
default-project = "FE"
default-issue-type = "Story"
epic-issue-type = "Epic"
auth-cmd = "op read op://Personal/Jira/api-token"

[[providers]]
name = "github-platform"
type = "github"
owner = "myorg"
repo = "platform"
auth-cmd = "gh auth token"

[[mappings]]
glob = "platform/**"
provider = "github-platform"

[[mappings]]
glob = "**"
provider = "jira-main"
`;

async function writeConfig(contents: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'md-issue-config-'));
  await mkdir(join(dir, '.md-issue'));
  const path = join(dir, '.md-issue', 'config.toml');
  await writeFile(path, contents);
  return path;
}

describe('loadConfig', () => {
  test('loads a valid config', async () => {
    const path = await writeConfig(VALID_TOML);
    const cfg = await loadConfig(path);
    expect(cfg.providers).toHaveLength(2);
    expect(cfg.providers[0]?.name).toBe('jira-main');
    expect(cfg.mappings).toHaveLength(2);
  });

  test('rejects invalid TOML', async () => {
    const path = await writeConfig('not = valid = toml');
    await expect(loadConfig(path)).rejects.toBeInstanceOf(ConfigError);
  });

  test('rejects missing required field', async () => {
    const path = await writeConfig(
      `[[providers]]\nname = "x"\ntype = "jira"\nhost = "h"\n[[mappings]]\nglob = "**"\nprovider = "x"`,
    );
    // default-project + auth-cmd missing
    await expect(loadConfig(path)).rejects.toBeInstanceOf(ConfigError);
  });

  test('rejects mapping that references unknown provider', async () => {
    const path = await writeConfig(`
[[providers]]
name = "jira-main"
type = "jira"
host = "h"
default-project = "FE"
auth-cmd = "echo"

[[mappings]]
glob = "**"
provider = "does-not-exist"
`);
    await expect(loadConfig(path)).rejects.toThrow(/unknown provider/);
  });

  test('rejects missing providers section entirely', async () => {
    const path = await writeConfig(`[[mappings]]\nglob = "**"\nprovider = "x"\n`);
    await expect(loadConfig(path)).rejects.toBeInstanceOf(ConfigError);
  });
});

describe('providerForPath', () => {
  test('first match wins', async () => {
    const path = await writeConfig(VALID_TOML);
    const cfg = await loadConfig(path);
    const compiled = compileMappings(cfg);

    expect(providerForPath('platform/auth/index.md', cfg, compiled)?.name).toBe(
      'github-platform',
    );
    expect(providerForPath('projects/frontend/foo.md', cfg, compiled)?.name).toBe('jira-main');
    expect(providerForPath('anywhere.md', cfg, compiled)?.name).toBe('jira-main');
  });

  test('returns null when nothing matches', async () => {
    const path = await writeConfig(`
[[providers]]
name = "jira-main"
type = "jira"
host = "h"
default-project = "FE"
auth-cmd = "echo"

[[mappings]]
glob = "projects/**"
provider = "jira-main"
`);
    const cfg = await loadConfig(path);
    expect(providerForPath('elsewhere.md', cfg)).toBeNull();
  });
});
