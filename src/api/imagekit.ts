import { apiRequest } from "./client";

export async function apiUploadImage(fileBase64: string, fileName: string): Promise<string> {
    const { url } = await apiRequest<{ url: string }>("/imagekit/upload", {
        method: "POST",
        body: JSON.stringify({ fileBase64, fileName }),
    });
    return url;
}
