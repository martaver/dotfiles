import type { Command } from 'commander';

export function registerPush(program: Command): void {
  program
    .command('push')
    .description('Send staged changes to each configured Provider.')
    .action(() => {
      console.log('push: not yet implemented');
      process.exit(1);
    });
}
