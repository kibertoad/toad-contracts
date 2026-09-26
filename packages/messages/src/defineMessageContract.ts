import type { StandardJSONSchemaV1, StandardSchemaV1 } from "@standard-schema/spec";

/**
 * A message schema whose fields can be introspected: a Standard Schema that also implements Standard
 * JSON Schema. A routing container reads the declared field names with core's `getObjectKeys`, and
 * literal field values (such as a message-type discriminator) from the JSON Schema's `const`, with
 * no value in hand. zod (4.2+) and arktype (2.1.28+) schemas satisfy this directly; valibot schemas
 * need `toStandardJsonSchema` from `@toad-contracts/valibot`.
 */
export type RoutableMessageSchema = StandardSchemaV1 & StandardJSONSchemaV1;

/**
 * The slim message-side counterpart of an API contract: a consumer schema (the parsed/output side a
 * handler receives) and a publisher schema (the input side a producer sends) plus optional
 * documentation metadata. Both schemas implement Standard JSON Schema so a routing container can
 * enumerate each schema's declared field names.
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
