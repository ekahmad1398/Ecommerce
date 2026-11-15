import { describe, it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({
    ordersAggregate: vi.fn(),
    orderitemsAgg: vi.fn(),
}));
vi.mock("../../models/Order.js", () => ({
    default: { aggregate: mocks.ordersAggregate },
}));
vi.mock("../../models/orderItems.js", () => ({
    default: { aggregate: mocks.orderitemsAgg },
}));
import { getUserOrders } from "../../controllers/userControllers/orders.js";
const USER_ID = "507f1f77bcf86cd799439011";
function makeRes() {
    const res = {};
    res.status = vi.fn(() => res);
    res.json = vi.fn(() => res);
    return res;
}
function makeReq(query = {}) {
    return { user: { id: USER_ID }, query };
}
const orderFacetResult = [
    {
        metadata: [{ total: 4 }],
        orders: [
            {
                _id: "o1",
                createdAt: new Date("2026-11-01"),
                updatedAt: new Date("2026-11-02"),
                totalPrice: 50,
                paymentStatus: "paid",
            },
        ],
    },
];
const statsResult = [
    {
        orderStatuses: [
            { _id: { order: "o1", status: "processing" } },
            { _id: { order: "o1", status: "delivered" } },
        ],
        summary: [{ notYetShipped: 1, cancelled: 0, delievered: 1 }],
    },
];
describe("getUserOrders", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.ordersAggregate.mockResolvedValue(orderFacetResult);
        mocks.orderitemsAgg.mockResolvedValue(statsResult);
    });
    it("merges sub-order statuses onto each order and returns counts", async () => {
        const res = makeRes();
        const next = vi.fn();
        await getUserOrders(makeReq(), res, next);
        expect(res.status).toHaveBeenCalledWith(200);
        const body = res.json.mock.calls[0][0];
        expect(body.totalOrders).toBe(4);
        expect(body.orders[0].statuses).toEqual(expect.arrayContaining(["processing", "delivered"]));
        expect(body.counts.notYetShipped).toBe(1);
        expect(next).not.toHaveBeenCalled();
    });
    it("passes pagination into the orders pipeline", async () => {
        const res = makeRes();
        await getUserOrders(makeReq({ page: "2", limit: "5" }), res, vi.fn());
        const pipeline = mocks.ordersAggregate.mock.calls[0][0];
        const ordersBranch = pipeline[1].$facet.orders;
        expect(ordersBranch).toContainEqual({ $skip: 5 });
        expect(ordersBranch).toContainEqual({ $limit: 5 });
    });
    it("defaults year to current year when param missing", async () => {
        const res = makeRes();
        await getUserOrders(makeReq({}), res, vi.fn());
        const body = res.json.mock.calls[0][0];
        expect(body.year).toBe(new Date().getFullYear());
    });
});
