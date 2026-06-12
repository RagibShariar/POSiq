import { NextFunction, Request, RequestHandler, Response } from "express";

// Express 4 doesn't catch rejected promises — every async controller is
// wrapped so errors flow into the error middleware.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
