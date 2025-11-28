import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { throwError } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context) as Observable<boolean>;
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      // Detailed error logging for debugging
      const req = context.switchToHttp().getRequest();
      const url = req?.url || 'unknown';
      const authHeader = req?.headers?.['authorization'] || 'none';
      const tenantId = req?.headers?.['x-tenant-id'] || 'none';
      
      console.error('[JwtAuthGuard] Authentication failed');
      console.error(`  URL: ${url}`);
      console.error(`  Authorization header: ${authHeader.substring(0, 30)}...`);
      console.error(`  x-tenant-id: ${tenantId}`);
      
      if (err) {
        console.error(`  Error name: ${err?.name || 'Unknown'}`);
        console.error(`  Error message: ${err?.message || 'No message'}`);
        if (err?.expiredAt) {
          console.error(`  Token expired at: ${err.expiredAt}`);
        }
        console.error('  Full error:', err);
      }
      
      if (info) {
        console.error(`  Info name: ${info?.name || 'Unknown'}`);
        console.error(`  Info message: ${info?.message || 'No message'}`);
        if (info?.expiredAt) {
          console.error(`  Token expired at: ${info.expiredAt}`);
        }
        console.error('  Full info:', info);
      }
      
      // If TokenExpiredError, log it prominently with readable format
      if ((err?.name === 'TokenExpiredError' || info?.name === 'TokenExpiredError')) {
        const expiredAt = err?.expiredAt || info?.expiredAt;
        const expiredAtDate = expiredAt ? new Date(expiredAt * 1000).toISOString() : 'unknown';
        console.error(`  ⚠️  TOKEN EXPIRED ERROR`);
        console.error(`      expiredAt (timestamp): ${expiredAt}`);
        console.error(`      expiredAt (ISO): ${expiredAtDate}`);
        console.error(`      now (ISO): ${new Date().toISOString()}`);
      }
      
      throw err || new UnauthorizedException('Invalid or expired token');
    }
    return user;
  }
}
