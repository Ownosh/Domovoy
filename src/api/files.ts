import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import { BASE_URL, getAccessToken } from "./client";
import { prepareAvatarImage, prepareFeedImage } from "../utils/prepareImageUpload";

const FILES_URL = BASE_URL.replace("/api", "");

/** URI для multipart-загрузки с телефона */
function uploadFileUri(uri: string): string {
    if (Platform.OS === "ios" && uri.startsWith("file://")) {
        return uri.slice("file://".length);
    }
    return uri;
}

async function readFileInfo(uri: string): Promise<FileSystem.FileInfo> {
    const candidates = uri.startsWith("file://")
        ? [uri, uri.slice("file://".length)]
        : [uri, `file://${uri}`];
    for (const candidate of candidates) {
        const info = await FileSystem.getInfoAsync(candidate);
        if (info.exists && (info.size ?? 0) > 0) return info;
    }
    throw new Error("Файл не найден или пустой");
}

/**
 * Загрузка через backend → S3.
 * FileSystem.uploadAsync надёжно отправляет файл с React Native (fetch+FormData давал size=0).
 */
export async function uploadFile(
    fileUri: string,
    mimeType = "image/jpeg",
    purpose: "feed" | "avatar" = "feed",
): Promise<string> {
    const token = await getAccessToken();
    await readFileInfo(fileUri);

    const qs = purpose === "avatar" ? "?purpose=avatar" : "";
    const uploadUrl = `${FILES_URL}/api/files/upload${qs}`;

    const result = await FileSystem.uploadAsync(uploadUrl, uploadFileUri(fileUri), {
        httpMethod: "POST",
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: "file",
        mimeType,
        headers: {
            Authorization: token ? `Bearer ${token}` : "",
        },
    });

    if (result.status < 200 || result.status >= 300) {
        let message = `Ошибка загрузки файла (${result.status})`;
        try {
            const body = JSON.parse(result.body) as { error?: string };
            if (body.error) message = body.error;
        } catch {
            /* ignore */
        }
        throw new Error(message);
    }

    const { url } = JSON.parse(result.body) as { url: string };
    return url;
}

/** Аватар: сжатие + загрузка через сервер. Возвращает URL и локальный file:// для превью. */
export async function uploadAvatar(fileUri: string): Promise<{ url: string; localUri: string }> {
    const prepared = await prepareAvatarImage(fileUri);
    const url = await uploadFile(prepared.uri, prepared.mimeType, "avatar");
    return { url, localUri: prepared.uri };
}

/** Фото для ленты / обращений: сжатие + загрузка */
export async function uploadFeedImage(fileUri: string): Promise<string> {
    const prepared = await prepareFeedImage(fileUri);
    return uploadFile(prepared.uri, prepared.mimeType);
}
