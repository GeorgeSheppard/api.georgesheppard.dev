import Anthropic from '@anthropic-ai/sdk';
import { config } from '@config/index.js';

export class AnthropicClientWrapper {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
  }

  getClient(): Anthropic {
    return this.client;
  }
}
