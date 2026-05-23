#!/usr/bin/env bun
import { Command } from 'commander';
import { registerInit } from './commands/init.ts';
import { registerLint } from './commands/lint.ts';
import { registerPull } from './commands/pull.ts';
import { registerPush } from './commands/push.ts';

export function buildCli(): Command {
  const program = new Command();

  program
    .name('md-issue')
    .description('Two-way sync between markdown files and an issue tracker.')
    .version('0.0.0');

  registerInit(program);
  registerLint(program);
  registerPush(program);
  registerPull(program);

  return program;
}

if (import.meta.main) {
  await buildCli().parseAsync(process.argv);
}
