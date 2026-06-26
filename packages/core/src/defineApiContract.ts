import type { StandardSchemaV1 } from "@standard-schema/spec";
import { SUCCESSFUL_HTTP_STATUS_CODES } from "./HttpStatusCodes.ts";
import { ContractNoBody } from "./constants.ts";
import {
  isAnyOfResponses,
  isSseResponse,
  type ResponsesByStatusCode,
  type SseSchemaByEventName,
} from "./contractResponse.ts";
import type {
  CommonRouteDefinitionMetadata,
  InferSchemaOutput,
  RoutePathResolver,
} from "./schemaTypes.ts";
import type { DistributiveOmit, Exactly } from "./typeUtils.ts";

/**
 * Structural constraint for request/response schemas that describe an object shape.
 */
export type RequestObjectSchema = StandardSchemaV1;

/**
 * The capability, beyond Standard Schema, that core needs from a path-params schema: a way to list
 * its object-property keys, which the Standard Schema spec does not expose. Schema-library adapters
 * implement this on the schemas they produce (e.g. `@toad-contracts/valibot`'s `withObjectKeys`
 * reads valibot's `.entries`). Core depends only on this interface and never on a concrete schema
 * library, so the dependency is inverted: adapters satisfy core's contract, not the other way round.
 */
export interface ObjectKeysCarrier {
  /** Lists the schema's object-property keys. */
  readonly getObjectKeys: () => readonly string[];
}

/** A path-params schema: a Standard Schema that also carries object-key introspection. */
export type RequestPathParamsSchema = RequestObjectSchema & ObjectKeysCarrier;
export type RequestQuerySchema = RequestObjectSchema;
export type RequestHeaderSchema = RequestObjectSchema;
export type ResponseHeaderSchema = RequestObjectSchema;

export type CommonApiContract = {
  // oxlint-disable-next-line typescript/no-explicit-any -- required for compatibility with generics
  pathResolver: RoutePathResolver<any>;
  requestPathParamsSchema?: RequestPathParamsSchema;
  requestQuerySchema?: RequestQuerySchema;
  requestHeaderSchema?: RequestHeaderSchema;
  responseHeaderSchema?: ResponseHeaderSchema;
  responsesByStatusCode: ResponsesByStatusCode;

  metadata?: CommonRouteDefinitionMetadata;
  summary?: string;
  description?: string;
  tags?: readonly string[];
};

export type GetApiContract = CommonApiContract & {
  method: "get";
  requestBodySchema?: never;
};

export type DeleteApiContract = CommonApiContract & {
  method: "delete";
  requestBodySchema?: never;
};

export type PayloadApiContract = CommonApiContract & {
  method: "post" | "put" | "patch";
  requestBodySchema: typeof ContractNoBody | StandardSchemaV1;
};

export type ApiContract = GetApiContract | DeleteApiContract | PayloadApiContract;

type TypedPathApiContract<TPathParamsSchema extends RequestPathParamsSchema | undefined> =
  DistributiveOmit<ApiContract, "pathResolver" | "requestPathParamsSchema"> & {
    pathResolver: RoutePathResolver<InferSchemaOutput<TPathParamsSchema>>;
    requestPathParamsSchema?: TPathParamsSchema;
  };

export const defineApiContract = <
  TPathParamsSchema extends RequestPathParamsSchema | undefined = undefined,
  const TContract extends TypedPathApiContract<TPathParamsSchema> =
    TypedPathApiContract<TPathParamsSchema>,
>(
  contract: Exactly<TContract, TypedPathApiContract<TPathParamsSchema>> & {
    requestPathParamsSchema?: TPathParamsSchema;
  },
): TContract => contract;

/**
 * Builds the route's path pattern, replacing each path param with a `:key` placeholder. The keys are
 * read through the schema's {@link ObjectKeysCarrier} surface, which the schema-library adapter
 * implements, so core needs no knowledge of the concrete schema library.
 */
export const mapApiContractToPath = (routeConfig: ApiContract): string => {
  if (!routeConfig.requestPathParamsSchema) {
    return routeConfig.pathResolver(undefined);
  }

  const resolverParams = routeConfig.requestPathParamsSchema
    .getObjectKeys()
    .reduce<Record<string, string>>((acc, key) => {
      acc[key] = `:${key}`;

      return acc;
    }, {});

  return routeConfig.pathResolver(resolverParams);
};

/** Human-readable `"METHOD /path"` description of a contract. */
export const describeApiContract = (routeConfig: ApiContract): string => {
  return `${routeConfig.method.toUpperCase()} ${mapApiContractToPath(routeConfig)}`;
};

export const getSseSchemaByEventName = (routeConfig: ApiContract): SseSchemaByEventName | null => {
  const result: SseSchemaByEventName = {};

  for (const value of Object.values(routeConfig.responsesByStatusCode)) {
    if (isSseResponse(value)) {
      Object.assign(result, value.schemaByEventName);
    } else if (isAnyOfResponses(value)) {
      for (const response of value.responses) {
        if (isSseResponse(response)) {
          Object.assign(result, response.schemaByEventName);
        }
      }
    }
  }

  return Object.keys(result).length > 0 ? result : null;
};

export const hasAnySuccessSseResponse = (apiContract: ApiContract): boolean => {
  for (const code of [...SUCCESSFUL_HTTP_STATUS_CODES, "2xx" as const, "default" as const]) {
    const value = apiContract.responsesByStatusCode[code];

    if (!value) {
      continue;
    }

    if (isSseResponse(value)) {
      return true;
    } else if (isAnyOfResponses(value)) {
      for (const response of value.responses) {
        if (isSseResponse(response)) {
          return true;
        }
      }
    }
  }

  return false;
};
