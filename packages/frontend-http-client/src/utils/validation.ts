// Re-exports the vendor-neutral Standard Schema validation helpers from core so request, response,
// SSE event, and response-header validation all share one implementation.
export { SchemaValidationError, validate } from "@toad-contracts/core";
