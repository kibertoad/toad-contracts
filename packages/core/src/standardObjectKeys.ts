import type { StandardTypedV1 } from "@standard-schema/spec";

/**
 * The single object-key introspection surface every adapter implements, shared by API contracts
 * (path-param mapping) and message contracts (field projection/routing). The Standard Schema spec
 * exposes no runtime way to list an object schema's declared keys, so this sits beside it as an
 * opt-in sibling interface — modelled exactly on the spec's own `StandardJSONSchemaV1`: a separate
 * `"~standard"` capability layered on the shared `StandardTypedV1` base, feature-detected on the
 * `objectKeys` member.
 *
 * This is a local copy of the extension proposed for `@standard-schema/spec` in
 * `docs/proposals/object-keys-introspection.md`; if the spec adopts it, this re-exports from there.
 */
export interface StandardObjectKeysV1<Input = unknown, Output = Input> {
  /** The Standard Object Keys properties. */
  readonly "~standard": StandardObjectKeysV1.Props<Input, Output>;
}

export declare namespace StandardObjectKeysV1 {
  /** The Standard Object Keys properties interface. */
  export interface Props<Input = unknown, Output = Input> extends StandardTypedV1.Props<
    Input,
    Output
  > {
    /** Methods for listing the input/output object keys. */
    readonly objectKeys: StandardObjectKeysV1.Lister;
  }

  /** The Standard Object Keys lister interface. */
  export interface Lister {
    /** Lists the declared keys of the input object shape. May throw if the schema does not describe an object. */
    readonly input: (options?: StandardObjectKeysV1.Options | undefined) => ReadonlyArray<string>;
    /** Lists the declared keys of the output object shape. May throw if the schema does not describe an object. */
    readonly output: (options?: StandardObjectKeysV1.Options | undefined) => ReadonlyArray<string>;
  }

  /** The options for the input/output methods. */
  export interface Options {
    /** Explicit support for additional vendor-specific parameters, if needed. */
    readonly libraryOptions?: Record<string, unknown> | undefined;
  }

  /** The Standard types interface. */
  export interface Types<Input = unknown, Output = Input> extends StandardTypedV1.Types<
    Input,
    Output
  > {}

  /** Infers the input type of a Standard. */
  export type InferInput<Schema extends StandardTypedV1> = StandardTypedV1.InferInput<Schema>;

  /** Infers the output type of a Standard. */
  export type InferOutput<Schema extends StandardTypedV1> = StandardTypedV1.InferOutput<Schema>;
}
