import FormData from 'form-data';
import axios from 'axios';
import { config } from '@config/index.js';
import { logger } from '@core/telemetry/logger.js';

export interface SendEmailOptions {
  from: string;
  to: string[];
  subject: string;
  template: string;
  variables: {
    recommendationsurl: string;
    unsubscribeUrl: string;
    unsubscribeText: string;
  };
}

export abstract class EmailClient {
  abstract sendRecommendationsEmail(options: SendEmailOptions): Promise<void>;
}

export class MailgunClient implements EmailClient {
  private apiKey: string;
  private domain = 'mailgun.shelfie.georgesheppard.dev';
  private baseUrl = 'https://api.eu.mailgun.net/v3';

  constructor() {
    this.apiKey = config.MAILGUN_API_KEY;
  }

  async sendRecommendationsEmail(options: SendEmailOptions): Promise<void> {
    const form = new FormData();
    form.append('from', options.from);

    // Add all recipients
    options.to.forEach((email) => form.append('to', email));

    form.append('subject', options.subject);
    form.append('template', options.template);

    // Add template variables
    form.append('v:recommendationsurl', options.variables.recommendationsurl);
    form.append('v:unsubscribeUrl', options.variables.unsubscribeUrl);
    form.append('v:unsubscribeText', options.variables.unsubscribeText);

    try {
      await axios.post(`${this.baseUrl}/${this.domain}/messages`, form, {
        auth: {
          username: 'api',
          password: this.apiKey,
        },
        headers: form.getHeaders(),
      });
    } catch (error) {
      logger.error('Failed to send email via Mailgun:', error);
      throw error;
    }
  }
}
