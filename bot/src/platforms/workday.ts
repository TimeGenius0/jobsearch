import type { Page } from 'playwright';
import type { Profile, CommonResponses, PlatformHandler } from '../types';
import { humanLikeDelay } from '../utils';
import { FileUploader } from '../file-uploader';
import { QuestionAnswerer } from '../question-answerer';

/**
 * Workday ATS handler
 * Covers: *.myworkdayjobs.com and apply.workday.com/*
 *
 * Workday forms are React SPAs with dynamic section loading.
 * Each section (Personal Info, Experience, Documents) may be on its own page/step.
 * The handler fills all visible inputs, then lets MultiPageHandler advance pages.
 */
export class WorkdayHandler implements PlatformHandler {
  async detect(url: string, page: Page): Promise<boolean> {
    if (url.includes('myworkdayjobs.com') || url.includes('workday.com')) {
      return true;
    }
    // Check for Workday DOM markers
    const hasWorkday =
      (await page.locator('[data-automation-id], [class*="workday"], [id*="wd-"]').count()) > 0;
    return hasWorkday;
  }

  async fill(page: Page, profile: Profile, responses: CommonResponses): Promise<void> {
    console.log('💼 Detected Workday ATS platform');

    // Workday often takes a while to render its React components
    await page.waitForSelector('[data-automation-id], input', { timeout: 20000 });
    await humanLikeDelay(1000, 2000);

    // Upload documents if file inputs are visible
    console.log('\n📎 Uploading documents...');
    await FileUploader.uploadDocuments(page, profile.work.resumePath, profile.work.coverLetterPath);

    // Fill visible form fields using Workday's data-automation-id attributes
    await this.fillByAutomationId(page, profile, responses);

    // Fall back to generic label-based filling for any remaining fields
    await this.fillRemainingFields(page, profile, responses);

    // Answer custom questions
    await this.fillCustomQuestions(page);

    // Handle EEO selects
    await this.fillEEODropdowns(page, responses);

    console.log('✅ Workday form filled (current page)');
  }

  private async fillByAutomationId(page: Page, profile: Profile, responses: CommonResponses): Promise<void> {
    const { personalInfo, location, work, education, preferences } = profile;

    type FieldDef = { id: string; value: string };

    const fieldDefs: FieldDef[] = [
      { id: 'legalNameSection_firstName', value: personalInfo.firstName },
      { id: 'legalNameSection_lastName', value: personalInfo.lastName },
      { id: 'firstName', value: personalInfo.firstName },
      { id: 'lastName', value: personalInfo.lastName },
      { id: 'email', value: personalInfo.email },
      { id: 'phone-number', value: personalInfo.phone },
      { id: 'phoneNumber', value: personalInfo.phone },
      { id: 'linkedin', value: personalInfo.linkedin || '' },
      { id: 'linkedIn', value: personalInfo.linkedin || '' },
      { id: 'city', value: location.city },
      { id: 'state', value: location.state },
      { id: 'addressLine1', value: location.address || '' },
      { id: 'postalCode', value: location.zipCode || '' },
      { id: 'country', value: location.country || 'United States' },
      { id: 'currentJobTitle', value: work.currentTitle || '' },
      { id: 'currentCompany', value: work.currentCompany || '' },
      { id: 'yearsOfExperience', value: work.yearsExperience.toString() },
      { id: 'schoolName', value: education.university || '' },
      { id: 'degree', value: education.degree || '' },
      { id: 'desiredSalary', value: responses.salaryExpectation || '' },
      { id: 'howDidYouHearAboutUs', value: responses.referralSource || '' },
    ];

    for (const { id, value } of fieldDefs) {
      if (!value) continue;
      try {
        const el = page.locator(`[data-automation-id="${id}"]`).first();
        if (await el.isVisible({ timeout: 500 })) {
          const tag = await el.evaluate(e => e.tagName.toLowerCase());
          if (tag === 'input' || tag === 'textarea') {
            const current = await el.inputValue().catch(() => '');
            if (current) continue;
            await el.fill(value);
            await humanLikeDelay();
            console.log(`   ✓ [workday] ${id}`);
          }
        }
      } catch {
        continue;
      }
    }

    // Handle work authorization dropdown
    if (preferences.workAuthorization) {
      try {
        const authEl = page
          .locator('[data-automation-id*="workAuthorization"], [data-automation-id*="visa"]')
          .first();
        if (await authEl.isVisible({ timeout: 500 })) {
          await authEl.selectOption({ label: preferences.workAuthorization }).catch(() => {});
          await humanLikeDelay();
        }
      } catch {}
    }

    // Handle sponsorship radio/checkbox
    try {
      const sponsorText = preferences.requiresVisaSponsorship ? 'Yes' : 'No';
      const sponsorEl = page
        .locator(`[data-automation-id*="sponsor"] label:has-text("${sponsorText}")`)
        .first();
      if (await sponsorEl.isVisible({ timeout: 500 })) {
        await sponsorEl.click();
        await humanLikeDelay();
      }
    } catch {}
  }

