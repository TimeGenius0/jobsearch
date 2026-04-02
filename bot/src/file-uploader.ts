import { Page } from 'playwright';
import * as fs from 'fs';
import { humanLikeDelay } from './utils';

export class FileUploader {
  /**
   * Find and upload resume to the application form
   */
  static async uploadResume(page: Page, resumePath: string): Promise<boolean> {
    if (!resumePath || !fs.existsSync(resumePath)) {
      console.log(`⚠️  Resume not found: ${resumePath}`);
      return false;
    }

    console.log(`📄 Uploading resume: ${resumePath}`);

    // First, find ALL file inputs on the page (even hidden ones)
    const allFileInputs = await page.locator('input[type="file"]').all();
    console.log(`   Found ${allFileInputs.length} file input(s) on page`);

    if (allFileInputs.length === 0) {
      console.log('  ⚠️  No file inputs found on page');
      return false;
    }

    // Try to find resume-specific input first
    for (const input of allFileInputs) {
      try {
        const name = await input.getAttribute('name');
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const accept = await input.getAttribute('accept');
        
        const context = `${name} ${id} ${ariaLabel} ${accept}`.toLowerCase();
        
        console.log(`   Checking file input: name="${name}", id="${id}", aria-label="${ariaLabel}"`);
        
        if (context.includes('resume') || context.includes('cv')) {
          console.log(`   ✓ Found resume field, uploading...`);
          await input.setInputFiles(resumePath);
          console.log('  ✅ Resume uploaded successfully');
          await humanLikeDelay(1000, 2000);
          return true;
        }
      } catch (err) {
        continue;
      }
    }

    // If no resume-specific field, use the first file input
    console.log('   No resume-specific field found, using first file input...');
    try {
      await allFileInputs[0].setInputFiles(resumePath);
      console.log('  ✅ Resume uploaded to first file input');
      await humanLikeDelay(1000, 2000);
      return true;
    } catch (err) {
      console.log('  ⚠️  Failed to upload to first file input');
      return false;
    }
  }

  /**
   * Find and upload cover letter to the application form
   */
  static async uploadCoverLetter(page: Page, coverLetterPath: string): Promise<boolean> {
    if (!coverLetterPath || !fs.existsSync(coverLetterPath)) {
      console.log(`⚠️  Cover letter not found: ${coverLetterPath}`);
      return false;
    }

    console.log(`📝 Uploading cover letter: ${coverLetterPath}`);

    const allFileInputs = await page.locator('input[type="file"]').all();

    // Try to find cover letter-specific input by attributes OR ancestor text
    for (const input of allFileInputs) {
      try {
        const name = await input.getAttribute('name');
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const attrContext = `${name} ${id} ${ariaLabel}`.toLowerCase();

        // Also check surrounding ancestor text for "cover"
        const ancestorContext = await input.evaluate((el) => {
          let node: Element | null = el.parentElement;
          for (let d = 0; d < 10 && node; d++) {
            const text = node.textContent?.trim().toLowerCase() || '';
            if (text.length > 3) return text.substring(0, 300);
            node = node.parentElement;
          }
          return '';
        }).catch(() => '');

        if (attrContext.includes('cover') || ancestorContext.includes('cover letter')) {
          console.log(`   ✓ Found cover letter field, uploading...`);
          await input.setInputFiles(coverLetterPath);
          console.log('  ✅ Cover letter uploaded successfully');
          await humanLikeDelay(1000, 2000);
          return true;
        }
      } catch (err) {
        continue;
      }
    }

    // No dedicated cover letter field found — do NOT fall back to a positional guess
    // (that would overwrite the resume if it was already uploaded)
    console.log('  ℹ️  No dedicated cover letter upload field found (form may not have one)');
    return false;
  }

  /**
   * Upload both resume and cover letter
   */
  static async uploadDocuments(
    page: Page,
    resumePath: string,
    coverLetterPath?: string
  ): Promise<{ resume: boolean; coverLetter: boolean }> {
    const results = {
      resume: await this.uploadResume(page, resumePath),
      coverLetter: coverLetterPath ? await this.uploadCoverLetter(page, coverLetterPath) : false,
    };

    return results;
  }

  /**
   * Check if there are any unfilled file inputs
   */
  static async hasUnfilledFileInputs(page: Page): Promise<boolean> {
    const fileInputs = await page.locator('input[type="file"]').all();
    
    for (const input of fileInputs) {
      try {
        const hasFile = await input.evaluate((el: any) => {
          return el.files && el.files.length > 0;
        });
        
        if (!hasFile) {
          const label = await input.getAttribute('aria-label') || await input.getAttribute('name') || 'Unknown';
          console.log(`⚠️  Unfilled file input: ${label}`);
          return true;
        }
      } catch (err) {
        continue;
      }
    }
    
    return false;
  }
}
