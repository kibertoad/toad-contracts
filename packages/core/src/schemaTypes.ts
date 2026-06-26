import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * Infers the input type of a Standard Schema (the type accepted before transforms run),
 * or `undefined` when no schema is provided.
 */
export type InferSchemaInput<T extends StandardSchemaV1 | undefined> = T extends StandardSchemaV1
  ? StandardSchemaV1.InferInput<T>
  : T extends undefined
    ? undefined
    : never;

/**
 * Infers the output type of a Standard Schema (the type produced after parsing),
 * or `undefined` when no schema is provided.
 */
export type InferSchemaOutput<T extends StandardSchemaV1 | undefined> = T extends StandardSchemaV1
  ? StandardSchemaV1.InferOutput<T>
  : T extends undefined
    ? undefined
    : never;

export type RoutePathResolver<PathParams> = (pathParams: PathParams) => string;

// oxlint-disable-next-line typescript/no-empty-object-type -- augmentation target consumers extend via module augmentation
export interface CommonRouteDefinitionMetadata extends Record<string, unknown> {}
