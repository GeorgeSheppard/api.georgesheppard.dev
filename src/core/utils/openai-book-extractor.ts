import OpenAI from 'openai';
import { config } from '@config/index.js';
import { logger } from '@core/telemetry/logger.js';

export interface BookcaseImage {
  buffer: Buffer;
  contentType: string;
}

export abstract class BookExtractor {
  abstract extractBooks(images: BookcaseImage[]): Promise<string[]>;
}

export class OpenAIBookExtractor implements BookExtractor {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
    });
  }

  async extractBooks(images: BookcaseImage[]): Promise<string[]> {
    try {
      const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
        {
          type: 'text',
          text: 'Identify every distinct book title visible on the spines or covers in these bookcase images. Ignore duplicates across images. Return JSON in this exact format: { "books": ["Book Title 1", "Book Title 2"] }',
        },
        ...images.map(
          (image): OpenAI.Chat.Completions.ChatCompletionContentPart => ({
            type: 'image_url',
            image_url: {
              url: `data:${image.contentType};base64,${image.buffer.toString('base64')}`,
            },
          })
        ),
      ];

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert at identifying book titles from photos of bookcases. Return only book titles you can confidently read, without authors or extra commentary.',
          },
          {
            role: 'user',
            content,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(responseContent);
      const books = parsed.books || [];

      return Array.from(new Set(books)) as string[];
    } catch (error) {
      logger.error('OpenAI book extraction failed:', error);
      throw error;
    }
  }
}
