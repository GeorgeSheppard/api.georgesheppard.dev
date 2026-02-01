import OpenAI from 'openai';
import { config } from '@config/index.js';
import { Location, toAffiliateTag, toAmazonDomain } from '@core/types/location.js';
import { Recommendation} from '@core/types/recommendation.js';


export abstract class Recommender {
  abstract getRecommendations(
    books: string[],
    location: Location,
    previousRecommendations?: Recommendation[]
  ): Promise<Recommendation[]>;
}

export class OpenAIRecommender implements Recommender {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
    });
  }

  async getRecommendations(
    books: string[],
    location: Location,
    previousRecommendations: Recommendation[] = []
  ): Promise<Recommendation[]> {
    try {
      const previousTitles = previousRecommendations.map((r) => r.name);
      const prompt = this.buildPrompt(books, previousTitles);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              "You are a book recommendation expert. Generate 5 book recommendations in JSON format based on the user's reading history.",
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(content);
      const recommendations = parsed.recommendations || [];

      // Add Amazon affiliate links
      return recommendations.map((rec: any) => ({
        name: rec.name || rec.title,
        author: rec.author,
        description: rec.description,
        reason: rec.reasonForRecommendation,
        amazonLink: this.buildAmazonLink(rec.name || rec.title, rec.author, location),
      }));
    } catch (error) {
      console.error('OpenAI recommendation generation failed:', error);
      throw error;
    }
  }

  private buildPrompt(books: string[], previousRecommendations: string[]): string {
    let prompt = `Based on these books the user has read:\n${books.join('\n')}\n\n`;
    prompt += 'Generate 5 book recommendations.\n\n';

    if (previousRecommendations.length > 0) {
      prompt += `IMPORTANT: Do NOT recommend any of these books that were previously recommended:\n${previousRecommendations.join('\n')}\n\n`;
    }

    prompt += `Return JSON in this exact format:
{
  "recommendations": [
    {
      "name": "Book Title",
      "author": "Author Name",
      "description": "Brief description of the book (2-3 sentences)",
      "reasonForRecommendation": "Why this book matches their taste (1-2 sentences)"
    }
  ]
}`;

    return prompt;
  }

  private buildAmazonLink(title: string, author: string, location: Location): string {
    const query = encodeURIComponent(`${title} ${author}`);
    const domain = toAmazonDomain(location);
    const tag = toAffiliateTag(location);

    return `https://www.${domain}/s?k=${query}&tag=${tag}`;
  }
}
