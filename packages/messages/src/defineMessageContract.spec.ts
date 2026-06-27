import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { StandardObjectKeysV1 } from "@toad-contracts/core";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  defineMessageContract,
  type InferConsumerMessage,
  type InferPublisherMessage,
  type MessageContract,
  type RoutableMessageSchema,
} from "./defineMessageContract.ts";

/**
 * A hand-rolled {@link RoutableMessageSchema} so this package can be tested without depending on any
 * schema library. `Input`/`Output` drive the inference helpers; `keys` drive the shared object-key
 * surface a routing container reads.
 */
const makeSchema = <Input, Output = Input>(
  keys: readonly string[] = [],
): StandardSchemaV1<Input, Output> & StandardObjectKeysV1 =>
  Object.assign(
    {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: (value: unknown) => ({ value: value as Output }),
        objectKeys: {
          input: () => keys,
          output: () => keys,
        },
      },
    } satisfies StandardSchemaV1<Input, Output> & StandardObjectKeysV1,
    {},
  );

describe("defineMessageContract", () => {
  it("returns the contract unchanged at runtime", () => {
    const consumerSchema = makeSchema<{ type: "user.created" }>(["type"]);
    const publisherSchema = makeSchema<{ type: "user.created" }>(["type"]);
    const contract = { consumerSchema, publisherSchema, domain: "users" } satisfies MessageContract;

    expect(defineMessageContract(contract)).toBe(contract);
  });

  it("preserves the consumer output and publisher input types for inference", () => {
    const contract = defineMessageContract({
      // consumer side: parsed output a handler receives
      consumerSchema: makeSchema<{ id?: string }, { id: string; type: "user.created" }>([
        "id",
        "type",
      ]),
      // publisher side: input a producer sends (id optional before parsing)
      publisherSchema: makeSchema<{ id?: string; type: "user.created" }>(["id", "type"]),
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

describe("RoutableMessageSchema object-keys surface", () => {
  it("exposes the declared field names a routing container reads at registration time", () => {
    const schema: RoutableMessageSchema = makeSchema<{ type: "order.placed"; id: string }>([
      "type",
      "id",
    ]);
    expect(schema["~standard"].objectKeys.input()).toEqual(["type", "id"]);
    expect(schema["~standard"].objectKeys.output()).toEqual(["type", "id"]);
  });
});
