import { ERROR_CODES } from '@lp/shared';

export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(code = ERROR_CODES.VALIDATION, message, details) {
    return new AppError(400, code, message, details);
  }
  static unauthorized(code = ERROR_CODES.UNAUTHORIZED, message) {
    return new AppError(401, code, message);
  }
  static forbidden(code = ERROR_CODES.FORBIDDEN, message) {
    return new AppError(403, code, message);
  }
  static notFound(message = 'Not found') {
    return new AppError(404, ERROR_CODES.NOT_FOUND, message);
  }
  static conflict(code = ERROR_CODES.CONFLICT, message) {
    return new AppError(409, code, message);
  }
}
