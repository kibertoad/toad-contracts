import type { StandardJSONSchemaV1, StandardSchemaV1 } from "@standard-schema/spec";
import { getObjectKeys } from "@toad-contracts/core";
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
 * schema library. `Input`/`Output` drive the inference helpers; `keys` become the JSON Schema
 * `properties` a routing container reads.
 */
const objectJsonSchema = (keys: readonly string[]): Record<string, unknown> => ({
  type: "object",
  properties: Object.fromEntries(keys.map((key) => [key, {}])),
});

const makeSchema = <Input, Output = Input>(
  keys: readonly string[] = [],
): StandardSchemaV1<Input, Output> & StandardJSONSchemaV1<Input, Output> =>
  Object.assign(
    {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: (value: unknown) => ({ value: value as Output }),
        jsonSchema: {
          input: () => objectJsonSchema(keys),
          output: () => objectJsonSchema(keys),
        },
      },
    } satisfies StandardSchemaV1<Input, Output> & StandardJSONSchemaV1<Input, Output>,
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

describe("RoutableMessageSchema field introspection", () => {
  it("exposes the declared field names a routing container reads at registration time", () => {
    const schema: RoutableMessageSchema = makeSchema<{ type: "order.placed"; id: string }>([
      "type",
      "id",
    ]);
    expect(getObjectKeys(schema)).toEqual(["type", "id"]);
    expect(getObjectKeys(schema, "output")).toEqual(["type", "id"]);
  });
});
