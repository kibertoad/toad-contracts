import {
  blobBody,
  blobResponse,
  defineApiContract,
  noBodyResponse,
  sseBody,
  sseResponse,
} from "@toad-contracts/core";
import { withObjectKeys } from "@toad-contracts/valibot";
import { array, literal, number, object, string } from "valibot";

const RESPONSE_BODY_SCHEMA = object({ id: string() });
const REQUEST_BODY_SCHEMA = object({ name: string() });
const PATH_PARAMS_SCHEMA = withObjectKeys(object({ userId: string() }));
const QUERY_PARAMS_SCHEMA = object({ yearFrom: number() });
const SSE_ITEM_SCHEMA = object({ items: array(object({ id: string() })) });
const SSE_COMPLETED_SCHEMA = object({ totalCount: number() });

const SSE_SCHEMAS = {
  "item.updated": SSE_ITEM_SCHEMA,
  completed: SSE_COMPLETED_SCHEMA,
};

export const getApiContract = defineApiContract({
  method: "get",
  pathResolver: () => "/",
  responsesByStatusCode: { 200: RESPONSE_BODY_SCHEMA },
});

export const getApiContractWithPathParams = defineApiContract({
  method: "get",
  requestPathParamsSchema: PATH_PARAMS_SCHEMA,
  pathResolver: ({ userId }) => `/users/${userId}`,
  responsesByStatusCode: { 200: RESPONSE_BODY_SCHEMA },
});

export const getApiContractWithQueryParams = defineApiContract({
  method: "get",
  requestQuerySchema: QUERY_PARAMS_SCHEMA,
  pathResolver: () => "/",
  responsesByStatusCode: { 200: RESPONSE_BODY_SCHEMA },
});

export const getApiContractWithPathAndQueryParams = defineApiContract({
  method: "get",
  requestPathParamsSchema: PATH_PARAMS_SCHEMA,
  requestQuerySchema: QUERY_PARAMS_SCHEMA,
  pathResolver: ({ userId }) => `/users/${userId}`,
  responsesByStatusCode: { 200: RESPONSE_BODY_SCHEMA },
});

export const postApiContract = defineApiContract({
  method: "post",
  requestBodySchema: REQUEST_BODY_SCHEMA,
  pathResolver: () => "/",
  responsesByStatusCode: { 200: RESPONSE_BODY_SCHEMA },
});

export const postApiContractWithPathParams = defineApiContract({
  method: "post",
  requestBodySchema: REQUEST_BODY_SCHEMA,
  requestPathParamsSchema: PATH_PARAMS_SCHEMA,
  pathResolver: ({ userId }) => `/users/${userId}`,
  responsesByStatusCode: { 200: RESPONSE_BODY_SCHEMA },
});

export const sseGetApiContract = defineApiContract({
  method: "get",
  pathResolver: () => "/events/stream",
  responsesByStatusCode: { 200: sseResponse(SSE_SCHEMAS) },
});

export const sseGetApiContractWithPathParams = defineApiContract({
  method: "get",
  requestPathParamsSchema: PATH_PARAMS_SCHEMA,
  pathResolver: ({ userId }) => `/users/${userId}/events`,
  responsesByStatusCode: { 200: sseResponse(SSE_SCHEMAS) },
});

export const sseGetApiContractWithQueryParams = defineApiContract({
  method: "get",
  requestQuerySchema: QUERY_PARAMS_SCHEMA,
  pathResolver: () => "/events/stream",
  responsesByStatusCode: { 200: sseResponse(SSE_SCHEMAS) },
});

export const dualModeApiContract = defineApiContract({
  method: "post",
  requestBodySchema: REQUEST_BODY_SCHEMA,
  pathResolver: () => "/events/dual",
  responsesByStatusCode: {
    200: {
      content: {
        "application/json": RESPONSE_BODY_SCHEMA,
        "text/event-stream": sseBody(SSE_SCHEMAS),
      },
    },
  },
});

