export const colors = {
    bg: "#0c1014",
    bgElevated: "#131a22",
    surface: "#1a232e",
    surfaceHover: "#222c3a",
    border: "#2a3544",
    borderSubtle: "#1e2835",
    text: "#f2f0eb",
    textMuted: "#9aa5b5",
    textDim: "#6b7788",
    primary: "#3d9e7a",
    primaryMuted: "#2d7a5e",
    primarySoft: "rgba(61, 158, 122, 0.15)",
    accent: "#d4a853",
    accentSoft: "rgba(212, 168, 83, 0.12)",
    danger: "#e05d5d",
    dangerSoft: "rgba(224, 93, 93, 0.12)",
    info: "#5b9fd4",
    warning: "#e8a23d",
    overlay: "rgba(8, 12, 16, 0.88)",
} as const;

export type ColorKey = keyof typeof colors;
