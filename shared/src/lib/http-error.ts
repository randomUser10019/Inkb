/** Client-safe failure. 4xx messages are shown. 5xx messages are not. */
export class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export function badRequest(message: string): HttpError {
  return new HttpError(400, "BAD_REQUEST", message);
}

export function notFound(message: string): HttpError {
  return new HttpError(404, "NOT_FOUND", message);
}

export function tooMany(message: string): HttpError {
  return new HttpError(429, "RATE_LIMIT", message);
}

export function unavailable(message: string): HttpError {
  return new HttpError(503, "UNAVAILABLE", message);
}
