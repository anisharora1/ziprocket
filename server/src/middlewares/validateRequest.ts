import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

export const validateRequest = (schema: {
    body?: ZodSchema;
    query?: ZodSchema;
    params?: ZodSchema;
}) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (schema.body) {
                req.body = await schema.body.parseAsync(req.body);
            }
            if (schema.query) {
                req.query = (await schema.query.parseAsync(req.query)) as any;
            }
            if (schema.params) {
                req.params = (await schema.params.parseAsync(req.params)) as any;
            }
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const formattedErrors = error.issues.map((err: any) => `${err.path.join(".")}: ${err.message}`);
                res.status(400).json({
                    success: false,
                    message: `Validation failed: ${formattedErrors.join("; ")}`
                });
                return;
            }
            next(error);
        }
    };
};
