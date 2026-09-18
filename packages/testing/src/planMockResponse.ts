import type { StandardSchemaV1 } from "@standard-schema/spec";
import {
  type ApiContractResponse,
  contentTypeEssence,
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

const MOCK_BODY_KINDS: readonly MockBodyKind[] = ["json", "blob", "sse"];

/**
 * What a single contract response entry lets a mock serve. A content-map entry can offer several
 * of these at once; {@link selectMockBody} picks between them using the bodies the caller supplied.
 */
export type MockResponsePlan = {
  json?: MockJsonTarget;
  blob?: MockBlobTarget;
  sse?: MockSseTarget;
  /** The kind of the first declared media type, or `undefined` for a no-body-only entry. */
  primaryKind?: MockBodyKind;
  allowNoBody: boolean;
};

/** The body fields a mock helper receives, narrowed to what body selection needs. */
export type MockBodyParams = {
  responseJson?: unknown;
  responseBlob?: unknown;
  events?: unknown;
};

/**
 * Reduces a contract response entry to the bodies a mock can serve for it.
 *
 * `preferredContentType` narrows a content map to a single media type before picking, which is how
 * a caller disambiguates an entry declaring several variants of the same kind (e.g. both
 * `application/json` and `application/json+01`). It is matched the way response resolution matches
 * media types — parameters stripped, case-insensitive — and must name a media type the entry
 * declares, so a typo fails here instead of silently serving an empty body. Without it, the first
 * declared descriptor of each kind wins.
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

  if (!entry.content) {
    return plan;
  }

  const contentEntries = Object.entries(entry.content);
  const preferred =
    preferredContentType === undefined ? undefined : contentTypeEssence(preferredContentType);

  if (
    preferred !== undefined &&
    !contentEntries.some(([key]) => contentTypeEssence(key) === preferred)
  ) {
    throw new Error(
      `Content type '${preferredContentType}' is not declared for this response; declared media types: ${contentEntries
        .map(([key]) => key)
        .join(", ")}`,
    );
  }

  for (const [contentType, descriptor] of contentEntries) {
    if (preferred !== undefined && contentTypeEssence(contentType) !== preferred) {
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
 * The body a mock helper should serve for one `mockResponse` call: a single body, an empty
 * response, or `dual` — JSON and SSE on the same status code, answered per request by `accept`,
 * the way a real dual-mode route is.
 */
export type MockBodySelection =
  | { kind: "empty" }
  | { kind: "json"; json: MockJsonTarget }
  | { kind: "blob"; blob: MockBlobTarget }
  | { kind: "sse"; sse: MockSseTarget }
  | { kind: "dual"; json: MockJsonTarget; sse: MockSseTarget };

/**
 * Picks which of a plan's bodies to serve, from the bodies the caller actually supplied.
 *
 * An entry declaring several kinds does not mean the mock can serve all of them: with
 * `allowNoBody` every body field is optional, so a dual-mode entry may be mocked with JSON alone.
 * Selecting on what was supplied keeps such a mock serving that one body instead of failing on the
 * ones it was never given. When nothing was supplied, the first declared media type still wins, so
 * a missing required body surfaces as a schema validation error rather than a silent empty body.
 */
export function selectMockBody(plan: MockResponsePlan, params: MockBodyParams): MockBodySelection {
  if (mocksEmptyBody(plan, params)) {
    return { kind: "empty" };
  }

  const supplied: Record<MockBodyKind, boolean> = {
    json: plan.json !== undefined && params.responseJson !== undefined,
    blob: plan.blob !== undefined && params.responseBlob !== undefined,
    sse: plan.sse !== undefined && params.events !== undefined,
  };

  if (plan.json && plan.sse && supplied.json && supplied.sse && !supplied.blob) {
    return { kind: "dual", json: plan.json, sse: plan.sse };
  }

  // The primary kind wins when the caller supplied its body; otherwise the one body they did
  // supply, and failing that the primary kind, so its schema reports what is missing.
  const preferredOrder = plan.primaryKind
    ? [plan.primaryKind, ...MOCK_BODY_KINDS.filter((kind) => kind !== plan.primaryKind)]
    : MOCK_BODY_KINDS;
  const selected = preferredOrder.find((kind) => supplied[kind]) ?? plan.primaryKind;

  if (selected === "json" && plan.json) {
    return { kind: "json", json: plan.json };
  }
  if (selected === "blob" && plan.blob) {
    return { kind: "blob", blob: plan.blob };
  }
  if (selected === "sse" && plan.sse) {
    return { kind: "sse", sse: plan.sse };
  }

  return { kind: "empty" };
}

/**
 * True when an entry that permits an absent body was mocked without one, i.e. the caller is
 * mocking the empty response rather than any of the declared bodies.
 */
export const mocksEmptyBody = (plan: MockResponsePlan, params: MockBodyParams): boolean =>
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
