import type { Command } from 'commander';
import { resolve } from 'node:path';
import { runLint } from '../lint/lint.ts';
import { loadConfig } from '../config/load.ts';

export function registerLint(program: Command): void {
  program
    .command('lint')
    .description('Reconcile mirror locations and stage the result.')
    .option('-w, --workspace <path>', 'Workspace root (defaults to cwd).')
    .action(async (opts: { workspace?: string }) => {
      const workspaceRoot = resolve(opts.workspace ?? process.cwd());
      let statusTable: Record<string, string> | undefined;
      try {
        const config = await loadConfig(`${workspaceRoot}/.md-issue/config.toml`);
        statusTable = config.status;
      } catch {
        // Config is optional for lint; missing config means no status mapping.
      }
      const lintOptions: Parameters<typeof runLint>[0] = { workspaceRoot };
      if (statusTable) lintOptions.statusTable = statusTable;
      const result = await runLint(lintOptions);

      const touched = result.applied.filter((a) => a.touched);
      console.log(`Reconciled ${touched.length} item(s).`);
      for (const a of touched) {
        const moved = a.baselinePath && a.baselinePath !== a.newPath ? ` (was ${a.baselinePath})` : '';
        console.log(`  ${a.newPath}${moved}`);
      }
      if (result.conflicts.length > 0) {
        console.log(`Conflicts on ${result.conflicts.length} item(s):`);
        for (const c of result.conflicts) console.log(`  ${c.newPath}`);
        process.exit(1);
      }
    });
}
