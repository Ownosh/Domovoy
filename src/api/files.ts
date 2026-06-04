import { BASE_URL, getAccessToken } from "./client";

const FILES_URL = BASE_URL.replace("/api", "");

/**
 * Загружает файл на сервер и возвращает публичный URL.
 * Принимает URI файла (из expo-image-picker без base64).
 */
export async function uploadFile(fileUri: string, mimeType = "image/jpeg"): Promise<string> {
    const token = await getAccessToken();
    const ext = mimeType.split("/")[1] ?? "jpg";
    const filename = `upload_${Date.now()}.${ext}`;

    const formData = new FormData();
    formData.append("file", {
        uri: fileUri,
        type: mimeType,
        name: filename,
    } as unknown as Blob);

    const res = await fetch(`${FILES_URL}/api/files/upload`, {
        method: "POST",
        headers: {
            Authorization: token ? `Bearer ${token}` : "",
            // Content-Type НЕ ставим — fetch выставит boundary автоматически
        },
        body: formData,
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error ?? "Ошибка загрузки файла");
    }

    const { url } = await res.json() as { url: string };
    return url;
}
