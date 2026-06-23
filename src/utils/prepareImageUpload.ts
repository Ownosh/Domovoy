import * as ImageManipulator from "expo-image-manipulator";

/** Сжимает фото до размера аватара перед загрузкой (256px ≈ 20–60 KB) */
export async function prepareAvatarImage(
    fileUri: string,
): Promise<{ uri: string; mimeType: string }> {
    const result = await ImageManipulator.manipulateAsync(
        fileUri,
        [{ resize: { width: 256, height: 256 } }],
        { compress: 0.58, format: ImageManipulator.SaveFormat.JPEG },
    );
    return { uri: result.uri, mimeType: "image/jpeg" };
}

/** Сжимает фото для ленты / обращений */
export async function prepareFeedImage(
    fileUri: string,
    maxWidth = 1280,
): Promise<{ uri: string; mimeType: string }> {
    const result = await ImageManipulator.manipulateAsync(
        fileUri,
        [{ resize: { width: maxWidth } }],
        { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG },
    );
    return { uri: result.uri, mimeType: "image/jpeg" };
}
