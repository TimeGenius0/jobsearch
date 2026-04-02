import type { Page } from 'playwright';
import type { Profile, CommonResponses, PlatformHandler } from '../types';
import { humanLikeDelay } from '../utils';
import { FileUploader } from '../file-uploader';
import { QuestionAnswerer } from '../question-answerer';

export class GenericHandler implements PlatformHandler {
  async detect(url: string, page: Page): Promise<boolean> {
    // Generic handler is always a fallback
    return true;
  }

  async fill(page: Page, profile: Profile, responses: CommonResponses, resumeText?: string): Promise<void> {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔧 Using generic form filler');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const qaBot = new QuestionAnswerer();

    console.log('⏳ Waiting for form to load...');
    await page.waitForSelector('input:not([type="hidden"]), textarea', { timeout: 20000 });
    console.log('   Initial fields detected, waiting for full form...');
    
    // Wait for dynamic content to finish loading
    await page.waitForTimeout(3000);
    
    // Wait for network to be idle (form might be fetching data)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
      console.log('   Network still active, but proceeding...');
    });
    
    console.log('✅ Form loaded\n');

    // Upload documents first
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📎 STEP 1: Uploading documents');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    await FileUploader.uploadDocuments(page, profile.work.resumePath, profile.work.coverLetterPath);

    // Find and fill common fields by looking at labels, names, placeholders
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✍️  STEP 2: Filling form fields');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('🔍 Scanning input fields...');
    
    // Don't use :visible - it's too strict. Just get all inputs and check ourselves.
    const inputs = await page.locator('input, textarea, select').all();
    console.log(`   Found ${inputs.length} total fields\n`);
    
    // Filter to only visible/enabled ones
    const visibleInputs: typeof inputs = [];
    for (const input of inputs) {
      try {
        const isVisible = await input.isVisible();
        const isEnabled = await input.isEnabled();
        if (isVisible && isEnabled) {
          visibleInputs.push(input);
        }
      } catch {
        // Field might have been removed, skip it
      }
    }
    
    console.log(`   ${visibleInputs.length} are visible and enabled\n`);

    for (const input of visibleInputs) {
      const tagName = await input.evaluate(el => el.tagName.toLowerCase());
      const type = await input.getAttribute('type');
      const name = (await input.getAttribute('name'))?.toLowerCase() || '';
      const placeholder = (await input.getAttribute('placeholder'))?.toLowerCase() || '';
      const id = (await input.getAttribute('id'))?.toLowerCase() || '';
      const ariaLabel = (await input.getAttribute('aria-label'))?.toLowerCase() || '';
      
      const context = `${name} ${placeholder} ${id} ${ariaLabel}`.toLowerCase();

      try {
        // Skip if already filled
        const value = await input.inputValue().catch(() => '');
        if (value && value.length > 0) continue;



        // Try to get the label text for this field
        let questionText: string = '';
        try {
          // Strategy 1: aria-label (already extracted above)
          questionText = ariaLabel;
          
          // Strategy 2: label[for]
          if (!questionText && id) {
            const labelFor = await page.locator(`label[for="${id}"]`).textContent().catch(() => '');
            questionText = labelFor || '';
          }
          
          // Strategy 3: aria-labelledby
          if (!questionText) {
            const ariaLabelledBy = await input.getAttribute('aria-labelledby');
            if (ariaLabelledBy) {
              const labelledByText = await page.locator(`#${ariaLabelledBy}`).textContent().catch(() => '');
              questionText = labelledByText || '';
            }
          }
          
          // Strategy 4: Look at parent and nearby elements
          if (!questionText || questionText.length < 10) {
            const contextText = await input.evaluate((el) => {
              let text = '';

              // Check parent's text content
              const parent = el.parentElement;
              if (parent) {
                // Look for label/legend/heading in parent
                const label = parent.querySelector('label, legend, h3, h4, p, div > span');
                if (label && label.textContent) {
                  text = label.textContent.trim();
                }
              }

              // Check previous siblings
              if (!text || text.length < 10) {
                let prev = el.previousElementSibling;
                let depth = 0;
                while (prev && depth < 3 && text.length < 500) {
                  const tagName = prev.tagName.toLowerCase();
                  if (['label', 'p', 'div', 'span', 'h3', 'h4', 'legend'].includes(tagName)) {
                    const siblingText = prev.textContent?.trim() || '';
                    if (siblingText.length > text.length) {
                      text = siblingText;
                    }
                  }
                  prev = prev.previousElementSibling;
                  depth++;
                }
              }

              return text.trim();
            });

            if (contextText && contextText.length > (questionText?.length || 0)) {
              questionText = contextText || '';
            }
          }

          // Strategy 5: Walk up ancestor tree (handles deeply nested inputs like Rippling)
          if (!questionText || questionText.length < 10) {
            const ancestorText = await input.evaluate((el) => {
              /* eslint-disable @typescript-eslint/no-explicit-any */
              let node: any = (el as any).parentElement;
              let depth = 0;
              while (node && depth < 8) {
                for (const child of Array.from(node.children) as any[]) {
                  if (child.contains(el)) continue; // skip the branch containing our input
                  const tag: string = child.tagName.toLowerCase();
                  // Hard label elements
                  if (['label', 'legend', 'h1', 'h2', 'h3', 'h4', 'h5'].includes(tag)) {
                    const t: string = child.textContent?.trim() || '';
                    if (t.length > 10 && t.length < 500) return t;
                  }
                  // Div/span that looks like a question label (no nested inputs)
                  if (['div', 'span', 'p'].includes(tag)) {
                    const t: string = child.textContent?.trim() || '';
                    if (t.length > 2 && t.length < 400 && !child.querySelector('input, textarea, select')) {
                      return t;
                    }
                  }
                }
                node = node.parentElement;
                depth++;
              }
              return '';
            });
            if (ancestorText && ancestorText.length > (questionText?.length || 0)) {
              questionText = ancestorText;
            }
          }
          
          // Fallback to placeholder
          if (!questionText) {
            questionText = placeholder;
          }
        } catch {}
        
        console.log(`   Checking field: ${name || id || placeholder || 'unknown'} (type: ${type || tagName})`);
        if (questionText && questionText.length > 20) {
          console.log(`     Question: "${questionText.substring(0, 80)}..."`);
        }
        
        // For textareas, ALWAYS try AI (they're almost always open-ended questions)
        if (tagName === 'textarea') {
          console.log(`     📝 Textarea detected - using AI`);
          
          // Build prompt from whatever context we have
          let promptText = questionText;
          if (!promptText || promptText.length < 10) {
            // Fallback: use placeholder or generic
            promptText = placeholder || `Describe your relevant experience and qualifications`;
          }
          
          console.log(`     🤖 AI answering: "${promptText.substring(0, 60)}..."`);
          const answer = await qaBot.answerQuestion(promptText);
          
          if (answer) {
            console.log(`     ✅ AI filled (${answer.length} chars)`);
            await input.fill(answer);
            await humanLikeDelay(500, 1000);
            continue;
          } else {
            console.log(`     ⚠️  AI unavailable, skipping`);
            continue;
          }
        }
        
        if (type === 'file') {
          if (context.includes('resume') && profile.work.resumePath) {
            await input.setInputFiles(profile.work.resumePath);
            console.log('📄 Resume uploaded (generic)');
            await humanLikeDelay(1000, 2000);
          } else if (context.includes('cover') && profile.work.coverLetterPath) {
            await input.setInputFiles(profile.work.coverLetterPath);
            console.log('📝 Cover letter uploaded (generic)');
            await humanLikeDelay(1000, 2000);
          }
        } else if (type === 'email' || context.includes('email')) {
          console.log(`     ✓ Filling email: ${profile.personalInfo.email}`);
          await input.fill(profile.personalInfo.email);
          await humanLikeDelay();
        } else if (type === 'tel' || context.includes('phone')) {
          console.log(`     ✓ Filling phone: ${profile.personalInfo.phone}`);

          await input.fill(profile.personalInfo.phone);
          await humanLikeDelay();
        } else if (context.includes('name') && !context.includes('last') && !context.includes('company')) {
          // Generic "name" field - use full name
          console.log(`     ✓ Filling name: ${profile.personalInfo.firstName} ${profile.personalInfo.lastName}`);
          await input.fill(`${profile.personalInfo.firstName} ${profile.personalInfo.lastName}`);
          await humanLikeDelay();
        } else if (context.includes('first') && context.includes('name')) {
          console.log(`     ✓ Filling first name: ${profile.personalInfo.firstName}`);
          await input.fill(profile.personalInfo.firstName);
          await humanLikeDelay();
        } else if (context.includes('last') && context.includes('name')) {
          console.log(`     ✓ Filling last name: ${profile.personalInfo.lastName}`);

          await input.fill(profile.personalInfo.lastName);
          await humanLikeDelay();
        } else if (context.includes('linkedin')) {
          if (profile.personalInfo.linkedin) {
            await input.fill(profile.personalInfo.linkedin);
            await humanLikeDelay();
          }
        } else if (context.includes('github') && profile.personalInfo.github) {
          await input.fill(profile.personalInfo.github);
          await humanLikeDelay();
        } else if (context.includes('portfolio') && profile.personalInfo.portfolio) {
          await input.fill(profile.personalInfo.portfolio);
          await humanLikeDelay();
        } else if (context.includes('city')) {
          await input.fill(profile.location.city);
          await humanLikeDelay();
        } else if (context.includes('state') || context.includes('province')) {
          await input.fill(profile.location.state);
          await humanLikeDelay();
        } else if (context.includes('zip') || context.includes('postal')) {
          if (profile.location.zipCode) {
            await input.fill(profile.location.zipCode);
            await humanLikeDelay();
          }
        } else if (context.includes('address') && profile.location.address) {
          await input.fill(profile.location.address);
          await humanLikeDelay();
        } else if (context.includes('location') && !context.includes('willing')) {
          await input.fill(`${profile.location.city}, ${profile.location.state}`);
          await humanLikeDelay();
        } else if (context.includes('website') && profile.personalInfo.website) {
          await input.fill(profile.personalInfo.website);
          await humanLikeDelay();
        } else if ((context.includes('company') || context.includes('employer')) && profile.work.currentCompany) {
          await input.fill(profile.work.currentCompany);
          await humanLikeDelay();
        } else if (context.includes('title') && profile.work.currentTitle) {
          await input.fill(profile.work.currentTitle);
          await humanLikeDelay();
        } else if (context.includes('experience') && context.includes('year')) {
          await input.fill(profile.work.yearsExperience.toString());
          await humanLikeDelay();
        } else if (context.includes('degree') && profile.education.degree) {
          await input.fill(profile.education.degree);
          await humanLikeDelay();
        } else if ((context.includes('university') || context.includes('school')) && profile.education.university) {
          await input.fill(profile.education.university);
          await humanLikeDelay();
        } else if (context.includes('sponsor') || context.includes('visa')) {
          await input.fill(profile.preferences.requiresVisaSponsorship ? 'Yes' : 'No');
          await humanLikeDelay();
        } else if (context.includes('relocate')) {
          await input.fill(profile.preferences.willingToRelocate ? 'Yes' : 'No');
          await humanLikeDelay();
        } else if (context.includes('authorization') || context.includes('work authorization')) {
          await input.fill(profile.preferences.workAuthorization);
          await humanLikeDelay();
        } else if (context.includes('salary') && responses.salaryExpectation) {
          await input.fill(responses.salaryExpectation);
          await humanLikeDelay();
        } else if ((context.includes('start') || context.includes('available')) && responses.availableStartDate) {
          await input.fill(responses.availableStartDate);
          await humanLikeDelay();
        } else if (context.includes('referral') && responses.referralSource) {
          await input.fill(responses.referralSource);
          await humanLikeDelay();
        } else if (
          placeholder.includes('select') ||
          ariaLabel.includes('select') ||
          ariaLabel.includes('search') ||
          (await input.getAttribute('role'))?.toLowerCase() === 'combobox'
        ) {
          // Custom combobox/dropdown (e.g. Rippling uses input[role=combobox] instead of <select>)
          const label = questionText.toLowerCase();
          let valueToSelect: string | null = null;

          if (label.includes('sponsor') || label.includes('visa') || label.includes('authorization') || label.includes('work auth')) {
            valueToSelect = profile.preferences.workAuthorization;
          } else if (label.includes('relocate')) {
            valueToSelect = profile.preferences.willingToRelocate ? 'Yes' : 'No';
          } else if (label.includes('location') || label.includes('city') || label.includes('where')) {
            valueToSelect = `${profile.location.city}, ${profile.location.state}`;
          } else if (label.includes('country')) {
            valueToSelect = profile.location.country || 'United States';
          } else if (label.includes('salary') && responses.salaryExpectation) {
            valueToSelect = responses.salaryExpectation;
          } else if ((label.includes('start') || label.includes('available')) && responses.availableStartDate) {
            valueToSelect = responses.availableStartDate;
          } else if (label.includes('employment') || label.includes('job type')) {
            valueToSelect = 'Full-time';
          }

          if (valueToSelect) {
            console.log(`     🔽 Custom dropdown - trying: "${valueToSelect}"`);
            try {
              await input.click();
              await page.waitForTimeout(500);
              await input.fill(valueToSelect);
              await page.waitForTimeout(600);
              // Look for a dropdown option list and click the best match
              const optionSelectors = [
                `[role="option"]:has-text("${valueToSelect}")`,
                `[role="listbox"] li`,
                `[class*="option"]`,
                `[class*="dropdown"] li`,
                `[class*="menu"] li`,
              ];
              let clicked = false;
              for (const sel of optionSelectors) {
                try {
                  const opts = await page.locator(sel).all();
                  if (opts.length > 0) {
                    // Find best match
                    for (const opt of opts) {
                      const txt = (await opt.textContent())?.toLowerCase() || '';
                      if (txt.includes(valueToSelect.toLowerCase().split(',')[0].toLowerCase())) {
                        await opt.click();
                        clicked = true;
                        break;
                      }
                    }
                    if (!clicked && opts.length > 0) {
                      await opts[0].click();
                      clicked = true;
                    }
                    if (clicked) break;
                  }
                } catch {}
              }
              if (clicked) {
                console.log(`     ✅ Dropdown selected`);
              } else {
                console.log(`     ⚠️  Dropdown opened but no option matched — left as typed`);
              }
              await humanLikeDelay();
            } catch (err: any) {
              console.warn(`     ⚠️  Custom dropdown failed: ${err.message}`);
            }
          } else {
            console.log(`     ⏭️  Custom dropdown — no mapping for: "${questionText.substring(0, 60)}"`);
          }
        } else {
          // Didn't match any patterns
          console.log(`     ⏭️  Skipped (no matching pattern for: ${context.substring(0, 50)})`);
        }
      } catch (err: any) {
        console.warn(`     ⚠️  Error filling field: ${name || id || placeholder}`);
        console.warn(`        ${err.message}`);
      }
    }
    
    console.log(`\n📊 Summary: Attempted to fill ${visibleInputs.length} fields`);

    // Handle EEO/Diversity questions (usually at the end)
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 STEP 3: Filling EEO/Diversity questions');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    await this.fillEEOQuestions(page, responses);

    console.log('\n✅ Generic form filled (best effort)');
  }

  private async fillEEOQuestions(page: Page, responses: CommonResponses): Promise<void> {
    console.log('🔍 Scanning for EEO/diversity questions...');
    console.log(`   Looking for: veteran, disability, gender, race`);

    // Find all selects and check their OPTIONS text (more reliable than field names)
    const allSelects = await page.locator('select').all();
    
    console.log(`   Found ${allSelects.length} select dropdown(s)`);
    
    for (const select of allSelects) {
      try {
        if (!await select.isVisible().catch(() => false)) continue;
        
        // Get all option texts
        const options = await select.locator('option').allTextContents();
        const optionsText = options.join(' ').toLowerCase();
        
        // Check what type of EEO question this is based on options
        if (optionsText.includes('veteran') && responses.veteranStatus) {
          console.log(`   ✓ Veteran status dropdown`);
          await select.selectOption({ label: responses.veteranStatus }).catch(() => {
            // Try selecting first "not" or "decline" option
            select.selectOption({ index: 1 }).catch(() => {});
          });
          await humanLikeDelay();
        } else if (optionsText.includes('disability') && responses.disability) {
          console.log(`   ✓ Disability status dropdown`);
          await select.selectOption({ label: responses.disability }).catch(() => {
            select.selectOption({ index: 1 }).catch(() => {});
          });
          await humanLikeDelay();
        } else if ((optionsText.includes('male') || optionsText.includes('female')) && responses.gender) {
          console.log(`   ✓ Gender dropdown`);
          await select.selectOption({ label: responses.gender }).catch(() => {
            select.selectOption({ index: 1 }).catch(() => {});
          });
          await humanLikeDelay();
        } else if ((optionsText.includes('asian') || optionsText.includes('hispanic') || optionsText.includes('caucasian')) && responses.race) {
          console.log(`   ✓ Race/ethnicity dropdown`);
          await select.selectOption({ label: responses.race }).catch(() => {
            select.selectOption({ index: 1 }).catch(() => {});
          });
          await humanLikeDelay();
        }
      } catch {}
    }

    // Veteran status
    if (responses.veteranStatus) {
      const veteranSelectors = [
        'select[name*="veteran"]',
        'select[id*="veteran"]',
        'input[name*="veteran"]',
        '[aria-label*="veteran"]',
      ];

      for (const selector of veteranSelectors) {
        try {
          const field = page.locator(selector).first();
          if (await field.isVisible({ timeout: 1000 })) {
            const tagName = await field.evaluate(el => el.tagName.toLowerCase());
            
            if (tagName === 'select') {
              // Try to select by text
              await field.selectOption({ label: responses.veteranStatus }).catch(async () => {
                // Fallback: try common values
                const options = await field.locator('option').allTextContents();
                const match = options.find(opt => 
                  opt.toLowerCase().includes('not') && opt.toLowerCase().includes('veteran')
                );
                if (match) await field.selectOption({ label: match });
              });
            } else if (tagName === 'input') {
              // Radio button
              const label = page.locator(`label:has-text("${responses.veteranStatus}")`).first();
              if (await label.isVisible({ timeout: 500 })) {
                await label.click();
              }
            }
            
            await humanLikeDelay();
            console.log('  ✓ Veteran status');
            break;
          }
        } catch (err) {
          continue;
        }
      }
    }

    // Disability status
    if (responses.disability) {
      const disabilitySelectors = [
        'select[name*="disability"]',
        'select[id*="disability"]',
        'select[name*="disabled"]',
        'input[name*="disability"]',
        '[aria-label*="disability"]',
      ];

      for (const selector of disabilitySelectors) {
        try {
          const field = page.locator(selector).first();
          if (await field.isVisible({ timeout: 1000 })) {
            const tagName = await field.evaluate(el => el.tagName.toLowerCase());
            
            if (tagName === 'select') {
              await field.selectOption({ label: responses.disability }).catch(async () => {
                const options = await field.locator('option').allTextContents();
                const match = options.find(opt => 
                  opt.toLowerCase().includes('not') || opt.toLowerCase().includes('decline')
                );
                if (match) await field.selectOption({ label: match });
              });
            } else if (tagName === 'input') {
              const label = page.locator(`label:has-text("${responses.disability}")`).first();
              if (await label.isVisible({ timeout: 500 })) {
                await label.click();
              }
            }
            
            await humanLikeDelay();
            console.log('  ✓ Disability status');
            break;
          }
        } catch (err) {
          continue;
        }
      }
    }

    // Gender
    if (responses.gender) {
      const genderSelectors = [
        'select[name*="gender"]',
        'select[id*="gender"]',
        'input[name*="gender"]',
        '[aria-label*="gender"]',
      ];

      for (const selector of genderSelectors) {
        try {
          const field = page.locator(selector).first();
          if (await field.isVisible({ timeout: 1000 })) {
            const tagName = await field.evaluate(el => el.tagName.toLowerCase());
            
            if (tagName === 'select') {
              await field.selectOption({ label: responses.gender }).catch(async () => {
                const options = await field.locator('option').allTextContents();
                const match = options.find(opt => 
                  opt.toLowerCase().includes('prefer') || opt.toLowerCase().includes('decline')
                );
                if (match) await field.selectOption({ label: match });
              });
            } else if (tagName === 'input') {
              const label = page.locator(`label:has-text("${responses.gender}")`).first();
              if (await label.isVisible({ timeout: 500 })) {
                await label.click();
              }
            }
            
            await humanLikeDelay();
            console.log('  ✓ Gender');
            break;
          }
        } catch (err) {
          continue;
        }
      }
    }

    // Race/Ethnicity
    if (responses.race) {
      const raceSelectors = [
        'select[name*="race"]',
        'select[name*="ethnicity"]',
        'select[id*="race"]',
        'select[id*="ethnicity"]',
        'input[name*="race"]',
        'input[name*="ethnicity"]',
        '[aria-label*="race"]',
        '[aria-label*="ethnicity"]',
      ];

      for (const selector of raceSelectors) {
        try {
          const field = page.locator(selector).first();
          if (await field.isVisible({ timeout: 1000 })) {
            const tagName = await field.evaluate(el => el.tagName.toLowerCase());
            
            if (tagName === 'select') {
              await field.selectOption({ label: responses.race }).catch(async () => {
                const options = await field.locator('option').allTextContents();
                const match = options.find(opt => 
                  opt.toLowerCase().includes('prefer') || opt.toLowerCase().includes('decline')
                );
                if (match) await field.selectOption({ label: match });
              });
            } else if (tagName === 'input') {
              const label = page.locator(`label:has-text("${responses.race}")`).first();
              if (await label.isVisible({ timeout: 500 })) {
                await label.click();
              }
            }
            
            await humanLikeDelay();
            console.log('  ✓ Race/Ethnicity');
            break;
          }
        } catch (err) {
          continue;
        }
      }
    }
  }
}
