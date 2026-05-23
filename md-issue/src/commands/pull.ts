import type { Command } from 'commander';

export function registerPull(program: Command): void {
  program
    .command('pull')
    .description('Fetch provider state into the Provider Branch and merge into the working branch.')
    .action(() => {
      console.log('pull: not yet implemented');
      process.exit(1);
    });
}
