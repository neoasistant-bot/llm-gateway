import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { AUDIT_ACTION_KEY, AUDIT_RESOURCE_KEY } from './audit-action.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Read metadata from handler
    const auditAction = this.reflector.get<string>(
      AUDIT_ACTION_KEY,
      context.getHandler(),
    );
    const auditResource = this.reflector.get<string>(
      AUDIT_RESOURCE_KEY,
      context.getHandler(),
    );

    // Skip if no metadata
    if (!auditAction || !auditResource) {
      return next.handle();
    }

    const action = auditAction as any;

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    const ip = request.ip || request.get('x-forwarded-for');

    return next.handle().pipe(
      tap((response) => {
        // Extract resourceId from response or request params
        let resourceId: string | undefined;

        if (response && typeof response === 'object' && 'id' in response) {
          resourceId = response.id;
        } else if (request.params?.id) {
          resourceId = request.params.id;
        } else if (request.params?.methodId) {
          resourceId = request.params.methodId;
        }

        // Sanitize request body (remove sensitive fields)
        const sanitizedBody = this.sanitizeBody(request.body);

        // Log the audit action
        this.auditService
          .log({
            userId,
            action,
            resource: auditResource,
            resourceId,
            details: sanitizedBody,
            ip,
          })
          .catch((error) => {
            console.error('Failed to log audit action:', error);
          });
      }),
    );
  }

  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'refreshToken', 'passwordHash'];

    sensitiveFields.forEach((field) => {
      if (field in sanitized) {
        delete sanitized[field];
      }
    });

    return sanitized;
  }
}
