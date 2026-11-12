import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

const mocks = vi.hoisted(() => ({
  productFindOne: vi.fn(),
  productSave: vi.fn(),
  mockAggregate: vi.fn(),
  isValidObjectId: vi.fn(),
  mongooseObjectID: vi.fn(),
}));

vi.mock("../../models/Product.js", () => ({
  default: {
    aggregate: mocks.mockAggregate,
  },
}));

vi.mock("../../models/category.js", () => ({
  default: {
    collection: { name: "functionforname" },
    aggregate: mocks.mockAggregate,
  },
}));

import { getHomeCategories } from "../../controllers/userControllers/category.js";

function makeRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

function makeReq(body: unknown, query: {}) {
  return { query, body } as any;
}

describe("homeCategories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("validates if a real number is given", async () => {
    const res = makeRes();
    const next = vi.fn();

    await getHomeCategories(
      makeReq(undefined, { limit: "2.1" }),
        res,
        next
    )

    expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({limit: 10})
    )
  });

});
