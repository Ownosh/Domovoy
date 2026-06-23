/** Единый ключ дома для ленты, коллективных заявок и объявлений */
export function buildBuildingKey(building: string): string {
    return building.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Ключ активного дома: из списка квартир или профиля */
export function getProfileBuildingKey(
    profile: { building: string },
    apartments?: { buildingKey: string; isActive: boolean }[],
): string {
    const fromApartment = apartments?.find((a) => a.isActive)?.buildingKey;
    return buildBuildingKey(fromApartment || profile.building);
}
