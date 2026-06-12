export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }

  static badRequest(code: string, message: string) {
    return new ApiError(400, code, message);
  }

  static unauthorized(message = "Authentication required") {
    return new ApiError(401, "UNAUTHORIZED", message);
  }

  static forbidden(message = "You do not have permission to do this") {
    return new ApiError(403, "FORBIDDEN", message);
  }

  static notFound(message = "Resource not found") {
    return new ApiError(404, "NOT_FOUND", message);
  }

  static conflict(code: string, message: string) {
    return new ApiError(409, code, message);
  }
}
