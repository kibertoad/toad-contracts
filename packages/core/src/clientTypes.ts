import type { StandardSchemaV1 } from "@standard-schema/spec";
import type {
  ExpandStatusRangeKey,
  HttpStatusCode,
  HttpStatusCodeRange,
  SuccessfulHttpStatusCode,
  WildcardStatusCodeKey,
} from "./HttpStatusCodes.ts";
import type {
  BlobResponseHandle,
  ResponsesByStatusCode,
  SseSchemaByEventName,
} from "./contractResponse.ts";
import type { ApiContract } from "./defineApiContract.ts";
import type { ContractResponseMode, SseEventOf } from "./inferTypes.ts";
import type { InferSchemaInput, InferSchemaOutput } from "./schemaTypes.ts";
import type { Prettify } from "./typeUtils.ts";

export type HeadersParam<T> = T | (() => T) | (() => Promise<T>);

type ExtractRequestBody<T> = T extends { requestBodySchema: StandardSchemaV1 }
  ? T["requestBodySchema"]
  : undefined;

// streaming param: required for dual-mode, forbidden otherwise
type StreamingParam<T extends ResponsesByStatusCode, TIsStreaming extends boolean> =
  ContractResponseMode<T> extends "dual" ? { streaming: TIsStreaming } : { streaming?: never };

// SSE-only contracts default IsStreaming to true; everything else to false
export type DefaultStreaming<T extends ResponsesByStatusCode> =
  ContractResponseMode<T> extends "sse" ? true : false;

// No schema -> the key is optional and its value is `undefined`. A schema whose inferred input
// admits `undefined` (e.g. a top-level `optional(...)` or `unknown()`) -> the key is optional but
// carries the full inferred type, so callers can omit it instead of passing an explicit `undefined`.
// Otherwise the key is required.
type RequiredWhenDefined<T, TKey extends string, TExtra = T> = [T] extends [undefined]
  ? { [K in TKey]?: undefined }
  : undefined extends T
    ? { [K in TKey]?: TExtra }
    : { [K in TKey]: TExtra };

export type ClientRequestParams<
  TApiContract extends ApiContract,
  TIsStreaming extends boolean,
> = Prettify<
  StreamingParam<TApiContract["responsesByStatusCode"], TIsStreaming> &
    RequiredWhenDefined<InferSchemaInput<TApiContract["requestPathParamsSchema"]>, "pathParams"> &
    RequiredWhenDefined<InferSchemaInput<ExtractRequestBody<TApiContract>>, "body"> &
    RequiredWhenDefined<InferSchemaInput<TApiContract["requestQuerySchema"]>, "queryParams"> &
    RequiredWhenDefined<
      InferSchemaInput<TApiContract["requestHeaderSchema"]>,
      "headers",
      HeadersParam<InferSchemaInput<TApiContract["requestHeaderSchema"]>>
    > & { pathPrefix?: string }
>;

type InferClientResponseHeaders<TApiContract extends ApiContract> =
  TApiContract["responseHeaderSchema"] extends StandardSchemaV1
    ? Omit<Record<string, string>, keyof InferSchemaOutput<TApiContract["responseHeaderSchema"]>> &
        InferSchemaOutput<TApiContract["responseHeaderSchema"]>
    : Record<string, string>;

/**
 * Maps a bare-schema (JSON shorthand) responsesByStatusCode entry to its TypeScript body type.
 * Every other body kind — no-body, blob, SSE — is declared through a content-map entry.
 */
type InferClientResponseBody<T> = T extends StandardSchemaV1 ? InferSchemaOutput<T> : never;

/**
 * Structural shape every SSE event body shares (browser MessageEvent-aligned), used to split SSE
 * bodies from the rest. A blob body resolves to a non-iterable `BlobResponseHandle`, so SSE is the
 * only body that async-iterates event objects.
 */
type SseBodyShape = AsyncIterable<{ type: string; lastEventId: string }>;

/** The client-side body type a single content-map descriptor materializes into. */
type InferContentDescriptorBody<TDescriptor> = TDescriptor extends { _tag: "BlobBody" }
  ? BlobResponseHandle
  : TDescriptor extends { _tag: "SseBody"; schemaByEventName: infer S extends SseSchemaByEventName }
    ? AsyncIterable<SseEventOf<S>>
    : TDescriptor extends StandardSchemaV1
      ? InferSchemaOutput<TDescriptor>
      : never;

