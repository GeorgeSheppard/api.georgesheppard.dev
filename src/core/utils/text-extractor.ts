import axios from 'axios';
import FormData from 'form-data';
import { config } from '@config/index.js';

export interface TextExtractionResponse {
  books: string[];
}

export class TextExtractorClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.TEXT_EXTRACTOR_URL;
  }

  async extractText(imageBuffer: Buffer, contentType: string): Promise<TextExtractionResponse> {
    const form = new FormData();
    form.append('file', imageBuffer, {
      contentType,
      filename: 'bookcase.jpg',
    });

    try {
      const response = await axios.post<TextExtractionResponse>(`${this.baseUrl}/extract-books`, form, {
        headers: {
          ...form.getHeaders(),
        },
        timeout: 900000, // 15 minutes
      });

      return response.data;
    } catch (error) {
      console.error('Text extraction failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const textExtractorClient = new TextExtractorClient();
