#!/usr/bin/env bun
import { Command } from 'commander';
import { initCommand } from './commands/init';
import { rosterCommand } from './commands/roster';
import { homeroomCommand } from './commands/homeroom';
import { enrollCommand } from './commands/enroll';
import { trainCommand } from './commands/train';
import { trainBatchCommand } from './commands/train-batch';
import { retrainCommand } from './commands/retrain';
import { studyCommand } from './commands/study';
import { switchCommand } from './commands/switch';
import { handoffCommand } from './commands/handoff';
import { assignCommand } from './commands/assign';
import { tasksCommand } from './commands/tasks';
import { reflectCommand } from './commands/reflect';

const program = new Command();

program
  .name('aigakuen')
  .description('AI Gakuen - Hyper-specialized Otaku agents for Claude Code')
  .version('0.1.0');

// Core commands
program.addCommand(initCommand);
program.addCommand(enrollCommand);
program.addCommand(trainCommand);
program.addCommand(trainBatchCommand);
program.addCommand(retrainCommand);
program.addCommand(studyCommand);
program.addCommand(switchCommand);
program.addCommand(handoffCommand);
program.addCommand(homeroomCommand);

// Otaku management
program.addCommand(rosterCommand);

// Task management
program.addCommand(assignCommand);
program.addCommand(tasksCommand);

// Self-improvement
program.addCommand(reflectCommand);

program.parse();
