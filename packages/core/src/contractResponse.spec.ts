import { number, object, string } from "valibot";
import { describe, expect, it } from "vitest";
import {
  blobBody,
  blobResponse,
  isBlobBody,
  isContentResponseEntry,
  isJsonBody,
  isJsonResponse,
  isSseBody,
  jsonResponse,
  noBodyResponse,
  resolveContractResponse,
  resolveResponseEntry,
  resolveStatusEntry,
  sseBody,
  sseResponse,
} from "./contractResponse.ts";

describe("isJsonResponse", () => {
  it("returns true for a bare Standard Schema", () => {
    expect(isJsonResponse(object({ id: string() }))).toBe(true);
  });

  it("returns false for every content-map entry", () => {
    expect(isJsonResponse(jsonResponse(object({ id: string() })))).toBe(false);
    expect(isJsonResponse(blobResponse("image/png"))).toBe(false);
    expect(isJsonResponse(sseResponse({ update: string() }))).toBe(false);
    expect(isJsonResponse(noBodyResponse())).toBe(false);
  });
});

describe("isContentResponseEntry", () => {
  it("returns true for entries carrying content or allowNoBody", () => {
    expect(isContentResponseEntry(blobResponse("image/png"))).toBe(true);
    expect(isContentResponseEntry(sseResponse({ update: string() }))).toBe(true);
    expect(isContentResponseEntry(jsonResponse(object({ id: string() })))).toBe(true);
    expect(isContentResponseEntry(noBodyResponse())).toBe(true);
  });

  it("returns false for a bare Standard Schema", () => {
    expect(isContentResponseEntry(object({ id: string() }))).toBe(false);
  });
});

describe("body descriptors", () => {
  it("isBlobBody only matches blobBody()", () => {
    expect(isBlobBody(blobBody())).toBe(true);
    expect(isBlobBody(sseBody({ update: string() }))).toBe(false);
    expect(isBlobBody(object({ id: string() }))).toBe(false);
  });

  it("isSseBody only matches sseBody()", () => {
    expect(isSseBody(sseBody({ update: string() }))).toBe(true);
    expect(isSseBody(blobBody())).toBe(false);
    expect(isSseBody(object({ id: string() }))).toBe(false);
  });

  it("isJsonBody only matches a bare Standard Schema", () => {
    expect(isJsonBody(object({ id: string() }))).toBe(true);
    expect(isJsonBody(blobBody())).toBe(false);
    expect(isJsonBody(sseBody({ update: string() }))).toBe(false);
  });
});

describe("response factories", () => {
  it("jsonResponse maps the schema under application/json", () => {
    const schema = object({ id: string() });
    expect(jsonResponse(schema)).toEqual({ content: { "application/json": schema } });
  });

  it("blobResponse maps a blob body under the given media type", () => {
    expect(blobResponse("image/png")).toEqual({ content: { "image/png": blobBody() } });
  });

  it("sseResponse maps an SSE body under text/event-stream", () => {
    const schemaByEventName = { update: string() };
    expect(sseResponse(schemaByEventName)).toEqual({
      content: { "text/event-stream": sseBody(schemaByEventName) },
    });
  });

  it("noBodyResponse carries allowNoBody and no content", () => {
    expect(noBodyResponse()).toEqual({ allowNoBody: true });
  });

  it.each([
    ["jsonResponse", (d?: { description: string }) => jsonResponse(object({ id: string() }), d)],
    ["blobResponse", (d?: { description: string }) => blobResponse("image/png", d)],
    ["sseResponse", (d?: { description: string }) => sseResponse({ update: string() }, d)],
    ["noBodyResponse", (d?: { description: string }) => noBodyResponse(d)],
  ])("%s carries description only when provided", (_name, factory) => {
    expect(factory({ description: "Some description" })).toMatchObject({
      description: "Some description",
    });
    expect(factory()).not.toHaveProperty("description");
  });
});

