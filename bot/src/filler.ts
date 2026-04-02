import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import * as path from 'path';
import type { Profile, CommonResponses, ApplicationState, PlatformHandler } from './types';
import { saveApplicationState, sanitizeFilename } from './utils';
import { LeverHandler } from './platforms/lever';
import { GreenhouseHandler } from './platforms/greenhouse';
import { AshbyHandler } from './platforms/ashby';
import { WorkdayHandler } from './platforms/workday';
import { GenericHandler } from './platforms/generic';
import { MultiPageHandler } from './multi-page-handler';
import { EmailVerifier } from './email-verifier';
import { VisionAnalyzer } from './vision-analyzer';

export class ApplicationFiller {
  private browser: Browser | BrowserContext | null = null;
  private page: Page | null = null;
  private handlers: PlatformHandler[] = [];
  private screenshotDir: string;
  private applicationsDir: string;
  private emailVerifier: EmailVerifier | null = null;
  private isPersistentContext: boolean = false;

  constructor(screenshotDir: string = './screenshots', applicationsDir: string = './applications') {
    this.screenshotDir = screenshotDir;
    this.applicationsDir = applicationsDir;
    this.handlers = [
      new LeverHandler(),
      new GreenhouseHandler(),
      new AshbyHandler(),
      new WorkdayHandler(),
      new GenericHandler(), // Always last (fallback)
    ];
  }

