import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "crypto";
import fs from "fs/promises";
import path from "path";
import { Readable } from "stream";
import type { Request } from "express";

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

let s3Client: S3Client | null = null;

export function isS3Configured(): boolean {
    if (process.env.FILES_STORAGE === "local") return false;
    return !!(
        process.env.S3_ENDPOINT &&
        process.env.S3_ACCESS_KEY &&
        process.env.S3_SECRET_KEY &&
        process.env.S3_BUCKET
    );
}

function getS3(): S3Client {
    if (!s3Client) {
        s3Client = new S3Client({
            endpoint: process.env.S3_ENDPOINT,
            region: process.env.S3_REGION ?? "ru-1",
            credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY!,
                secretAccessKey: process.env.S3_SECRET_KEY!,
            },
            forcePathStyle: true,
        });
    }
    return s3Client;
}

export function getPublicBaseUrl(req?: Request): string {
    const isDev = process.env.NODE_ENV !== "production";
    const serverUrl = process.env.SERVER_URL?.replace(/\/$/, "");
    if (isDev && serverUrl) return serverUrl;

    const fromEnv =
        process.env.PUBLIC_API_URL?.replace(/\/$/, "") ??
        process.env.SERVER_URL?.replace(/\/$/, "");
    if (fromEnv) return fromEnv;
    if (req) {
        const host = req.get("host");
        if (host) return `${req.protocol}://${host}`;
    }
    const port = process.env.PORT ?? "3001";
    return `http://localhost:${port}`;
}

/** URL через API — работает даже если S3-бакет приватный */
export function apiServeUrl(key: string, req?: Request): string {
    return `${getPublicBaseUrl(req)}/api/files/serve?key=${encodeURIComponent(key)}`;
}

/** Прямой публичный URL S3 (Timeweb) — быстрая загрузка в ленте */
export function s3DirectPublicUrl(key: string): string {
    const custom = process.env.S3_PUBLIC_URL?.replace(/\/$/, "");
    if (custom) return `${custom}/${key}`;

    const endpoint = process.env.S3_ENDPOINT!.replace(/\/$/, "");
    const bucket = process.env.S3_BUCKET!;
    const host = endpoint.replace(/^https?:\/\//, "");
    if (host.startsWith("s3.") || host.includes("twcstorage.ru") || host.includes("timeweb")) {
        return `https://${bucket}.${host}/${key}`;
    }
    return `${endpoint}/${bucket}/${key}`;
}

export function publicImageUrl(key: string, req?: Request): string {
    const ikEnabled = process.env.IMAGEKIT_ENABLED === "1";
    const ik =
        ikEnabled
            ? process.env.IMAGEKIT_URL_ENDPOINT?.replace(/\/$/, "") ??
              process.env.EXPO_PUBLIC_IMAGEKIT_URL_ENDPOINT?.replace(/\/$/, "")
            : undefined;
    if (ik) return `${ik}/${key}`;

    if (!isS3Configured()) {
        const fileName = path.basename(key);
        return `${getPublicBaseUrl(req)}/uploads/${fileName}`;
    }

    // Лента и общие фото — напрямую с S3/CDN
    return s3DirectPublicUrl(key);
}

/** URL аватара через API — для приватного бакета */
export function publicAvatarUrl(key: string, req?: Request): string {
    if (!isS3Configured()) {
        return publicImageUrl(key, req);
    }
    return apiServeUrl(key, req);
}

export async function readStoredFile(
    key: string,
): Promise<{ body: NodeJS.ReadableStream; contentType: string } | null> {
    if (!key.startsWith("uploads/") || key.includes("..")) return null;

    if (isS3Configured()) {
        try {
            const obj = await getS3().send(
                new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }),
            );
            if (!obj.Body) return null;
            return {
                body: obj.Body as NodeJS.ReadableStream,
                contentType: obj.ContentType ?? "image/jpeg",
            };
        } catch {
            return null;
        }
    }

    try {
        const filePath = path.join(UPLOADS_DIR, path.basename(key));
        const buf = await fs.readFile(filePath);
        return { body: Readable.from(buf), contentType: "image/jpeg" };
    } catch {
        return null;
    }
}

export async function storeUploadedFile(
    buffer: Buffer,
    ext: string,
    contentType: string,
    req?: Request,
    purpose: "feed" | "avatar" = "feed",
): Promise<string> {
    const safeExt = ext.startsWith(".") ? ext : `.${ext}`;
    const key = `uploads/${randomBytes(8).toString("hex")}${safeExt}`;

    if (isS3Configured()) {
        const putParams: ConstructorParameters<typeof PutObjectCommand>[0] = {
            Bucket: process.env.S3_BUCKET!,
            Key: key,
            Body: buffer,
            ContentType: contentType,
        };
        if (process.env.S3_ACL_PUBLIC_READ === "1") {
            putParams.ACL = "public-read";
        }
        await getS3().send(new PutObjectCommand(putParams));
        return purpose === "avatar" ? publicAvatarUrl(key, req) : publicImageUrl(key, req);
    }

    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    const fileName = path.basename(key);
    await fs.writeFile(path.join(UPLOADS_DIR, fileName), buffer);
    return publicImageUrl(key, req);
}

/** Presigned PUT — телефон грузит напрямую в S3 */
export async function createPresignedUpload(
    contentType: string,
    ext = ".jpg",
    req?: Request,
    purpose: "feed" | "avatar" = "feed",
): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
    if (!isS3Configured()) {
        throw new Error("S3 not configured");
    }
    const safeExt = ext.startsWith(".") ? ext : `.${ext}`;
    const key = `uploads/${randomBytes(8).toString("hex")}${safeExt}`;
    const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: key,
        ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(getS3(), command, { expiresIn: 600 });
    return {
        uploadUrl,
        publicUrl: purpose === "avatar" ? publicAvatarUrl(key, req) : publicImageUrl(key, req),
        key,
    };
}
