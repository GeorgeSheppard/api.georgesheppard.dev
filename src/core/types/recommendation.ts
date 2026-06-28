export interface Recommendation {
  name: string;
  author: string;
  description: string;
  reason: string;
  amazonLink: string;
}

export interface BookEntry {
  title: string;
  author: string | null;
}

export interface BooksProcessed {
  books: BookEntry[];
}
