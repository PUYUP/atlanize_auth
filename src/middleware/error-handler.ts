import type { NextFunction, Request, Response } from "express";

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "Not Found" });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(err);

  const message =
    process.env.NODE_ENV === "production"
      ? "Internal Server Error"
      : err instanceof Error
        ? err.message
        : String(err);

  res.status(500).json({ error: message });
}
