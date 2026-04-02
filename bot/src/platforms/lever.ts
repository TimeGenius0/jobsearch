import type { Page } from 'playwright';
import type { Profile, CommonResponses, PlatformHandler } from '../types';
import { humanLikeDelay } from '../utils';
import { FileUploader } from '../file-uploader';
import { QuestionAnswerer } from '../question-answerer';

export class LeverHandler implements PlatformHandler {
  async detect(url: string, page: Page): Promise<boolean> {
    return url.includes('jobs.lever.co') || 
           url.includes('lever.co/') ||
           await page.locator('[class*="lever"]').count() > 0;
  }

  async fill(page: Page, profile: Profile, responses: CommonResponses, resumeText?: string): Promise<void> {
    console.log('🎯 Detected Lever platform');

    // Wait for form to load
    await page.waitForSelector('input[name="name"], input[type="text"]', { timeout: 10000 });
    await humanLikeDelay();

    // Full name (Lever usually has single name field)
    const nameField = page.locator('input[name="name"]').first();
    if (await nameField.count() > 0) {
      await nameField.fill(`${profile.personalInfo.firstName} ${profile.personalInfo.lastName}`);
      await humanLikeDelay();
    }

    // Email
    const emailField = page.locator('input[name="email"], input[type="email"]').first();
    if (await emailField.count() > 0) {
      await emailField.fill(profile.personalInfo.email);
      await humanLikeDelay();
    }

    // Phone
    const phoneField = page.locator('input[name="phone"], input[type="tel"]').first();
    if (await phoneField.count() > 0) {
      await phoneField.fill(profile.personalInfo.phone);
      await humanLikeDelay();
    }

    // LinkedIn
    if (profile.personalInfo.linkedin) {
      const linkedinField = page.locator('input[name="urls[LinkedIn]"], input[placeholder*="LinkedIn"]').first();
      if (await linkedinField.count() > 0) {
        await linkedinField.fill(profile.personalInfo.linkedin);
        await humanLikeDelay();
      }
    }

    // Upload documents
    console.log('\n📎 Uploading documents...');
    await FileUploader.uploadDocuments(page, profile.work.resumePath, profile.work.coverLetterPath);

    // Custom open-ended questions (Lever often has textareas below the standard fields)
    await this.fillCustomQuestions(page);

    // EEO questions (Lever often has these)
    await this.fillEEOQuestions(page, responses);

    console.log('✅ Lever form filled');
  }

  private async fillCustomQuestions(page: Page): Promise<void> {
    const qaBot = new QuestionAnswerer();
    const textareas = await page.locator('textarea').all();

    for (const textarea of textareas) {
      try {
        if (!(await textarea.isVisible())) continue;
        const current = await textarea.inputValue().catch(() => '');
        if (current) continue;

        const id = await textarea.getAttribute('id').catch(() => '');
        let questionText = '';

        if (id) {
          questionText = (await page.locator(`label[for="${id}"]`).textContent().catch(() => '')) || '';
        }
        if (!questionText) {
          questionText = (await textarea.getAttribute('aria-label').catch(() => '')) || '';
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
    // Lever uses a consistent structure for EEO questions
    const questions = [
      { key: 'veteranStatus', text: 'veteran', response: responses.veteranStatus },
      { key: 'disability', text: 'disability', response: responses.disability },
      { key: 'gender', text: 'gender', response: responses.gender },
      { key: 'race', text: 'race', response: responses.race },
    ];

    for (const q of questions) {
      if (!q.response) continue;

      try {
        // Lever often uses select dropdowns
        const select = page.locator(`select[name*="${q.text}"], select[aria-label*="${q.text}"]`).first();
        if (await select.isVisible({ timeout: 1000 })) {
          await select.selectOption({ label: q.response }).catch(() => {
            // Fallback to "decline" option
            select.selectOption({ index: 1 });
          });
          await humanLikeDelay();
        }
      } catch (err) {
        // Continue to next question
      }
    }
  }
}
