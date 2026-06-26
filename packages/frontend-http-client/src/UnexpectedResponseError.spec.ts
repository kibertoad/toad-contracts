import { describe, expect, it } from "vitest";
import { UnexpectedResponseError } from "./UnexpectedResponseError.ts";

describe("UnexpectedResponseError", () => {
  it("exposes the status code, headers, and body", () => {
    const error = new UnexpectedResponseError(
      503,
      { "content-type": "text/html" },
      "<html>down</html>",
    );

    expect(error.code).toBe("UNEXPECTED_RESPONSE_ERROR");
    expect(error.statusCode).toBe(503);
    expect(error.headers).toEqual({ "content-type": "text/html" });
    expect(error.body).toBe("<html>down</html>");
    expect(error.message).toBe("Unexpected response: statusCode=503, contentType=text/html");
  });

  it("falls back to 'none' in the message when content-type is absent", () => {
    const error = new UnexpectedResponseError(500, {}, "");
    expect(error.message).toBe("Unexpected response: statusCode=500, contentType=none");
  });

  it("recognizes branded instances across realms via Symbol.hasInstance", () => {
    const error = new UnexpectedResponseError(404, {}, "");
    expect(error).toBeInstanceOf(UnexpectedResponseError);

    const brand = Symbol.for("toad-contracts.frontend-http-client.error.UnexpectedResponseError");
    const lookalike = { [brand]: true };
    expect(lookalike).toBeInstanceOf(UnexpectedResponseError);
  });

  it("rejects non-branded values", () => {
    expect({}).not.toBeInstanceOf(UnexpectedResponseError);
    expect(null).not.toBeInstanceOf(UnexpectedResponseError);
    expect(new Error("x")).not.toBeInstanceOf(UnexpectedResponseError);
  });
});