export const dualModeApiContractWithPathParams = defineApiContract({
  method: "post",
  requestBodySchema: REQUEST_BODY_SCHEMA,
  requestPathParamsSchema: PATH_PARAMS_SCHEMA,
  pathResolver: ({ userId }) => `/users/${userId}/events/dual`,
  responsesByStatusCode: {
    200: {
      content: {
        "application/json": RESPONSE_BODY_SCHEMA,
        "text/event-stream": sseBody(SSE_SCHEMAS),
      },
    },
  },
});

export const noBodyApiContract = defineApiContract({
  method: "delete",
  requestPathParamsSchema: PATH_PARAMS_SCHEMA,
  pathResolver: ({ userId }) => `/users/${userId}`,
  responsesByStatusCode: { 204: noBodyResponse() },
});

export const getApiContractWith2xxRange = defineApiContract({
  method: "get",
  pathResolver: () => "/range",
  responsesByStatusCode: { "2xx": RESPONSE_BODY_SCHEMA },
});

export const getApiContractWithDefault = defineApiContract({
  method: "get",
  pathResolver: () => "/default",
  responsesByStatusCode: { default: RESPONSE_BODY_SCHEMA },
});

const CREATED_BODY_SCHEMA = object({ id: string(), created: literal(true) });

export const getApiContractWithExactAndRange = defineApiContract({
  method: "get",
  pathResolver: () => "/exact-and-range",
  responsesByStatusCode: {
    200: RESPONSE_BODY_SCHEMA,
    "2xx": CREATED_BODY_SCHEMA,
  },
});

export const deleteApiContractWithNoBodyResponse = defineApiContract({
  method: "delete",
  pathResolver: () => "/no-body",
  responsesByStatusCode: { 204: noBodyResponse() },
});

export const patchApiContract = defineApiContract({
  method: "patch",
  requestBodySchema: REQUEST_BODY_SCHEMA,
  pathResolver: () => "/patch",
  responsesByStatusCode: { 200: RESPONSE_BODY_SCHEMA },
});

export const putApiContract = defineApiContract({
  method: "put",
  requestBodySchema: REQUEST_BODY_SCHEMA,
  pathResolver: () => "/put",
  responsesByStatusCode: { 200: RESPONSE_BODY_SCHEMA },
});

export const textResponseApiContract = defineApiContract({
  method: "get",
  pathResolver: () => "/text",
  responsesByStatusCode: { 200: blobResponse("text/plain") },
});

export const blobResponseApiContract = defineApiContract({
  method: "get",
  pathResolver: () => "/blob",
  responsesByStatusCode: { 200: blobResponse("application/octet-stream") },
});

/** One status code carrying two JSON variants plus a downloadable rendering of the same resource. */
export const multiContentApiContract = defineApiContract({
  method: "get",
  pathResolver: () => "/multi-content",
  responsesByStatusCode: {
    200: {
      content: {
        "application/json": RESPONSE_BODY_SCHEMA,
        "application/json+01": CREATED_BODY_SCHEMA,
        "application/pdf": blobBody(),
      },
    },
  },
});

/** A status code that may answer with a body or with nothing at all. */
export const optionalBodyApiContract = defineApiContract({
  method: "get",
  pathResolver: () => "/optional-body",
  responsesByStatusCode: {
    200: { content: { "application/json": RESPONSE_BODY_SCHEMA }, allowNoBody: true },
  },
});

export const getApiContractWith4xxRange = defineApiContract({
  method: "get",
  pathResolver: () => "/not-found",
  responsesByStatusCode: { "4xx": RESPONSE_BODY_SCHEMA },
});

export const getApiContractWith5xxRange = defineApiContract({
  method: "get",
  pathResolver: () => "/server-error",
  responsesByStatusCode: { "5xx": RESPONSE_BODY_SCHEMA },
});
