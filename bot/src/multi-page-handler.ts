import { Page } from 'playwright';
import { humanLikeDelay } from './utils';

export class MultiPageHandler {
  /**
   * Detect if there's a "Next" or "Continue" button for multi-page forms
   * (More strict - excludes Submit buttons)
   */
  static async hasNextButton(page: Page): Promise<boolean> {
    const nextSelectors = [
      'button:has-text("Next"):not(:has-text("Submit"))',
      'button:has-text("Continue"):not(:has-text("Submit"))',
      'button:has-text("Save and Continue")',
      'input[type="submit"][value*="Next"]',
      'input[type="submit"][value*="Continue"]',
    ];

    for (const selector of nextSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 1000 })) {
          // Additional check: make sure it's not a "Submit" button
          const text = await button.textContent();
          if (text && !text.toLowerCase().includes('submit') && !text.toLowerCase().includes('apply')) {
            console.log(`   Found Next button: "${text}"`);
            return true;
          }
        }
      } catch {
        continue;
      }
    }

    return false;
  }

  /**
   * Click the next/continue button
   */
  static async clickNext(page: Page): Promise<boolean> {
    const nextSelectors = [
      'button:has-text("Next"):not(:has-text("Submit"))',
      'button:has-text("Continue"):not(:has-text("Submit"))',
      'button:has-text("Save and Continue")',
      'input[type="submit"][value*="Next"]',
      'input[type="submit"][value*="Continue"]',
    ];

    for (const selector of nextSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 1000 })) {
          const text = await button.textContent();
          
          // Skip if it's actually a Submit button
          if (text && (text.toLowerCase().includes('submit') || text.toLowerCase().includes('apply'))) {
            console.log(`   Skipping button (appears to be Submit): "${text}"`);
            continue;
          }
          
          console.log(`📄 Clicking "${text}" to continue to next page...`);
          await button.click();
          await humanLikeDelay(2000, 3000);
          
          // Wait for page to load
          try {
            await page.waitForLoadState('networkidle', { timeout: 10000 });
          } catch {
            await page.waitForLoadState('domcontentloaded');
          }
          
          return true;
        }
      } catch (err) {
        continue;
      }
    }

    return false;
  }

  /**
   * Detect if we're on a "Create Account" or "Sign Up" page
   */
  static async isAccountCreationPage(page: Page): Promise<boolean> {
    const indicators = [
      'Create an account',
      'Sign up',
      'Register',
      'Create your account',
      'Set up your account',
      'Choose a password',
    ];

    for (const text of indicators) {
      const element = page.locator(`h1:has-text("${text}"), h2:has-text("${text}"), label:has-text("${text}")`).first();
      if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
        return true;
      }
    }

    // Check for password confirmation field (common in account creation)
    const confirmPassword = page.locator('input[name*="confirm"], input[name*="password2"], input[placeholder*="Confirm"]').first();
    return await confirmPassword.isVisible({ timeout: 1000 }).catch(() => false);
  }

  /**
   * Fill account creation form
   */
  static async fillAccountCreation(page: Page, email: string, firstName: string, lastName: string): Promise<void> {
    console.log('🔐 Detected account creation page, filling credentials...');

    // Email
    const emailInput = page.locator('input[type="email"], input[name*="email"]').first();
    if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailInput.fill(email);
      await humanLikeDelay();
    }

    // First name
    const firstNameInput = page.locator('input[name*="first"], input[placeholder*="First"]').first();
    if (await firstNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstNameInput.fill(firstName);
      await humanLikeDelay();
    }

    // Last name
    const lastNameInput = page.locator('input[name*="last"], input[placeholder*="Last"]').first();
    if (await lastNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await lastNameInput.fill(lastName);
      await humanLikeDelay();
    }

    // Password (generate or use a standard one)
    const password = 'TempPass123!'; // TODO: Make this configurable
    const passwordInput = page.locator('input[type="password"]').first();
    if (await passwordInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await passwordInput.fill(password);
      await humanLikeDelay();
      
      console.log(`⚠️  Account password: ${password} (save this!)`);
    }

    // Confirm password
    const confirmPasswordInput = page.locator('input[type="password"]').nth(1);
    if (await confirmPasswordInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmPasswordInput.fill(password);
      await humanLikeDelay();
    }

    console.log('✅ Account creation form filled');
  }

  /**
   * Detect if we're on an email verification page
   * (Strict detection - must have multiple indicators)
   */
  static async isEmailVerificationPage(page: Page): Promise<boolean> {
    const pageText = await page.textContent('body');
    if (!pageText) return false;

    const lowerText = pageText.toLowerCase();
    
    // Must have at least 2 of these indicators
    const indicators = [
      'verify your email',
      'check your email',
      'verification code',
      'enter the code',
      'we sent you a code',
      'we emailed you',
    ];
    
    const matchCount = indicators.filter(text => lowerText.includes(text)).length;
    
    // Also check for code input field
    const hasCodeInput = await page.locator('input[name*="code"], input[placeholder*="code"], input[type="text"][maxlength="6"]').count() > 0;
    
    // Require at least 2 text indicators OR 1 indicator + code input field
    const isVerificationPage = matchCount >= 2 || (matchCount >= 1 && hasCodeInput);
    
    if (isVerificationPage) {
      console.log(`   Email verification detected: ${matchCount} text indicators, hasCodeInput: ${hasCodeInput}`);
    }
    
    return isVerificationPage;
  }

  /**
   * Fill verification code from Gmail
   */
  static async fillVerificationCode(page: Page, code: string): Promise<boolean> {
    console.log(`🔑 Entering verification code: ${code}`);

    const codeSelectors = [
      'input[name*="code"]',
      'input[id*="code"]',
      'input[placeholder*="code"]',
      'input[type="text"]',
      'input[inputmode="numeric"]',
    ];

    for (const selector of codeSelectors) {
      try {
        const input = page.locator(selector).first();
        if (await input.isVisible({ timeout: 2000 })) {
          await input.fill(code);
          await humanLikeDelay();
          
          // Look for submit/verify button
          const submitButtons = [
            'button:has-text("Verify")',
            'button:has-text("Submit")',
            'button:has-text("Continue")',
            'button[type="submit"]',
          ];

          for (const btnSelector of submitButtons) {
            const btn = page.locator(btnSelector).first();
            if (await btn.isVisible({ timeout: 1000 })) {
              await btn.click();
              console.log('✅ Verification code submitted');
              await humanLikeDelay(2000, 3000);
              return true;
            }
          }
          
          return true;
        }
      } catch (err) {
        continue;
      }
    }

    console.log('⚠️  Could not find verification code input field');
    return false;
  }
}
