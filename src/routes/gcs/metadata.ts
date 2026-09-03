import { Router } from "express";
import { bucket } from "../../lib/gcs-storage.js";
import type { FileMetadata } from "../../types/upload.js";

const router = Router();

router.post("/", async (req, res) => {
    const { objectPath } = req.body;

    if (!objectPath || typeof objectPath !== 'string') {
        return res.status(400).json({ error: 'objectPath wajib diisi' });
    }

    // Validasi sederhana supaya endpoint ini tidak dipakai untuk baca path bebas
    if (!objectPath.startsWith('uploads/')) {
        return res.status(400).json({ error: 'objectPath tidak valid' });
    }

    const file = bucket.file(objectPath);

    try {
        const [exists] = await file.exists();
        if (!exists) {
            return res.status(404).json({ error: 'File tidak ditemukan di bucket — upload mungkin belum selesai atau gagal' });
        }

        const [metadata] = await file.getMetadata();

        const result: FileMetadata = {
            name: metadata.name ?? objectPath,
            bucket: metadata.bucket ?? '',
            size: Number(metadata.size ?? 0),
            contentType: metadata.contentType ?? 'application/octet-stream',
            md5Hash: metadata.md5Hash,
            crc32c: metadata.crc32c,
            etag: metadata.etag,
            timeCreated: metadata.timeCreated ?? '',
            updated: metadata.updated ?? '',
            mediaLink: metadata.mediaLink
        };

        return res.json(result);
    } catch (err) {
        console.error('Gagal mengambil metadata:', err);
        return res.status(500).json({ error: 'Gagal mengambil metadata file' });
    }
});

export default router;