/**
 * Expands a content-map entry into one `{ body }` variant per declared media type, plus a
 * `{ body: null }` variant when the entry sets `allowNoBody`.
 */
type ContentEntryVariants<TEntry> =
  | (TEntry extends { content: infer C }
      ? { [CT in keyof C & string]: { body: InferContentDescriptorBody<C[CT]> } }[keyof C & string]
      : never)
  | (TEntry extends { allowNoBody: true } ? { body: null } : never);

type IsContentEntry<V> = V extends { content: object }
  ? true
  : V extends { allowNoBody: true }
    ? true
    : false;

type SseContentVariants<TEntry> = Extract<ContentEntryVariants<TEntry>, { body: SseBodyShape }>;
type NonSseContentVariants<TEntry> = Exclude<ContentEntryVariants<TEntry>, { body: SseBodyShape }>;

/** Response mode for a given status class: success codes filter by SSE/non-SSE; others pass all. */
type ResponseBodyMode = "sse" | "non-sse" | "all";

type ContentVariantsForMode<TEntry, TMode extends ResponseBodyMode> = TMode extends "sse"
  ? SseContentVariants<TEntry>
  : TMode extends "non-sse"
    ? NonSseContentVariants<TEntry>
    : ContentEntryVariants<TEntry>;

// A bare-schema entry is JSON by definition, so it contributes nothing in SSE mode and its body
// as-is in every other mode.
type JsonBodyForMode<V, TMode extends ResponseBodyMode> = TMode extends "sse"
  ? never
  : InferClientResponseBody<V>;

/** Attaches `statusCode` + `headers` to each `{ body }` variant, dropping `never` variants. */
type WithMeta<TStatusCode, THeaders, TVariant> = TVariant extends unknown
  ? Prettify<{ statusCode: TStatusCode; headers: THeaders } & TVariant>
  : never;

/**
 * Builds a `{ statusCode, headers, body }` discriminated-union member, collapsing to `never` (which
 * drops the member from the surrounding union) when the resolved body is itself `never`. This
 * happens for a non-SSE success code viewed in SSE mode, or an SSE-only success code viewed in
 * non-SSE mode, without which the member would survive with an unusable `body: never`.
 */
type JsonMember<TStatusCode, THeaders, TBody> = [TBody] extends [never]
  ? never
  : { statusCode: TStatusCode; headers: THeaders; body: TBody };

/**
 * Builds the response union member(s) for a status code holding entry `V`. A content-map entry
 * expands to one member per media type; a bare-schema entry yields the single JSON member.
 */
type ResponseMember<TStatusCode, THeaders, V, TMode extends ResponseBodyMode> =
  IsContentEntry<V> extends true
    ? WithMeta<TStatusCode, THeaders, ContentVariantsForMode<V, TMode>>
    : JsonMember<TStatusCode, THeaders, JsonBodyForMode<V, TMode>>;

// Exact status codes explicitly defined in the contract; these take precedence over range keys.
type ExactStatusCodes<TApiContract extends ApiContract> =
  keyof TApiContract["responsesByStatusCode"] & HttpStatusCode;

// Status codes covered by any range key (e.g. '2xx', '4xx') present in the contract.
// These take precedence over 'default'.
type RangeStatusCodes<TApiContract extends ApiContract> = {
  [K in keyof TApiContract["responsesByStatusCode"] & HttpStatusCodeRange]: ExpandStatusRangeKey<K>;
}[keyof TApiContract["responsesByStatusCode"] & HttpStatusCodeRange];

// Status codes that fall through to 'default', not claimed by any exact code or range key.
// Split into success/non-success so captureAsError typing stays accurate: success lands in
// Either.result, non-success lands in Either.error.
type DefaultSuccessStatusCodes<TApiContract extends ApiContract> = Exclude<
  SuccessfulHttpStatusCode,
  ExactStatusCodes<TApiContract> | RangeStatusCodes<TApiContract>
>;
type DefaultNonSuccessStatusCodes<TApiContract extends ApiContract> = Exclude<
  Exclude<HttpStatusCode, SuccessfulHttpStatusCode>,
  ExactStatusCodes<TApiContract> | RangeStatusCodes<TApiContract>
>;

type WildcardSseEntry<
  TApiContract extends ApiContract,
  K extends WildcardStatusCodeKey,
