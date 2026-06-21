/** Нормализация building_key для FK и сравнений (нижний регистр, trim). */
export function normalizeBuildingKey(key: string): string {
    return key.trim().toLowerCase();
}

/** Нормализация номера квартиры: убрать префиксы, оставить буквы/цифры. */
export function normalizeApartment(apartment: string): string {
    let s = apartment.trim().toLowerCase();
    s = s.replace(/^(кв\.?|№|#)\s*/i, "");
    s = s.replace(/[^0-9a-zа-яё]/gi, "");
    return s;
}

/** SQL-выражение для migrate/триггеров (MariaDB REGEXP_REPLACE). */
export const SQL_NORMALIZE_APARTMENT_NORM = `
LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(TRIM(apartment), '^(кв\\\\.?|№|#)[[:space:]]*', '', 1, 0, 'i'),
    '[^0-9a-zа-яё]',
    '',
    1, 0, 'i'
  )
)
`;
