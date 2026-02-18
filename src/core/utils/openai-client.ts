import OpenAI from 'openai';
import { config } from '@config/index.js';

export class OpenAIClientWrapper {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
  }

  getClient(): OpenAI {
    return this.client;
  }
}
