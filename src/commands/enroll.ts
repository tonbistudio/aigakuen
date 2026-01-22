import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { logger } from '../utils';
import {
  GakuenStore,
  OtakuRegistryStore,
  requireGakuenRoot,
} from '../storage';
import { parseSpec } from '../core/analyzer/spec-parser';
import { extractDomains } from '../core/analyzer/domain-extractor';
import {
  recommendOtakuWithProgress,
  type OtakuRecommendation,
} from '../core/analyzer/otaku-recommender';
import { confirm } from '../ui/prompts';
import {
  createCheckpoint,
  findCheckpointForSpec,
  loadCheckpoint,
  updateWithParsedSpec,
  updateWithDomains,
  updateWithBatchProgress,
  markOtakuComplete,
  markConfirmed,
  markFailed,
  deleteCheckpoint,
  listCheckpoints,
  hashSpec,
  type EnrollmentCheckpoint,
} from '../core/enrollment';

export const enrollCommand = new Command('enroll')
  .description('Analyze a spec/PRD and recommend Otaku specialists')
  .argument('[spec]', 'Path to the spec or PRD file')
  .option('-y, --yes', 'Skip confirmation and enroll all recommended Otaku')
  .option('-r, --resume [id]', 'Resume from a previous checkpoint')
  .option('--list-checkpoints', 'List all enrollment checkpoints')
  .option('--clean-checkpoints', 'Clean up old checkpoints')
  .action(async (specPath, options) => {
    try {
      const projectRoot = requireGakuenRoot();
      const store = new GakuenStore(projectRoot);
      const registry = new OtakuRegistryStore(projectRoot);
      const gakuenPath = store.getGakuenPath();

      // Handle checkpoint management commands
      if (options.listCheckpoints) {
        const checkpoints = listCheckpoints(gakuenPath);
        if (checkpoints.length === 0) {
          logger.info('No enrollment checkpoints found.');
          return;
        }
        console.log(chalk.bold('\nEnrollment Checkpoints:\n'));
        for (const cp of checkpoints) {
          const statusColor = cp.canResume ? chalk.yellow : chalk.gray;
          console.log(`  ${chalk.cyan(cp.id)}`);
          console.log(`    Spec: ${cp.specPath}`);
          console.log(`    Status: ${statusColor(cp.status)} - ${cp.progress}`);
          console.log(`    Updated: ${new Date(cp.updatedAt).toLocaleString()}`);
          if (cp.canResume) {
            console.log(`    ${chalk.green('Can resume')}: aigakuen enroll --resume ${cp.id}`);
          }
          console.log();
        }
        return;
      }

      if (options.cleanCheckpoints) {
        const { cleanupCheckpoints } = await import('../core/enrollment');
        const cleaned = cleanupCheckpoints(gakuenPath);
        logger.success(`Cleaned up ${cleaned} old checkpoint(s).`);
        return;
      }

      // Determine if resuming or starting fresh
      let checkpoint: EnrollmentCheckpoint | null = null;

      if (options.resume) {
        // Resume from specific checkpoint or find one
        if (typeof options.resume === 'string') {
          checkpoint = loadCheckpoint(gakuenPath, options.resume);
          if (!checkpoint) {
            logger.error(`Checkpoint not found: ${options.resume}`);
            logger.info('Use --list-checkpoints to see available checkpoints.');
            process.exit(1);
          }
        } else if (specPath) {
          // Try to find checkpoint for this spec
          const absPath = resolve(specPath);
          const specContent = readFileSync(absPath, 'utf-8');
          checkpoint = findCheckpointForSpec(gakuenPath, absPath, specContent);
        }

        if (checkpoint) {
          logger.blank();
          console.log(chalk.bold.yellow('📋 Resuming from checkpoint...'));
          console.log(chalk.gray(`   Status: ${checkpoint.status}`));
          console.log(chalk.gray(`   Progress: batch ${checkpoint.currentBatch}/${checkpoint.totalBatches}`));
          logger.blank();
        }
      }

      // If no checkpoint found and no spec path, error
      if (!checkpoint && !specPath) {
        logger.error('Please provide a spec file path or use --resume to continue a previous enrollment.');
        process.exit(1);
      }

      // Start or resume enrollment
      await runEnrollment({
        projectRoot,
        store,
        registry,
        gakuenPath,
        specPath: checkpoint?.specPath || resolve(specPath),
        checkpoint,
        skipConfirmation: options.yes,
      });

    } catch (error) {
      logger.blank();
      logger.error(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

interface EnrollmentContext {
  projectRoot: string;
  store: GakuenStore;
  registry: OtakuRegistryStore;
  gakuenPath: string;
  specPath: string;
  checkpoint: EnrollmentCheckpoint | null;
  skipConfirmation: boolean;
}

async function runEnrollment(ctx: EnrollmentContext): Promise<void> {
  let checkpoint = ctx.checkpoint;
  const { store, registry, gakuenPath, specPath, skipConfirmation } = ctx;

  try {
    // Read spec content
    const specContent = readFileSync(specPath, 'utf-8');

    // Create checkpoint if not resuming
    if (!checkpoint) {
      logger.blank();
      console.log(chalk.bold.magenta('📚 Analyzing curriculum...'));
      logger.blank();
      checkpoint = createCheckpoint(gakuenPath, specPath, specContent);
    }

    // Step 1: Parse spec (if not already done)
    let spec = checkpoint.parsedSpec;
    if (!spec) {
      const parseSpinner = ora('Parsing spec file...').start();
      try {
        spec = await parseSpec(specPath);
        checkpoint = updateWithParsedSpec(gakuenPath, checkpoint, spec);
        parseSpinner.succeed(`Parsed: ${chalk.cyan(spec.title)}`);
      } catch (error) {
        parseSpinner.fail('Failed to parse spec');
        markFailed(gakuenPath, checkpoint, String(error));
        throw error;
      }
    } else {
      console.log(chalk.green('✔') + ` Spec already parsed: ${chalk.cyan(spec.title)}`);
    }

    // Show detected info
    if (spec.techStack.length > 0) {
      logger.info(`Detected technologies: ${spec.techStack.join(', ')}`);
    }

    // Step 2: Extract domains (if not already done)
    let domains = checkpoint.domains;
    if (!domains) {
      logger.blank();
      const domainSpinner = ora('Identifying expertise domains...').start();
      try {
        const extraction = await extractDomains(spec);
        domains = extraction.domains;
        checkpoint = updateWithDomains(gakuenPath, checkpoint, domains);

        // Also save project info
        const config = store.getConfig();
        config.projectName = extraction.projectName;
        config.projectDescription = extraction.projectDescription;
        store.saveConfig(config);

        domainSpinner.succeed(
          `Identified ${chalk.green(domains.length)} expertise domains`
        );
      } catch (error) {
        domainSpinner.fail('Failed to analyze spec');
        markFailed(gakuenPath, checkpoint, String(error));
        throw error;
      }
    } else {
      console.log(chalk.green('✔') + ` Domains already extracted: ${chalk.green(domains.length)} domains`);
    }

    // Display domains
    logger.blank();
    console.log(chalk.bold('Expertise domains needed:'));
    logger.blank();

    for (const domain of domains) {
      const icon = getSpecificityIcon(domain.specificity);
      console.log(`  ${icon} ${chalk.bold(domain.name)} (${domain.specificity} specificity)`);
      console.log(chalk.gray(`     ${domain.description}`));
      if (domain.technologies.length > 0) {
        console.log(chalk.gray(`     Technologies: ${domain.technologies.slice(0, 4).join(', ')}`));
      }
      logger.blank();
    }

    // Step 3: Generate Otaku recommendations (with batch checkpointing)
    let recommendations = checkpoint.otakuRecommendations;
    const isComplete = checkpoint.status === 'otaku-complete';

    if (!recommendations || !isComplete) {
      const startBatch = checkpoint.currentBatch || 0;
      const existingRecommendations = recommendations || [];

      if (startBatch > 0) {
        console.log(chalk.yellow(`  Resuming from batch ${startBatch + 1}...`));
      }

      const otakuSpinner = ora('Generating Otaku recommendations...').start();

      try {
        recommendations = await recommendOtakuWithProgress(
          {
            projectName: store.getConfig().projectName || spec.title,
            projectDescription: store.getConfig().projectDescription || '',
            domains,
          },
          startBatch,
          existingRecommendations,
          (batchIndex, batchResults, total) => {
            // Save progress after each batch
            checkpoint = updateWithBatchProgress(gakuenPath, checkpoint!, batchIndex, batchResults);
            otakuSpinner.text = `Generating Otaku recommendations... (batch ${batchIndex + 1}/${total})`;
          }
        );

        checkpoint = markOtakuComplete(gakuenPath, checkpoint);
        otakuSpinner.succeed(
          `Generated ${chalk.green(recommendations.length)} Otaku recommendations`
        );
      } catch (error) {
        otakuSpinner.fail('Failed to generate recommendations');
        markFailed(gakuenPath, checkpoint, String(error));

        // Show helpful message about resuming
        logger.blank();
        logger.info(chalk.yellow('Progress saved! Resume with:'));
        logger.info(chalk.cyan(`  aigakuen enroll --resume ${checkpoint.id}`));
        logger.blank();
        throw error;
      }
    } else {
      console.log(chalk.green('✔') + ` Otaku already generated: ${chalk.green(recommendations.length)} Otaku`);
    }

    // Display recommendations
    logger.blank();
    logger.divider();
    logger.blank();

    console.log(chalk.bold('Recommended Otaku:'));
    logger.blank();

    for (const rec of recommendations) {
      console.log(`  ${chalk.bold.cyan(rec.profile.name)} (${chalk.gray(rec.profile.id)})`);
      if (rec.profile.specialty) {
        console.log(`     ${rec.profile.specialty}`);
      }
      const tech = rec.profile.expertise.technologies;
      if (tech.length > 0) {
        console.log(chalk.gray(`     Tech: ${tech.slice(0, 4).join(', ')}`));
      }
      logger.blank();
    }

    // Step 4: Confirm and save
    logger.divider();
    logger.blank();

    const shouldEnroll =
      skipConfirmation ||
      (await confirm('Enroll these Otaku in your project?'));

    if (!shouldEnroll) {
      logger.info('Enrollment cancelled. Your progress is saved.');
      logger.info(chalk.cyan(`Resume later with: aigakuen enroll --resume ${checkpoint.id}`));
      return;
    }

    // Save to registry
    const saveSpinner = ora('Enrolling Otaku...').start();

    // Save curriculum
    store.saveCurriculum(specPath, specContent);

    // Register all Otaku
    for (const rec of recommendations) {
      registry.registerOtaku({
        ...rec.profile,
        meta: {
          createdAt: new Date().toISOString(),
          lastTrained: null,
          trainingSources: [],
        },
      });
    }

    // Mark checkpoint as confirmed and clean up
    markConfirmed(gakuenPath, checkpoint);
    deleteCheckpoint(gakuenPath, checkpoint.id);

    saveSpinner.succeed('Otaku enrolled!');
    logger.blank();

    // Show next steps
    console.log(chalk.bold('Next steps:'));
    logger.blank();
    logger.info(`1. Train an Otaku: ${chalk.cyan(`aigakuen train ${recommendations[0]?.profile.id}`)}`);
    logger.info(`2. View roster: ${chalk.cyan('aigakuen roster')}`);
    logger.blank();

  } catch (error) {
    // Error already handled above, just re-throw
    throw error;
  }
}

function getSpecificityIcon(specificity: string): string {
  switch (specificity) {
    case 'high':
      return '🎯';
    case 'medium':
      return '📍';
    case 'low':
      return '📌';
    default:
      return '•';
  }
}
