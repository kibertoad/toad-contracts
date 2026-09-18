import type { StandardSchemaV1 } from "@standard-schema/spec";
import type {
  HttpStatusCode,
  HttpStatusCodeRange,
  WildcardStatusCodeKey,
} from "./HttpStatusCodes.ts";

export type ResponseOptions = {
  readonly description?: string;
};

/** Spreadable `description` fragment shared by every response factory. */
const descriptionPart = (options?: ResponseOptions): { description?: string } =>
  options?.description !== undefined ? { description: options.description } : {};

export type SseSchemaByEventName = Record<string, StandardSchemaV1>;

// ───────────────────────────────────────────────────────────────────────────
// Body descriptors
//
// A descriptor says how a body is carried, never which media type carries it:
// the media type is the key it sits under in a {@link ResponseContentMap}. A bare
// Standard Schema is a JSON body, so the common case stays free of ceremony.
// ───────────────────────────────────────────────────────────────────────────

/** Opaque binary body; the media type is supplied by the content-map key. */
export type BlobBody = {
  readonly _tag: "BlobBody";
};

export const blobBody = (): BlobBody => ({ _tag: "BlobBody" });

/** Server-Sent Events body; the media type is supplied by the content-map key. */
export type SseBody<T extends SseSchemaByEventName = SseSchemaByEventName> = {
  readonly _tag: "SseBody";
  readonly schemaByEventName: T;
};

export const sseBody = <T extends SseSchemaByEventName>(schemaByEventName: T): SseBody<T> => ({
  _tag: "SseBody",
  schemaByEventName,
});

/**
 * A value in a {@link ResponseContentMap}; the media type is the map key, so a
 * descriptor never carries a content type itself. A bare Standard Schema is JSON.
 */
export type BodyDescriptor = StandardSchemaV1 | BlobBody | SseBody;

/** Shared `_tag` discriminator check backing the descriptor predicates. */
const hasTag = (value: unknown, tag: string): boolean =>
  typeof value === "object" &&
  value !== null &&
  "_tag" in value &&
  (value as { _tag: unknown })._tag === tag;

export const isBlobBody = (value: BodyDescriptor): value is BlobBody => hasTag(value, "BlobBody");

export const isSseBody = (value: BodyDescriptor): value is SseBody => hasTag(value, "SseBody");

export const isJsonBody = (value: BodyDescriptor): value is StandardSchemaV1 =>
  typeof value === "object" && value !== null && !("_tag" in value);

/**
 * Lazy, single-consume accessor over a {@link blobResponse} body — the client-side value a blob
 * response resolves to. Mirrors the accessor surface of Fetch's `Response`/`Blob`, so one
 * descriptor covers every non-JSON body: decode it as text, buffer it, or stream it untouched.
 *
 * The underlying body is a one-shot stream: the first accessor you call consumes it; calling a
 * second throws. Pick one. Draining the body (any accessor except a lazy `stream()`, or `cancel()`)
 * is also what releases the connection — a handle you never touch keeps it open.
 */
export interface BlobResponseHandle {
  /** Raw stream, for piping/backpressure. You own draining or cancelling it. */
  stream(): ReadableStream<Uint8Array>;
  /** Buffer the whole body into a `Blob`. */
  blob(): Promise<Blob>;
  /** Buffer the whole body and decode it as UTF-8 text. */
  text(): Promise<string>;
  /** Buffer the whole body into an `ArrayBuffer`. */
  arrayBuffer(): Promise<ArrayBuffer>;
  /** Discard the body without materializing it, releasing the connection. */
  cancel(): Promise<void>;
}

// ───────────────────────────────────────────────────────────────────────────
// Response entries
//
// A status code maps either to a bare Standard Schema (the JSON shorthand) or to
// an OpenAPI-shaped `{ content }` entry keyed by media type. The content map lets a
// single status code expose several media types — including more than one JSON
// variant (e.g. `application/json` and `application/json+01`) — each disambiguated
// by an exact content-type match. A contract may freely mix both styles across
// status codes.
// ───────────────────────────────────────────────────────────────────────────

/** Commonly used response media types, offered as autocomplete suggestions. */
export type CommonResponseContentType =
  | "application/json"
  | "application/octet-stream"
  | "application/pdf"
  | "application/x-ndjson"
  | "application/xml"
  | "application/zip"
  | "audio/mpeg"
  | "audio/ogg"
  | "image/gif"
  | "image/jpeg"
  | "image/png"
  | "image/svg+xml"
  | "image/webp"
  | "text/csv"
  | "text/event-stream"
  | "text/html"
  | "text/plain"
  | "video/mp4"
  | "video/webm";

/**
 * A response media type. Common values are autocompleted; any other string
 * (e.g. a vendored variant like `application/json+01`) is accepted too.
 */
