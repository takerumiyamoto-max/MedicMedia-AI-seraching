import { postJson } from "./client";
import type { SearchMaterialRequest, SearchMaterialResponse } from "./types";

export function searchMaterial(req: SearchMaterialRequest) {
  return postJson<SearchMaterialResponse>("/search/material", req);
}