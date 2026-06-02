import { apiRequest } from "./client";
import type { NewsItem } from "../types";

export async function apiFetchNews(): Promise<NewsItem[]> {
    return apiRequest<NewsItem[]>("/news");
}
