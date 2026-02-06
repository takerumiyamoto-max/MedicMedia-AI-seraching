// apps/api/src/services/api_error.ts
export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "NOT_EXTRACTED"
  | "NOT_CHUNKED"
  | "INTERNAL";

export class ApiError extends Error {
  public readonly code: ApiErrorCode;
  public readonly status: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ApiErrorCode,
    message: string,
    status: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof Error && (err as any).name === "ApiError";
}