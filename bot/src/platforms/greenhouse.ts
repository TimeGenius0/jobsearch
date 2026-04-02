import type { Page } from 'playwright';
import type { Profile, CommonResponses, PlatformHandler } from '../types';
import { humanLikeDelay } from '../utils';
import { FileUploader } from '../file-uploader';
import { QuestionAnswerer } from '../question-answerer';

export class GreenhouseHandler implements PlatformHandler {
  async detect(url: string, page: Page): Promise<boolean> {
    return url.includes('boards.greenhouse.io') ||
           url.includes('greenhouse.io/') ||
           await page.locator('#application_form, [id*="greenhouse"]').count() > 0;
  }

  async fill(page: Page, profile: Profile, responses: CommonResponses, resumeText?: string): Promise<void> {
    console.log('🌿 Detected Greenhouse platform');

    await page.waitForSelector('input[type="text"], input[type="email"]', { timeout: 10000 });
    await humanLikeDelay();

    // First name
    const firstNameField = page.locator('input[name*="first_name"], input#first_name').first();
    if (await firstNameField.count() > 0) {
      await firstNameField.fill(profile.personalInfo.firstName);
      await humanLikeDelay();
    }

    // Last name
    const lastNameField = page.locator('input[name*="last_name"], input#last_name').first();
    if (await lastNameField.count() > 0) {
      await lastNameField.fill(profile.personalInfo.lastName);
      await humanLikeDelay();
    }

    // Email
    const emailField = page.locator('input[name*="email"], input[type="email"]').first();
    if (await emailField.count() > 0) {
      await emailField.fill(profile.personalInfo.email);
      await humanLikeDelay();
    }

    // Phone
    const phoneField = page.locator('input[name*="phone"], input[type="tel"]').first();
    if (await phoneField.count() > 0) {
      await phoneField.fill(profile.personalInfo.phone);
      await humanLikeDelay();
    }

    // Location
    const locationField = page.locator('input[name*="location"], input[placeholder*="location"]').first();
    if (await locationField.count() > 0) {
      await locationField.fill(`${profile.location.city}, ${profile.location.state}`);
      await humanLikeDelay();
    }

    // LinkedIn
    if (profile.personalInfo.linkedin) {
      const linkedinField = page.locator('input[name*="linkedin"], input[placeholder*="LinkedIn"]').first();
      if (await linkedinField.count() > 0) {
        await linkedinField.fill(profile.personalInfo.linkedin);
        await humanLikeDelay();
      }
    }

    // Upload documents
    console.log('\n📎 Uploading documents...');
    await FileUploader.uploadDocuments(page, profile.work.resumePath, profile.work.coverLetterPath);

    // Custom open-ended questions (textareas)
    await this.fillCustomQuestions(page);

    // EEO questions (usually on a separate page in Greenhouse)
    await this.fillEEOQuestions(page, responses);

    console.log('✅ Greenhouse form filled');
  }

  private async fillCustomQuestions(page: Page): Promise<void> {
    const qaBot = new QuestionAnswerer();
    const textareas = await page.locator('textarea').all();

    for (const textarea of textareas) {
      try {
        if (!(await textarea.isVisible())) continue;
        const current = await textarea.inputValue().catch(() => '');
        if (current) continue;

        // Get question text from label or surrounding context
        const id = await textarea.getAttribute('id').catch(() => '');
        let questionText = '';

        if (id) {
          questionText = (await page.locator(`label[for="${id}"]`).textContent().catch(() => '')) || '';
        }
        if (!questionText) {
          const ariaLabel = await textarea.getAttribute('aria-label').catch(() => '');
          questionText = ariaLabel || '';
        }
        if (!questionText) {
          questionText = await textarea.evaluate((el) => {
            let node: Element | null = el.parentElement;
            for (let d = 0; d < 6; d++) {
              if (!node) break;
              for (const child of Array.from(node.children)) {
                if (child.contains(el)) continue;
                const tag = child.tagName.toLowerCase();
                if (['label', 'legend', 'h3', 'h4', 'p'].includes(tag)) {
                  const t = child.textContent?.trim() || '';
                  if (t.length > 5 && t.length < 500) return t;
                }
              }
              node = node.parentElement;
            }
            return '';
          });
        }

        if (!questionText || questionText.length < 5) continue;

        console.log(`\n   📝 Custom question: "${questionText.substring(0, 80)}"`);
        const answer = await qaBot.answerQuestion(questionText);
        if (answer) {
          await textarea.fill(answer);
          console.log(`   ✅ Answered (${answer.length} chars)`);
          await humanLikeDelay(300, 600);
        }
      } catch {
        continue;
      }
    }
  }

  private async fillEEOQuestions(page: Page, responses: CommonResponses): Promise<void> {
    // Greenhouse EEO questions are often in fieldsets
    const questions = [
      { response: responses.veteranStatus, keywords: ['veteran', 'protected veteran'] },
      { response: responses.disability, keywords: ['disability', 'disabled'] },
      { response: responses.gender, keywords: ['gender', 'sex'] },
      { response: responses.race, keywords: ['race', 'ethnicity'] },
    ];

    for (const q of questions) {
      if (!q.response) continue;

      for (const keyword of q.keywords) {
        try {
          // Try select first
          const select = page.locator(`select[id*="${keyword}"], select[name*="${keyword}"]`).first();
          if (await select.isVisible({ timeout: 1000 })) {
            await select.selectOption({ label: q.response }).catch(() => {
              // Select first "decline" or "prefer not" option
              const options = select.locator('option');
              options.filter({ hasText: /decline|prefer not/i }).first().click().catch(() => {});
            });
            await humanLikeDelay();
            break;
          }

          // Try radio buttons
          const radio = page.locator(`input[type="radio"][value*="${q.response}"]`).first();
          if (await radio.isVisible({ timeout: 1000 })) {
            await radio.click();
            await humanLikeDelay();
            break;
          }
        } catch (err) {
          continue;
        }
      }
    }
  }
}
