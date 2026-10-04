import { Catch, RpcExceptionFilter, ArgumentsHost } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { DomainException } from './domain.exception';

@Catch(DomainException)
export class RpcDomainExceptionFilter implements RpcExceptionFilter<DomainException> {
    catch(exception: DomainException, host: ArgumentsHost): Observable<any> {
        return throwError(() => ({
            code: this.mapToGrpcCode(exception.statusCode),
            message: exception.message,
            details: exception.details,
        }));
    }

    private mapToGrpcCode(statusCode: number): number {
        const map: Record<number, number> = {
            400: 3,  // INVALID_ARGUMENT
            401: 16, // UNAUTHENTICATED
            403: 7,  // PERMISSION_DENIED
            404: 5,  // NOT_FOUND
            409: 6,  // ALREADY_EXISTS
            500: 13, // INTERNAL
        };
        return map[statusCode] || 2; // UNKNOWN
    }
}