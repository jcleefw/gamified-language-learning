/** UPPER_SNAKE_CASE error codes for all API error responses. */
export enum ErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  BAD_REQUEST = 'BAD_REQUEST',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',
}

export interface ApiError {
  code: ErrorCode;
  message: string;
}

/** Universal response envelope for all SRS HTTP endpoints. */
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };
