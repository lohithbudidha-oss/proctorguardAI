import { Request, Response, NextFunction } from 'express';
export declare const createExam: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const getExams: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const updateExam: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const publishExam: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=examController.d.ts.map