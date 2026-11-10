export class BobHttpError extends Error {
    status;
    body;
    constructor(status, message, body) {
        super(message);
        this.status = status;
        this.body = body;
        this.name = 'BobHttpError';
    }
}
export class BobNetworkError extends Error {
    cause;
    constructor(message, cause) {
        super(message);
        this.cause = cause;
        this.name = 'BobNetworkError';
    }
}
//# sourceMappingURL=types.js.map