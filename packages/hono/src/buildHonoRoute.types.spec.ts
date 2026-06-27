import { defineApiContract } from "@toad-contracts/core";
import { withObjectKeys } from "@toad-contracts/valibot";
import { Hono } from "hono";
import type { BlankEnv } from "hono/types";
import { object, string } from "valibot";
import { describe, expectTypeOf, it } from "vitest";
import { buildHonoRoute, buildHonoRouteHandler, honoContractRoutes } from "./buildHonoRoute.ts";
import type { AnyHonoApp, EnvOf, HonoContractHandler } from "./types.ts";

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

type ServerContainer = { db: string };
type SessionPayload = { id: string };
type AppEnv = { Variables: { container: ServerContainer; user?: SessionPayload } };

describe("env-aware contract handlers", () => {
  it("infers the app env so inline handlers get c.get('container'/'user') and c.get('apiContract')", () => {
    const app = new Hono<AppEnv>();
    buildHonoRoute(app, getContract, (c) => {
      expectTypeOf(c.get("container")).toEqualTypeOf<ServerContainer>();
      expectTypeOf(c.get("user")).toEqualTypeOf<SessionPayload | undefined>();
      expectTypeOf(c.get("apiContract")).toEqualTypeOf<typeof getContract>();
      return c.json({ name: "Frodo" }, 200);
    });
  });

  it("still types apiContract and rejects unknown keys on a plain app (backward compatible)", () => {
    const app = new Hono();
    buildHonoRoute(app, getContract, (c) => {
      expectTypeOf(c.get("apiContract")).toEqualTypeOf<typeof getContract>();
      // @ts-expect-error 'container' is not a variable on a plain Hono app
      c.get("container");
      return c.json({ name: "Frodo" }, 200);
    });
  });

  it("binds env for separately-defined handlers via the factory", () => {
    const { buildHonoRoute: build, buildHonoRouteHandler: typeHandler } =
      honoContractRoutes<AppEnv>();
    const handler = typeHandler(getContract, (c) => {
      expectTypeOf(c.get("container")).toEqualTypeOf<ServerContainer>();
      expectTypeOf(c.get("apiContract")).toEqualTypeOf<typeof getContract>();
      return c.json({ name: "Frodo" }, 200);
    });
    const app = new Hono<AppEnv>();
    build(app, getContract, handler);
  });

  it("rejects a default (BlankEnv) handler where an app env is required (invariance)", () => {
    const app = new Hono<AppEnv>();
    const blank = buildHonoRouteHandler(getContract, (c) => c.json({ name: "x" }, 200));
    // @ts-expect-error a BlankEnv handler is not assignable to an AppEnv-inferred route
    buildHonoRoute(app, getContract, blank);
  });

  it("recovers an app's env and falls back to BlankEnv for an any-typed app", () => {
    expectTypeOf<EnvOf<Hono<AppEnv>>>().toEqualTypeOf<AppEnv>();
    // AnyHonoApp is Hono<any, any, any>; EnvOf must not let `any` poison the handler env.
    expectTypeOf<EnvOf<AnyHonoApp>>().toEqualTypeOf<BlankEnv>();
  });

  it("keeps apiContract typed and rejects unknown keys on an any-typed app (no collapse to any)", () => {
    const app: AnyHonoApp = new Hono();
    buildHonoRoute(app, getContract, (c) => {
      expectTypeOf(c.get("apiContract")).toEqualTypeOf<typeof getContract>();
      // @ts-expect-error EnvOf<AnyHonoApp> falls back to BlankEnv, so 'container' is not a variable
      c.get("container");
      return c.json({ name: "Frodo" }, 200);
    });
  });
});
