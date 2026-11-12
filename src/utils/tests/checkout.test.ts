import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted: mocks must exist BEFORE vi.mock factories run (they're hoisted to top)
const mocks = vi.hoisted(() => ({
  productFindOne: vi.fn(),
  productSave: vi.fn(),
  orderSave: vi.fn(),
  subOrderSave: vi.fn(),
  stripeCreate: vi.fn(),
  startSession: vi.fn(),
}));

vi.mock("mongoose", () => ({
  default: { startSession: mocks.startSession },
}));

vi.mock("../../models/Product.js", () => ({
  default: { findOne: mocks.productFindOne },
}));

vi.mock("../../models/Order.js", () => ({
  default: class {
    _id = "order-id-123";
    save = mocks.orderSave;
    constructor(public data: unknown) {}
  },
}));

vi.mock("../../models/orderItems.js", () => ({
  default: class {
    save = mocks.subOrderSave;
    constructor(public data: unknown) {}
  },
}));

vi.mock("stripe", () => ({
  default: class {
    checkout = { sessions: { create: mocks.stripeCreate } };
  },
}));

import { checkout } from "../../controllers/userControllers/checkout.js";

const fakeProduct = {
  _id: "prod-1",
  name: "Test Product",
  description: "desc",
  price: 25,
  stock: 10,
  vendorId: { toString: () => "vendor-1" },
  save: mocks.productSave,
};

function makeRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

function makeReq(body: unknown) {
  return { user: { id: "user-1" }, body } as any;
}

describe("checkout controller", () => {
  const session = {
    startTransaction: vi.fn(),
    commitTransaction: vi.fn().mockResolvedValue(undefined),
    abortTransaction: vi.fn().mockResolvedValue(undefined),
    endSession: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.startSession.mockResolvedValue(session);
    // findOne() returns a query; .session(dbSession) is chained, then awaited
    mocks.productFindOne.mockReturnValue({
      session: vi.fn().mockResolvedValue(fakeProduct),
    });
    mocks.orderSave.mockResolvedValue({});
    mocks.subOrderSave.mockResolvedValue({});
    mocks.productSave.mockResolvedValue({});
    mocks.stripeCreate.mockResolvedValue({
      url: "https://stripe.test/checkout",
    });
  });

  it("rejects an unsupported payment method with 400", async () => {
    const res = makeRes();
    const next = vi.fn();

    await checkout(
      makeReq({
        paymentMethod: "PayPal",
        shippingAddress: {},
        CartItems: [{ productID: "p", quantity: 1 }],
      }),
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects an empty cart with 400", async () => {
    const res = makeRes();
    const next = vi.fn();

    await checkout(
      makeReq({
        paymentMethod: "Stripe_Card",
        shippingAddress: {},
        CartItems: [],
      }),
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 404 when the product is missing or out of stock", async () => {
    mocks.productFindOne.mockReturnValue({
      session: vi.fn().mockResolvedValue(null),
    });
    const res = makeRes();
    const next = vi.fn();

    await checkout(
      makeReq({
        paymentMethod: "Stripe_Card",
        shippingAddress: { phone: "1", address: "a", city: "c", country: "US" },
        CartItems: [{ productID: "missing", quantity: 1 }],
      }),
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(session.abortTransaction).toHaveBeenCalled();
  });

  it("creates a Stripe session and commits on success", async () => {
    const res = makeRes();
    const next = vi.fn();

    await checkout(
      makeReq({
        paymentMethod: "Stripe_Card",
        shippingAddress: { phone: "1", address: "a", city: "c", country: "US" },
        CartItems: [{ productID: "prod-1", quantity: 2 }],
      }),
      res,
      next,
    );

    expect(mocks.stripeCreate).toHaveBeenCalledOnce();
    expect(session.commitTransaction).toHaveBeenCalledOnce();
    expect(session.abortTransaction).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://stripe.test/checkout" }),
    );
    // stock was decremented: 10 - 2 = 8
    expect(fakeProduct.stock).toBe(8);
  });

  it("rolls back and calls next(error) when Stripe fails — never commits", async () => {
    const stripeError = new Error("Stripe API down");
    mocks.stripeCreate.mockRejectedValue(stripeError);
    const res = makeRes();
    const next = vi.fn();

    await checkout(
      makeReq({
        paymentMethod: "Stripe_Card",
        shippingAddress: { phone: "1", address: "a", city: "c", country: "US" },
        CartItems: [{ productID: "prod-1", quantity: 1 }],
      }),
      res,
      next,
    );

    expect(next).toHaveBeenCalledWith(stripeError);
    expect(session.abortTransaction).toHaveBeenCalled();
    expect(session.commitTransaction).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("checking the COD options", async () => {
    const res = makeRes();
    const next = vi.fn();

    await checkout(
      makeReq({
        paymentMethod: "COD",
        shippingAddress: { phone: "1", address: "a", city: "c", country: "US" },
        CartItems: [{ productID: "prod-1", quantity: 2 }],
      }),
      res,
      next,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(session.commitTransaction).toHaveBeenCalledOnce();
    expect(session.abortTransaction).not.toHaveBeenCalled();
    expect(mocks.orderSave).toHaveBeenCalledOnce();
    expect(mocks.subOrderSave).toHaveBeenCalledOnce();
    expect(mocks.stripeCreate).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "order-id-123" }),
    );
  });
});
