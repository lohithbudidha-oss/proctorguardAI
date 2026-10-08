import { Request, Response, NextFunction } from 'express';
import { Role } from '../models/User';
export interface AuthRequest extends Request {
    user?: {
        userId: string;
        role: Role;
        status: string;
    };
}
export declare const authenticate: (req: AuthRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const requireRole: (roles: Role[]) => (req: AuthRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=authMiddleware.d.ts.map