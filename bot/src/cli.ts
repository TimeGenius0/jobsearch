#!/usr/bin/env node
import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { config } from 'dotenv';
import { ApplicationFiller } from './filler';
import { loadProfile, loadResponses } from './utils';

const ACTIVITY_LOG = path.resolve(__dirname, '../../activity.log');

function logActivity(tool: string, url: string, company: string, outcome: string, details: string = ''): void {
  const writeHeader = !fs.existsSync(ACTIVITY_LOG) || fs.statSync(ACTIVITY_LOG).size === 0;
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const row = [timestamp, tool, url, company, outcome, details]
    .map(v => `"${String(v).replace(/"/g, '""')}"`)
    .join(',');
  if (writeHeader) {
    fs.appendFileSync(ACTIVITY_LOG, 'timestamp,tool,url,company,outcome,details\n', 'utf-8');
  }
  fs.appendFileSync(ACTIVITY_LOG, row + '\n', 'utf-8');
}

// Load environment variables (API keys)
config();

const program = new Command();

program
  .name('job-bot')
  .description('Semi-automated job application filler')
  .version('1.0.0');

program
  .command('apply')
  .description('Fill a job application form')
  .requiredOption('-u, --url <url>', 'Job application URL')
  .option('-p, --profile <path>', 'Path to profile.json', './data/profile.json')
  .option('-r, --responses <path>', 'Path to responses.json', './data/responses.json')
  .action(async (options) => {
    try {
      console.log(chalk.blue.bold('\n🤖 Job Application Bot\n'));

      // Load API key from environment or .env file
      if (!process.env.CLAUDE_API_KEY && !process.env.ANTHROPIC_API_KEY) {
        const envPath = path.resolve(__dirname, '../../jobsearch/.env');
        if (fs.existsSync(envPath)) {
          const envContent = fs.readFileSync(envPath, 'utf-8');
          const match = envContent.match(/CLAUDE_API_KEY=(.+)/);
          if (match) {
            process.env.CLAUDE_API_KEY = match[1].trim();
            console.log(chalk.gray('✓ Loaded API key from .env'));
          }
        }
      }

      // Load data
      const profile = loadProfile(path.resolve(options.profile));
      const responses = loadResponses(path.resolve(options.responses));

      console.log(chalk.green(`✓ Loaded profile: ${profile.personalInfo.firstName} ${profile.personalInfo.lastName}`));
      console.log(chalk.green(`✓ Loaded responses\n`));

      // Initialize filler
      const filler = new ApplicationFiller();
      await filler.init();

      // Fill application
      const state = await filler.fillApplication(options.url, profile, responses);

      logActivity(
        'job-bot',
        options.url,
        state.company,
        state.status,
        `role=${state.role},platform=${state.platform}`
      );

      console.log(chalk.yellow('\n⏸️  Process paused. Browser left open for your review.'));
      console.log(chalk.cyan('   Review the form, make any manual adjustments, and submit.'));
      console.log(chalk.gray('   Press Ctrl+C when done.\n'));

      // Keep process alive until user closes
      await new Promise(() => {});
    } catch (error) {
      logActivity('job-bot', options.url, '', 'error', String(error));
      console.error(chalk.red('\n❌ Error:'), error);
      process.exit(1);
    }
  });

program
  .command('scrape')
  .description('Scrape job posting to see form fields (coming soon)')
  .requiredOption('-u, --url <url>', 'Job posting URL')
  .action(async (options) => {
    console.log(chalk.yellow('🚧 Scraper not implemented yet'));
    console.log(chalk.gray('   Use the apply command to fill applications directly.\n'));
  });

program
  .command('setup')
  .description('Create sample data files')
  .action(() => {
    const dataDir = path.resolve('./data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const sampleProfile = {
      personalInfo: {
        firstName: 'Bilel',
        lastName: 'Buraway',
        email: 'bilel@example.com',
        phone: '+1-650-555-1234',
        linkedin: 'https://linkedin.com/in/bilelburaway',
        portfolio: 'https://bilelburaway.com',
        github: 'https://github.com/bilelburaway',
        website: 'https://bilelburaway.com',
      },
      location: {
        city: 'Mountain View',
        state: 'CA',
        country: 'USA',
        zipCode: '94043',
        address: '123 Main St, Mountain View, CA 94043',
      },
      work: {
        currentTitle: 'Principal Product Manager',
        currentCompany: 'Intuit Mailchimp',
        yearsExperience: 15,
        resumePath: path.resolve('./data/resume.pdf'),
        coverLetterPath: path.resolve('./data/cover-letter.docx'),
      },
      education: {
        degree: 'MS in Electrical Engineering',
        university: 'Telecom ParisTech',
        graduationYear: 2007,
      },
      preferences: {
        workAuthorization: 'US Citizen',
        willingToRelocate: false,
        remotePreference: 'remote' as const,
        requiresVisaSponsorship: false,
      },
    };

    const sampleResponses = {
      salaryExpectation: '$150,000 - $180,000',
      availableStartDate: '2 weeks notice',
      referralSource: 'LinkedIn',
      veteranStatus: 'I am not a protected veteran',
      disability: 'I don\'t wish to answer',
      gender: 'Prefer not to say',
      race: 'Prefer not to say',
    };

    fs.writeFileSync(
      path.join(dataDir, 'profile.json'),
      JSON.stringify(sampleProfile, null, 2)
    );
    fs.writeFileSync(
      path.join(dataDir, 'responses.json'),
      JSON.stringify(sampleResponses, null, 2)
    );

    console.log(chalk.green('\n✓ Sample files created:'));
    console.log(chalk.cyan('  - data/profile.json'));
    console.log(chalk.cyan('  - data/responses.json'));
    console.log(chalk.yellow('\n⚠️  Edit these files with your actual information!'));
    console.log(chalk.gray('   Also add your resume.pdf and cover-letter.docx to the data/ folder.'));
    console.log(chalk.gray('   Generate cover letters with: cd ../jobsearch && python3 cover_letter.py <url> --company "Name"\n'));
  });

program.parse();
