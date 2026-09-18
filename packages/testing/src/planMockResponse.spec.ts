import { blobBody, blobResponse, noBodyResponse, sseBody, sseResponse } from "@toad-contracts/core";
import { number, object, string } from "valibot";
import { describe, expect, it } from "vitest";
import { acceptsSse, mocksEmptyBody, planMockResponse } from "./planMockResponse.ts";

describe("planMockResponse", () => {
  it("treats a bare Standard Schema as an application/json body", () => {
    const schema = object({ id: string() });

    expect(planMockResponse(schema)).toEqual({
      json: { contentType: "application/json", schema },
      primaryKind: "json",
      allowNoBody: false,
    });
  });

  it("reads the media type a factory declared", () => {
    expect(planMockResponse(blobResponse("image/png"))).toMatchObject({
      blob: { contentType: "image/png" },
      primaryKind: "blob",
    });

    const schemaByEventName = { tick: object({ count: number() }) };
    expect(planMockResponse(sseResponse(schemaByEventName))).toMatchObject({
      sse: { schemaByEventName },
      primaryKind: "sse",
    });
  });

  it("collects every kind a content map declares, keeping the first as primary", () => {
    const jsonSchema = object({ id: string() });
    const plan = planMockResponse({
      content: {
        "application/pdf": blobBody(),
        "application/json": jsonSchema,
        "text/event-stream": sseBody({ tick: object({ count: number() }) }),
      },
    });

    expect(plan.primaryKind).toBe("blob");
    expect(plan.blob).toEqual({ contentType: "application/pdf" });
    expect(plan.json).toEqual({ contentType: "application/json", schema: jsonSchema });
    expect(plan.sse).toBeDefined();
  });

  it("keeps the first declared media type of each kind", () => {
    const canonical = object({ id: string() });
    const vendored = object({ legacyId: number() });
    const plan = planMockResponse({
      content: { "application/json": canonical, "application/json+01": vendored },
    });

    expect(plan.json).toEqual({ contentType: "application/json", schema: canonical });
  });

  it("narrows to a single media type when one is preferred", () => {
    const canonical = object({ id: string() });
    const vendored = object({ legacyId: number() });
    const plan = planMockResponse(
      { content: { "application/json": canonical, "application/json+01": vendored } },
      "application/json+01",
    );

    expect(plan.json).toEqual({ contentType: "application/json+01", schema: vendored });
  });

  it("yields no body target when the preferred media type is not declared", () => {
    const plan = planMockResponse(blobResponse("image/png"), "text/plain");

    expect(plan.primaryKind).toBeUndefined();
    expect(plan.blob).toBeUndefined();
  });

  it("marks a no-body entry", () => {
    expect(planMockResponse(noBodyResponse())).toEqual({ allowNoBody: true });
  });

  it("marks an entry that allows an absent body alongside its content", () => {
    const plan = planMockResponse({
      content: { "application/json": object({ id: string() }) },
      allowNoBody: true,
    });

    expect(plan.allowNoBody).toBe(true);
    expect(plan.primaryKind).toBe("json");
  });
});

describe("mocksEmptyBody", () => {
  const plan = planMockResponse({
    content: { "application/json": object({ id: string() }) },
    allowNoBody: true,
  });

  it("is true when an entry allowing an absent body is mocked without one", () => {
    expect(mocksEmptyBody(plan, {})).toBe(true);
  });

  it.each([
    ["responseJson", { responseJson: { id: "1" } }],
    ["responseBlob", { responseBlob: "raw" }],
    ["events", { events: [] }],
  ])("is false when %s is supplied", (_name, params) => {
    expect(mocksEmptyBody(plan, params)).toBe(false);
  });

  it("is false for an entry that does not allow an absent body", () => {
    expect(mocksEmptyBody(planMockResponse(object({ id: string() })), {})).toBe(false);
  });
});

describe("acceptsSse", () => {
  it.each([
    [undefined, false],
    ["application/json", false],
    ["text/event-stream", true],
    ["application/json, text/event-stream;q=0.9", true],
  ])("%s → %s", (header, expected) => {
    expect(acceptsSse(header)).toBe(expected);
  });

  it("handles a repeated accept header", () => {
    expect(acceptsSse(["application/json", "text/event-stream"])).toBe(true);
    expect(acceptsSse(["application/json"])).toBe(false);
  });
});
