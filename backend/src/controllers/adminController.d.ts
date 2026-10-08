import { Request, Response, NextFunction } from 'express';
export declare const getCandidates: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const updateCandidateStatus: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=adminController.d.ts.map