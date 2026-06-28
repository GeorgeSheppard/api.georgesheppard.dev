import OpenAI from 'openai';
import { BookEntry } from '@core/types/recommendation.js';

export interface BookcaseImage {
  buffer: Buffer;
  contentType: string;
}

export async function extractBooksFromImages(
  images: BookcaseImage[],
  openaiClient: OpenAI
): Promise<BookEntry[]> {
  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    {
      type: 'text',
      text: 'Identify every distinct book visible on the spines or covers in these bookcase images. Ignore duplicates across images. Return JSON in this exact format: { "books": [{ "title": "Book Title", "author": "Author Name or null if unreadable" }] }',
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

  const completion = await openaiClient.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'You are an expert at identifying books from photos of bookcases. Return only titles and authors you can confidently read, without extra commentary.',
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
  const books: BookEntry[] = parsed.books || [];

  const seenTitles = new Set<string>();
  return books.filter((book) => {
    const key = book.title.toLowerCase();
    if (seenTitles.has(key)) return false;
    seenTitles.add(key);
    return true;
  });
}
