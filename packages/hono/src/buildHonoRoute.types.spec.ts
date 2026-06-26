import { defineApiContract } from "@toad-contracts/core";
import { withObjectKeys } from "@toad-contracts/valibot";
import { object, string } from "valibot";
import { describe, expectTypeOf, it } from "vitest";
import { buildHonoRouteHandler } from "./buildHonoRoute.ts";
import type { HonoContractHandler } from "./types.ts";

const RESPONSE_BODY_SCHEMA = object({ name: string() });
const REQUEST_BODY_SCHEMA = object({ id: string() });
const PATH_PARAMS_SCHEMA = withObjectKeys(object({ userId: string() }));
const HEADERS_SCHEMA = object({ authorization: string() });

const getContract = defineApiContract({
  method: "get",
  requestPathParamsSchema: PATH_PARAMS_SCHEMA,
  requestHeaderSchema: HEADERS_SCHEMA,
  pathResolver: ({ userId }) => `/users/${userId}`,
  responsesByStatusCode: { 200: RESPONSE_BODY_SCHEMA },
});

const postContract = defineApiContract({
  method: "post",
  requestBodySchema: REQUEST_BODY_SCHEMA,
  requestPathParamsSchema: PATH_PARAMS_SCHEMA,
  pathResolver: ({ userId }) => `/users/${userId}`,
  responsesByStatusCode: { 201: RESPONSE_BODY_SCHEMA },
});

describe("contract-derived handler types", () => {
  it("types c.req.valid(...) and c.get('apiContract') from the contract", () => {
    buildHonoRouteHandler(getContract, (c) => {
      expectTypeOf(c.req.valid("param")).toEqualTypeOf<{ userId: string }>();
      expectTypeOf(c.req.valid("header")).toEqualTypeOf<{ authorization: string }>();
      expectTypeOf(c.get("apiContract")).toEqualTypeOf<typeof getContract>();
      return c.json({ name: "Frodo" }, 200);
    });
  });

  it("exposes the request body to payload handlers", () => {
    buildHonoRouteHandler(postContract, (c) => {
      expectTypeOf(c.req.valid("json")).toEqualTypeOf<{ id: string }>();
      expectTypeOf(c.req.valid("param")).toEqualTypeOf<{ userId: string }>();
      return c.json({ name: "Sam" }, 201);
    });
  });

  it("forbids a body target on a GET contract", () => {
    buildHonoRouteHandler(getContract, (c) => {
      // @ts-expect-error 'json' is not a valid target: the GET contract declares no request body
      c.req.valid("json");
      return c.json({ name: "Frodo" }, 200);
    });
  });

  it("rejects a status code not declared in the contract", () => {
    // @ts-expect-error 201 is not a declared response status for getContract
    const handler: HonoContractHandler<typeof getContract> = (c) => c.json({ name: "x" }, 201);
    expectTypeOf(handler).toBeFunction();
  });

  it("rejects a response body that does not match the contract schema", () => {
    // @ts-expect-error response body must match RESPONSE_BODY_SCHEMA ({ name: string })
    const handler: HonoContractHandler<typeof getContract> = (c) => c.json({ wrong: true }, 200);
    expectTypeOf(handler).toBeFunction();
  });
});
