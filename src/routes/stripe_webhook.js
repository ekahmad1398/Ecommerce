import Stripe from "stripe";
import express from "express";
import subOrderSchema from "../models/orderItems.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const router = express.Router();

router.post(
  "/webhook/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;
    try {
      event = Stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.webhook_secret,
      );
    } catch (error) {
      console.log(error);
      res.status(400).json({ message: "Webhook signature error." });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const ParentorderID = session.metadata.ParentorderID;

      const paymentIntent = await stripe.paymentIntents.retrieve(
        session.payment_intent,
        {
          expand: ["latest_charge.balance_transaction"],
        },
      );

      const exactStripeFee =
        paymentIntent.latest_charge.balance_transaction.fee / 100;
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

export default router