  async init(): Promise<void> {
    console.log('🌐 Launching Google Chrome...');
    
    // Use installed Chrome with explicit executable path
    const browser = await chromium.launch({
      headless: false,
      executablePath: '/usr/bin/google-chrome',
      slowMo: 50,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
    });
    
    console.log('✅ Google Chrome launched');
    
    // Create context and get page
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
    });
    
    console.log('✅ Context created');
    
    this.page = await context.newPage();
    this.browser = browser;
    this.isPersistentContext = false;
    
    console.log('✅ Page ready');
  }

  async fillApplication(
    url: string,
    profile: Profile,
    responses: CommonResponses
  ): Promise<ApplicationState> {
    if (!this.page) throw new Error('Filler not initialized. Call init() first.');

    console.log(`\n🚀 Opening application: ${url}`);
    
    // Navigate with timeout fallback
    try {
      await this.page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      console.log('✅ Page loaded');
    } catch (err: any) {
      // If networkidle times out, page is still loaded, just has background activity
      if (err.message && err.message.includes('Timeout')) {
        console.log('⏱️  Page has background activity, but content is loaded. Continuing...');
        // Wait for basic DOM to be ready
        await this.page.waitForLoadState('domcontentloaded').catch(() => {});
      } else {
        // Some other error, re-throw
        throw err;
      }
    }

    const screenshots: string[] = [];
    
    console.log('📋 Detecting company and role...');
    const company = await this.detectCompanyName(this.page, url);
    const role = await this.detectRoleName(this.page);

    // Take initial screenshot
    console.log('📸 Taking screenshot...');
    screenshots.push(await this.takeScreenshot(`${company}-01-initial`));

    // Click "Apply" button if we're on a job posting page (not the application form)
    await this.clickApplyButton();

    // Check for account creation
    if (await MultiPageHandler.isAccountCreationPage(this.page)) {
      await MultiPageHandler.fillAccountCreation(
        this.page,
        profile.personalInfo.email,
        profile.personalInfo.firstName,
        profile.personalInfo.lastName
      );
      screenshots.push(await this.takeScreenshot(`${company}-account-created`));
      
      // Click continue/next after account creation
      await MultiPageHandler.clickNext(this.page);
    }

    // Multi-page form handling
    let pageNumber = 1;
    let hasMorePages = true;

    while (hasMorePages && pageNumber <= 10) { // Max 10 pages to avoid infinite loops
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📋 Page ${pageNumber}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      // Check for email verification page
      if (await MultiPageHandler.isEmailVerificationPage(this.page)) {
        console.log('\n📧 Email verification page detected!');
        screenshots.push(await this.takeScreenshot(`${company}-email-verification-required`));
        
        console.log('⚠️  Manual action required:');
        console.log('   1. Check your email for verification code');
        console.log('   2. Enter the code in the browser');
        console.log('   3. Click submit/verify');
        console.log('   4. Press Enter here when done to continue...\n');
        
        // Option: Open Gmail to help user
        console.log('💡 Want me to open Gmail? (y/n): ');
        const shouldOpenGmail = await new Promise<boolean>((resolve) => {
          process.stdin.once('data', (data) => {
            resolve(data.toString().trim().toLowerCase() === 'y');
          });
        });
        
        if (shouldOpenGmail && this.browser) {
          if (!this.emailVerifier) {
            this.emailVerifier = new EmailVerifier();
            await this.emailVerifier.init(this.browser);
          }
          
          // Try to get code automatically
          const code = await this.emailVerifier.getVerificationCode(company, 120000);
          
          if (code) {
            await MultiPageHandler.fillVerificationCode(this.page, code);
            screenshots.push(await this.takeScreenshot(`${company}-email-verified`));
            console.log('✅ Code entered automatically. Press Enter to continue...');
            await new Promise<void>((resolve) => {
              process.stdin.once('data', () => resolve());
            });
          } else {
            console.log('⚠️  Could not auto-retrieve code. Enter it manually and press Enter...');
            await new Promise<void>((resolve) => {
              process.stdin.once('data', () => resolve());
            });
          }
        } else {
          // Wait for user to handle manually
          await new Promise<void>((resolve) => {
            process.stdin.once('data', () => resolve());
          });
        }
        
        // Continue after verification
        await MultiPageHandler.clickNext(this.page);
        pageNumber++;
        continue;
      }
      
      // Detect platform and fill current page
      const handler = await this.detectPlatform(url, this.page);
      await handler.fill(this.page, profile, responses);

      // Take screenshot of filled page
      screenshots.push(await this.takeScreenshot(`${company}-page-${pageNumber}-filled`));

      // Check if there's a "Next" button
      console.log(`\n🔍 Checking for Next/Continue button...`);
      if (await MultiPageHandler.hasNextButton(this.page)) {
        const clicked = await MultiPageHandler.clickNext(this.page);
        if (clicked) {
          pageNumber++;
        } else {
          console.log(`   No Next button found or failed to click`);
          hasMorePages = false;
        }
      } else {
        console.log(`   No Next button detected - this appears to be the final page`);
        hasMorePages = false;
      }
    }
    
    console.log(`\n✅ Completed filling ${pageNumber} page(s)`);

    // Final screenshot
    screenshots.push(await this.takeScreenshot(`${company}-final`));

    // Detect platform for state
    const finalHandler = await this.detectPlatform(url, this.page);
    
    // Save application state
    const state: ApplicationState = {
      url,
      company,
      role,
      platform: finalHandler.constructor.name,
      timestamp: new Date().toISOString(),
      screenshots,
      formData: {}, // Could extract form values here
      status: 'ready-to-submit',
    };

    const statePath = saveApplicationState(state, this.applicationsDir);
    console.log(`\n💾 Application state saved: ${statePath}`);
    console.log(`📸 Screenshots: ${screenshots.join(', ')}`);
    
    // Summary of what was filled
    console.log(`\n📋 Application Summary:`);
    console.log(`   Company: ${company}`);
    console.log(`   Role: ${role}`);
    console.log(`   Pages filled: ${pageNumber > 1 ? pageNumber : 1}`);
    console.log(`   Resume: ${profile.work.resumePath}`);
    if (profile.work.coverLetterPath) {
      console.log(`   Cover Letter: ${profile.work.coverLetterPath}`);
    }
    
    console.log(`\n⚠️  BROWSER LEFT OPEN FOR REVIEW`);
    console.log(`👉 Please review the form and click submit manually.`);
    console.log(`   Press Ctrl+C when done to close the browser.\n`);

    return state;
  }

  private async detectPlatform(url: string, page: Page): Promise<PlatformHandler> {
    for (const handler of this.handlers) {
      if (await handler.detect(url, page)) {
        return handler;
      }
    }
    return this.handlers[this.handlers.length - 1]; // Fallback to GenericHandler
  }

  private async detectCompanyName(page: Page, url: string): Promise<string> {
    // Strategy 1: JSON-LD structured data (most reliable)
    const jsonLdCompany = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent || '');
          const item = Array.isArray(data) ? data[0] : data;
          if (item.hiringOrganization?.name) return item.hiringOrganization.name;
          if (item.publisher?.name) return item.publisher.name;
          if (item.author?.name) return item.author.name;
        } catch {
          continue;
        }
      }
      return null;
    }).catch(() => null);
    if (jsonLdCompany) return sanitizeFilename(jsonLdCompany);

    // Strategy 2: og:site_name or og:title meta tag
    const ogSiteName = await page.locator('meta[property="og:site_name"]').getAttribute('content').catch(() => '');
    if (ogSiteName && ogSiteName.length > 1) return sanitizeFilename(ogSiteName);

    // Strategy 3: Page title patterns
    const title = await page.title();
    if (title) {
      // "Role - Company | Jobs" or "Company - Careers"
      const patterns = [
        /(?:at\s+)(.+?)\s*[-|–|·]\s*(?:Jobs|Careers|Apply)/i,
        /(?:\|\s*)(.+?)\s*(?:Jobs|Careers|Hiring)/i,
        /^(.+?)\s*[-|–|·]\s*(?:Jobs|Careers|Application|Apply)/i,
        /(.+?)\s*[-|–|·]\s*.+?\s*(?:\||$)/,
      ];
      for (const pattern of patterns) {
        const match = title.match(pattern);
        if (match && match[1].trim().length > 1) return sanitizeFilename(match[1].trim());
      }
    }

    // Strategy 4: Known ATS URL patterns
    const urlPatterns: Array<{ regex: RegExp; group: number }> = [
      { regex: /jobs\.lever\.co\/([^/?]+)/, group: 1 },
      { regex: /boards\.greenhouse\.io\/([^/?]+)/, group: 1 },
      { regex: /jobs\.gem\.com\/([^/?]+)/, group: 1 },
      { regex: /job\.ashbyhq\.com\/([^/?]+)/, group: 1 },
      { regex: /jobsboard\.ashby\.io\/([^/?]+)/, group: 1 },
      { regex: /apply\.workday\.com\/([^/?]+)/, group: 1 },
      { regex: /([^.]+)\.myworkdayjobs\.com/, group: 1 },
      { regex: /([^.]+)\.bamboohr\.com/, group: 1 },
      { regex: /app\.icims\.com\/companies\/(\d+)\/([^/?]+)/, group: 2 },
    ];
    for (const { regex, group } of urlPatterns) {
      const match = url.match(regex);
      if (match && match[group]) return sanitizeFilename(match[group]);
    }

    // Strategy 5: First heading that looks like a company name
    const h1 = await page.locator('h1').first().textContent().catch(() => '');
    if (h1 && h1.trim().length > 1 && h1.trim().length < 60) {
      // If h1 looks like a company (not a job title), use it
      if (!/engineer|manager|director|analyst|developer|designer/i.test(h1)) {
        return sanitizeFilename(h1.trim());
      }
    }

    // Fallback: domain name (more informative than "ats")
    const domainMatch = url.match(/\/\/([^/?]+)/);
    if (domainMatch) {
      const domain = domainMatch[1].replace(/^(www\.|jobs\.|careers\.|apply\.)/, '').split('.')[0];
      if (domain && domain !== 'ats' && domain.length > 2) return sanitizeFilename(domain);
    }

    return 'unknown-company';
  }

  private async detectRoleName(page: Page): Promise<string> {
    // Strategy 1: JSON-LD structured data
    const jsonLdTitle = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent || '');
          const item = Array.isArray(data) ? data[0] : data;
          if (item.title) return item.title;
          if (item.name && item['@type'] === 'JobPosting') return item.name;
        } catch {
          continue;
        }
      }
      return null;
    }).catch(() => null);
    if (jsonLdTitle) return sanitizeFilename(jsonLdTitle);

    // Strategy 2: og:title (often "Role at Company")
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content').catch(() => '');
    if (ogTitle) {
      const match = ogTitle.match(/^(.+?)\s*(?:at\s+|[-|–]).+$/i);
      if (match) return sanitizeFilename(match[1].trim());
      if (ogTitle.trim().length > 2 && ogTitle.trim().length < 80) return sanitizeFilename(ogTitle.trim());
    }

    // Strategy 3: h1 — job titles are usually in h1
    const h1Text = await page.locator('h1').first().textContent().catch(() => '');
    if (h1Text && h1Text.trim().length > 2) return sanitizeFilename(h1Text.trim());

    // Strategy 4: h2 fallback
    const h2Text = await page.locator('h2').first().textContent().catch(() => '');
    if (h2Text && h2Text.trim().length > 2) return sanitizeFilename(h2Text.trim());

    return 'unknown-role';
  }

  private async clickApplyButton(): Promise<void> {
    if (!this.page) throw new Error('Page not available');

    console.log('🔍 Looking for "Apply" button...');

    // If the page already has form inputs, assume we're already on the application form
    const existingInputs = await this.page.locator('input[type="text"], input[type="email"], textarea').count();
    if (existingInputs >= 3) {
      console.log('   Form already on page — skipping apply button click\n');
      return;
    }

    // Candidates for "Apply" navigation buttons — EXACT text only to avoid matching submit buttons
    // like "Apply and save" or "Apply without saving"
    const applySelectors = [
      'a:has-text("Apply for this job")',
      'button:has-text("Apply for this job")',
      'a:has-text("Apply Now")',
      'button:has-text("Apply Now")',
      'a.application-link',
      'button.apply-button',
      '.postings-btn',
      '[data-qa="btn-apply"]',
      'a[href*="/apply"]',
    ];

    // Exact-text "Apply" button — only if text is precisely "Apply" (not "Apply and save" etc.)
    const exactApplyButtons = await this.page.locator('a, button').all();
    for (const btn of exactApplyButtons) {
      try {
        const text = (await btn.textContent())?.trim();
        if (text === 'Apply' && await btn.isVisible({ timeout: 300 })) {
          applySelectors.unshift('__exact_apply__');
          console.log(`   Found exact "Apply" button`);
          console.log(`🔘 Clicking apply button...`);
          await btn.click();
          try {
            await this.page.waitForLoadState('networkidle', { timeout: 3000 });
          } catch {
            await this.page.waitForLoadState('domcontentloaded').catch(() => {});
          }
          console.log('✅ Navigated to application form\n');
          return;
        }
      } catch {
        continue;
      }
    }

    // Try selector list
    for (const selector of applySelectors) {
      if (selector === '__exact_apply__') continue;
      try {
        const button = this.page.locator(selector).first();
        if (await button.isVisible({ timeout: 500 })) {
          console.log(`   Found: ${selector}`);
          console.log(`🔘 Clicking apply button...`);
          await button.click();
          try {
            await this.page.waitForLoadState('networkidle', { timeout: 3000 });
          } catch {
            await this.page.waitForLoadState('domcontentloaded').catch(() => {});
          }
          console.log('✅ Navigated to application form\n');
          return;
        }
      } catch {
        continue;
      }
    }

    console.log('   No apply button found - already on application form\n');
  }

  private async takeScreenshot(name: string): Promise<string> {
    if (!this.page) throw new Error('Page not available');

    const filename = `${name}-${Date.now()}.png`;
    const filepath = path.join(this.screenshotDir, filename);
    await this.page.screenshot({
      path: filepath,
      fullPage: true,
      animations: 'disabled',
      timeout: 10000,
    }).catch(async () => {
      // Fallback: viewport-only screenshot with shorter timeout
      await this.page!.screenshot({ path: filepath, animations: 'disabled', timeout: 5000 }).catch(() => {});
    });
    console.log(`📸 Screenshot: ${filepath}`);
    return filepath;
  }

  async close(): Promise<void> {
    if (this.emailVerifier) {
      await this.emailVerifier.close();
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}