// oxlint-disable-next-line typescript/no-empty-object-type -- `string & {}` keeps literal autocomplete while accepting any string
export type ResponseContentType = CommonResponseContentType | (string & {});

/**
 * Maps a response media type (e.g. `application/json`) to the body it carries.
 * {@link CommonResponseContentType} keys are autocompleted; any other media type is accepted too.
 */
export type ResponseContentMap = Partial<Record<CommonResponseContentType, BodyDescriptor>> &
  Record<string, BodyDescriptor>;

/** A content-map response carrying a body for one or more media types. */
export type BodyContentResponseEntry = {
  readonly description?: string;
  readonly content: ResponseContentMap;
  readonly allowNoBody?: boolean;
};

/** A content-map response that never carries a body. */
export type NoBodyContentResponseEntry = {
  readonly description?: string;
  readonly content?: never;
  readonly allowNoBody: true;
};

/**
 * A content-map response entry. Either a body response (`content` required,
 * optionally `allowNoBody`) or a no-body response (`allowNoBody: true`, no
 * `content`). The union forces at least one of `content` / `allowNoBody`.
 */
export type ResponseEntry = BodyContentResponseEntry | NoBodyContentResponseEntry;

/** The JSON shorthand: a bare Standard Schema standing in for `application/json`. */
export type TypedJsonResponse = StandardSchemaV1;

export type ApiContractResponse = TypedJsonResponse;

export const isContentResponseEntry = (
  value: ApiContractResponse | ResponseEntry,
): value is ResponseEntry =>
  typeof value === "object" && value !== null && ("content" in value || "allowNoBody" in value);

export const isJsonResponse = (
  value: ApiContractResponse | ResponseEntry,
): value is TypedJsonResponse =>
  typeof value === "object" && value !== null && !isContentResponseEntry(value);

/**
 * Declares a no-body response (e.g. `204`).
 */
export const noBodyResponse = (options?: ResponseOptions): NoBodyContentResponseEntry => ({
  allowNoBody: true,
  ...descriptionPart(options),
});

/**
 * Declares an `application/json` response. Equivalent to using the schema directly as the
 * status code's value, but reachable when the response also needs a `description`.
 */
export const jsonResponse = <TSchema extends StandardSchemaV1>(
  schema: TSchema,
  options?: ResponseOptions,
) =>
  ({
    content: { "application/json": schema },
    ...descriptionPart(options),
  }) as const satisfies BodyContentResponseEntry;

/**
 * Declares a binary/opaque response for a single media type. The client materializes it as a
 * {@link BlobResponseHandle}, which decodes to text, a `Blob`, an `ArrayBuffer`, or a raw stream.
 */
export const blobResponse = <TContentType extends ResponseContentType>(
  contentType: TContentType,
  options?: ResponseOptions,
) =>
  ({
    // A computed property with a generic key widens to `{ [x: string]: ... }`, losing the literal
    // media type — assert the single-key record shape to keep `TContentType` in the entry type.
    content: { [contentType]: blobBody() } as { readonly [K in TContentType]: BlobBody },
    ...descriptionPart(options),
  }) as const satisfies BodyContentResponseEntry;

/**
 * Declares a Server-Sent Events response under `text/event-stream`.
 */
export const sseResponse = <T extends SseSchemaByEventName>(
  schemaByEventName: T,
  options?: ResponseOptions,
) =>
  ({
    content: { "text/event-stream": sseBody(schemaByEventName) },
    ...descriptionPart(options),
  }) as const satisfies BodyContentResponseEntry;

export type ResponsesByStatusCode = Partial<
  Record<HttpStatusCode | WildcardStatusCodeKey, ApiContractResponse | ResponseEntry>
>;

export type ResponseKind =
  | { kind: "noContent" }
  | { kind: "blob" }
  | { kind: "json"; schema: StandardSchemaV1 }
  | { kind: "sse"; schemaByEventName: SseSchemaByEventName };

/**
 * Extracts the lowercased media-type essence (the token before any `;` parameters) from a
 * content-type value, e.g. `'text/csv; charset=utf-8'` -> `'text/csv'`.
 */
const contentTypeEssence = (contentType: string): string => {
  const semicolon = contentType.indexOf(";");
  const essence = semicolon === -1 ? contentType : contentType.slice(0, semicolon);
  return essence.trim().toLowerCase();
};

/**
 * Matches the JSON media type, including structured `+json` suffixes such as
 * `application/problem+json` (RFC 7807) and `application/vnd.api+json` (JSON:API).
 */
const isJsonContentType = (essence: string): boolean =>
  essence === "application/json" || essence.endsWith("+json");

const descriptorToKind = (descriptor: BodyDescriptor): ResponseKind => {
  if (isBlobBody(descriptor)) {
    return { kind: "blob" };
  }
  if (isSseBody(descriptor)) {
    return { kind: "sse", schemaByEventName: descriptor.schemaByEventName };
  }
  return { kind: "json", schema: descriptor };
};

