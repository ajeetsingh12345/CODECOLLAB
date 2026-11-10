import { ZodError } from "zod";

export function notFound(req, res) {
  res.status(404).json({ message: "Route not found" });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Invalid request data",
      errors: err.issues.map(issue => ({ path: issue.path.join("."), message: issue.message }))
    });
  }

  const knownErrors = {
    P2002: { status: 409, message: "A record with the supplied unique value already exists" },
    P2025: { status: 404, message: "Record not found" },
    P1000: { status: 503, message: "Database unavailable" },
    P1001: { status: 503, message: "Database unavailable" },
    P1002: { status: 503, message: "Database unavailable" }
  };
  const knownError = knownErrors[err.code];
  const status = err.status || knownError?.status || 500;

  if (status >= 500) console.error(err);
  return res.status(status).json({
    message: knownError?.message || (status >= 500 ? "Internal server error" : err.message)
  });
}
