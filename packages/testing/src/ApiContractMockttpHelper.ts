import {
  type ApiContract,
  ContractNoBody,
  isAnyOfResponses,
  isBlobResponse,
  isJsonResponse,
  isNoBodyResponse,
  isSseResponse,
  isStreamResponse,
  isTextResponse,
  resolveStatusEntry,
} from "@toad-contracts/core";
import type { Mockttp, RequestRuleBuilder } from "mockttp";
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

    if (responseEntry === ContractNoBody || isNoBodyResponse(responseEntry)) {
      await mockRule.thenReply(statusCode);
      return;
    }

    if (isTextResponse(responseEntry)) {
      await mockRule.thenReply(statusCode, anyParams.responseText, {
        "content-type": responseEntry.contentType,
      });
      return;
    }

    if (isBlobResponse(responseEntry)) {
      await mockRule.thenReply(statusCode, anyParams.responseBlob, {
        "content-type": responseEntry.contentType,
      });
      return;
    }

    if (isStreamResponse(responseEntry)) {
      await mockRule.thenReply(statusCode, anyParams.responseStream, {
        "content-type": responseEntry.contentType,
      });
      return;
    }

    if (isSseResponse(responseEntry)) {
      const body = formatSseResponse(
        validateSseEvents(responseEntry.schemaByEventName, anyParams.events),
      );
      await mockRule.thenReply(statusCode, body, {
        "content-type": "text/event-stream",
      });
      return;
    }

    if (isAnyOfResponses(responseEntry)) {
      const sseEntry = responseEntry.responses.find(isSseResponse);
      const jsonEntry = responseEntry.responses.find(isJsonResponse);

      await mockRule.thenCallback((request) => {
        const accept = request.headers.accept ?? "";

        if (accept.includes("text/event-stream") && sseEntry) {
          return {
            statusCode,
            headers: { "content-type": "text/event-stream" },
            body: formatSseResponse(
              validateSseEvents(sseEntry.schemaByEventName, anyParams.events),
            ),
          };
        }

        if (jsonEntry) {
          return {
            statusCode,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(validateResponseBody(jsonEntry, anyParams.responseJson)),
          };
        }

        return { statusCode };
      });
      return;
    }

    const body = validateResponseBody(responseEntry, anyParams.responseJson);
    await mockRule.thenReply(statusCode, JSON.stringify(body), {
      "content-type": "application/json",
    });
  }
}
