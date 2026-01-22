import { Command } from 'commander';
import { basename } from 'path';
import { GakuenStore } from '../storage';
import { logger } from '../utils';

export const initCommand = new Command('init')
  .description('Initialize AI Gakuen in the current project')
  .option('-n, --name <name>', 'Project name')
  .action(async (options) => {
    const projectRoot = process.cwd();
    const store = new GakuenStore(projectRoot);

    if (store.isInitialized()) {
      logger.warn('AI Gakuen is already initialized in this project.');
      return;
    }

    const projectName = options.name || basename(projectRoot);

    try {
      const config = store.initialize(projectName);

      logger.blank();
      logger.gakuen('AI Gakuen initialized!');
      logger.blank();
      logger.info(`Project: ${config.projectName}`);
      logger.info(`Location: ${projectRoot}/.gakuen/`);
      logger.blank();
      logger.divider();
      logger.blank();
      logger.info('Next steps:');
      logger.info('  1. Create or add your project spec/PRD');
      logger.info('  2. Run: aigakuen enroll <path-to-spec>');
      logger.info('  3. Train your Otaku specialists');
      logger.blank();
    } catch (error) {
      logger.error(
        `Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      process.exit(1);
    }
  });
