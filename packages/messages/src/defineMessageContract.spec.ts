import type { StandardSchemaV1 } from "@standard-schema/spec";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  defineMessageContract,
  type InferConsumerMessage,
  type InferPublisherMessage,
  type MessageContract,
  type MessageTypeCarrier,
  type RoutableMessageSchema,
} from "./defineMessageContract.ts";

/**
 * A hand-rolled {@link RoutableMessageSchema} so this package can be tested without depending on any
 * schema library. `Input`/`Output` drive the inference helpers; `type` drives the carrier.
 */
const makeSchema = <Input, Output = Input>(
  type?: string,
): StandardSchemaV1<Input, Output> & MessageTypeCarrier =>
  Object.assign(
    {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: (value: unknown) => ({ value: value as Output }),
      },
    } satisfies StandardSchemaV1<Input, Output>,
    {
      getMessageType: (fieldPath = "type"): string | undefined =>
        fieldPath === "type" ? type : undefined,
    },
  );

describe("defineMessageContract", () => {
  it("returns the contract unchanged at runtime", () => {
    const consumerSchema = makeSchema<{ type: "user.created" }>("user.created");
    const publisherSchema = makeSchema<{ type: "user.created" }>("user.created");
    const contract = { consumerSchema, publisherSchema, domain: "users" } satisfies MessageContract;

    expect(defineMessageContract(contract)).toBe(contract);
  });

  it("preserves the consumer output and publisher input types for inference", () => {
    const contract = defineMessageContract({
      // consumer side: parsed output a handler receives
      consumerSchema: makeSchema<{ id?: string }, { id: string; type: "user.created" }>(
        "user.created",
      ),
      // publisher side: input a producer sends (id optional before parsing)
      publisherSchema: makeSchema<{ id?: string; type: "user.created" }>("user.created"),
    });

    expectTypeOf<InferConsumerMessage<typeof contract>>().toEqualTypeOf<{
      id: string;
      type: "user.created";
    }>();
    expectTypeOf<InferPublisherMessage<typeof contract>>().toEqualTypeOf<{
      id?: string;
      type: "user.created";
    }>();
  });
});

describe("MessageTypeCarrier surface", () => {
  it("exposes the message type literal a routing container reads at registration time", () => {
    const schema: RoutableMessageSchema = makeSchema<{ type: "order.placed" }>("order.placed");
    expect(schema.getMessageType()).toBe("order.placed");
    expect(schema.getMessageType("type")).toBe("order.placed");
    expect(schema.getMessageType("missing")).toBeUndefined();
  });
});
