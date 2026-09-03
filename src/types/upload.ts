// src/lib/types/upload.ts

export interface SignedUrlRequest {
    fileName: string;
    contentType: string;
    fileSize?: number;
    entityMetadata?: Record<string, any>;
}

export interface SignedUrlResponse {
    signedUrl: string;
    objectPath: string; // path/key file di dalam bucket
    expiresAt: string;
}

export interface FileMetadata {
    name: string;
    bucket: string;
    size: number; // dalam bytes
    contentType: string;
    md5Hash?: string;
    crc32c?: string;
    etag?: string;
    timeCreated: string;
    updated: string;
    mediaLink?: string;
}

export interface UploadProgress {
    loaded: number;
    total: number;
    percentage: number; // 0 - 100
}