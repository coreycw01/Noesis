export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}
