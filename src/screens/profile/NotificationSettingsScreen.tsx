import type { ProfileScreenProps } from "../../navigation/types";
import React from "react";
import { StyleSheet, Text } from "react-native";
import { Card, ScreenLayout, ToggleRow } from "../../components/ui";
import { useApp } from "../../context/AppContext";
import { colors, textStyles } from "../../theme";

type Props = ProfileScreenProps<"NotificationSettings">;

export function NotificationSettingsScreen({ navigation }: Props) {
    const { notificationPrefs, toggleNotificationPref } = useApp();

    return (
        <ScreenLayout
            title="Уведомления"
            subtitle="Какие типы сообщений показывать в ленте"
            onBack={() => navigation.goBack()}
        >
            <Text style={[textStyles.body, styles.intro]}>
                Отключённые категории скрываются на главной и не подсвечиваются
                как непрочитанные.
            </Text>
            <Card padded={false}>
                <ToggleRow
                    title="Отключения коммуникаций"
                    description="Вода, свет, отопление — плановые и аварийные"
                    value={notificationPrefs.outages}
                    onValueChange={() => toggleNotificationPref("outages")}
                />
                <ToggleRow
                    title="Собрания"
                    description="Очные и онлайн собрания собственников"
                    value={notificationPrefs.meetings}
                    onValueChange={() => toggleNotificationPref("meetings")}
                />
                <ToggleRow
                    title="Объявления УК"
                    description="Официальные сообщения управляющей компании"
                    value={notificationPrefs.announcements}
                    onValueChange={() =>
                        toggleNotificationPref("announcements")
                    }
                />
                <ToggleRow
                    title="Прочие"
                    description="Общие напоминания и сервисные сообщения"
                    value={notificationPrefs.general}
                    onValueChange={() => toggleNotificationPref("general")}
                />
            </Card>
        </ScreenLayout>
    );
}

const styles = StyleSheet.create({
    intro: { color: colors.textMuted },
});
