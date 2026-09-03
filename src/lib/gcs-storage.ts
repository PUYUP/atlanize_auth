// src/lib/server/gcs-storage.ts
// File ini HANYA boleh diimport dari kode server (+server.ts / +page.server.ts),
// karena berisi credentials. SvelteKit otomatis melindungi folder $lib/server
// dari ter-bundle ke client.

import { Storage } from '@google-cloud/storage';

if (!process.env.GCS_BUCKET_NAME) {
    throw new Error('Env GCS_BUCKET_NAME belum di-set');
}

let credentials;

if (!process.env.GCP_KEY_FILE && process.env.GCP_SERVICE_ACCOUNT_KEY) {
    try {
        // Parse isi JSON yang di-copy-paste ke env variable Vercel
        const parsed = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY);

        credentials = {
            client_email: parsed.client_email,
            // Penting: Vercel sering me-escape newline, jadi kita kembalikan ke format aslinya
            private_key: parsed.private_key.replace(/\\n/g, '\n'),
        };
    } catch (error) {
        console.error('Gagal melakukan parse GCP_SERVICE_ACCOUNT_KEY:', error);
    }
}

// Opsi 1: pakai Application Default Credentials (ADC)
// - Di Cloud Run / GKE / Compute Engine, ini otomatis pakai service account bawaan.
// - Di lokal, jalankan `gcloud auth application-default login` dulu.
//
// Opsi 2: pakai key file (JSON service account) secara eksplisit,
// lebih gampang kalau butuh signed URL tanpa akses IAM signBlob (lihat README).
export const storage = new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    ...(process.env.GCP_KEY_FILE ? { keyFilename: process.env.GCP_KEY_FILE } : {}),
    ...(!process.env.GCP_KEY_FILE && credentials ? { credentials } : {})
});

export const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);