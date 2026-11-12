import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  aggregate: vi.fn(),
}));

vi.mock("../../models/Product.js", () => ({ default: {} }));

vi.mock("../../models/category.js", () => ({
  default: {
    collection: { name: "categories" },
    aggregate: mocks.aggregate,
  },
}));

import { getHomeCategories } from "../../controllers/userControllers/category.js";

function makeRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

function makeReq(query: Record<string, string>) {
  return { query } as any;
}

const emptyResult = [{ metadata: [{ totalCategories: 0 }], categories: [] }];

describe("getHomeCategories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.aggregate.mockResolvedValue(emptyResult);
  });

  it("defaults limit to 10 when a decimal is passed", async () => {
    const res = makeRes();

    await getHomeCategories(makeReq({ limit: "2.1" }), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const pipeline = mocks.aggregate.mock.calls[0][0];
    const facetStage = pipeline.find((s: any) => s.$facet);
    const limitStage = facetStage.$facet.categories.find(
      (s: any) => s.$limit !== undefined,
    );
    expect(limitStage.$limit).toBe(10);
  });

  it("uses the requested limit when it is a valid integer", async () => {
    const res = makeRes();

    await getHomeCategories(makeReq({ limit: "25", page: "2" }), res, vi.fn());

    const pipeline = mocks.aggregate.mock.calls[0][0];
    const facetStage = pipeline.find((s: any) => s.$facet);
    const stages = facetStage.$facet.categories;
    const limitStage = stages.find((s: any) => s.$limit !== undefined);
    const skipStage = stages.find((s: any) => s.$skip !== undefined);
    expect(limitStage.$limit).toBe(25);
    expect(skipStage.$skip).toBe(25); // page 2 → (2-1) * 25
  });

  it("returns 400 when page overflows the safe integer range", async () => {
    const res = makeRes();

    await getHomeCategories(
      makeReq({ page: "9007199254740991", limit: "50" }),
      res,
      vi.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.aggregate).not.toHaveBeenCalled();
  });
});
