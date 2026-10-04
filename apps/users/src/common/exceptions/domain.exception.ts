export class DomainException extends Error {
    public readonly code: string;
    public readonly details?: Record<string, any>;
    public readonly statusCode: number;

    constructor(
        message: string,
        code: string = 'DOMAIN_ERROR',
        statusCode: number = 400,
        details?: Record<string, any>
    ) {
        super(message);
        this.name = 'DomainException';
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        Object.setPrototypeOf(this, DomainException.prototype);
    }
}