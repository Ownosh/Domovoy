/** Единый ключ дома для ленты, коллективных заявок и объявлений */
export function buildBuildingKey(building: string): string {
    return building.trim().toLowerCase().replace(/\s+/g, " ");
}
