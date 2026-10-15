import Stripe from "stripe";
import express from "express";
import type { Request, Response } from "express";
import subOrderSchema from "../models/orderItems.js";
import Order from "../models/Order.js";
import env from "../config.js";
const stripe = new Stripe(env.STRIPE_SECRET_KEY);
const router = express.Router();

router.post(
  "/webhook/stripe",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    const sig:any = req.headers["stripe-signature"];
    let event;
    try {
      event = Stripe.webhooks.constructEvent(
        req.body,
        sig,
        env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (error) {
      console.log(error);
      return res.status(400).json({ message: "Webhook signature error." });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const ParentorderID = session.metadata?.ParentorderID;
      if (!ParentorderID) {
        return res.status(400).json({ message: "Order ID is unavailable." });
      }

      if (typeof session.payment_intent !== "string") {
        return res.status(400).json({ message: "Payment intent is unavailable." });
      }

      if (session.amount_total === null || session.amount_total <= 0) {
        return res.status(400).json({ message: "Session total is unavailable." });
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(
        session.payment_intent,
        {
          expand: ["latest_charge.balance_transaction"],
        },
      );

      const latestCharge = paymentIntent.latest_charge;
      if (!latestCharge || typeof latestCharge === "string") {
        return res.status(500).json({ message: "Expanded charge is unavailable." });
      }

      const balanceTransaction = latestCharge.balance_transaction;
      if (!balanceTransaction || typeof balanceTransaction === "string") {
        return res
          .status(500)
          .json({ message: "Expanded balance transaction is unavailable." });
      }

      const exactStripeFee = balanceTransaction.fee / 100;
      const totalCollected = session.amount_total / 100;

      await Order.findByIdAndUpdate(ParentorderID, {
        paymentIntentId: session.payment_intent,
        paymentStatus: "paid",
        paymentMethod: session.payment_method_types,
      });

      const subOrders = await subOrderSchema.find({ ParentorderID });

      for (const subOrder of subOrders) {
        const ratio = subOrder.subOrderTotal / totalCollected;
        const stripeFeeAllocation = exactStripeFee * ratio;
        const poolafterStripeFee = subOrder.subOrderTotal - stripeFeeAllocation;

        subOrder.platformComissionCut = Number(
          (poolafterStripeFee * 0.1).toFixed(2),
        );
        subOrder.vendorNetEarned = Number(
          (poolafterStripeFee - subOrder.platformComissionCut).toFixed(2),
        );
        subOrder.status = "processing";
        await subOrder.save();
      }
    }
    res.json({ received: true });
  },
);

export default router;
