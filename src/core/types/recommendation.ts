export interface Recommendation {
  name: string;
  author: string;
  description: string;
  reason: string;
  amazonLink: string;
}

export interface BooksProcessed {
  books: string[];
}