describe("resolveContractResponse", () => {
  describe("noBodyResponse", () => {
    it("returns noContent regardless of content-type", () => {
      expect(resolveContractResponse(noBodyResponse(), "application/json")).toEqual({
        kind: "noContent",
      });
      expect(resolveContractResponse(noBodyResponse(), undefined)).toEqual({ kind: "noContent" });
    });
  });

  describe("missing content-type", () => {
    it("returns null in strict mode for every body-carrying entry", () => {
      expect(resolveContractResponse(object({ id: string() }), undefined)).toBeNull();
      expect(resolveContractResponse(jsonResponse(object({ id: string() })), undefined)).toBeNull();
      expect(resolveContractResponse(blobResponse("image/png"), undefined)).toBeNull();
      expect(resolveContractResponse(sseResponse({ update: string() }), undefined)).toBeNull();
    });

    it("returns noContent when the entry allows an absent body", () => {
      const entry = {
        content: { "application/json": object({ id: string() }) },
        allowNoBody: true,
      } as const;
      expect(resolveContractResponse(entry, undefined)).toEqual({ kind: "noContent" });
    });
  });

  describe("bare Standard Schema (JSON shorthand)", () => {
    it("resolves to json for application/json content-type", () => {
      const schema = object({ id: string() });
      expect(resolveContractResponse(schema, "application/json")).toEqual({ kind: "json", schema });
    });

    it("returns null for non-json content-type", () => {
      expect(resolveContractResponse(object({ id: string() }), "text/plain")).toBeNull();
    });

    it("resolves structured +json suffixes (problem+json, vnd.api+json)", () => {
      const schema = object({ error: string() });
      expect(resolveContractResponse(schema, "application/problem+json")).toEqual({
        kind: "json",
        schema,
      });
      expect(resolveContractResponse(schema, "application/vnd.api+json; charset=utf-8")).toEqual({
        kind: "json",
        schema,
      });
    });

    it("does not match a content-type that merely contains application/json as a substring", () => {
      expect(
        resolveContractResponse(object({ id: string() }), "text/html; note=application/json"),
      ).toBeNull();
    });
  });

  describe("content-map matching", () => {
    it("resolves each declared media type to its descriptor's kind", () => {
      const schema = object({ id: string() });
      const sseSchema = { tick: object({ count: number() }) };
      const entry = {
        content: {
          "application/json": schema,
          "application/pdf": blobBody(),
          "text/event-stream": sseBody(sseSchema),
        },
      };

      expect(resolveContractResponse(entry, "application/json")).toEqual({ kind: "json", schema });
      expect(resolveContractResponse(entry, "application/pdf")).toEqual({ kind: "blob" });
      expect(resolveContractResponse(entry, "text/event-stream")).toEqual({
        kind: "sse",
        schemaByEventName: sseSchema,
      });
    });

    it("strips content-type parameters and ignores case when matching", () => {
      expect(resolveContractResponse(blobResponse("image/PNG"), "image/png; q=1")).toEqual({
        kind: "blob",
      });
    });

    it("keeps JSON variants distinct instead of collapsing them by +json suffix", () => {
      const canonical = object({ id: string() });
      const vendored = object({ legacyId: number() });
      const entry = {
        content: { "application/json": canonical, "application/json+01": vendored },
      };

      expect(resolveContractResponse(entry, "application/json")).toEqual({
        kind: "json",
        schema: canonical,
      });
      expect(resolveContractResponse(entry, "application/json+01")).toEqual({
        kind: "json",
        schema: vendored,
      });
    });

    it("resolves structured +json suffixes to the application/json entry", () => {
      const schema = object({ error: string() });

      expect(resolveContractResponse(jsonResponse(schema), "application/problem+json")).toEqual({
        kind: "json",
        schema,
      });
      expect(
        resolveContractResponse(jsonResponse(schema), "application/vnd.api+json; charset=utf-8"),
      ).toEqual({ kind: "json", schema });
    });

    it("prefers an explicitly declared +json media type over the application/json entry", () => {
      const canonical = object({ id: string() });
      const problem = object({ detail: string() });
      const entry = {
        content: { "application/json": canonical, "application/problem+json": problem },
      };

      expect(resolveContractResponse(entry, "application/problem+json")).toEqual({
        kind: "json",
        schema: problem,
      });
    });

    it("does not resolve a +json response against a non-JSON descriptor", () => {
      expect(
        resolveContractResponse(
          { content: { "application/json": blobBody(), "image/png": blobBody() } },
          "application/problem+json",
        ),
      ).toBeNull();
    });

    it("returns null when no declared media type matches", () => {
      expect(resolveContractResponse(blobResponse("image/png"), "application/json")).toBeNull();
      expect(
        resolveContractResponse(sseResponse({ update: string() }), "application/json"),
      ).toBeNull();
    });

    it("does not let a broader declared type shadow a more specific one", () => {
      // Substring matching once let `text/` swallow `text/event-stream`, making the SSE body
      // unreachable. Essence equality keeps every media type distinct regardless of order.
      const sseSchema = { tick: object({ count: number() }) };
      const entry = { content: { "text/": blobBody(), "text/event-stream": sseBody(sseSchema) } };

      expect(resolveContractResponse(entry, "text/event-stream")).toEqual({
        kind: "sse",
        schemaByEventName: sseSchema,
      });
    });
  });

  describe("strict: false", () => {
    it("falls back to the sole descriptor when content-type is absent", () => {
      const schema = object({ id: string() });
      expect(resolveContractResponse(schema, undefined, false)).toEqual({ kind: "json", schema });
      expect(resolveContractResponse(jsonResponse(schema), undefined, false)).toEqual({
        kind: "json",
        schema,
      });
      expect(resolveContractResponse(blobResponse("image/png"), undefined, false)).toEqual({
        kind: "blob",
      });
    });

    it("falls back to the sole descriptor when content-type does not match", () => {
      const schema = object({ id: string() });
      expect(resolveContractResponse(schema, "text/plain", false)).toEqual({
        kind: "json",
        schema,
      });
      expect(resolveContractResponse(blobResponse("image/png"), "text/plain", false)).toEqual({
        kind: "blob",
      });
    });

    it("falls back to the sole SSE descriptor when content-type is absent", () => {
      const sseSchema = { update: object({ id: string() }) };
      expect(resolveContractResponse(sseResponse(sseSchema), undefined, false)).toEqual({
        kind: "sse",
        schemaByEventName: sseSchema,
      });
    });

    it("still returns null for a multi-media-type entry, which needs content-type to disambiguate", () => {
      const entry = { content: { "text/csv": blobBody(), "application/json": object({}) } };
      expect(resolveContractResponse(entry, undefined, false)).toBeNull();
      expect(resolveContractResponse(entry, "image/png", false)).toBeNull();
    });
  });
});

