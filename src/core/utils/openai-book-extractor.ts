import OpenAI from 'openai';
import { z } from 'zod';
import { BookEntry } from '@core/types/recommendation.js';

export interface BookcaseImage {
  buffer: Buffer;
  contentType: string;
}

const ExtractedBooksSchema = z.object({
  books: z.array(
    z.object({
      title: z.string(),
      author: z.string().nullable(),
    })
  ),
});

export async function extractBooksFromImages(
  images: BookcaseImage[],
  openaiClient: OpenAI
): Promise<BookEntry[]> {
  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    {
      type: 'text',
      text: 'Identify every distinct book visible on the spines or covers in these bookcase images. Ignore duplicates across images.',
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
          'You are an expert at identifying books from photos of bookcases. Return only titles and authors you can confidently read, without extra commentary. Use null for the author if it cannot be read.',
      },
      {
        role: 'user',
        content,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'extracted_books',
        strict: true,
        schema: z.toJSONSchema(ExtractedBooksSchema),
      },
    },
    temperature: 0,
  });

  const responseContent = completion.choices[0]?.message?.content;
  if (!responseContent) {
    throw new Error('No response from OpenAI');
  }

  const rawParsed: unknown = JSON.parse(responseContent);
  const result = ExtractedBooksSchema.safeParse(rawParsed);
  if (!result.success) {
    throw new Error(`OpenAI returned invalid book extraction format: ${result.error.message}`);
  }

  const seenTitles = new Set<string>();
  return result.data.books.filter((book) => {
    const key = book.title.toLowerCase();
    if (seenTitles.has(key)) return false;
    seenTitles.add(key);
    return true;
  });
}