/**
 * Resolves a content-map {@link ResponseEntry}. Media types are matched by exact
 * (parameter-stripped, case-insensitive) equality, so e.g. `application/json` and
 * `application/json+01` stay distinct — a content map declares its variants explicitly,
 * so there is nothing to guess.
 */
const resolveContentEntry = (
  entry: ResponseEntry,
  contentType: string | undefined,
  strict: boolean,
): ResponseKind | null => {
  if (!entry.content) {
    return { kind: "noContent" };
  }

  const entries = Object.entries(entry.content);

  if (!contentType) {
    if (entry.allowNoBody) {
      return { kind: "noContent" };
    }
  } else {
    const target = contentTypeEssence(contentType);
    for (const [mediaType, descriptor] of entries) {
      if (contentTypeEssence(mediaType) === target) {
        return descriptorToKind(descriptor);
      }
    }
  }

  // No content-type (without allowNoBody), or no media type matched: in non-strict mode fall
  // back to the sole descriptor when the entry declares exactly one.
  const onlyDescriptor = entries.length === 1 ? entries[0]?.[1] : undefined;
  return !strict && onlyDescriptor ? descriptorToKind(onlyDescriptor) : null;
};

/**
 * Resolves a contract's response entry for a given status code into a concrete `ResponseKind`,
 * taking the response `content-type` into account.
 *
 * Returns `null` when the content-type cannot be matched to any entry in the contract,
 * indicating the response is unexpected and should be treated as an error by the caller.
 *
 * @param schemaEntry - The contract entry for the matched status code: a bare Standard Schema
 *   (the JSON shorthand) or a content-map entry (`noBodyResponse`, `jsonResponse`, `blobResponse`,
 *   `sseResponse`, or a hand-written `{ content }` map).
 * @param contentType - The `content-type` header value from the actual HTTP response,
 *   or `undefined` when the header is absent.
 * @param strict - When `true` (default), returns `null` if the `content-type` is absent or does
 *   not match the contract entry. When `false`, falls back to the entry's declared kind instead of
 *   returning `null` — only applies to entries declaring exactly one body.
 */
export const resolveContractResponse = (
  schemaEntry: ApiContractResponse | ResponseEntry,
  contentType: string | undefined,
  strict = true,
): ResponseKind | null => {
  if (isContentResponseEntry(schemaEntry)) {
    return resolveContentEntry(schemaEntry, contentType, strict);
  }

  // The bare-schema shorthand declares no media type of its own, only "this is JSON", so it
  // accepts any JSON media type — `application/json` and `+json` suffixes alike.
  if (!contentType) {
    return strict ? null : { kind: "json", schema: schemaEntry };
  }

  if (isJsonContentType(contentTypeEssence(contentType))) {
    return { kind: "json", schema: schemaEntry };
  }

  return strict ? null : { kind: "json", schema: schemaEntry };
};

function getRangeKey(statusCode: number): HttpStatusCodeRange | null {
  if (statusCode >= 100 && statusCode < 200) return "1xx";
  if (statusCode >= 200 && statusCode < 300) return "2xx";
  if (statusCode >= 300 && statusCode < 400) return "3xx";
  if (statusCode >= 400 && statusCode < 500) return "4xx";
  if (statusCode >= 500 && statusCode < 600) return "5xx";
  return null;
}

/**
 * Resolves the raw contract response entry for a concrete status code, before any content-type
 * resolution. Lookup precedence: exact code → range key (e.g. `'4xx'`) → `'default'`.
 * Returns `undefined` when no entry matches.
 */
export function resolveStatusEntry(
  responsesByStatusCode: ResponsesByStatusCode,
  statusCode: number,
): ApiContractResponse | ResponseEntry | undefined {
  const exactEntry = responsesByStatusCode[statusCode as HttpStatusCode];
  if (exactEntry) {
    return exactEntry;
  }

  const rangeKey = getRangeKey(statusCode);
  if (rangeKey) {
    const rangeEntry = responsesByStatusCode[rangeKey];
    if (rangeEntry) {
      return rangeEntry;
    }
  }

  return responsesByStatusCode.default;
}

/**
 * Combines status-code lookup and content-type resolution into a single call.
 * Lookup precedence: exact code → range key (e.g. `'4xx'`) → `'default'`.
 * Returns `null` when no entry matches or the content-type cannot be matched.
 */
export function resolveResponseEntry(
  responsesByStatusCode: ResponsesByStatusCode,
  statusCode: number,
  contentType: string | undefined,
  strictContentType: boolean,
): ResponseKind | null {
  const entry = resolveStatusEntry(responsesByStatusCode, statusCode);
  return entry ? resolveContractResponse(entry, contentType, strictContentType) : null;
}
