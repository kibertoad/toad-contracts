import type { StandardSchemaV1 } from "@standard-schema/spec";
import type {
  ApiContract,
  ExpandStatusRangeKey,
  HttpStatusCode,
  InferSchemaInput,
  RequestPathParamsSchema,
  ResponseContentType,
  SseSchemaByEventName,
  WildcardStatusCodeKey,
} from "@toad-contracts/core";

/** A single SSE event to emit, as accepted by the mock helpers before schema validation. */
export type SseMockEvent = { event: string; data: unknown };

/**
 * Type-safe SSE event union derived from a contract's `schemaByEventName` map.
 * Each event name is paired with the input type of its Standard Schema.
 */
export type SseMockEventInput<S extends SseSchemaByEventName> = {
  [K in keyof S & string]: { event: K; data: StandardSchemaV1.InferInput<NonNullable<S[K]>> };
}[keyof S & string];

/**
 * Serializes a list of SSE events into a `text/event-stream` body. Each event becomes an
 * `event:`/`data:` pair terminated by a blank line, matching the SSE wire format. The trailing
 * blank line after the final event is required: a spec-compliant client discards a trailing event
 * that is not terminated by a blank line.
 *
 * @example
 * formatSseResponse([{ event: 'completed', data: { totalCount: 1 } }])
 * // "event: completed\ndata: {\"totalCount\":1}\n\n"
 */
export function formatSseResponse(events: SseMockEvent[]): string {
  return events
    .map(({ event, data }) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    .join("");
}

// The JSON bodies a content map declares. Several JSON media types on one status code contribute
// a union of input types; `contentType` picks which one the mock actually serves.
type JsonBodyParam<TContent> =
  Extract<TContent[keyof TContent], StandardSchemaV1> extends never
    ? object
    : {
        responseJson: StandardSchemaV1.InferInput<
          Extract<TContent[keyof TContent], StandardSchemaV1>
        >;
      };

// An opaque body is mocked verbatim: the helpers send the value as-is under the declared media type.
type BlobBodyParam<TContent> = [Extract<TContent[keyof TContent], { _tag: "BlobBody" }>] extends [
  never,
]
  ? object
  : { responseBlob: string | Uint8Array };

type SseBodyParam<TContent> = [Extract<TContent[keyof TContent], { _tag: "SseBody" }>] extends [
  never,
]
  ? object
  : Extract<TContent[keyof TContent], { _tag: "SseBody" }> extends {
        schemaByEventName: infer S extends SseSchemaByEventName;
      }
    ? { events: SseMockEventInput<S>[] }
    : object;

type ContentBodyParam<TContent> = JsonBodyParam<TContent> &
  BlobBodyParam<TContent> &
  SseBodyParam<TContent>;

// Maps a single responsesByStatusCode entry to the body field(s) the mock needs:
// content map              → one field per declared body kind (all optional with allowNoBody)
// allowNoBody-only entry   → no required body field
// bare Standard Schema     → { responseJson }
// A content map declaring both JSON and SSE asks for both fields, and the mock answers by `accept`,
// the way the real dual-mode route does.
type InferBodyParam<T> = T extends { content: infer TContent }
  ? // An entry that also allows an absent body accepts either: omit every body field to mock the
    // empty response, or supply one to mock the body.
    T extends { allowNoBody: true }
    ? Partial<ContentBodyParam<TContent>>
    : ContentBodyParam<TContent>
  : T extends { allowNoBody: true }
    ? { responseJson?: null }
    : T extends StandardSchemaV1
      ? { responseJson: StandardSchemaV1.InferInput<T> }
      : object;

type ExactStatusCodePairs<TContract extends ApiContract> = {
  [K in keyof TContract["responsesByStatusCode"] & HttpStatusCode]: {
    responseStatus: K;
  } & InferBodyParam<NonNullable<TContract["responsesByStatusCode"][K]>>;
}[keyof TContract["responsesByStatusCode"] & HttpStatusCode];

type RangeStatusCodePairs<TContract extends ApiContract> = {
  [K in keyof TContract["responsesByStatusCode"] & WildcardStatusCodeKey]: {
    responseStatus: Exclude<
      ExpandStatusRangeKey<K>,
      keyof TContract["responsesByStatusCode"] & HttpStatusCode
    >;
  } & InferBodyParam<NonNullable<TContract["responsesByStatusCode"][K]>>;
}[keyof TContract["responsesByStatusCode"] & WildcardStatusCodeKey];

type StatusCodeBodyPair<TContract extends ApiContract> =
  | ExactStatusCodePairs<TContract>
  | RangeStatusCodePairs<TContract>;

type PathParamsField<TContract extends ApiContract> =
  TContract["requestPathParamsSchema"] extends RequestPathParamsSchema
    ? { pathParams: InferSchemaInput<TContract["requestPathParamsSchema"]> }
    : { pathParams?: never };

/**
 * Parameters accepted by `mockResponse`, derived from a contract. A discriminated union on
 * `responseStatus`: each concrete status code (or wildcard range) carries exactly the body fields
 * its declared response kind requires.
 *
 * `contentType` narrows a status code declaring several variants of one kind (e.g. both
 * `application/json` and `application/json+01`) to the single media type the mock should serve.
 * Without it, the first declared media type of each kind wins.
 */
export type MockResponseParams<TContract extends ApiContract> = PathParamsField<TContract> & {
  contentType?: ResponseContentType;
} & StatusCodeBodyPair<TContract>;
