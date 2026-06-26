import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { SseSchemaByEventName } from "@toad-contracts/core";
import type { SseMockEvent } from "./types.ts";

/**
 * Validates a mock response body through a Standard Schema and returns the parsed output (unknown
 * properties stripped, transforms applied), mirroring valibot's `parse`. Replaces the
 * schema-library-specific `parse` call so the helpers stay vendor-neutral across any Standard
 * Schema implementation.
 *
 * The mock helpers buffer the body synchronously, so a schema whose validation resolves
 * asynchronously is unsupported and throws an actionable error instead of silently producing a
 * `[object Promise]` body.
 */
export function validateResponseBody(schema: StandardSchemaV1, value: unknown): unknown {
  const result = schema["~standard"].validate(value);

  if (result instanceof Promise) {
    throw new TypeError(
      "Standard Schema validation returned a Promise. The mock helpers require synchronous " +
        "validation; use a schema whose `~standard.validate` resolves synchronously.",
    );
  }

  if (result.issues) {
    throw new Error(
      `Mock response body does not satisfy the contract schema: ${JSON.stringify(result.issues)}`,
    );
  }

  return result.value;
}

/**
 * Validates a single SSE event against the contract's `schemaByEventName` and returns the event
 * with its `data` parsed (unknown properties stripped, transforms applied). Throws if the event
 * name is not declared in the contract or its data does not satisfy the matching schema, so SSE
 * payloads receive the same contract enforcement as JSON bodies.
 */
export function validateSseEvent(
  schemaByEventName: SseSchemaByEventName,
  event: SseMockEvent,
): SseMockEvent {
  const schema = schemaByEventName[event.event];

  if (!schema) {
    throw new Error(`Mock SSE event '${event.event}' is not declared in the contract's SSE schema`);
  }

  return { event: event.event, data: validateResponseBody(schema, event.data) };
}

/** Validates every SSE event in a list through {@link validateSseEvent}. */
export function validateSseEvents(
  schemaByEventName: SseSchemaByEventName,
  events: SseMockEvent[],
): SseMockEvent[] {
  return events.map((event) => validateSseEvent(schemaByEventName, event));
}
