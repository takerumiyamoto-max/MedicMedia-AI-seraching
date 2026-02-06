export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "NOT_EXTRACTED"
  | "NOT_CHUNKED"
  | "INTERNAL";

export type MaterialHit = {
  chunk_id: string;
  pdf_id: string;
  page_start: number;
  page_end: number;
  score: number;
  snippet: string;
};

export type SearchMaterialSuccess = {
  ok: true;
  request_id: string;
  pdf_id: string;
  query: string;
  top_k: number;
  chunk_size: number;
  overlap: number;
  hit_count: number;
  hits: MaterialHit[];
};

export type SearchMaterialError = {
  ok: false;
  request_id: string;
  error: {
    code: ApiErrorCode;
    message: string;
    details: Record<string, unknown>;
  };
};

export type SearchMaterialResponse = SearchMaterialSuccess | SearchMaterialError;

export type SearchMaterialRequest = {
  pdf_id: string;
  query: string;
  top_k?: number;
};