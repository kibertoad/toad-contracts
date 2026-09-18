import type { BlobResponseHandle } from "@toad-contracts/core";
import {
  blobResponse,
  ContractNoBody,
  defineApiContract,
  noBodyResponse,
  sseBody,
  sseResponse,
} from "@toad-contracts/core";
import { withObjectKeys } from "@toad-contracts/valibot";
import { getLocal } from "mockttp";
import { number, object, optional, pipe, string, transform, unknown } from "valibot";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from "vitest";
import wretch from "wretch";
import { sendByApiContract } from "./sendByApiContract.ts";
import { UnexpectedResponseError } from "./UnexpectedResponseError.ts";

const JSON_HEADERS = { "content-type": "application/json" };

describe("sendByApiContract", () => {
  const mockServer = getLocal();

  beforeEach(async () => {
    await mockServer.start();
  });

  afterEach(async () => {
    await mockServer.stop();
  });

  const buildClient = () => wretch(mockServer.url);

  describe("GET", () => {
    it("sends GET request and returns typed body", async () => {
      const responseSchema = object({ id: number(), title: string() });

      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/products/1",
        responsesByStatusCode: { 200: responseSchema },
      });

      await mockServer.forGet("/products/1").thenJson(200, { id: 1, title: "Backpack" });

      const result = await sendByApiContract(buildClient(), contract, {});

      expectTypeOf(result.result).toMatchTypeOf<
        { body: { id: number; title: string } } | undefined
      >();
      expect(result.result).toMatchObject({ body: { id: 1, title: "Backpack" } });
    });

    it("sends GET request with path params", async () => {
      const contract = defineApiContract({
        requestPathParamsSchema: withObjectKeys(object({ productId: number() })),
        method: "get",
        pathResolver: ({ productId }) => `/products/${productId}`,
        responsesByStatusCode: { 200: unknown() },
      });

      await mockServer.forGet("/products/1").thenJson(200, { id: 1 });

      const result = await sendByApiContract(buildClient(), contract, {
        pathParams: { productId: 1 },
      });

      expect(result.result).toMatchObject({ body: { id: 1 } });
    });

    it("sends GET request with query params", async () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/products",
        requestQuerySchema: object({ limit: number() }),
        responsesByStatusCode: { 200: unknown() },
      });

      await mockServer
        .forGet("/products")
        .withQuery({ limit: "3" })
        .thenJson(200, [{ id: 1 }]);

      const result = await sendByApiContract(buildClient(), contract, {
        queryParams: { limit: 3 },
      });

      expect(result.result).toMatchObject({ body: [{ id: 1 }] });
    });

    it("sends GET request with headers", async () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/products/1",
        requestHeaderSchema: object({ authorization: string() }),
        responsesByStatusCode: { 200: unknown() },
      });

      await mockServer
        .forGet("/products/1")
        .withHeaders({ authorization: "Bearer token" })
        .thenJson(200, { id: 1 });

      const result = await sendByApiContract(buildClient(), contract, {
        headers: { authorization: "Bearer token" },
      });

      expect(result.result).toMatchObject({ body: { id: 1 } });
    });

    it("resolves headers from a sync function", async () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/products/1",
        requestHeaderSchema: object({ authorization: string() }),
        responsesByStatusCode: { 200: unknown() },
      });

      await mockServer
        .forGet("/products/1")
        .withHeaders({ authorization: "Bearer token" })
        .thenJson(200, { id: 1 });

      const result = await sendByApiContract(buildClient(), contract, {
        headers: () => ({ authorization: "Bearer token" }),
      });

      expect(result.result).toMatchObject({ body: { id: 1 } });
    });

    it("resolves headers from an async function", async () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/products/1",
        requestHeaderSchema: object({ authorization: string() }),
        responsesByStatusCode: { 200: unknown() },
      });

      await mockServer
        .forGet("/products/1")
        .withHeaders({ authorization: "Bearer token" })
        .thenJson(200, { id: 1 });

      const result = await sendByApiContract(buildClient(), contract, {
        headers: async () => ({ authorization: "Bearer token" }),
      });

      expect(result.result).toMatchObject({ body: { id: 1 } });
    });

    it("works with path prefix", async () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/products/1",
        responsesByStatusCode: { 200: unknown() },
      });

      await mockServer.forGet("/api/products/1").thenJson(200, { id: 1 });

      const result = await sendByApiContract(buildClient(), contract, { pathPrefix: "api" });

      expect(result.result).toMatchObject({ body: { id: 1 } });
    });

    it("validates response and throws on schema mismatch", async () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/products/1",
        responsesByStatusCode: { 200: object({ id: string() }) },
      });

      await mockServer.forGet("/products/1").thenJson(200, { id: 1 });

      await expect(sendByApiContract(buildClient(), contract, {})).rejects.toThrow();
    });

    it("throws on network failure (no HTTP response)", async () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/products/1",
        responsesByStatusCode: { 200: unknown() },
      });

      await expect(
        sendByApiContract(buildClient(), contract, { signal: AbortSignal.abort() }),
      ).rejects.toMatchObject({ name: "AbortError" });
    });

    it("returns UnexpectedResponseError when status is not in contract", async () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/products/1",
        responsesByStatusCode: {},
      });

      await mockServer.forGet("/products/1").thenJson(500, { error: "fail" });

      const result = await sendByApiContract(buildClient(), contract, {});

      expect(result.error).toBeInstanceOf(UnexpectedResponseError);
      expect((result.error as UnexpectedResponseError).statusCode).toBe(500);
      expect(result.result).toBeUndefined();
    });

    it("returns typed body for non-2xx response when status is in contract", async () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/products/1",
        responsesByStatusCode: {
          200: object({ id: number() }),
          404: object({ message: string() }),
        },
      });

      await mockServer.forGet("/products/1").thenJson(404, { message: "not found" });

      const response = await sendByApiContract(buildClient(), contract, { captureAsError: false });

      expectTypeOf(response.result).toEqualTypeOf<
        | { statusCode: 200; body: { id: number }; headers: Record<string, string> }
        | { statusCode: 404; body: { message: string }; headers: Record<string, string> }
        | undefined
      >();
      expect(response.result).toMatchObject({ statusCode: 404, body: { message: "not found" } });
    });

    it("returns non-2xx response as Either.error by default", async () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/products/1",
        responsesByStatusCode: {
          200: object({ id: number() }),
          404: object({ message: string() }),
        },
      });

      await mockServer.forGet("/products/1").thenJson(404, { message: "not found" });

      const response = await sendByApiContract(buildClient(), contract, {});

      expectTypeOf(response.result).toEqualTypeOf<
        { statusCode: 200; body: { id: number }; headers: Record<string, string> } | undefined
      >();
      expect(response.error).toBeDefined();
      expect(response.result).toBeUndefined();
    });

    it("parses and merges response headers when responseHeaderSchema is defined", async () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/products/1",
        responsesByStatusCode: { 200: object({ id: number() }) },
        responseHeaderSchema: object({ "x-request-id": string() }),
      });

      await mockServer
        .forGet("/products/1")
        .thenJson(200, { id: 1 }, { "x-request-id": "abc-123" });

      const result = await sendByApiContract(buildClient(), contract, {});

      expect(result.result?.headers["x-request-id"]).toBe("abc-123");
      expect(result.result?.headers["content-type"]).toBe("application/json");
    });
  });

  describe("POST", () => {
    it("sends POST request with body and returns typed response", async () => {
      const contract = defineApiContract({
        method: "post",
        pathResolver: () => "/products",
        requestBodySchema: object({ name: string() }),
        responsesByStatusCode: { 201: object({ id: number() }) },
      });

      await mockServer.forPost("/products").thenJson(201, { id: 21 });

      const result = await sendByApiContract(buildClient(), contract, { body: { name: "test" } });

      expectTypeOf(result.result).toMatchTypeOf<{ body: { id: number } } | undefined>();
      expect(result.result).toMatchObject({ body: { id: 21 } });
    });

    it("sends POST with path params and body", async () => {
      const contract = defineApiContract({
        requestPathParamsSchema: withObjectKeys(object({ orgId: string() })),
        method: "post",
        pathResolver: ({ orgId }) => `/orgs/${orgId}/members`,
        requestBodySchema: object({ email: string() }),
        responsesByStatusCode: { 201: object({ id: string() }) },
      });

      await mockServer.forPost("/orgs/acme/members").thenJson(201, { id: "1" });

      const result = await sendByApiContract(buildClient(), contract, {
        pathParams: { orgId: "acme" },
        body: { email: "alice@example.com" },
      });

      expect(result.result).toMatchObject({ body: { id: "1" } });
    });
  });

  describe("PUT", () => {
    it("sends PUT request", async () => {
      const contract = defineApiContract({
        requestPathParamsSchema: withObjectKeys(object({ id: string() })),
        method: "put",
        pathResolver: ({ id }) => `/products/${id}`,
        requestBodySchema: object({ name: string() }),
        responsesByStatusCode: { 200: object({ id: number() }) },
      });

      await mockServer.forPut("/products/1").thenJson(200, { id: 1 });

      const result = await sendByApiContract(buildClient(), contract, {
        pathParams: { id: "1" },
        body: { name: "updated" },
      });

      expectTypeOf(result.result).toMatchTypeOf<{ body: { id: number } } | undefined>();
      expect(result.result).toMatchObject({ body: { id: 1 } });
    });
  });

  describe("PATCH", () => {
    it("sends PATCH request", async () => {
      const contract = defineApiContract({
        requestPathParamsSchema: withObjectKeys(object({ id: string() })),
        method: "patch",
        pathResolver: ({ id }) => `/products/${id}`,
        requestBodySchema: object({ name: string() }),
        responsesByStatusCode: { 200: object({ id: number() }) },
      });

      await mockServer.forPatch("/products/1").thenJson(200, { id: 1 });

      const result = await sendByApiContract(buildClient(), contract, {
        pathParams: { id: "1" },
        body: { name: "patched" },
      });

      expectTypeOf(result.result).toMatchTypeOf<{ body: { id: number } } | undefined>();
      expect(result.result).toMatchObject({ body: { id: 1 } });
    });
  });

  describe("DELETE", () => {
    it("sends DELETE request with a no-body response and returns null on 204", async () => {
      const contract = defineApiContract({
        requestPathParamsSchema: withObjectKeys(object({ id: string() })),
        method: "delete",
        pathResolver: ({ id }) => `/products/${id}`,
        responsesByStatusCode: { 204: noBodyResponse() },
      });

      await mockServer.forDelete("/products/1").thenReply(204);

      const result = await sendByApiContract(buildClient(), contract, { pathParams: { id: "1" } });

      expectTypeOf(result.result).toMatchTypeOf<{ body: null } | undefined>();
      expect(result.result).toMatchObject({ statusCode: 204, body: null });
    });
  });

  describe("SSE", () => {
    it("returns async iterable of typed events", async () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/events",
        responsesByStatusCode: {
          200: sseResponse({ update: object({ id: string() }) }),
        },
      });

      const sseBody = 'event: update\ndata: {"id":"1"}\n\nevent: update\ndata: {"id":"2"}\n\n';

      await mockServer
        .forGet("/events")
        .withHeaders({ accept: "text/event-stream" })
        .thenReply(200, sseBody, { "content-type": "text/event-stream" });

      const response = await sendByApiContract(buildClient(), contract, {});

      expectTypeOf(response.result).toMatchTypeOf<
        | {
            body: AsyncIterable<{
              type: "update";
              data: { id: string };
              lastEventId: string;
              retry: number | undefined;
            }>;
          }
        | undefined
      >();

      if (!response.result) throw new Error("Expected result");
      const events: {
        type: string;
        data: { id: string };
        lastEventId: string;
        retry: number | undefined;
      }[] = [];
      for await (const event of response.result.body) {
        events.push(event);
      }

      expect(events).toEqual([
        { type: "update", data: { id: "1" }, lastEventId: "", retry: undefined },
        { type: "update", data: { id: "2" }, lastEventId: "", retry: undefined },
      ]);
    });

    it("validates event data against contract schema", async () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/events",
        responsesByStatusCode: {
          200: sseResponse({ tick: object({ count: pipe(string(), transform(Number)) }) }),
        },
      });

      // count arrives as a string; the transform should turn it into a number
      const sseBody = 'event: tick\ndata: {"count":"42"}\n\n';

      await mockServer
        .forGet("/events")
        .withHeaders({ accept: "text/event-stream" })
        .thenReply(200, sseBody, { "content-type": "text/event-stream" });

      const response = await sendByApiContract(buildClient(), contract, {});

      if (!response.result) throw new Error("Expected result");
      const events: {
        type: string;
        data: { count: number };
        lastEventId: string;
        retry: number | undefined;
      }[] = [];
      for await (const event of response.result.body) {
        events.push(event);
      }

      expect(events).toEqual([
        { type: "tick", data: { count: 42 }, lastEventId: "", retry: undefined },
      ]);
    });

    it("dual-mode: streaming: true infers AsyncIterable, streaming: false infers typed body", () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/events",
        responsesByStatusCode: {
          200: {
            content: {
              "application/json": object({ latest: string() }),
              "text/event-stream": sseBody({ update: object({ id: string() }) }),
            },
          },
        },
      });

      type SseResult = Awaited<
        ReturnType<() => ReturnType<typeof sendByApiContract<typeof contract, true>>>
      >;
      type JsonResult = Awaited<
        ReturnType<() => ReturnType<typeof sendByApiContract<typeof contract, false>>>
      >;

      expectTypeOf<NonNullable<SseResult["result"]>["body"]>().toEqualTypeOf<
        AsyncIterable<{
          type: "update";
          data: { id: string };
          lastEventId: string;
          retry: number | undefined;
        }>
      >();
      expectTypeOf<NonNullable<JsonResult["result"]>["body"]>().toEqualTypeOf<{ latest: string }>();
    });

    it("throws when a conflicting Accept header is provided for an SSE contract", async () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/events",
        requestHeaderSchema: object({ accept: string() }),
        responsesByStatusCode: {
          200: sseResponse({ update: object({ id: string() }) }),
        },
      });

      await expect(
        sendByApiContract(buildClient(), contract, { headers: { accept: "application/json" } }),
      ).rejects.toThrow(
        'Cannot use SSE streaming with a custom Accept header ("application/json")',
      );
    });

    it("throws when SSE event type is not in the contract schema", async () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/events",
        responsesByStatusCode: {
          200: sseResponse({ update: object({ id: string() }) }),
        },
      });

      const sseBody = "event: unknown\ndata: {}\n\n";

      await mockServer
        .forGet("/events")
        .withHeaders({ accept: "text/event-stream" })
        .thenReply(200, sseBody, { "content-type": "text/event-stream" });

      const response = await sendByApiContract(buildClient(), contract, {});

      if (!response.result) throw new Error("Expected result");

      await expect(async () => {
        for await (const _ of response.result.body) {
          // consume
        }
      }).rejects.toThrow('Schema for event "unknown" not found.');
    });

    it("throws when event data fails schema validation", async () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/events",
        responsesByStatusCode: {
          200: sseResponse({ update: object({ id: string() }) }),
        },
      });

      const sseBody = 'event: update\ndata: {"id":123}\n\n';

      await mockServer
        .forGet("/events")
        .withHeaders({ accept: "text/event-stream" })
        .thenReply(200, sseBody, { "content-type": "text/event-stream" });

      const response = await sendByApiContract(buildClient(), contract, {});

      if (!response.result) throw new Error("Expected result");
      const resultBody = response.result.body;

      await expect(async () => {
        for await (const _ of resultBody) {
          // consume
        }
      }).rejects.toThrow();
    });
  });

  describe("blob", () => {
    const csvContract = defineApiContract({
      method: "get",
      pathResolver: () => "/export.csv",
      responsesByStatusCode: { 200: blobResponse("text/csv") },
    });

    const replyWithCsv = () =>
      mockServer
        .forGet("/export.csv")
        .thenReply(200, "id,name\n1,Backpack", { "content-type": "text/csv" });

    it("returns a lazy handle that decodes the body as text", async () => {
      await replyWithCsv();

      const result = await sendByApiContract(buildClient(), csvContract, {});

      expectTypeOf(result.result).toMatchTypeOf<{ body: BlobResponseHandle } | undefined>();
      if (!result.result) throw new Error("Expected result");
      expect(await result.result.body.text()).toBe("id,name\n1,Backpack");
    });

    it("buffers the body into a Blob", async () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/photo.png",
        responsesByStatusCode: { 200: blobResponse("image/png") },
      });

      await mockServer
        .forGet("/photo.png")
        .thenReply(200, Buffer.from([0x89, 0x50, 0x4e, 0x47]), { "content-type": "image/png" });

      const result = await sendByApiContract(buildClient(), contract, {});

      if (!result.result) throw new Error("Expected result");
      const blob = await result.result.body.blob();
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBe(4);
    });

    it("buffers the body into an ArrayBuffer", async () => {
      await replyWithCsv();

      const result = await sendByApiContract(buildClient(), csvContract, {});

      if (!result.result) throw new Error("Expected result");
      const buffer = await result.result.body.arrayBuffer();
      expect(new TextDecoder().decode(buffer)).toBe("id,name\n1,Backpack");
    });

    it("exposes the raw stream without buffering it", async () => {
      await replyWithCsv();

      const result = await sendByApiContract(buildClient(), csvContract, {});

      if (!result.result) throw new Error("Expected result");
      const stream = result.result.body.stream();
      expect(stream).toBeInstanceOf(ReadableStream);
      expect(await new Response(stream).text()).toBe("id,name\n1,Backpack");
    });

    it("discards the body via cancel()", async () => {
      await replyWithCsv();

      const result = await sendByApiContract(buildClient(), csvContract, {});

      if (!result.result) throw new Error("Expected result");
      await expect(result.result.body.cancel()).resolves.toBeUndefined();
    });

    it("throws on a second accessor, since the body is one-shot", async () => {
      await replyWithCsv();

      const result = await sendByApiContract(buildClient(), csvContract, {});

      if (!result.result) throw new Error("Expected result");
      await result.result.body.text();
      expect(() => result.result?.body.stream()).toThrow("Response body already consumed");
      await expect(result.result.body.blob()).rejects.toThrow("Response body already consumed");
    });
  });

  describe("content-type request header", () => {
    it("sets content-type: application/json automatically when body is present", async () => {
      const contract = defineApiContract({
        method: "post",
        pathResolver: () => "/items",
        requestBodySchema: object({ name: string() }),
        responsesByStatusCode: { 200: object({ id: number() }) },
      });

      let contentTypeHeader: string | undefined;
      await mockServer.forPost("/items").thenCallback((req) => {
        contentTypeHeader = req.headers["content-type"];
        return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ id: 1 }) };
      });

      await sendByApiContract(buildClient(), contract, { body: { name: "test" } });

      expect(contentTypeHeader).toBe("application/json");
    });

    it("does not set content-type when no body is present", async () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/items",
        responsesByStatusCode: { 200: object({ id: number() }) },
      });

      let contentTypeHeader: string | undefined;
      await mockServer.forGet("/items").thenCallback((req) => {
        contentTypeHeader = req.headers["content-type"];
        return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ id: 1 }) };
      });

      await sendByApiContract(buildClient(), contract, {});

      expect(contentTypeHeader).toBeUndefined();
    });

    it("preserves user-provided content-type (lowercase)", async () => {
      const contract = defineApiContract({
        method: "post",
        pathResolver: () => "/items",
        requestBodySchema: object({ name: string() }),
        requestHeaderSchema: object({ "content-type": optional(string()) }),
        responsesByStatusCode: { 200: object({ id: number() }) },
      });

      let contentTypeHeader: string | undefined;
      await mockServer.forPost("/items").thenCallback((req) => {
        contentTypeHeader = req.headers["content-type"];
        return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ id: 1 }) };
      });

      await sendByApiContract(buildClient(), contract, {
        body: { name: "test" },
        headers: { "content-type": "text/plain" },
      });

      expect(contentTypeHeader).toBe("text/plain");
    });

    it("preserves user-provided content-type (Title-Case)", async () => {
      const contract = defineApiContract({
        method: "post",
        pathResolver: () => "/items",
        requestBodySchema: object({ name: string() }),
        requestHeaderSchema: object({ "Content-Type": optional(string()) }),
        responsesByStatusCode: { 200: object({ id: number() }) },
      });

      let contentTypeHeader: string | undefined;
      await mockServer.forPost("/items").thenCallback((req) => {
        contentTypeHeader = req.headers["content-type"];
        return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ id: 1 }) };
      });

      await sendByApiContract(buildClient(), contract, {
        body: { name: "test" },
        headers: { "Content-Type": "text/plain" },
      });

      expect(contentTypeHeader).toBe("text/plain");
    });
  });

  describe("request validation", () => {
    it("validates the request body and throws before sending on schema mismatch", async () => {
      const contract = defineApiContract({
        method: "post",
        pathResolver: () => "/items",
        requestBodySchema: object({ name: string() }),
        responsesByStatusCode: { 201: object({ id: number() }) },
      });

      const endpoint = await mockServer.forPost("/items").thenJson(201, { id: 1 });

      await expect(
        // @ts-expect-error name must be a string
        sendByApiContract(buildClient(), contract, { body: { name: 123 } }),
      ).rejects.toThrow(/does not satisfy the contract schema/);

      expect((await endpoint.getSeenRequests()).length).toBe(0);
    });

    it("applies request query schema transforms before sending", async () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/products",
        requestQuerySchema: object({
          limit: pipe(
            number(),
            transform((n) => n * 2),
          ),
        }),
        responsesByStatusCode: { 200: unknown() },
      });

      await mockServer.forGet("/products").withQuery({ limit: "10" }).thenJson(200, { ok: true });

      const result = await sendByApiContract(buildClient(), contract, {
        queryParams: { limit: 5 },
      });

      expect(result.result).toMatchObject({ body: { ok: true } });
    });

    it("sends a string body verbatim under a non-JSON content-type", async () => {
      const contract = defineApiContract({
        method: "post",
        pathResolver: () => "/raw",
        requestBodySchema: string(),
        requestHeaderSchema: object({ "content-type": optional(string()) }),
        responsesByStatusCode: { 200: unknown() },
      });

      let receivedBody: string | undefined;
      await mockServer.forPost("/raw").thenCallback(async (req) => {
        receivedBody = await req.body.getText();
        return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) };
      });

      await sendByApiContract(buildClient(), contract, {
        body: "id,name\n1,Backpack",
        headers: { "content-type": "text/csv" },
      });

      expect(receivedBody).toBe("id,name\n1,Backpack");
    });

    it("sends a POST with a ContractNoBody request body and no payload", async () => {
      const contract = defineApiContract({
        method: "post",
        pathResolver: () => "/ping",
        requestBodySchema: ContractNoBody,
        responsesByStatusCode: { 204: noBodyResponse() },
      });

      let receivedBody: string | undefined;
      await mockServer.forPost("/ping").thenCallback(async (req) => {
        receivedBody = await req.body.getText();
        return { statusCode: 204 };
      });

      const result = await sendByApiContract(buildClient(), contract, {});

      expect(result.result).toMatchObject({ statusCode: 204, body: null });
      expect(receivedBody).toBe("");
    });
  });

  describe("SSE error handling", () => {
    it("throws a clear error when SSE event data is not valid JSON", async () => {
      const contract = defineApiContract({
        method: "get",
        pathResolver: () => "/events",
        responsesByStatusCode: {
          200: sseResponse({ update: object({ id: string() }) }),
        },
      });

      const sseBody = "event: update\ndata: not-json\n\n";

      await mockServer
        .forGet("/events")
        .withHeaders({ accept: "text/event-stream" })
        .thenReply(200, sseBody, { "content-type": "text/event-stream" });

      const response = await sendByApiContract(buildClient(), contract, {});

      if (!response.result) throw new Error("Expected result");
      const resultBody = response.result.body;

      await expect(async () => {
        for await (const _ of resultBody) {
          // consume
        }
      }).rejects.toThrow(/Failed to parse data for SSE event "update" as JSON/);
    });
  });
});
