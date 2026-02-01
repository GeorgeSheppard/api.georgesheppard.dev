import { vi } from 'vitest';
import { Recommender } from '@core/utils/openai-recommender.js';
import { Location } from '@core/types/location.js';
import { Recommendation } from '@core/types/recommendation.js';


export function createMockRecommender(): Recommender {
  return {
    getRecommendations: vi.fn(
      async (
        books: string[],
        location: Location,
        previousRecommendations: Recommendation[] = []
      ): Promise<Recommendation[]> => {
        // Mock implementation - return fake recommendations
        return [
          {
            name: 'The Midnight Library',
            author: 'Matt Haig',
            description:
              "A compelling novel about life's infinite possibilities and second chances.",
            reason:
              "Based on your reading history, this book shares similar themes and writing style that you'll enjoy.",
            amazonLink:
              'https://www.amazon.com/s?k=The%20Midnight%20Library%20Matt%20Haig&tag=test',
          },
          {
            name: 'Project Hail Mary',
            author: 'Andy Weir',
            description:
              "An exciting science fiction adventure about an astronaut's mission to save Earth.",
            reason:
              "Based on your reading history, this book shares similar themes and writing style that you'll enjoy.",
            amazonLink: 'https://www.amazon.com/s?k=Project%20Hail%20Mary%20Andy%20Weir&tag=test',
          },
        ];
      }
    ),
  } as Recommender;
}
