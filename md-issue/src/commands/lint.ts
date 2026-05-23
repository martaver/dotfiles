import type { Command } from 'commander';

export function registerLint(program: Command): void {
  program
    .command('lint')
    .description('Reconcile mirror locations and stage the result.')
    .action(() => {
      console.log('lint: not yet implemented');
      process.exit(1);
    });
}
