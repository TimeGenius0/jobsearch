import type { Page } from 'playwright';
import type { Profile, CommonResponses, PlatformHandler } from '../types';
import { humanLikeDelay } from '../utils';
import { FileUploader } from '../file-uploader';
import { QuestionAnswerer } from '../question-answerer';

export class AshbyHandler implements PlatformHandler {
  async detect(url: string, page: Page): Promise<boolean> {
    if (
      url.includes('jobs.gem.com') ||
      url.includes('ashbyhq.com') ||
      url.includes('jobsboard.ashby') ||
      url.includes('job.ashby')
    ) {
      return true;
    }
    // Check for Ashby DOM markers
    const hasAshby =
      (await page.locator('[data-ashby-component], [class*="ashby"], [id*="ashby"]').count()) > 0;
    return hasAshby;
  }

  async fill(page: Page, profile: Profile, responses: CommonResponses): Promise<void> {
    console.log('🔷 Detected Ashby ATS platform');

    await page.waitForSelector('input, textarea', { timeout: 15000 });
    await humanLikeDelay(500, 1000);

    // Upload documents first (Ashby often has upload at top)
    console.log('\n📎 Uploading documents...');
    await FileUploader.uploadDocuments(page, profile.work.resumePath, profile.work.coverLetterPath);
    await humanLikeDelay(500, 1000);

    // Ashby system fields use name="_systemfield_*" pattern
    await this.fillSystemFields(page, profile);

    // Fill custom application questions (textareas)
    await this.fillCustomQuestions(page, responses);

    // Fill EEO/diversity fields (selects + radio buttons)
    await this.fillEEODropdowns(page, responses);
    await this.fillEEORadioButtons(page, responses);

    console.log('✅ Ashby form filled');
  }

  private async fillSystemFields(page: Page, profile: Profile): Promise<void> {
    const { personalInfo, location, work } = profile;

    const fieldMap: Array<{ selectors: string[]; value: string }> = [
      // Full name (Ashby often combines first+last)
      {
        selectors: [
          'input[name="_systemfield_name"]',
          'input[placeholder*="Full name"]',
          'input[placeholder*="full name"]',
        ],
        value: `${personalInfo.firstName} ${personalInfo.lastName}`,
      },
      // First name
      {
        selectors: [
          'input[name="_systemfield_first_name"]',
          'input[id*="firstName"]',
          'input[placeholder*="First name"]',
        ],
        value: personalInfo.firstName,
      },
      // Last name
      {
        selectors: [
          'input[name="_systemfield_last_name"]',
          'input[id*="lastName"]',
          'input[placeholder*="Last name"]',
        ],
        value: personalInfo.lastName,
      },
      // Email
      {
        selectors: [
          'input[name="_systemfield_email"]',
          'input[type="email"]',
          'input[placeholder*="Email"]',
        ],
        value: personalInfo.email,
      },
      // Phone
      {
        selectors: [
          'input[name="_systemfield_phone"]',
          'input[type="tel"]',
          'input[placeholder*="Phone"]',
        ],
        value: personalInfo.phone,
      },
      // LinkedIn
      {
        selectors: [
          'input[name="_systemfield_linkedin_url"]',
          'input[placeholder*="LinkedIn"]',
          'input[id*="linkedin"]',
        ],
        value: personalInfo.linkedin || '',
      },
      // Website / portfolio
      {
        selectors: [
          'input[name="_systemfield_website_url"]',
          'input[placeholder*="Website"]',
          'input[placeholder*="Portfolio"]',
        ],
        value: personalInfo.portfolio || personalInfo.website || '',
      },
      // Location / city
      {
        selectors: [
          'input[name="_systemfield_location"]',
          'input[placeholder*="City"]',
          'input[placeholder*="Location"]',
        ],
        value: `${location.city}, ${location.state}`,
      },
      // Current company
      {
        selectors: [
          'input[placeholder*="Current company"]',
          'input[placeholder*="Company"]',
          'input[name*="company"]',
        ],
        value: work.currentCompany || '',
      },
      // Current title
      {
        selectors: [
          'input[placeholder*="Current title"]',
          'input[placeholder*="Job title"]',
          'input[name*="title"]',
        ],
        value: work.currentTitle || '',
      },
      // GitHub
      {
        selectors: [
          'input[name="_systemfield_github_url"]',
          'input[placeholder*="GitHub"]',
          'input[id*="github"]',
        ],
        value: personalInfo.github || '',
      },
    ];

    for (const { selectors, value } of fieldMap) {
      if (!value) continue;
      for (const selector of selectors) {
        try {
          const el = page.locator(selector).first();
          if (await el.isVisible({ timeout: 800 })) {
            const current = await el.inputValue().catch(() => '');
            if (current) continue; // already filled
            console.log(`   ✓ Filling: ${selector.split('[')[1]?.replace(/[^\w_-]/g, '') || selector}`);
            await el.fill(value);
            await humanLikeDelay();
            break;
          }
        } catch {
          continue;
        }
      }
    }
  }