  private async fillRemainingFields(page: Page, profile: Profile, responses: CommonResponses): Promise<void> {
    const { personalInfo, location, work, preferences } = profile;

    const inputs = await page.locator('input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"])').all();

    for (const input of inputs) {
      try {
        if (!(await input.isVisible())) continue;
        if (!(await input.isEnabled())) continue;
        const current = await input.inputValue().catch(() => '');
        if (current) continue;

        const name = ((await input.getAttribute('name')) || '').toLowerCase();
        const placeholder = ((await input.getAttribute('placeholder')) || '').toLowerCase();
        const autoId = ((await input.getAttribute('data-automation-id')) || '').toLowerCase();
        const ariaLabel = ((await input.getAttribute('aria-label')) || '').toLowerCase();
        const ctx = `${name} ${placeholder} ${autoId} ${ariaLabel}`;

        if (ctx.includes('first') && ctx.includes('name')) {
          await input.fill(personalInfo.firstName);
        } else if (ctx.includes('last') && ctx.includes('name')) {
          await input.fill(personalInfo.lastName);
        } else if (ctx.includes('email')) {
          await input.fill(personalInfo.email);
        } else if (ctx.includes('phone') || ctx.includes('tel')) {
          await input.fill(personalInfo.phone);
        } else if (ctx.includes('linkedin')) {
          await input.fill(personalInfo.linkedin || '');
        } else if (ctx.includes('city')) {
          await input.fill(location.city);
        } else if (ctx.includes('zip') || ctx.includes('postal')) {
          await input.fill(location.zipCode || '');
        } else if (ctx.includes('salary') && responses.salaryExpectation) {
          await input.fill(responses.salaryExpectation);
        } else if ((ctx.includes('start') || ctx.includes('available')) && responses.availableStartDate) {
          await input.fill(responses.availableStartDate);
        } else if (ctx.includes('company') && work.currentCompany) {
          await input.fill(work.currentCompany);
        } else if (ctx.includes('title') && work.currentTitle) {
          await input.fill(work.currentTitle);
        } else {
          continue;
        }

        await humanLikeDelay();
      } catch {
        continue;
      }
    }
  }

  private async fillCustomQuestions(page: Page): Promise<void> {
    const qaBot = new QuestionAnswerer();
    const textareas = await page.locator('textarea').all();

    for (const textarea of textareas) {
      try {
        if (!(await textarea.isVisible())) continue;
        const current = await textarea.inputValue().catch(() => '');
        if (current) continue;

        const questionText = await textarea.evaluate((el) => {
          const ariaLabel = el.getAttribute('aria-label');
          if (ariaLabel && ariaLabel.length > 5) return ariaLabel;
          let node: Element | null = el.parentElement;
          for (let d = 0; d < 8; d++) {
            if (!node) break;
            for (const child of Array.from(node.children)) {
              if (child.contains(el)) continue;
              const tag = child.tagName.toLowerCase();
              if (['label', 'legend', 'h3', 'h4', 'p'].includes(tag)) {
                const t = child.textContent?.trim() || '';
                if (t.length > 5 && t.length < 500) return t;
              }
              if (['div', 'span'].includes(tag) && !child.querySelector('input, textarea, select')) {
                const t = child.textContent?.trim() || '';
                if (t.length > 10 && t.length < 400) return t;
              }
            }
            node = node.parentElement;
          }
          return '';
        });

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

  private async fillEEODropdowns(page: Page, responses: CommonResponses): Promise<void> {
    const allSelects = await page.locator('select').all();

    for (const select of allSelects) {
      try {
        if (!(await select.isVisible().catch(() => false))) continue;
        const options = await select.locator('option').allTextContents();
        const optText = options.join(' ').toLowerCase();

        if (optText.includes('veteran') && responses.veteranStatus) {
          await select.selectOption({ label: responses.veteranStatus }).catch(() =>
            select.selectOption({ index: 1 }).catch(() => {})
          );
        } else if (optText.includes('disability') && responses.disability) {
          await select.selectOption({ label: responses.disability }).catch(() =>
            select.selectOption({ index: 1 }).catch(() => {})
          );
        } else if ((optText.includes('male') || optText.includes('female')) && responses.gender) {
          await select.selectOption({ label: responses.gender }).catch(() =>
            select.selectOption({ index: 1 }).catch(() => {})
          );
        } else if (
          (optText.includes('asian') || optText.includes('hispanic')) &&
          responses.race
        ) {
          await select.selectOption({ label: responses.race }).catch(() =>
            select.selectOption({ index: 1 }).catch(() => {})
          );
        }

        await humanLikeDelay();
      } catch {
        continue;
      }
    }
  }
}
