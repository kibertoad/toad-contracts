import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { SuccessfulHttpStatusCode } from "./HttpStatusCodes.ts";
import type {
  BlobResponseHandle,
  ResponseEntry,
  ResponsesByStatusCode,
  SseSchemaByEventName,
} from "./contractResponse.ts";
import type { ValueOf } from "./typeUtils.ts";

type ExtractSuccessResponses<T extends ResponsesByStatusCode> = ValueOf<
  T,
  Extract<keyof T, SuccessfulHttpStatusCode | "2xx" | "default">
>;

// The body descriptors a content-map entry contributes: each media type's descriptor
// (a Standard Schema for JSON, `BlobBody`, or `SseBody`), plus `{ allowNoBody: true }` when set.
type FlatContentSuccessResponses<TEntry> =
  | (TEntry extends { content: infer TContent } ? TContent[keyof TContent] : never)
  | (TEntry extends { allowNoBody: true } ? { allowNoBody: true } : never);

/**
 * Flattens every success response into the union of bodies it can carry: bare-schema (JSON
 * shorthand) entries pass through, content-map entries expand to one member per media type.
 */
type FlatSuccessResponses<T extends ResponsesByStatusCode> =
  | Exclude<ExtractSuccessResponses<T>, ResponseEntry>
  | FlatContentSuccessResponses<Extract<ExtractSuccessResponses<T>, ResponseEntry>>;

// `infer S extends SseSchemaByEventName` keeps the inferred map assignable to SseSchemaByEventName
// for callers that constrain on it, instead of widening to `unknown` behind a type parameter.
type SseSchemaOf<T> = T extends {
  _tag: "SseBody";
  schemaByEventName: infer S extends SseSchemaByEventName;
}
  ? S
  : never;

/**
 * Extracts the merged SSE event schema map from a responsesByStatusCode map.
 * Returns the union of all `schemaByEventName` objects from SSE responses (content-map
 * `sseBody` descriptors).
 */
export type InferSseSuccessResponses<T extends ResponsesByStatusCode> = SseSchemaOf<
  FlatSuccessResponses<T>
>;

/**
 * Returns true if any success status code entry is a JSON Standard Schema
 * (a bare schema or a content-map JSON descriptor).
 */
export type HasAnyJsonSuccessResponse<T extends ResponsesByStatusCode> =
  Extract<FlatSuccessResponses<T>, StandardSchemaV1> extends never ? false : true;

type JsonSchemaOf<T> = T extends StandardSchemaV1 ? T : never;

/**
 * Extracts the union of JSON Standard Schemas from all success responses.
 * Blob and SSE responses are excluded.
 */
export type InferJsonSuccessResponses<T extends ResponsesByStatusCode> = JsonSchemaOf<
  FlatSuccessResponses<T>
>;

type NonSseBodyOf<T> = T extends { _tag: "SseBody" }
  ? never
  : T extends { _tag: "BlobBody" }
    ? BlobResponseHandle
    : T extends StandardSchemaV1
      ? StandardSchemaV1.InferOutput<T>
      : undefined;

/**
 * Infers the TypeScript output type of all non-SSE success responses.
 * JSON schemas → InferOutput<T>. A blob entry → BlobResponseHandle. A no-body entry → undefined.
 * An SSE entry → never (excluded). Content-map entries are unpacked before mapping.
 */
export type InferNonSseSuccessResponses<T extends ResponsesByStatusCode> = NonSseBodyOf<
  FlatSuccessResponses<T>
>;

/**
 * Discriminated union of SSE events inferred from a schemaByEventName map.
 * Aligns with the browser MessageEvent shape.
 */
export type SseEventOf<S> = {
  [K in keyof S]: K extends string
    ? {
        type: K;
        data: S[K] extends StandardSchemaV1 ? StandardSchemaV1.InferOutput<S[K]> : never;
        lastEventId: string;
        retry: number | undefined;
      }
    : never;
}[keyof S];

/**
 * Returns true if any success status code entry is an SSE response
 * (a content-map `sseBody` descriptor).
 */
export type HasAnySseSuccessResponse<T extends ResponsesByStatusCode> =
  Extract<FlatSuccessResponses<T>, { _tag: "SseBody" }> extends never ? false : true;

/**
 * Returns true if any success status code entry has a non-SSE response
 * (JSON, blob, or no-body). Mirrors HasAnySseSuccessResponse.
 */
export type HasAnyNonSseSuccessResponse<T extends ResponsesByStatusCode> =
  Exclude<FlatSuccessResponses<T>, { _tag: "SseBody" }> extends never ? false : true;

/**
 * Classifies a contract's response mode into one of three cases:
 * - 'dual': SSE + non-SSE success responses; caller chooses via streaming param
 * - 'sse': SSE-only success responses; always streams
 * - 'non-sse': JSON / blob / no-body; never streams
 */
export type ContractResponseMode<T extends ResponsesByStatusCode> =
  HasAnySseSuccessResponse<T> extends true
    ? HasAnyNonSseSuccessResponse<T> extends true
      ? "dual"
      : "sse"
    : "non-sse";

/**
 * Union of response mode literals available for a given responsesByStatusCode map.
 */
export type AvailableResponseModes<T extends ResponsesByStatusCode> =
  | (HasAnyJsonSuccessResponse<T> extends true ? "json" : never)
  | (HasAnySseSuccessResponse<T> extends true ? "sse" : never)
  | (Extract<FlatSuccessResponses<T>, { _tag: "BlobBody" }> extends never ? never : "blob")
  | (Extract<FlatSuccessResponses<T>, { allowNoBody: true }> extends never ? never : "noContent");
