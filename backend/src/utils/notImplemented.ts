import { Request, Response } from "express";

// Placeholder handler used while scaffolding. Replace with real controllers.
export function notImplemented(req: Request, res: Response) {
  res.status(501).json({
    success: false,
    error: {
      code: "NOT_IMPLEMENTED",
      message: `${req.method} ${req.baseUrl}${req.path} is not implemented yet`,
    },
  });
}
