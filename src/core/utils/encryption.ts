import crypto from 'crypto';
import { config } from '@config/index.js';

export class Encryption {
  private key: Buffer;
  private iv: Buffer;

  constructor() {
    // Must be 32 bytes for AES-256
    this.key = Buffer.from(config.ENCRYPTION_KEY, 'utf-8');
    // Must be 16 bytes for AES-256-CBC
    this.iv = Buffer.from(config.ENCRYPTION_IV, 'utf-8');

    if (this.key.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be exactly 32 bytes');
    }
    if (this.iv.length !== 16) {
      throw new Error('ENCRYPTION_IV must be exactly 16 bytes');
    }
  }

  encrypt(plainText: string): string {
    const cipher = crypto.createCipheriv('aes-256-cbc', this.key, this.iv);
    let encrypted = cipher.update(plainText, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
  }

  decrypt(cipherText: string): string {
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.key, this.iv);
    let decrypted = decipher.update(cipherText, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

// Export singleton instance
export const encryption = new Encryption();
