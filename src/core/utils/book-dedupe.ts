import { BookEntry } from '@core/types/recommendation.js';

/**
 * Dedupe books by case-insensitive title, keeping the first occurrence.
 */
export function dedupeBooksByTitle(books: BookEntry[]): BookEntry[] {
  const seenTitles = new Set<string>();
  return books.filter((book) => {
    const key = book.title.toLowerCase();
    if (seenTitles.has(key)) return false;
    seenTitles.add(key);
    return true;
  });
}
