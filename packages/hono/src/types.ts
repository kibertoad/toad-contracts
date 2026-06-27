import type { StandardSchemaV1 } from "@standard-schema/spec";
import type {
  AnyOfResponses,
  ApiContract,
  ClientRequestParams,
  CommonRouteDefinitionMetadata,
  ExpandStatusRangeKey,
  InferSchemaInput,
  InferSchemaOutput,
  Prettify,
  TypedTextResponse,
  WildcardStatusCodeKey,
} from "@toad-contracts/core";
import type { SchemaValidationError } from "@toad-contracts/core";
import type { Context, Handler, Hono, MiddlewareHandler, TypedResponse } from "hono";
import type { BlankEnv, Env } from "hono/types";
import type { StatusCode } from "hono/utils/http-status";

/**
 * Any Hono app instance, regardless of its `Env`/`Schema`/`BasePath` generics. Route registration
 * is type-erased: the contract drives the handler types, not the app's own generics.
 */
// oxlint-disable-next-line typescript/no-explicit-any -- accept any Hono app instance
export type AnyHonoApp = Hono<any, any, any>;

/**
 * The request body schema of a contract, or `undefined` for GET/DELETE and `ContractNoBody`.
 * Mirrors the `ExtractRequestBody` helper in core's `clientTypes`.
 */
type ContractRequestBodySchema<TContract extends ApiContract> = TContract extends {
  requestBodySchema: StandardSchemaV1;
}
  ? TContract["requestBodySchema"]
  : undefined;

// Contributes `{ [key]: Infer<schema> }` when the schema is present, and the identity element
// `unknown` (collapsed away by the surrounding intersection) when it is absent. `Prettify<unknown>`
// resolves to `{}`, matching Hono's empty-input default.
type MaybeInput<TSchema, TKey extends string> = TSchema extends StandardSchemaV1
  ? { [K in TKey]: InferSchemaInput<TSchema> }
  : unknown;
type MaybeOutput<TSchema, TKey extends string> = TSchema extends StandardSchemaV1
  ? { [K in TKey]: InferSchemaOutput<TSchema> }
  : unknown;

/**
 * Builds Hono's `Input` shape (`{ in, out }`) from a contract, keyed by Hono validation target
 * (`param`/`query`/`header`/`json`). A key is present only when the contract declares the matching
 * request schema, so `c.req.valid('json')` is a type error on a contract without a request body.
 */
export type ContractInput<TContract extends ApiContract> = {
  in: Prettify<
    MaybeInput<TContract["requestPathParamsSchema"], "param"> &
      MaybeInput<TContract["requestQuerySchema"], "query"> &
      MaybeInput<TContract["requestHeaderSchema"], "header"> &
      MaybeInput<ContractRequestBodySchema<TContract>, "json">
  >;
  out: Prettify<
    MaybeOutput<TContract["requestPathParamsSchema"], "param"> &
      MaybeOutput<TContract["requestQuerySchema"], "query"> &
      MaybeOutput<TContract["requestHeaderSchema"], "header"> &
      MaybeOutput<ContractRequestBodySchema<TContract>, "json">
  >;
};

/**
 * Hono `Env` that exposes the contract on the context, so handlers and middleware can read it via
 * `c.get('apiContract')` (the Hono analog of fastify's `req.routeOptions.config.apiContract`).
 */
export type ContractEnv<TContract extends ApiContract = ApiContract> = {
  Variables: { apiContract: TContract };
};

// The concrete status code(s) a `responsesByStatusCode` key represents: an exact numeric key maps to
// itself; a wildcard range key (`'2xx'`, `'default'`, ...) expands to its union of codes.
type ResponseStatusFor<TKey> = TKey extends number
  ? TKey
  : TKey extends WildcardStatusCodeKey
    ? ExpandStatusRangeKey<TKey>
    : StatusCode;

