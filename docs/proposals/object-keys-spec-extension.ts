// Proposed extension for `@standard-schema/spec` (packages/spec/src/index.ts).
//
// This is the drop-in addition described in ./object-keys-introspection.md. It mirrors the existing
// `StandardJSONSchemaV1` extension: a sibling interface, opted into per-schema, that declares its own
// `"~standard"` properties on top of the shared `StandardTypedV1` base. It is presented in the spec
// package's own style so it can be dropped into `packages/spec/src/index.ts` as-is.
//
// `StandardTypedV1` is the base interface already exported by the spec; it is referenced here, not
// redefined.

import type { StandardTypedV1 } from "@standard-schema/spec";

/** The Standard Object Keys interface. */
export interface StandardObjectKeysV1<Input = unknown, Output = Input> {
  /** The Standard Object Keys properties. */
  readonly "~standard": StandardObjectKeysV1.Props<Input, Output>;
}

export declare namespace StandardObjectKeysV1 {
  /** The Standard Object Keys properties interface. */
  export interface Props<Input = unknown, Output = Input>
    extends StandardTypedV1.Props<Input, Output> {
    /** Methods for listing the input/output object keys. */
    readonly objectKeys: StandardObjectKeysV1.Lister;
  }

  /** The Standard Object Keys lister interface. */
  export interface Lister {
    /** Lists the declared keys of the input object shape. May throw if the schema does not describe an object. */
    readonly input: (
      options?: StandardObjectKeysV1.Options | undefined,
    ) => ReadonlyArray<string>;
    /** Lists the declared keys of the output object shape. May throw if the schema does not describe an object. */
    readonly output: (
      options?: StandardObjectKeysV1.Options | undefined,
    ) => ReadonlyArray<string>;
  }

  /** The options for the input/output methods. */
  export interface Options {
    /** Explicit support for additional vendor-specific parameters, if needed. */
    readonly libraryOptions?: Record<string, unknown> | undefined;
  }

  /** The Standard types interface. */
  export interface Types<Input = unknown, Output = Input>
    extends StandardTypedV1.Types<Input, Output> {}

  /** Infers the input type of a Standard. */
  export type InferInput<Schema extends StandardTypedV1> =
    StandardTypedV1.InferInput<Schema>;

  /** Infers the output type of a Standard. */
  export type InferOutput<Schema extends StandardTypedV1> =
    StandardTypedV1.InferOutput<Schema>;
}
