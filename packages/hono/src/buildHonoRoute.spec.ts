import { ContractNoBody, defineApiContract, SchemaValidationError } from "@toad-contracts/core";
import { withObjectKeys } from "@toad-contracts/valibot";
import { Hono } from "hono";
import { array, object, optional, pipe, string, transform } from "valibot";
import { describe, expect, it } from "vitest";
import { buildHonoRoute, buildHonoRouteHandler } from "./buildHonoRoute.ts";
import { requestByContract } from "./requestByContract.ts";

const RESPONSE_BODY_SCHEMA = object({ name: string() });
const REQUEST_BODY_SCHEMA = object({ id: string() });
const PATH_PARAMS_SCHEMA = withObjectKeys(object({ userId: string() }));
const HEADERS_SCHEMA = object({ authorization: string() });
const QUERY_SCHEMA = object({
  testIds: optional(array(string())),
  limit: optional(pipe(string(), transform(Number)), "10"),
});

describe("buildHonoRoute", () => {
  it("builds a GET route with path params and query, exposing the contract on the context", async () => {
    const contract = defineApiContract({
      method: "get",
      requestPathParamsSchema: PATH_PARAMS_SCHEMA,
      requestQuerySchema: QUERY_SCHEMA,
      pathResolver: ({ userId }) => `/users/${userId}`,
      responsesByStatusCode: { 200: RESPONSE_BODY_SCHEMA },
    });

    const app = new Hono();
    buildHonoRoute(app, contract, (c) => {
      expect(c.get("apiContract")).toBe(contract);
      expect(c.req.valid("param").userId).toBe("1");
      expect(c.req.valid("query").limit).toBe(5);
      expect(c.req.valid("query").testIds).toEqual(["a", "b"]);
      return c.json({ name: "Frodo" }, 200);
    });

    const response = await requestByContract(app, contract, {
      pathParams: { userId: "1" },
      queryParams: { testIds: ["a", "b"], limit: "5" },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ name: "Frodo" });
  });

  it("builds a POST route validating the body", async () => {
    const contract = defineApiContract({
      method: "post",
      requestBodySchema: REQUEST_BODY_SCHEMA,
      requestPathParamsSchema: PATH_PARAMS_SCHEMA,
      pathResolver: ({ userId }) => `/users/${userId}`,
      responsesByStatusCode: { 201: RESPONSE_BODY_SCHEMA },
    });

    const handler = buildHonoRouteHandler(contract, (c) => {
      expect(c.req.valid("json").id).toBe("2");
      expect(c.req.valid("param").userId).toBe("1");
      return c.json({ name: "Sam" }, 201);
    });

    const app = new Hono();
    buildHonoRoute(app, contract, handler);

    const response = await requestByContract(app, contract, {
      pathParams: { userId: "1" },
      body: { id: "2" },
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ name: "Sam" });
  });

  it("builds a PUT route with a header schema", async () => {
    const contract = defineApiContract({
      method: "put",
      requestBodySchema: REQUEST_BODY_SCHEMA,
      requestHeaderSchema: HEADERS_SCHEMA,
      pathResolver: () => "/widget",
      responsesByStatusCode: { 200: RESPONSE_BODY_SCHEMA },
    });

    const app = new Hono();
    buildHonoRoute(app, contract, (c) => {
      expect(c.req.valid("header").authorization).toBe("token");
      return c.json({ name: "ok" }, 200);
    });

    const response = await requestByContract(app, contract, {
      body: { id: "9" },
      headers: { authorization: "token" },
    });

    expect(response.status).toBe(200);
  });

  it("builds a PATCH route", async () => {
    const contract = defineApiContract({
      method: "patch",
      requestBodySchema: REQUEST_BODY_SCHEMA,
      pathResolver: () => "/widget",
      responsesByStatusCode: { 200: RESPONSE_BODY_SCHEMA },
    });

    const app = new Hono();
    buildHonoRoute(app, contract, (c) => c.json({ name: "patched" }, 200));

    const response = await requestByContract(app, contract, { body: { id: "9" } });
    expect(await response.json()).toEqual({ name: "patched" });
  });

  it("builds a DELETE route returning ContractNoBody", async () => {
    const contract = defineApiContract({
      method: "delete",
      requestPathParamsSchema: PATH_PARAMS_SCHEMA,
      pathResolver: ({ userId }) => `/users/${userId}`,
      responsesByStatusCode: { 204: ContractNoBody },
    });

    const app = new Hono();
    buildHonoRoute(app, contract, (c) => c.body(null, 204));

    const response = await requestByContract(app, contract, { pathParams: { userId: "1" } });
    expect(response.status).toBe(204);
  });

  it("appends middleware returned by the metadata mapper", async () => {
    const contract = defineApiContract({
      method: "get",
      pathResolver: () => "/ping",
      metadata: { tag: "health" },
      responsesByStatusCode: { 200: RESPONSE_BODY_SCHEMA },
    });

    let seenMetadata: unknown;
    let middlewareRan = false;
    const app = new Hono();
    buildHonoRoute(app, contract, (c) => c.json({ name: "ok" }, 200), {
      contractMetadataToRouteMapper: (metadata) => {
        seenMetadata = metadata;
        return {
          middleware: [
            async (_c, next) => {
              middlewareRan = true;
              await next();
            },
          ],
        };
      },
    });

    const response = await requestByContract(app, contract, {});
    expect(seenMetadata).toEqual({ tag: "health" });
    expect(middlewareRan).toBe(true);
    expect(await response.json()).toEqual({ name: "ok" });
  });

  describe("validation failures", () => {
    const contract = defineApiContract({
      method: "post",
      requestBodySchema: REQUEST_BODY_SCHEMA,
      pathResolver: () => "/widget",
      responsesByStatusCode: { 200: RESPONSE_BODY_SCHEMA },
    });

    it("throws SchemaValidationError surfaced through app.onError by default", async () => {
      const app = new Hono();
      app.onError((error, c) => {
        if (error instanceof SchemaValidationError) {
          return c.json({ issues: error.issues.length }, 400);
        }
        return c.json({ unexpected: true }, 500);
      });
      buildHonoRoute(app, contract, (c) => c.json({ name: "ok" }, 200));

      const response = await app.request("/widget", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: 123 }),
      });

      expect(response.status).toBe(400);
    });

    it("routes failures to onValidationError when provided", async () => {
      const app = new Hono();
      buildHonoRoute(app, contract, (c) => c.json({ name: "ok" }, 200), {
        onValidationError: (error, c) => c.json({ handled: error.issues.length }, 422),
      });

      const response = await app.request("/widget", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: 123 }),
      });

      expect(response.status).toBe(422);
      expect(await response.json()).toEqual({ handled: 1 });
    });
  });
});
