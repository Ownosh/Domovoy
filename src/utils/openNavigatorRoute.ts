import { Linking, Platform } from "react-native";

export type ExternalNavigatorApp = "yandex" | "dgis" | "system";

export type GeoPoint = { lat: number; lng: number };

/**
 * Открывает внешнее приложение карт с маршрутом или точкой назначения.
 * Координаты в десятичных градусах (широта, долгота).
 */
export function openRouteInExternalNavigator(
    app: ExternalNavigatorApp,
    destination: GeoPoint,
    origin?: GeoPoint,
): void {
    const { lat: dLat, lng: dLng } = destination;
    const o = origin;

    let url: string;
    if (app === "yandex") {
        if (o) {
            url = `https://yandex.ru/maps/?rtext=${o.lat},${o.lng}~${dLat},${dLng}&rtt=auto`;
        } else {
            url = `https://yandex.ru/maps/?pt=${dLng},${dLat}&z=16&l=map`;
        }
    } else if (app === "dgis") {
        if (o) {
            url = `https://2gis.ru/routeSearch/rsType/car/from/${o.lng},${o.lat}/to/${dLng},${dLat}`;
        } else {
            url = `https://2gis.ru/geo/${dLng}/${dLat}`;
        }
    } else if (Platform.OS === "ios") {
        url = o
            ? `http://maps.apple.com/?saddr=${o.lat},${o.lng}&daddr=${dLat},${dLng}`
            : `http://maps.apple.com/?daddr=${dLat},${dLng}`;
    } else {
        url = o
            ? `https://www.google.com/maps/dir/${o.lat},${o.lng}/${dLat},${dLng}`
            : `https://www.google.com/maps/search/?api=1&query=${dLat},${dLng}`;
    }

    void Linking.openURL(url);
}
