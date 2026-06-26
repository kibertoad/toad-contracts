import { defineApiContract } from "@toad-contracts/core";
import { withObjectKeys } from "@toad-contracts/valibot";
import { Hono } from "hono";
import { array, object, optional, string } from "valibot";
import { describe, expect, it } from "vitest";
import { buildHonoRoute } from "./buildHonoRoute.ts";
import { requestByContract } from "./requestByContract.ts";

const RESPONSE_BODY_SCHEMA = object({ ok: string() });

describe("requestByContract", () => {
  it("builds path, query (incl. arrays) and forwards them to the app", async () => {
    const contract = defineApiContract({
      method: "get",
      requestPathParamsSchema: withObjectKeys(object({ userId: string() })),
      requestQuerySchema: object({ tags: optional(array(string())), q: optional(string()) }),
      pathResolver: ({ userId }) => `/users/${userId}`,
      responsesByStatusCode: { 200: RESPONSE_BODY_SCHEMA },
    });

    const app = new Hono();
    buildHonoRoute(app, contract, (c) => {
      const query = c.req.valid("query");
      return c.json(
        { ok: `${c.req.valid("param").userId}:${query.tags?.join(",")}:${query.q}` },
        200,
      );
    });

    const response = await requestByContract(app, contract, {
      pathParams: { userId: "7" },
      queryParams: { tags: ["x", "y"], q: "find" },
    });

    expect(await response.json()).toEqual({ ok: "7:x,y:find" });
  });

  it("prepends pathPrefix to the resolved path", async () => {
    const contract = defineApiContract({
      method: "get",
      pathResolver: () => "/ping",
      responsesByStatusCode: { 200: RESPONSE_BODY_SCHEMA },
    });

    const app = new Hono();
    app.get("/api/ping", (c) => c.json({ ok: "prefixed" }, 200));

    const response = await requestByContract(app, contract, { pathPrefix: "/api" });
    expect(await response.json()).toEqual({ ok: "prefixed" });
  });

  it("accepts headers as a plain object and as a sync/async function", async () => {
    const contract = defineApiContract({
      method: "get",
      requestHeaderSchema: object({ authorization: string() }),
      pathResolver: () => "/secure",
      responsesByStatusCode: { 200: RESPONSE_BODY_SCHEMA },
    });

    const app = new Hono();
    buildHonoRoute(app, contract, (c) => c.json({ ok: c.req.valid("header").authorization }, 200));

    const objectResponse = await requestByContract(app, contract, {
      headers: { authorization: "plain" },
    });
    expect(await objectResponse.json()).toEqual({ ok: "plain" });

    const asyncResponse = await requestByContract(app, contract, {
      headers: () => Promise.resolve({ authorization: "async" }),
    });
    expect(await asyncResponse.json()).toEqual({ ok: "async" });
  });

  it("sends a string body verbatim without forcing a JSON content-type", async () => {
    const contract = defineApiContract({
      method: "post",
      requestBodySchema: string(),
      requestHeaderSchema: object({ "content-type": string() }),
      pathResolver: () => "/raw",
      responsesByStatusCode: { 200: RESPONSE_BODY_SCHEMA },
    });

    const app = new Hono();
    app.post("/raw", async (c) => c.json({ ok: await c.req.text() }, 200));

    const response = await requestByContract(app, contract, {
      body: "hello",
      headers: { "content-type": "text/plain" },
    });
    expect(await response.json()).toEqual({ ok: "hello" });
  });
});
