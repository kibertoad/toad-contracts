import { type ApiContract, ContractNoBody } from "@toad-contracts/core";
import type { MiddlewareHandler } from "hono";
import { contractValidator } from "./honoContractValidator.ts";
import type { AnyHonoApp, BuildHonoRouteOptions, HonoContractHandler } from "./types.ts";

/**
 * Derives the Hono route path from a contract by invoking its `pathResolver` with a `Proxy` that
 * returns a `:key` placeholder for each accessed param, e.g. turning `(p) => `/users/${p.userId}``
 * into `/users/:userId`. Runs once per route at registration, so it adds no per-request cost.
 *
 * Assumes `pathResolver` interpolates param values directly (the same assumption core's
 * `mapApiContractToPath` makes); a resolver that transforms a value (e.g. `encodeURIComponent`)
 * would corrupt the placeholder.
 */
export const honoPathFromContract = (contract: ApiContract): string => {
  if (!contract.requestPathParamsSchema) {
    return contract.pathResolver(undefined);
  }

  const placeholders = new Proxy({}, { get: (_target, prop) => `:${String(prop)}` }) as Record<
    string,
    string
  >;

  return contract.pathResolver(placeholders);
};

/**
 * Mounts a contract on a Hono app as a fully typed, self-validating route. The HTTP method and path
 * are derived from the contract; one validator middleware is wired per declared request schema
 * (path params, query, headers, body); and the contract is exposed on the context via
 * `c.get('apiContract')`. The handler's `c.req.valid(...)` types and return type are inferred from
 * the contract.
 *
 * Request validation failures throw a `SchemaValidationError` by default (handle them in the app's
 * `onError`), or are routed to `options.onValidationError` when provided.
 *
 * @param app - The Hono app to register the route on. Returned for chaining.
 * @param contract - A contract created with `defineApiContract`.
 * @param handler - The route handler, typed from the contract.
 * @param options - Optional metadata-to-middleware mapper and validation-error handler.
 */
export function buildHonoRoute<TApp extends AnyHonoApp, const TContract extends ApiContract>(
  app: TApp,
  contract: TContract,
  handler: HonoContractHandler<TContract>,
  options: BuildHonoRouteOptions = {},
): TApp {
  const path = honoPathFromContract(contract);

  const middleware: MiddlewareHandler[] = [
    async (c, next) => {
      c.set("apiContract", contract);
      await next();
    },
  ];

  if (contract.requestPathParamsSchema) {
    middleware.push(
      contractValidator("param", contract.requestPathParamsSchema, options.onValidationError),
    );
  }
  if (contract.requestQuerySchema) {
    middleware.push(
      contractValidator("query", contract.requestQuerySchema, options.onValidationError),
    );
  }
  if (contract.requestHeaderSchema) {
    middleware.push(
      contractValidator("header", contract.requestHeaderSchema, options.onValidationError),
    );
  }
  if (contract.requestBodySchema && contract.requestBodySchema !== ContractNoBody) {
    middleware.push(
      contractValidator("json", contract.requestBodySchema, options.onValidationError),
    );
  }

  const extra = options.contractMetadataToRouteMapper?.(contract.metadata);
  if (extra?.middleware) {
    middleware.push(...extra.middleware);
  }

  // Hono's `on` overloads expect fixed-arity handler tuples, so a spread of our dynamically built
  // middleware list does not match them. Register through an explicit loose signature: the route's
  // types come from the contract-typed `handler` param, not from this call.
  const register = app.on as unknown as (
    method: string,
    path: string,
    ...handlers: MiddlewareHandler[]
  ) => void;
  register(
    contract.method.toUpperCase(),
    path,
    ...middleware,
    handler as unknown as MiddlewareHandler,
  );

  return app;
}

/**
 * Types a handler from a contract without registering it, so handlers can be defined separately from
 * the route and passed to {@link buildHonoRoute}. The Hono analog of fastify-api-contracts'
 * `buildFastifyApiRouteHandler`.
 */
export function buildHonoRouteHandler<const TContract extends ApiContract>(
  _contract: TContract,
  handler: HonoContractHandler<TContract>,
): HonoContractHandler<TContract> {
  return handler;
}
