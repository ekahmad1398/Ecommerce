import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
const mocks = vi.hoisted(() => ({
    constructEvent: vi.fn(), // Stripe.webhooks.constructEvent (STATIC)
    retrievePI: vi.fn(), // stripe.paymentIntents.retrieve (instance)
    orderFindByIdAndUpdate: vi.fn(), // Order.findByIdAndUpdate
    subOrderFind: vi.fn(), // subOrderSchema.find
    subOrderSave: vi.fn(), // subOrder.save()
}));
vi.mock("stripe", () => {
    class StripeMock {
        // static — called as Stripe.webhooks.constructEvent(...)
        static webhooks = { constructEvent: mocks.constructEvent };
        // instance — called as stripe.paymentIntents.retrieve(...)
        paymentIntents = { retrieve: mocks.retrievePI };
    }
    return { default: StripeMock };
});
vi.mock("../../models/Order.js", () => ({
    default: { findByIdAndUpdate: mocks.orderFindByIdAndUpdate },
}));
vi.mock("../../models/orderItems.js", () => ({
    default: { find: mocks.subOrderFind },
}));
import stripeWebhook from "../../routes/stripe_webhook.js";
// real Express app, real router — only externals are mocked
const app = express();
app.use("/api/v1/webhooks", stripeWebhook);
const fakeSubOrder = {
    ParentorderID: "order-1",
    vendorID: "vendor-1",
    subOrderTotal: 50,
    platformComissionCut: 0,
    vendorNetEarned: 0,
    status: "pending",
    save: mocks.subOrderSave,
};
const completedEvent = {
    type: "checkout.session.completed",
    data: {
        object: {
            metadata: { ParentorderID: "order-1", customerId: "user-1" },
            payment_intent: "pi_123",
            payment_method_types: ["card"],
            amount_total: 5000,
        },
    },
};
describe("stripe webhook", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.constructEvent.mockReturnValue(completedEvent);
        mocks.retrievePI.mockResolvedValue({
            latest_charge: { balance_transaction: { fee: 150 } },
        });
        mocks.orderFindByIdAndUpdate.mockResolvedValue({});
        mocks.subOrderFind.mockResolvedValue([fakeSubOrder]);
        mocks.subOrderSave.mockResolvedValue({});
    });
    it("rejects an invalid signature with 400", async () => {
        mocks.constructEvent.mockImplementation(() => {
            throw new Error("bad signature");
        });
        const res = await request(app)
            .post("/api/v1/webhooks/stripe")
            .send({ fake: "payload" });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe("Webhook signature error.");
    });
    it("works if the data was correct", async () => {
        const res = await request(app)
            .post("/api/v1/webhooks/stripe")
            .send({ anything: "goes" });
        expect(res.body).toEqual({ received: true });
        expect(res.status).toBe(200);
        expect(mocks.orderFindByIdAndUpdate).toHaveBeenCalledWith("order-1", expect.objectContaining({ paymentStatus: "paid" }));
        expect(fakeSubOrder.status).toBe("processing");
        expect(mocks.subOrderSave).toHaveBeenCalled();
        expect(fakeSubOrder.platformComissionCut).toBe(4.85);
        expect(fakeSubOrder.vendorNetEarned).toBe(43.65);
    });
});
