export interface Env {
    R2_BUCKET: R2Bucket;
  
    // Optional env var, in bytes.
    // Example: MAX_MP3_BYTES=52428800
    MAX_MP3_BYTES?: string;
}