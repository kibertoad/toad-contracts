const unexpectedResponseErrorBrand = Symbol.for(
  "toad-contracts.frontend-http-client.error.UnexpectedResponseError",
);

/**
 * Returned as `Either.error` when the response status code is absent from the contract's
 * `responsesByStatusCode`, or its `content-type` cannot be matched to any declared response entry.
 * Carries the raw status code, headers, and unparsed body text for diagnostics.
 */
export class UnexpectedResponseError extends Error {
  readonly code = "UNEXPECTED_RESPONSE_ERROR";
  readonly statusCode: number;
  readonly headers: Record<string, string | undefined>;
  readonly body: string;

  constructor(statusCode: number, headers: Record<string, string | undefined>, body: string) {
    super(
      `Unexpected response: statusCode=${statusCode}, contentType=${headers["content-type"] ?? "none"}`,
    );
    this.name = "UnexpectedResponseError";
    this.statusCode = statusCode;
    this.headers = headers;
    this.body = body;

    Object.defineProperty(this, unexpectedResponseErrorBrand, { value: true });
  }

  static override [Symbol.hasInstance](val: unknown): boolean {
    return (
      val !== null &&
      typeof val === "object" &&
      unexpectedResponseErrorBrand in val &&
      (val as Record<symbol, unknown>)[unexpectedResponseErrorBrand] === true
    );
  }
}
