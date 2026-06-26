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
 *
 * The Standard Schema spec is validation-only and does not expose the object's keys, so the core
 * cannot introspect the path-param field names on its own. {@link mapApiContractToPath} therefore
 * takes a {@link PathParamKeysResolver} that knows how to list a schema's keys for the concrete
 * schema library in use (e.g. the `@toad-contracts/valibot` adapter reads valibot's `.entries`).
 * Precise per-field inference is preserved at call sites because {@link defineApiContract} captures
 * the concrete schema type.
 */
export type RequestObjectSchema = StandardSchemaV1;

export type RequestPathParamsSchema = RequestObjectSchema;
export type RequestQuerySchema = RequestObjectSchema;
export type RequestHeaderSchema = RequestObjectSchema;
export type ResponseHeaderSchema = RequestObjectSchema;

/**
 * Lists the object-property keys of a request schema. Supplied by the schema-library adapter,
 * since the Standard Schema interface does not expose object keys at runtime.
 */
export type PathParamKeysResolver = (schema: RequestObjectSchema) => readonly string[];

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
 * Builds the route's path pattern, replacing each path param with a `:key` placeholder.
 *
 * @param getPathParamKeys - Lists the path-param schema's object keys. Required because the Standard
 *   Schema interface does not expose object keys; the schema-library adapter supplies it.
 */
export const mapApiContractToPath = (
  routeConfig: ApiContract,
  getPathParamKeys: PathParamKeysResolver,
): string => {
  if (!routeConfig.requestPathParamsSchema) {
    return routeConfig.pathResolver(undefined);
  }

  const resolverParams = getPathParamKeys(routeConfig.requestPathParamsSchema).reduce<
    Record<string, string>
  >((acc, key) => {
    acc[key] = `:${key}`;

    return acc;
  }, {});

  return routeConfig.pathResolver(resolverParams);
};

/**
 * Human-readable `"METHOD /path"` description of a contract.
 *
 * @param getPathParamKeys - See {@link mapApiContractToPath}.
 */
export const describeApiContract = (
  routeConfig: ApiContract,
  getPathParamKeys: PathParamKeysResolver,
): string => {
  return `${routeConfig.method.toUpperCase()} ${mapApiContractToPath(routeConfig, getPathParamKeys)}`;
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