  private async fillCustomQuestions(page: Page, _responses: CommonResponses): Promise<void> {
    const qaBot = new QuestionAnswerer();
    const textareas = await page.locator('textarea').all();

    for (const textarea of textareas) {
      try {
        if (!(await textarea.isVisible())) continue;
        const current = await textarea.inputValue().catch(() => '');
        if (current) continue;

        // Extract question text from surrounding context
        const questionText = await this.extractQuestionText(page, textarea);
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

  private async extractQuestionText(page: Page, input: import('playwright').Locator): Promise<string> {
    // Strategy 1: aria-label
    const ariaLabel = await input.getAttribute('aria-label').catch(() => '');
    if (ariaLabel && ariaLabel.length > 5) return ariaLabel;

    // Strategy 2: label[for] using input id
    const id = await input.getAttribute('id').catch(() => '');
    if (id) {
      const label = await page.locator(`label[for="${id}"]`).textContent().catch(() => '');
      if (label && label.length > 5) return label.trim();
    }

    // Strategy 3: Walk up DOM to find question text
    const contextText = await input.evaluate((el) => {
      let node: Element | null = el.parentElement;
      for (let depth = 0; depth < 8; depth++) {
        if (!node) break;
        for (const child of Array.from(node.children)) {
          if (child.contains(el)) continue;
          const tag = child.tagName.toLowerCase();
          if (['label', 'legend', 'h3', 'h4', 'h5', 'p'].includes(tag)) {
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

    return contextText?.trim() || '';
  }

  private async fillEEODropdowns(page: Page, responses: CommonResponses): Promise<void> {
    const allSelects = await page.locator('select').all();

    for (const select of allSelects) {
      try {
        if (!(await select.isVisible().catch(() => false))) continue;

        const options = await select.locator('option').allTextContents();
        const optionsText = options.join(' ').toLowerCase();

        if (optionsText.includes('veteran') && responses.veteranStatus) {
          await select.selectOption({ label: responses.veteranStatus }).catch(() =>
            select.selectOption({ index: 1 }).catch(() => {})
          );
          await humanLikeDelay();
        } else if (optionsText.includes('disability') && responses.disability) {
          await select.selectOption({ label: responses.disability }).catch(() =>
            select.selectOption({ index: 1 }).catch(() => {})
          );
          await humanLikeDelay();
        } else if ((optionsText.includes('male') || optionsText.includes('female')) && responses.gender) {
          await select.selectOption({ label: responses.gender }).catch(() =>
            select.selectOption({ index: 1 }).catch(() => {})
          );
          await humanLikeDelay();
        } else if (
          (optionsText.includes('asian') || optionsText.includes('hispanic') || optionsText.includes('caucasian')) &&
          responses.race
        ) {
          await select.selectOption({ label: responses.race }).catch(() =>
            select.selectOption({ index: 1 }).catch(() => {})
          );
          await humanLikeDelay();
        }
      } catch {
        continue;
      }
    }
  }

  private async fillEEORadioButtons(page: Page, responses: CommonResponses): Promise<void> {
    const radioInputs = await page.locator('input[type="radio"]').all();
    if (radioInputs.length === 0) return;

    // Group radios by their name attribute
    const groups = new Map<string, Array<{ radio: import('playwright').Locator; label: string }>>();

    for (const radio of radioInputs) {
      try {
        const name = await radio.getAttribute('name');
        if (!name) continue;

        // Get label text from <label for="id"> or closest <label>
        const id = await radio.getAttribute('id');
        let label = '';
        if (id) {
          label = (await page.locator(`label[for="${id}"]`).textContent().catch(() => '')) || '';
        }
        if (!label) {
          label = await radio.evaluate((el) => el.closest('label')?.textContent?.trim() || '').catch(() => '');
        }

        if (!groups.has(name)) groups.set(name, []);
        groups.get(name)!.push({ radio, label: label.trim() });
      } catch {
        continue;
      }
    }

    for (const [name, options] of groups) {
      const nameLower = name.toLowerCase();

      // Map group name to desired response value
      let desired: string | undefined;
      if (nameLower.includes('eeoc_gender') || (nameLower.includes('gender') && !nameLower.includes('identity'))) {
        desired = responses.gender;
      } else if (nameLower.includes('eeoc_race') || nameLower.includes('race') || nameLower.includes('ethnicity')) {
        desired = responses.race;
      } else if (nameLower.includes('veteran')) {
        desired = responses.veteranStatus;
      } else if (nameLower.includes('disability')) {
        desired = responses.disability;
      } else {
        continue; // not an EEO group
      }

      if (!desired) continue;

      const match = this.findBestRadioMatch(options, desired);
      if (match) {
        console.log(`   📊 EEO [${nameLower.split('eeoc_').pop() || name}]: "${match.label}"`);
        await match.radio.click();
        await humanLikeDelay();
      } else {
        console.log(`   ⚠️  No radio match for "${desired}" in group "${name}"`);
      }
    }
  }

  private findBestRadioMatch(
    options: Array<{ radio: import('playwright').Locator; label: string }>,
    desired: string
  ): { radio: import('playwright').Locator; label: string } | null {
    const d = desired.toLowerCase();

    // 1. Exact match (case-insensitive)
    const exact = options.find((o) => o.label.toLowerCase() === d);
    if (exact) return exact;

    // 2. "Prefer not to say" / "Decline" → pick option containing "decline" or "prefer not"
    if (d.includes('prefer not') || d.includes('decline')) {
      const decline = options.find(
        (o) => o.label.toLowerCase().includes('decline') || o.label.toLowerCase().includes('prefer not')
      );
      if (decline) return decline;
    }

    // 3. Partial match: desired contains option label or vice-versa
    const partial = options.find(
      (o) => o.label.toLowerCase().includes(d) || d.includes(o.label.toLowerCase())
    );
    return partial || null;
  }
}
