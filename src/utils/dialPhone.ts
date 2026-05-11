import { Alert, Linking } from "react-native";

export function openTel(phone: string): void {
    const d = phone.replace(/\D/g, "");
    if (!d) return;
    Linking.openURL(`tel:${d}`).catch(() => {});
}

/** Подтверждение перед набором (SOS и т.п.) */
export function confirmThenDial(label: string, phone: string): void {
    Alert.alert(
        "Вы уверены?",
        `Будет выполнен вызов: ${label}\n${phone}`,
        [
            { text: "Отмена", style: "cancel" },
            { text: "Позвонить", onPress: () => openTel(phone) },
        ],
    );
}
