import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * The capability, beyond Standard Schema, that message routing needs: read the literal string
 * declared at a field path so a message's type can be discovered from its schema at registration
 * time. The Standard Schema spec exposes no such introspection. Schema-library adapters implement
 * this on the schemas they produce (`@toad-contracts/zod` reads `.shape[...].value`,
 * `@toad-contracts/valibot` reads `.entries[...].literal`). This package depends only on the
 * interface and never on a concrete schema library, so the dependency is inverted: adapters satisfy
 * this contract, not the other way round. This is the message-side counterpart of core's
 * `ObjectKeysCarrier`.
 */
export interface MessageTypeCarrier {
  /**
   * The literal string declared at `fieldPath` (dot-notation, default `"type"`), or `undefined` when
   * the path is absent or the field is not a string literal.
   */
  readonly getMessageType: (fieldPath?: string) => string | undefined;
}

/** A message schema that can be routed by type: a Standard Schema that also carries the literal. */
export type RoutableMessageSchema = StandardSchemaV1 & MessageTypeCarrier;

/**
 * The slim message-side counterpart of an API contract: a consumer schema (the parsed/output side a
 * handler receives) and a publisher schema (the input side a producer sends) plus optional
 * documentation metadata. Both schemas carry {@link MessageTypeCarrier} so several message types can
 * be routed from a single container by reading the type literal out of each schema.
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
