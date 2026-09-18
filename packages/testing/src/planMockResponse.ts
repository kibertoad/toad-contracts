import type { StandardSchemaV1 } from "@standard-schema/spec";
import {
  type ApiContractResponse,
  isBlobBody,
  isContentResponseEntry,
  isJsonBody,
  isSseBody,
  type ResponseEntry,
  type SseSchemaByEventName,
} from "@toad-contracts/core";

/** The JSON body a mock can serve for a status code, with the media type to send it under. */
export type MockJsonTarget = { contentType: string; schema: StandardSchemaV1 };

/** The opaque body a mock can serve for a status code, with the media type to send it under. */
export type MockBlobTarget = { contentType: string };

/** The SSE stream a mock can serve for a status code. */
export type MockSseTarget = { schemaByEventName: SseSchemaByEventName };

/** The body kinds a mock can serve, matching the descriptor kinds a content map may declare. */
export type MockBodyKind = "json" | "blob" | "sse";

/**
 * What a single contract response entry lets a mock serve. A content-map entry can offer several
 * of these at once: JSON and SSE together are answered by the request's `accept` header, the way a
 * real dual-mode route is; any other combination is served as `primaryKind`, the kind whose media
 * type the contract declares first.
 */
export type MockResponsePlan = {
  json?: MockJsonTarget;
  blob?: MockBlobTarget;
  sse?: MockSseTarget;
  /** The kind of the first declared media type, or `undefined` for a no-body-only entry. */
  primaryKind?: MockBodyKind;
  allowNoBody: boolean;
};

/**
 * Reduces a contract response entry to the bodies a mock can serve for it.
 *
 * `preferredContentType` narrows a content map to a single media type before picking, which is how
 * a caller disambiguates an entry declaring several variants of the same kind (e.g. both
 * `application/json` and `application/json+01`). Without it, the first declared descriptor of each
 * kind wins.
 */
export function planMockResponse(
  entry: ApiContractResponse | ResponseEntry,
  preferredContentType?: string,
): MockResponsePlan {
  if (!isContentResponseEntry(entry)) {
    return {
      json: { contentType: "application/json", schema: entry },
      primaryKind: "json",
      allowNoBody: false,
    };
  }

  const plan: MockResponsePlan = { allowNoBody: entry.allowNoBody === true || !entry.content };

  for (const [contentType, descriptor] of Object.entries(entry.content ?? {})) {
    if (preferredContentType !== undefined && contentType !== preferredContentType) {
      continue;
    }

    let kind: MockBodyKind | undefined;

    if (!plan.json && isJsonBody(descriptor)) {
      plan.json = { contentType, schema: descriptor };
      kind = "json";
    } else if (!plan.blob && isBlobBody(descriptor)) {
      plan.blob = { contentType };
      kind = "blob";
    } else if (!plan.sse && isSseBody(descriptor)) {
      plan.sse = { schemaByEventName: descriptor.schemaByEventName };
      kind = "sse";
    }

    plan.primaryKind ??= kind;
  }

  return plan;
}

/**
 * True when an entry that permits an absent body was mocked without one, i.e. the caller is
 * mocking the empty response rather than any of the declared bodies.
 */
export const mocksEmptyBody = (
  plan: MockResponsePlan,
  params: { responseJson?: unknown; responseBlob?: unknown; events?: unknown },
): boolean =>
  plan.allowNoBody &&
  params.responseJson === undefined &&
  params.responseBlob === undefined &&
  params.events === undefined;

/**
 * True when the request asks for an SSE stream. Accepts the repeated-header array shape some
 * servers hand back alongside the usual single value.
 */
export const acceptsSse = (acceptHeader: string | readonly string[] | undefined): boolean =>
  (Array.isArray(acceptHeader) ? acceptHeader.join(",") : (acceptHeader as string) || "").includes(
    "text/event-stream",
  );
