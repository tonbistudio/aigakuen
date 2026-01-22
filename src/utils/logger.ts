import chalk from 'chalk';

export const logger = {
  info: (message: string) => {
    console.log(chalk.blue('ℹ'), message);
  },

  success: (message: string) => {
    console.log(chalk.green('✓'), message);
  },

  warn: (message: string) => {
    console.log(chalk.yellow('⚠'), message);
  },

  error: (message: string) => {
    console.log(chalk.red('✗'), message);
  },

  debug: (message: string) => {
    if (process.env.DEBUG) {
      console.log(chalk.gray('⋯'), message);
    }
  },

  gakuen: (message: string) => {
    console.log(chalk.magenta('🎓'), message);
  },

  otaku: (name: string, message: string) => {
    console.log(chalk.cyan(`📖 ${name}:`), message);
  },

  task: (message: string) => {
    console.log(chalk.yellow('📋'), message);
  },

  divider: () => {
    console.log(chalk.gray('─'.repeat(50)));
  },

  blank: () => {
    console.log();
  },

  header: (title: string) => {
    console.log();
    console.log(chalk.bold.white(title));
    console.log(chalk.gray('─'.repeat(title.length)));
  },

  item: (message: string) => {
    console.log(chalk.gray('  •'), message);
  },
};
