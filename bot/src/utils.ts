import * as fs from 'fs';
import * as path from 'path';
import type { Profile, CommonResponses, ApplicationState } from './types';

export function loadProfile(profilePath: string): Profile {
  const content = fs.readFileSync(profilePath, 'utf-8');
  return JSON.parse(content);
}

export function loadResponses(responsesPath: string): CommonResponses {
  const content = fs.readFileSync(responsesPath, 'utf-8');
  return JSON.parse(content);
}

export function saveApplicationState(state: ApplicationState, outputDir: string): string {
  const filename = `${state.company.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`;
  const filepath = path.join(outputDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(state, null, 2));
  return filepath;
}

export function renderTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}

export async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function humanLikeDelay(min: number = 100, max: number = 300): Promise<void> {
  const ms = Math.random() * (max - min) + min;
  await delay(ms);
}

export function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
