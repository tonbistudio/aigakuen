import { Command } from 'commander';
import chalk from 'chalk';
import { OtakuRegistryStore, requireGakuenRoot } from '../storage';
import { OtakuStatus } from '../types';
import { logger } from '../utils';

export const rosterCommand = new Command('roster')
  .description('List all Otaku in the project')
  .option('-s, --status <status>', 'Filter by status')
  .option('--trained', 'Show only trained Otaku')
  .action(async (options) => {
    try {
      const projectRoot = requireGakuenRoot();
      const registry = new OtakuRegistryStore(projectRoot);

      let otakuList = registry.listOtaku();

      if (options.trained) {
        otakuList = registry.getTrainedOtaku();
      } else if (options.status) {
        otakuList = registry.getOtakuByStatus(options.status as OtakuStatus);
      }

      logger.blank();
      logger.header('📚 Otaku Roster');
      logger.blank();

      if (otakuList.length === 0) {
        logger.info('No Otaku registered yet.');
        logger.blank();
        logger.info('Run `aigakuen enroll <spec>` to analyze your project');
        logger.info('and get Otaku recommendations.');
        logger.blank();
        return;
      }

      for (const otaku of otakuList) {
        const statusIcon = getStatusIcon(otaku.status);
        const statusColor = getStatusColor(otaku.status);

        console.log(
          `  ${statusIcon} ${chalk.bold(otaku.name)} ${chalk.gray(`(${otaku.id})`)}`
        );
        console.log(`     ${chalk.cyan(otaku.specialty)}`);
        console.log(
          `     Status: ${statusColor(otaku.status)} | Domains: ${otaku.expertise.domains.join(', ')}`
        );

        if (otaku.catchphrase) {
          console.log(`     ${chalk.italic.gray(`"${otaku.catchphrase}"`)}`);
        }

        logger.blank();
      }

      logger.divider();
      logger.info(`Total: ${otakuList.length} Otaku`);
      logger.blank();
    } catch (error) {
      logger.error(
        error instanceof Error ? error.message : 'Unknown error'
      );
      process.exit(1);
    }
  });

function getStatusIcon(status: OtakuStatus): string {
  switch (status) {
    case 'recommended':
      return '💡';
    case 'training':
      return '📖';
    case 'idle':
      return '💤';
    case 'studying':
      return '✏️';
    case 'suspended':
      return '⏸️';
    case 'retired':
      return '🎓';
    default:
      return '❓';
  }
}

function getStatusColor(status: OtakuStatus): (text: string) => string {
  switch (status) {
    case 'recommended':
      return chalk.yellow;
    case 'training':
      return chalk.blue;
    case 'idle':
      return chalk.gray;
    case 'studying':
      return chalk.green;
    case 'suspended':
      return chalk.yellow;
    case 'retired':
      return chalk.gray;
    default:
      return chalk.white;
  }
}
