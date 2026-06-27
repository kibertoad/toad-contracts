import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { StandardObjectKeysV1 } from "@toad-contracts/core";

/**
 * A message schema whose fields can be introspected: a Standard Schema that also carries the shared
 * {@link StandardObjectKeysV1} surface. This is the same single object-key extension API contracts
 * use for path-param mapping — message routing reuses it to read a schema's declared field *names*
 * with no value in hand (field projection, routing-/partition-key derivation, partial-update
 * payloads, field-to-header mapping), so every adapter implements one introspection surface rather
 * than a message-specific one. The Standard Schema spec exposes no such introspection; schema-library
 * adapters implement it on the schemas they produce (`@toad-contracts/valibot` and
 * `@toad-contracts/zod` both ship `withObjectKeys`). This package depends only on the interface and
 * never on a concrete schema library, so the dependency is inverted: adapters satisfy this contract,
 * not the other way round.
 */
export type RoutableMessageSchema = StandardSchemaV1 & StandardObjectKeysV1;

/**
 * The slim message-side counterpart of an API contract: a consumer schema (the parsed/output side a
 * handler receives) and a publisher schema (the input side a producer sends) plus optional
 * documentation metadata. Both schemas carry the shared {@link StandardObjectKeysV1} surface so a
 * routing container can enumerate each schema's declared field names from a single introspection
 * surface.
 *
 * Unlike `ApiContract` this has no HTTP verb, path resolver, or status-code response map; a message
 * needs none of those.
 */
export type MessageContract<
  TConsumer extends RoutableMessageSchema = RoutableMessageSchema,
  TPublisher extends RoutableMessageSchema = RoutableMessageSchema,
> = {
  consumerSchema: TConsumer;
  publisherSchema: TPublisher;
  schemaVersion?: string;
  producedBy?: readonly string[];
  domain?: string;
  tags?: readonly string[];
};

/** The type a consumer receives: the output of the consumer schema (after parsing). */
export type InferConsumerMessage<T extends MessageContract> = StandardSchemaV1.InferOutput<
  T["consumerSchema"]
>;

/** The type a publisher sends: the input of the publisher schema (before parsing). */
export type InferPublisherMessage<T extends MessageContract> = StandardSchemaV1.InferInput<
  T["publisherSchema"]
>;

/**
 * Identity helper that preserves a contract's literal type for inference, mirroring core's
 * `defineApiContract`. Returns its argument unchanged at runtime.
 */
export const defineMessageContract = <const T extends MessageContract>(contract: T): T => contract;