> = K extends "default"
  ?
      | ResponseMember<
          DefaultSuccessStatusCodes<TApiContract>,
          InferClientResponseHeaders<TApiContract>,
          NonNullable<TApiContract["responsesByStatusCode"][K]>,
          "sse"
        >
      | ResponseMember<
          DefaultNonSuccessStatusCodes<TApiContract>,
          InferClientResponseHeaders<TApiContract>,
          NonNullable<TApiContract["responsesByStatusCode"][K]>,
          "all"
        >
  : ResponseMember<
      Exclude<ExpandStatusRangeKey<K>, ExactStatusCodes<TApiContract>>,
      InferClientResponseHeaders<TApiContract>,
      NonNullable<TApiContract["responsesByStatusCode"][K]>,
      K extends "2xx" ? "sse" : "all"
    >;

type WildcardNonSseEntry<
  TApiContract extends ApiContract,
  K extends WildcardStatusCodeKey,
> = K extends "default"
  ?
      | ResponseMember<
          DefaultSuccessStatusCodes<TApiContract>,
          InferClientResponseHeaders<TApiContract>,
          NonNullable<TApiContract["responsesByStatusCode"][K]>,
          "non-sse"
        >
      | ResponseMember<
          DefaultNonSuccessStatusCodes<TApiContract>,
          InferClientResponseHeaders<TApiContract>,
          NonNullable<TApiContract["responsesByStatusCode"][K]>,
          "all"
        >
  : ResponseMember<
      Exclude<ExpandStatusRangeKey<K>, ExactStatusCodes<TApiContract>>,
      InferClientResponseHeaders<TApiContract>,
      NonNullable<TApiContract["responsesByStatusCode"][K]>,
      K extends "2xx" ? "non-sse" : "all"
    >;

/**
 * Infers a discriminated union of `{ statusCode, headers, body }` for SSE mode:
 * - exact success status codes and `'2xx'` range → SSE body only (AsyncIterable)
 * - error status codes, other ranges, and `'default'` → body as-is (all kinds)
 *
 * `'default'` is split into a success half (`SuccessfulHttpStatusCode`) and a non-success half
 * so that `captureAsError` type narrowing stays correct regardless of the actual status code.
 *
 * Headers are typed via `InferClientResponseHeaders`: known headers from `responseHeaderSchema`
 * are strongly typed; all other headers remain accessible as `string | undefined`.
 */
export type InferSseClientResponse<TApiContract extends ApiContract> =
  | {
      [K in keyof TApiContract["responsesByStatusCode"] & HttpStatusCode]: ResponseMember<
        K,
        InferClientResponseHeaders<TApiContract>,
        NonNullable<TApiContract["responsesByStatusCode"][K]>,
        K extends SuccessfulHttpStatusCode ? "sse" : "all"
      >;
    }[keyof TApiContract["responsesByStatusCode"] & HttpStatusCode]
  | {
      [K in keyof TApiContract["responsesByStatusCode"] & WildcardStatusCodeKey]: WildcardSseEntry<
        TApiContract,
        K
      >;
    }[keyof TApiContract["responsesByStatusCode"] & WildcardStatusCodeKey];

/**
 * Infers a discriminated union of `{ statusCode, headers, body }` for non-SSE mode:
 * - exact success status codes and `'2xx'` range → non-SSE body only (JSON / blob / null)
 * - error status codes, other ranges, and `'default'` → body as-is (all kinds)
 *
 * `'default'` is split into a success half (`SuccessfulHttpStatusCode`) and a non-success half
 * so that `captureAsError` type narrowing stays correct regardless of the actual status code.
 *
 * Headers are typed via `InferClientResponseHeaders`: known headers from `responseHeaderSchema`
 * are strongly typed; all other headers remain accessible as `string | undefined`.
 */
export type InferNonSseClientResponse<TApiContract extends ApiContract> =
  | {
      [K in keyof TApiContract["responsesByStatusCode"] & HttpStatusCode]: ResponseMember<
        K,
        InferClientResponseHeaders<TApiContract>,
        NonNullable<TApiContract["responsesByStatusCode"][K]>,
        K extends SuccessfulHttpStatusCode ? "non-sse" : "all"
      >;
    }[keyof TApiContract["responsesByStatusCode"] & HttpStatusCode]
  | {
      [K in keyof TApiContract["responsesByStatusCode"] &
        WildcardStatusCodeKey]: WildcardNonSseEntry<TApiContract, K>;
    }[keyof TApiContract["responsesByStatusCode"] & WildcardStatusCodeKey];
