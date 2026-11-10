export class AppError extends Error {
    status;
    code;
    details;
    constructor(status, code, message, details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
        this.name = 'AppError';
    }
}
export const badRequest = (message, details) => new AppError(400, 'bad_request', message, details);
export const unauthorized = (message = 'Authentication required') => new AppError(401, 'unauthorized', message);
export const forbidden = (message = 'You do not have permission to perform this action') => new AppError(403, 'forbidden', message);
export const notFound = (message = 'Resource not found') => new AppError(404, 'not_found', message);
export const conflict = (message, details) => new AppError(409, 'conflict', message, details);
export const unprocessable = (code, message, details) => new AppError(422, code, message, details);
//# sourceMappingURL=errors.js.map