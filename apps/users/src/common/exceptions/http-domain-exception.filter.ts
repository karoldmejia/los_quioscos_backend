import { Catch, ExceptionFilter, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { DomainException } from './domain.exception';

@Catch(DomainException)
export class HttpDomainExceptionFilter implements ExceptionFilter {
    catch(exception: DomainException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        const status = exception.statusCode || HttpStatus.BAD_REQUEST;

        response.status(status).json({
            statusCode: status,
            message: exception.message,
            code: exception.code,
            details: exception.details,
            timestamp: new Date().toISOString(),
        });
    }
}