describe("resolveStatusEntry", () => {
  it("returns the raw entry without content-type resolution", () => {
    const schema = object({ id: string() });
    expect(resolveStatusEntry({ 200: schema }, 200)).toBe(schema);
  });

  it("returns undefined when nothing matches", () => {
    expect(resolveStatusEntry({ 200: object({}) }, 404)).toBeUndefined();
  });

  it("follows exact → range → default precedence", () => {
    const exact = object({ a: string() });
    const range = object({ b: string() });
    const def = object({ c: string() });
    const contract = { 200: exact, "2xx": range, default: def };

    expect(resolveStatusEntry(contract, 200)).toBe(exact);
    expect(resolveStatusEntry(contract, 201)).toBe(range);
    expect(resolveStatusEntry(contract, 404)).toBe(def);
  });
});

describe("resolveResponseEntry", () => {
  it("returns null when status code is not in the contract", () => {
    expect(resolveResponseEntry({}, 404, "application/json", true)).toBeNull();
  });

  it("resolves the entry when status code matches", () => {
    const schema = object({ id: string() });
    const result = resolveResponseEntry({ 200: schema }, 200, "application/json", true);
    expect(result).toEqual({ kind: "json", schema });
  });

  it("returns null when content-type is absent and strict is true", () => {
    const schema = object({ id: string() });
    expect(resolveResponseEntry({ 200: schema }, 200, undefined, true)).toBeNull();
  });

  it("falls back to entry kind when content-type is absent and strict is false", () => {
    const schema = object({ id: string() });
    const result = resolveResponseEntry({ 200: schema }, 200, undefined, false);
    expect(result).toEqual({ kind: "json", schema });
  });

  it("resolves noBodyResponse regardless of content-type", () => {
    expect(resolveResponseEntry({ 204: noBodyResponse() }, 204, undefined, true)).toEqual({
      kind: "noContent",
    });
  });

  describe("getRangeKey boundaries", () => {
    const schema = object({ x: string() });
    // Use a contract with all five range keys so a mismatch (null from getRangeKey) falls to null,
    // and a match resolves to the schema with kind 'json'.
    const allRanges = {
      "1xx": schema,
      "2xx": schema,
      "3xx": schema,
      "4xx": schema,
      "5xx": schema,
    };

    it.each([
      [99, null],
      [100, { kind: "json", schema }],
      [199, { kind: "json", schema }],
      [200, { kind: "json", schema }],
      [299, { kind: "json", schema }],
      [300, { kind: "json", schema }],
      [599, { kind: "json", schema }],
      [600, null],
    ])("status %i → %s", (statusCode, expected) => {
      expect(
        resolveResponseEntry(allRanges, statusCode as number, "application/json", true),
      ).toEqual(expected);
    });
  });

  describe("range key fallback", () => {
    it("resolves via 2xx range for any success code", () => {
      const schema = object({ id: string() });
      expect(resolveResponseEntry({ "2xx": schema }, 200, "application/json", true)).toEqual({
        kind: "json",
        schema,
      });
      expect(resolveResponseEntry({ "2xx": schema }, 201, "application/json", true)).toEqual({
        kind: "json",
        schema,
      });
    });

    it("resolves via 1xx range for any informational code", () => {
      const schema = object({ info: string() });
      expect(resolveResponseEntry({ "1xx": schema }, 100, "application/json", true)).toEqual({
        kind: "json",
        schema,
      });
    });

    it("resolves via 3xx range for any redirect code", () => {
      const schema = object({ location: string() });
      expect(resolveResponseEntry({ "3xx": schema }, 301, "application/json", true)).toEqual({
        kind: "json",
        schema,
      });
    });

    it("resolves via 4xx range for any client-error code", () => {
      const schema = object({ message: string() });
      expect(resolveResponseEntry({ "4xx": schema }, 404, "application/json", true)).toEqual({
        kind: "json",
        schema,
      });
      expect(resolveResponseEntry({ "4xx": schema }, 400, "application/json", true)).toEqual({
        kind: "json",
        schema,
      });
    });

    it("resolves via 5xx range for any server-error code", () => {
      const schema = object({ error: string() });
      expect(resolveResponseEntry({ "5xx": schema }, 500, "application/json", true)).toEqual({
        kind: "json",
        schema,
      });
      expect(resolveResponseEntry({ "5xx": schema }, 503, "application/json", true)).toEqual({
        kind: "json",
        schema,
      });
    });

    it("exact code takes precedence over range key", () => {
      const exact = object({ id: string() });
      const range = object({ message: string() });
      expect(
        resolveResponseEntry({ 200: exact, "2xx": range }, 200, "application/json", true),
      ).toEqual({ kind: "json", schema: exact });
    });

    it("exact match is absolute: content-type mismatch on exact entry returns null without falling through to range", () => {
      expect(
        resolveResponseEntry(
          { 200: blobResponse("text/csv"), "2xx": object({ id: string() }) },
          200,
          "application/json",
          true,
        ),
      ).toBeNull();
    });

    it("exact match is absolute: content-type mismatch on exact entry returns null without falling through to default", () => {
      expect(
        resolveResponseEntry(
          { 200: blobResponse("text/csv"), default: object({ id: string() }) },
          200,
          "application/json",
          true,
        ),
      ).toBeNull();
    });

    it("range key takes precedence over default", () => {
      const range = object({ message: string() });
      const def = object({ error: string() });
      expect(
        resolveResponseEntry({ "5xx": range, default: def }, 500, "application/json", true),
      ).toEqual({ kind: "json", schema: range });
    });

    it("multiple range keys each route correctly and default is not invoked for covered codes", () => {
      const s4xx = object({ clientError: string() });
      const s5xx = object({ serverError: string() });
      const def = object({ fallback: string() });
      const contract = { "4xx": s4xx, "5xx": s5xx, default: def };
      expect(resolveResponseEntry(contract, 404, "application/json", true)).toEqual({
        kind: "json",
        schema: s4xx,
      });
      expect(resolveResponseEntry(contract, 503, "application/json", true)).toEqual({
        kind: "json",
        schema: s5xx,
      });
      expect(resolveResponseEntry(contract, 304, "application/json", true)).toEqual({
        kind: "json",
        schema: def,
      });
    });

    it("2xx range takes precedence over default for success codes", () => {
      const s2xx = object({ data: string() });
      const def = object({ fallback: string() });
      expect(
        resolveResponseEntry({ "2xx": s2xx, default: def }, 201, "application/json", true),
      ).toEqual({ kind: "json", schema: s2xx });
      expect(
        resolveResponseEntry({ "2xx": s2xx, default: def }, 404, "application/json", true),
      ).toEqual({ kind: "json", schema: def });
    });

    it("returns null when range does not cover the status code", () => {
      expect(resolveResponseEntry({ "2xx": object({}) }, 404, "application/json", true)).toBeNull();
    });

    it("falls through to default when status code is outside all ranges", () => {
      const schema = object({ error: string() });
      expect(resolveResponseEntry({ default: schema }, 0, "application/json", true)).toEqual({
        kind: "json",
        schema,
      });
    });
  });

  describe("default fallback", () => {
    it("resolves via default when no exact or range match", () => {
      const schema = object({ error: string() });
      expect(resolveResponseEntry({ default: schema }, 503, "application/json", true)).toEqual({
        kind: "json",
        schema,
      });
    });

    it("resolves via default for any status code when it is the only entry", () => {
      const schema = object({ message: string() });
      expect(resolveResponseEntry({ default: schema }, 200, "application/json", true)).toEqual({
        kind: "json",
        schema,
      });
      expect(resolveResponseEntry({ default: schema }, 404, "application/json", true)).toEqual({
        kind: "json",
        schema,
      });
    });

    it("exact code takes precedence over default", () => {
      const exact = object({ id: string() });
      const def = object({ error: string() });
      expect(
        resolveResponseEntry({ 200: exact, default: def }, 200, "application/json", true),
      ).toEqual({ kind: "json", schema: exact });
    });

    it("resolves the correct kind from a multi-media-type default entry by content-type", () => {
      const jsonSchema = object({ id: string() });
      const sseSchema = { event: object({ id: string() }) };
      const contract = {
        default: {
          content: {
            "application/json": jsonSchema,
            "text/event-stream": sseBody(sseSchema),
          },
        },
      };
      expect(resolveResponseEntry(contract, 500, "application/json", true)).toEqual({
        kind: "json",
        schema: jsonSchema,
      });
      expect(resolveResponseEntry(contract, 500, "text/event-stream", true)).toEqual({
        kind: "sse",
        schemaByEventName: sseSchema,
      });
    });
  });
});
