import { type ApiContract, resolveStatusEntry } from "@toad-contracts/core";
import type { Mockttp, RequestRuleBuilder } from "mockttp";
import { acceptsSse, mocksEmptyBody, planMockResponse } from "./planMockResponse.ts";
import { formatSseResponse, type MockResponseParams } from "./types.ts";
import { validateResponseBody, validateSseEvents } from "./validateResponseBody.ts";

type HttpMethod = "get" | "delete" | "post" | "patch" | "put";

/**
 * Mocks HTTP responses in [mockttp](https://github.com/httptoolkit/mockttp)-based tests using
 * contracts defined with `defineApiContract` from `@toad-contracts/core`. The response body is
 * validated through the contract's Standard Schema before being sent.
 */
export class ApiContractMockttpHelper {
  private readonly mockServer: Mockttp;

  constructor(mockServer: Mockttp) {
    this.mockServer = mockServer;
  }

  private resolveMethodBuilder(method: HttpMethod, path: string): RequestRuleBuilder {
    switch (method) {
      case "get":
        return this.mockServer.forGet(path);
      case "delete":
        return this.mockServer.forDelete(path);
      case "post":
        return this.mockServer.forPost(path);
      case "patch":
        return this.mockServer.forPatch(path);
      case "put":
        return this.mockServer.forPut(path);
      default:
        throw new Error(`Unsupported method ${method}`);
    }
  }

  private resolvePath(contract: ApiContract, pathParams: unknown): string {
    // The path-param schema's keys are not introspectable through the vendor-neutral Standard
    // Schema interface, but the mock always receives concrete `pathParams` for path-param
    // contracts, so the resolver can build the URL directly. Contracts without path params ignore
    // the (undefined) argument and return their static path.
    return contract.pathResolver(pathParams);
  }

  async mockResponse<TContract extends ApiContract>(
    contract: TContract,
    params: MockResponseParams<TContract>,
  ): Promise<void> {
    // oxlint-disable-next-line typescript/no-explicit-any -- field access is safe; types are enforced by the public signature
    const anyParams = params as any;
    const path = this.resolvePath(contract, anyParams.pathParams);
    const statusCode = anyParams.responseStatus;
    const responseEntry = resolveStatusEntry(contract.responsesByStatusCode, statusCode);

    if (!responseEntry) {
      throw new Error("Specified responseStatus cannot be mapped with contract");
    }

    const mockRule = this.resolveMethodBuilder(contract.method, path);
    const plan = planMockResponse(responseEntry, anyParams.contentType);
    const serveEmptyBody = mocksEmptyBody(plan, anyParams);

    // A status code offering both JSON and SSE is answered per request, by `accept`, the way a
    // real dual-mode route is; everything else has a single body to serve.
    if (!serveEmptyBody && plan.json && plan.sse && plan.primaryKind !== "blob") {
      const { json, sse } = plan;

      await mockRule.thenCallback((request) =>
        acceptsSse(request.headers.accept)
          ? {
              statusCode,
              headers: { "content-type": "text/event-stream" },
              body: formatSseResponse(validateSseEvents(sse.schemaByEventName, anyParams.events)),
            }
          : {
              statusCode,
              headers: { "content-type": json.contentType },
              body: JSON.stringify(validateResponseBody(json.schema, anyParams.responseJson)),
            },
      );
      return;
    }

    if (!serveEmptyBody && plan.sse && plan.primaryKind === "sse") {
      const body = formatSseResponse(
        validateSseEvents(plan.sse.schemaByEventName, anyParams.events),
      );
      await mockRule.thenReply(statusCode, body, { "content-type": "text/event-stream" });
      return;
    }

    if (!serveEmptyBody && plan.blob && plan.primaryKind === "blob") {
      await mockRule.thenReply(statusCode, anyParams.responseBlob, {
        "content-type": plan.blob.contentType,
      });
      return;
    }

    if (!serveEmptyBody && plan.json && plan.primaryKind === "json") {
      const body = validateResponseBody(plan.json.schema, anyParams.responseJson);
      await mockRule.thenReply(statusCode, JSON.stringify(body), {
        "content-type": plan.json.contentType,
      });
      return;
    }

    await mockRule.thenReply(statusCode);
  }
}
