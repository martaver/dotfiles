import type { Command } from 'commander';

export function registerInit(program: Command): void {
  program
    .command('init')
    .description('Scaffold .md-issue/config.toml and create Provider Branches.')
    .action(() => {
      console.log('init: not yet implemented');
      process.exit(1);
    });
}
