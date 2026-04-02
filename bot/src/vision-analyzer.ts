import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';

export interface FieldMapping {
  fieldId: string;
  fieldName: string;
  question: string;
  type: 'text' | 'textarea' | 'select' | 'radio';
  isEEO?: boolean;
  eeoType?: 'veteran' | 'disability' | 'gender' | 'race';
}

export class VisionAnalyzer {
  private client: Anthropic | null = null;

  constructor() {
    const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    } else {
      console.warn('⚠️  No CLAUDE_API_KEY found - Vision analysis disabled');
    }
  }

  async analyzeForm(screenshotPath: string): Promise<FieldMapping[]> {
    if (!this.client || !fs.existsSync(screenshotPath)) {
      return [];
    }

    console.log('👁️  Using Claude Vision to analyze form...');

    try {
      const imageData = fs.readFileSync(screenshotPath);
      const base64Image = imageData.toString('base64');

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: `Analyze this job application form screenshot. For each input field visible, identify:

1. What question is being asked (the label/text near the field)
2. The type of field (text input, textarea, dropdown/select, radio buttons)
3. Whether it's an EEO/diversity question (veteran status, disability, gender, race/ethnicity)

Return ONLY a JSON array with this structure:
[
  {
    "question": "First Name",
    "type": "text",
    "isEEO": false
  },
  {
    "question": "Please describe a specific AI-powered product you've launched",
    "type": "textarea",
    "isEEO": false
  },
  {
    "question": "Veteran Status",
    "type": "select",
    "isEEO": true,
    "eeoType": "veteran"
  }
]

Focus on:
- Resume/CV upload fields
- Cover letter upload fields
- Long text questions about experience (textareas)
- EEO questions (veteran, disability, gender, race)

Return ONLY the JSON array, no explanation.`,
              },
            ],
          },
        ],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        // Extract JSON from response
        const jsonMatch = content.text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const mappings = JSON.parse(jsonMatch[0]) as FieldMapping[];
          console.log(`   ✅ Vision identified ${mappings.length} fields`);
          return mappings;
        }
      }

      return [];
    } catch (error) {
      console.warn('⚠️  Vision analysis failed:', error);
      return [];
    }
  }

  async identifyFieldPurpose(fieldContext: string, questionText: string): Promise<{
    shouldUseAI: boolean;
    isEEO: boolean;
    eeoType?: string;
  }> {
    // Quick heuristic-based classification
    const lowerQuestion = questionText.toLowerCase();
    const lowerContext = fieldContext.toLowerCase();

    // EEO detection
    if (lowerQuestion.includes('veteran') || lowerContext.includes('veteran')) {
      return { shouldUseAI: false, isEEO: true, eeoType: 'veteran' };
    }
    if (lowerQuestion.includes('disability') || lowerContext.includes('disability')) {
      return { shouldUseAI: false, isEEO: true, eeoType: 'disability' };
    }
    if (lowerQuestion.includes('gender') || lowerQuestion.includes('sex')) {
      return { shouldUseAI: false, isEEO: true, eeoType: 'gender' };
    }
    if (lowerQuestion.includes('race') || lowerQuestion.includes('ethnicity')) {
      return { shouldUseAI: false, isEEO: true, eeoType: 'race' };
    }

    // AI question detection - look for experience/describe/explain
    const aiTriggers = [
      'describe', 'explain', 'tell us', 'why are you', 'what experience',
      'how have you', 'give an example', 'product you', 'project you',
      'ai-powered', 'technologies', 'impact', 'achievement'
    ];

    const shouldUseAI = aiTriggers.some(trigger => lowerQuestion.includes(trigger));

    return { shouldUseAI, isEEO: false };
  }
}
