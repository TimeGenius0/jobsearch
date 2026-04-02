import Anthropic from '@anthropic-ai/sdk';

const RESUME_TEXT = `
Product, Science & Engineering Leader

AI founder and product leader with 15+ years building AI products for consumer
services, B2B and enterprise clients. In early-stage startups like Attila AI and
large-scale enterprises like Intuit, I've delivered AI solutions that move the
needle including a marketing campaign recommender that drove 35% omnichannel
penetration growth and a Virtual Sales Assistant that increased cross-sell rates
by 82%. I hold an MSc in Software Management and Electrical Engineering, have led
teams of 40+, and regularly partner with C-suite stakeholders. Also an early-stage
investor, advisor, and aspiring artist.

PROFESSIONAL HIGHLIGHTS

Principal Product Manager, Intuit Mailchimp, Mountain View, CA  (Apr 2025 – Present)
NASDAQ: INTU. 2025 Sales: $18B, employees: 18,000. Hired to report to the CPO.
- Owned Agentic AI strategy: done-for-you campaign recommendations, multimodal
  content generation (layout, text, image), and conversational AI agents.
- Delivered 35% lift in omnichannel penetration growth → +$10M ARR opportunity.
- Led Mailchimp's ChatGPT and Claude apps; built the chat-based agentic AI platform.
- 0→1 agentic content generation to PMF, reducing churn by 78 bps in 1 quarter.
- Established AI quality standards, Evals frameworks, GenAI Trust & Safety guardrails.
- Enabled launch of 6 agentic AI experiences; mentored 8 Principal–Staff PMs on AI
  quality, compliance, and platform integration.

Co-Founder & Chief Product Scientist, AICTOS, San Francisco, CA  (Mar 2023 – May 2025)
AI bootstrapped startup, 2024 Sales: $1.2M, employees: 2.
- Founded and led product for Aictos, a marketplace connecting SMBs with software
  engineering leaders assisted by AI agents for technical leadership and code quality.
- Designed AI agents for technical decision-making, engineering productivity, and
  project risk detection across distributed teams.
- Built a community of 45 experienced CTOs to validate use cases and refine workflows.

Director of Product, ParagonOne / Extern.com (YC 2017), San Francisco, CA  (Apr 2022 – Feb 2023)
Edtech startup backed by YC, 2022 Sales: $8M, employees: 30. Reported to the CTO.
- Led product vision, strategy, and roadmap; overseeing 2 PMs and 5 engineers.
- Pivoted the company to Enterprise/ESG segment after pitching the founders directly.
- Improved SQL conversion rates from 7% to 44% through GTM realignment.

Co-Founder & CPO, Attila AI, Tunis, Tunisia  (Feb 2016 – Jul 2020)
MarketingTech AI startup, 2020 Sales: $3M, employees: 12. Acquired by Craft Foundry.
- Led company from 0→1; hired ~20-person cross-functional team.
- Built ML recommendation engine for banking apps (credit cards, loans, savings).
- Boosted cross-sell conversion rate by 82% vs rule-based systems; +5% in conversions.

VP of Product & Growth, Tayara.tn (subsidiary of Schibsted), Tunis, Tunisia  (Jan 2015 – Jan 2016)
EURONEXT: VEND, 2015 Sales: $1.9B. Hired to report to the head of emerging markets.
- Scaled to 2.5M MAU; 5th most visited site in Tunisia.
- Led team of 10; partnered with 40-person global cross-functional team.

Co-Founder & CPO, Zouz, Tunis, Tunisia  (Mar 2010 – Jun 2014)
Social discovery startup backed by ACP and ATD capital, 2014 Sales: $0.5M, employees: 15.
- Raised seed and Series A funding; grew to 100K MAU.
- 42% activation ratio; 71% 3-month retention.

Product Manager, Sequans Communications, Cupertino, CA  (Apr 2007 – Feb 2010)
NYSE: SQNS — fabless semiconductor (4G/WiMAX SoCs).
- Managed VoIP integration for 4G semiconductor chip.
- Defined GTM strategy for 802.16e SoC; wrote technical white papers on MIMO systems.

EDUCATION
ENST Telecom ParisTech, MS in Electrical Engineering, Paris, France  (2004–2007)

SKILLS
Machine Learning: ML product lifecycle, Transformers/LSTMs, GenAI (GANs, VAEs,
LLMs), MLOps, Edge ML, Neural codecs (EnCodec, SoundStream), data engineering.
`;

export class QuestionAnswerer {
  private client: Anthropic | null = null;

  constructor() {
    const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    } else {
      console.warn('⚠️  No CLAUDE_API_KEY found - AI question answering disabled');
    }
  }

  async answerQuestion(question: string): Promise<string | null> {
    if (!this.client) {
      console.log('ℹ️  Skipping AI answer (no API key)');
      return null;
    }

    try {
      console.log(`🤔 AI answering: "${question.substring(0, 80)}..."`);

      const systemPrompt = `You are helping fill out a job application for Bilel, a Principal Product Manager with 15+ years of AI product experience.

Answer the application question based ONLY on the resume provided. Be:
- Specific and concrete (use numbers, metrics, examples from the resume)
- Concise (2-3 sentences max, unless question requires more detail)
- Direct (no fluff, no "I am writing to say...")
- Confident but accurate (don't embellish beyond what's in the resume)

If the resume doesn't contain relevant information for the question, say "Not applicable based on my background" rather than making something up.`;

      const userPrompt = `RESUME:
${RESUME_TEXT}

APPLICATION QUESTION:
${question}

Your answer (2-3 sentences, specific to the resume):`;

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        temperature: 0.7,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      const answer = response.content[0].type === 'text' ? response.content[0].text : null;
      
      if (answer) {
        console.log(`✅ AI answer: "${answer.substring(0, 80)}..."`);
      }

      return answer;
    } catch (error) {
      console.warn('⚠️  AI answer failed:', error);
      return null;
    }
  }

  async shouldAnswerWithAI(questionText: string): Promise<boolean> {
    // Only use AI for open-ended questions (textareas, longer questions)
    // Skip simple inputs like name, email, etc.
    
    const lowercaseQ = questionText.toLowerCase();
    
    // Questions that clearly need AI
    const aiTriggers = [
      'describe',
      'explain',
      'tell us about',
      'why are you',
      'what experience',
      'how have you',
      'give an example',
      'share a time',
      'what would you',
      'how would you',
      'specific example',
      'ai-powered',
      'product you',
      'project you',
      'technologies',
      'impact',
      'role',
    ];

    return aiTriggers.some(trigger => lowercaseQ.includes(trigger));
  }
}
