import * as readline from 'readline';

/**
 * Prompt the user for confirmation
 */
export async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} [Y/n] `, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === '' || normalized === 'y' || normalized === 'yes');
    });
  });
}

/**
 * Prompt the user for text input
 */
export async function input(message: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message}: `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Prompt the user to select from options
 */
export async function select(
  message: string,
  options: string[]
): Promise<number> {
  console.log(message);
  options.forEach((opt, i) => {
    console.log(`  ${i + 1}. ${opt}`);
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Select [1]: ', (answer) => {
      rl.close();
      const num = parseInt(answer.trim(), 10);
      if (isNaN(num) || num < 1 || num > options.length) {
        resolve(0); // Default to first option
      } else {
        resolve(num - 1);
      }
    });
  });
}
