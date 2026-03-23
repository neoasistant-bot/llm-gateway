import { SetMetadata } from '@nestjs/common';
import { AuditAction } from '../../generated/prisma/client';

export const AUDIT_ACTION_KEY = 'audit_action';
export const AUDIT_RESOURCE_KEY = 'audit_resource';

export const AuditLog = (action: AuditAction, resource: string) => {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    SetMetadata(AUDIT_ACTION_KEY, action)(target, key, descriptor);
    SetMetadata(AUDIT_RESOURCE_KEY, resource)(target, key, descriptor);
    return descriptor;
  };
};
