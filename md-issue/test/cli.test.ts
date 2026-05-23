import { describe, expect, test } from 'bun:test';
import { buildCli } from '../src/cli.ts';

describe('cli', () => {
  test('builds with the expected subcommands', () => {
    const program = buildCli();
    const names = program.commands.map((c) => c.name()).toSorted();
    expect(names).toEqual(['init', 'lint', 'pull', 'push']);
  });

  test('exposes the package name and version', () => {
    const program = buildCli();
    expect(program.name()).toBe('md-issue');
    expect(program.version()).toBe('0.0.0');
  });
});
