export interface Recommendation {
  name: string;
  author: string;
  description: string;
  reasonForRecommendation: string;
  amazonLink: string;
}

export interface BooksProcessed {
  books: string[];
}
