import { Page, Browser, BrowserContext } from 'playwright';

export class EmailVerifier {
  private gmailPage: Page | null = null;

  async init(browser: Browser | BrowserContext): Promise<void> {
    // Open Gmail in a new tab (assumes user is already logged in)
    console.log('📧 Opening Gmail in new tab (assuming active session)...');
    this.gmailPage = await browser.newPage();
    if (!this.gmailPage) throw new Error('Failed to create Gmail page');
    
    await this.gmailPage.goto('https://mail.google.com');
    
    // Wait for inbox to load (assumes already logged in)
    try {
      await this.gmailPage.waitForSelector('[role="main"]', { timeout: 10000 });
      console.log('✅ Gmail inbox loaded');
    } catch (err) {
      console.log('⚠️  Gmail not logged in - please log in manually in the new tab');
      console.log('   Waiting 30 seconds for manual login...');
      await this.gmailPage.waitForTimeout(30000);
    }
  }

  async getVerificationCode(companyName: string, timeout: number = 120000): Promise<string | null> {
    if (!this.gmailPage) throw new Error('Gmail not initialized');

    console.log(`📧 Checking Gmail for verification email from ${companyName}...`);
    console.log(`   (Will check every 5 seconds for up to ${timeout/1000} seconds)`);
    
    const startTime = Date.now();
    let checkCount = 0;
    
    while (Date.now() - startTime < timeout) {
      checkCount++;
      console.log(`   Check #${checkCount}...`);
      
      // Click inbox to refresh
      try {
        const inboxButton = this.gmailPage.locator('[aria-label*="Inbox"]').first();
        await inboxButton.click({ timeout: 2000 }).catch(() => {});
        await this.gmailPage.waitForTimeout(2000);
      } catch {
        // Just refresh the page if inbox button not found
        await this.gmailPage.reload();
        await this.gmailPage.waitForTimeout(3000);
      }
      
      // Look for recent emails (try multiple patterns)
      const senderPatterns = [
        companyName.toLowerCase(),
        'noreply',
        'no-reply',
        'verify',
        'notification',
      ];
      
      for (const pattern of senderPatterns) {
        const emails = await this.gmailPage.locator(`tr:has-text("${pattern}")`).all();
        
        // Check newest emails first
        for (const email of emails.slice(0, 3)) {
          try {
            await email.click();
            await this.gmailPage.waitForTimeout(2000);
            
            // Extract verification code from email body
            const bodyText = await this.gmailPage.locator('[role="main"]').textContent();
            
            if (bodyText && (bodyText.toLowerCase().includes('verif') || bodyText.toLowerCase().includes('code'))) {
              // Look for patterns
              const codePatterns = [
                /\b(\d{6})\b/,                       // 6-digit code
                /\b(\d{4})\b/,                       // 4-digit code  
                /code[:\s]+([A-Z0-9]{4,8})/i,       // "code: ABC123"
                /verification[:\s]+([A-Z0-9]{4,8})/i, // "verification: XYZ789"
                /is[:\s]+([A-Z0-9]{4,8})/i,         // "is: 123456"
              ];
              
              for (const pattern of codePatterns) {
                const match = bodyText.match(pattern);
                if (match) {
                  console.log(`   ✅ Found verification code: ${match[1]}`);
                  return match[1];
                }
              }
            }
            
            // Go back to inbox
            await this.gmailPage.goBack();
            await this.gmailPage.waitForTimeout(1000);
          } catch {
            continue;
          }
        }
      }
      
      // Wait before checking again
      await this.gmailPage.waitForTimeout(5000);
    }
    
    console.log('   ⏰ Timeout waiting for verification email');
    console.log('   💡 Check Gmail tab manually and enter code yourself');
    return null;
  }

  async getVerificationLink(from: string, timeout: number = 60000): Promise<string | null> {
    if (!this.gmailPage) throw new Error('Gmail not initialized');

    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      await this.gmailPage.reload();
      await this.gmailPage.waitForTimeout(3000);
      
      const emails = await this.gmailPage.locator(`tr:has-text("${from}")`).all();
      
      if (emails.length > 0) {
        await emails[0].click();
        await this.gmailPage.waitForTimeout(2000);
        
        // Find verification link
        const links = await this.gmailPage.locator('[role="main"] a[href*="verify"], [role="main"] a[href*="confirm"], [role="main"] a[href*="activate"]').all();
        
        if (links.length > 0) {
          const href = await links[0].getAttribute('href');
          if (href) {
            console.log(`📧 Found verification link: ${href}`);
            return href;
          }
        }
      }
      
      await this.gmailPage.waitForTimeout(5000);
    }
    
    return null;
  }

  async close(): Promise<void> {
    if (this.gmailPage) {
      await this.gmailPage.close();
    }
  }
}
