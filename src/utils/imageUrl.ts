const IMAGEKIT_HOST = "ik.imagekit.io";

const IMAGEKIT_ENDPOINT =
    (process.env.EXPO_PUBLIC_IMAGEKIT_URL_ENDPOINT ?? "").replace(/\/$/, "");

const API_BASE =
    (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "");

/** Прямой S3 для ленты (Timeweb). Задайте в .env при другом бакете. */
const S3_PUBLIC_BASE =
    (process.env.EXPO_PUBLIC_S3_PUBLIC_URL ?? "https://ownosh-domovoy-1.s3.twcstorage.ru").replace(/\/$/, "");

function extractUploadsKey(url: string): string | null {
    if (url.includes("/api/files/serve?")) {
        try {
            const key = new URL(url).searchParams.get("key");
            return key?.startsWith("uploads/") ? key : null;
        } catch {
            return null;
        }
    }
    try {
        const u = new URL(url);
        const idx = u.pathname.indexOf("/uploads/");
        if (idx >= 0) {
            const key = u.pathname.slice(idx + 1);
            return key.startsWith("uploads/") ? key : null;
        }
    } catch {
        /* ignore */
    }
    return null;
}

/** Fallback: API-прокси для ленты, если прямой S3 недоступен */
export function resolveFeedImageProxyUrl(url: string): string {
    const key = extractUploadsKey(url);
    if (key) return `${API_BASE}/api/files/serve?key=${encodeURIComponent(key)}`;
    return url;
}

/** Лента: прямой S3 вместо медленного API-прокси */
export function resolveFeedImageUrl(url: string): string {
    if (!url || url.startsWith("file:")) return url;
    const key = extractUploadsKey(url);
    if (key) return `${S3_PUBLIC_BASE}/${key}`;
    return resolveImageUrl(url);
}

/** Явно включите EXPO_PUBLIC_IMAGEKIT_ENABLED=1, когда CDN реально настроен */
const IMAGEKIT_ENABLED =
    process.env.EXPO_PUBLIC_IMAGEKIT_ENABLED === "1" && !!IMAGEKIT_ENDPOINT;

/** Аватары и serve-URL → всегда через текущий API_BASE (тот же хост, что и запросы приложения) */
export function resolveProfilePhotoUrl(url: string): string {
    if (!url || url.startsWith("file:")) return url;

    const key = extractUploadsKey(url);
    if (key) {
        return `${API_BASE}/api/files/serve?key=${encodeURIComponent(key)}`;
    }
    return resolveImageUrl(url);
}

/** S3 / path-style URL → ImageKit CDN (только если CDN включён) */
export function resolveImageUrl(url: string): string {
    if (!url || url.includes(IMAGEKIT_HOST)) return url;
    if (!IMAGEKIT_ENABLED) return url;
    try {
        const u = new URL(url);
        const uploadsIdx = u.pathname.indexOf("/uploads/");
        if (uploadsIdx >= 0) {
            return `${IMAGEKIT_ENDPOINT}${u.pathname.slice(uploadsIdx)}`;
        }
        const parts = u.pathname.split("/").filter(Boolean);
        const up = parts.indexOf("uploads");
        if (up >= 0) {
            return `${IMAGEKIT_ENDPOINT}/${parts.slice(up).join("/")}`;
        }
    } catch {
        /* ignore */
    }
    return url;
}

/** URL для отображения аватара (ImageKit — миниатюра, иначе API-прокси / оригинал) */
export function avatarDisplayUrl(url: string, size = 96): string {
    const resolved = resolveProfilePhotoUrl(resolveImageUrl(url));
    if (resolved.includes(IMAGEKIT_HOST)) {
        return imageTransformUrl(resolved, `tr:w-${size},h-${size},c-at_max,q-80,f-auto`);
    }
    return resolved;
}

/** ImageKit: вставляет tr:… сразу после id аккаунта. Остальные URL — без изменений. */
export function imageTransformUrl(
    url: string,
    transform: string,
): string {
    const resolved = resolveFeedImageUrl(url);
    if (!resolved || !resolved.includes(IMAGEKIT_HOST)) return resolved;
    try {
        const u = new URL(resolved);
        const parts = u.pathname.split("/").filter(Boolean);
        if (parts.length < 2) return resolved;
        if (parts[1]?.startsWith("tr:")) return resolved;
        u.pathname = `/${parts[0]}/${transform}/${parts.slice(1).join("/")}`;
        return u.toString();
    } catch {
        return resolved;
    }
}

/** Превью для ленты / карточек */
export function imageThumbUrl(url: string, width = 520, height = 360): string {
    return imageTransformUrl(url, `tr:w-${width},h-${height},c-at_max,q-80,f-auto`);
}

/** Миниатюра аватара */
export function imageAvatarUrl(url: string, size = 96): string {
    return avatarDisplayUrl(url, size);
}

/** Экран детали — чуть больше, но не оригинал */
export function imageDetailUrl(url: string, width = 1080): string {
    return imageTransformUrl(url, `tr:w-${width},c-at_max,q-85,f-auto`);
}