// Maps a single response entry to the Hono return value(s) a handler may produce for it. JSON
// entries must be returned via `c.json(...)` (a `TypedResponse`); every non-JSON kind (no-body,
// text, blob, stream, SSE) is produced via `c.body`/`c.text`/streaming and typed as a raw `Response`.
type ResponseReturnFor<TStatus extends StatusCode, TEntry> = TEntry extends StandardSchemaV1
  ? TypedResponse<InferSchemaInput<TEntry>, TStatus, "json">
  : TEntry extends AnyOfResponses<infer TItem>
    ? ResponseReturnFor<TStatus, TItem>
    : TEntry extends TypedTextResponse
      ? TypedResponse<string, TStatus, "text"> | Response
      : Response;

/**
 * Union of allowed handler return values derived from the contract's `responsesByStatusCode`. For a
 * JSON-only contract this is a union of `TypedResponse`s, so `c.json(body, status)` is checked
 * against the declared body and status. Collapses to `Response` when the contract declares no
 * responses, keeping such handlers usable.
 */
export type ContractResponseUnion<TContract extends ApiContract> = {
  [K in keyof TContract["responsesByStatusCode"]]: ResponseReturnFor<
    ResponseStatusFor<K> & StatusCode,
    NonNullable<TContract["responsesByStatusCode"][K]>
  >;
}[keyof TContract["responsesByStatusCode"]];

type ContractResponseReturn<TContract extends ApiContract> = [
  ContractResponseUnion<TContract>,
] extends [never]
  ? Response
  : ContractResponseUnion<TContract>;

/**
 * The Hono `Env` of an app instance, recovered from its first generic. Used to flow a consuming app's
 * `Variables`/`Bindings` (e.g. `c.get('container')`) into a contract handler's context, on top of the
 * contract's own `apiContract` variable. Falls back to `BlankEnv` for a non-Hono type.
 */
export type EnvOf<TApp> = TApp extends Hono<infer E, infer _S, infer _B> ? E : BlankEnv;

/**
 * A Hono handler whose context is fully typed from the contract: `c.req.valid('param'|'query'|
 * 'header'|'json')` carry the parsed request data, `c.get('apiContract')` returns the contract, and
 * the return value is constrained to the contract's declared responses.
 *
 * The optional `TEnv` merges a consuming app's `Env` (its `Variables`/`Bindings`) into the context, so
 * `c.get(...)` also resolves the app's own variables. With the default `TEnv = BlankEnv` the context
 * is exactly `ContractEnv<TContract>` (`& {}` is the identity), keeping the single-argument form
 * fully backward compatible.
 */
export type HonoContractHandler<
  TContract extends ApiContract,
  TEnv extends Env = BlankEnv,
> = Handler<
  ContractEnv<TContract> & TEnv,
  string,
  ContractInput<TContract>,
  ContractResponseReturn<TContract> | Promise<ContractResponseReturn<TContract>>
>;

/**
 * Callback that maps a contract's metadata to extra Hono middleware appended to the route. The Hono
 * analog of fastify-api-contracts' `ApiContractMetadataToRouteMapper` (which returns extra route
 * options); Hono expresses route-level behavior as middleware.
 */
export type ContractMetadataToRouteMapper = (
  metadata: CommonRouteDefinitionMetadata | undefined,
) => { middleware?: MiddlewareHandler[] };

/** Called when a request fails contract validation, to produce a custom response. */
export type OnValidationError = (
  error: SchemaValidationError,
  c: Context,
) => Response | Promise<Response>;

/** Options for {@link buildHonoRoute}. */
export type BuildHonoRouteOptions = {
  /** Maps contract metadata to extra middleware appended after the validators. */
  contractMetadataToRouteMapper?: ContractMetadataToRouteMapper;
  /**
   * Handles a contract validation failure. When omitted, the validator throws the
   * `SchemaValidationError`, to be handled by the app's `onError`.
   */
  onValidationError?: OnValidationError;
};

/**
 * Parameters for {@link requestByContract}, derived from the contract: `pathParams`, `body`,
 * `queryParams`, `headers` (object or sync/async function) and optional `pathPrefix`, each required
 * only when the contract declares the matching request schema. Reuses the client's request-param
 * shape, minus the streaming selector.
 */
export type RequestByContractParams<TContract extends ApiContract> = Omit<
  ClientRequestParams<TContract, false>,
  "streaming"
>;
