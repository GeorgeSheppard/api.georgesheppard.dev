export type S3Key = string;
export type S3SignedUrl = string;

export interface Image {
  timestamp: number;
  key: S3Key;
}

export interface SignedImage {
  timestamp: number;
  url: S3SignedUrl;
}
