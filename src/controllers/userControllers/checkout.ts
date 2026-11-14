import mongoose from "mongoose";
import Order from "../../models/Order.js";
import ProducSchema from "../../models/Product.js";
import subOrderItems from "../../models/orderItems.js";
import Stripe from "stripe";
import env from "../../config.js";
import { NextFunction, Request, Response } from "express";

const stripe = new Stripe(env.STRIPE_SECRET_KEY);
export const checkout = async (req:Request, res:Response, next:NextFunction) => {
  let dbSession: mongoose.ClientSession | null = null;
  try {
    const customerID = (req as any).user.id;
    const { shippingAddress, CartItems, paymentMethod } = req.body;

    const allowedMethods = ["Stripe_Card", "COD"];
    if (!allowedMethods.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "unsupported payment method selector",
      });
    }

    if (
      !shippingAddress ||
      !CartItems ||
      !Array.isArray(CartItems) ||
      CartItems.length === 0
    ) {
      return res
        .status(400)
        .json({ success: false, message: "please fill the requirements" });
    }

    dbSession = await mongoose.startSession();
    dbSession.startTransaction();

    let totalPrice = 0;
    const vendorGrouptedItems: Record<
      string,
      Array<{
        productID: mongoose.Types.ObjectId;
        quantity: number;
        price: number;
        subtotal: number;
      }>
    > = {};
    const lineItems = [];

    for (const item of CartItems) {
      const product = await ProducSchema.findOne({
        _id: item.productID,
        status: "active",
      }).session(dbSession);

      const requestedQuantity = item.quantity;
      if (!product || product.stock < requestedQuantity) {
        await dbSession.abortTransaction();
        dbSession.endSession();
        return res.status(404).json({
          success: false,
          message: `insuffiecient stock or product missing.`,
        });
      }
      product.stock -= requestedQuantity;
      await product.save({ session: dbSession });

      const unitPrice = product.price * (1 - (product.discount ?? 0) / 100);
      const lineTotal = unitPrice * requestedQuantity;
      totalPrice += lineTotal;

      const formattedTotalRow = {
        productID: product._id,
        quantity: requestedQuantity,
        price: unitPrice,
        subtotal: lineTotal,
      };
      const vendorKey = product.vendorId.toString();
      if (!vendorGrouptedItems[vendorKey]) {
        vendorGrouptedItems[vendorKey] = [];
      }
      vendorGrouptedItems[vendorKey].push(formattedTotalRow);

      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: product.name,
            images: (product.images ?? [])
              .map((image: { publicId?: string }) => image.publicId)
              .filter((url: string | undefined): url is string => Boolean(url))
              .slice(0, 8),
          },
          unit_amount: Math.round(unitPrice * 100),
        },
        quantity: requestedQuantity,
      });
    }

    if (paymentMethod === "COD") {
      const parentOrder = new Order({
        customerID,
        totalPrice,
        paymentMethod: "cash_on_delievery",
        paymentStatus: "processing",
        shippingAddress,
      });
      await parentOrder.save({ session: dbSession });
      const subOrderPromises = Object.keys(vendorGrouptedItems).map(
        async (vendorID) => {
          const itemList = vendorGrouptedItems[vendorID];
          const subtotal = itemList.reduce((sum, i) => sum + i.subtotal, 0);
          const subOrder = new subOrderItems({
              ParentorderID: parentOrder._id,
              vendorID,
              items: itemList,
              platformComissionCut: Number((Number(subtotal) * 0.1).toFixed(2)),
              vendorNetEarned: Number((Number(subtotal) * 0.9).toFixed(2)),
              subOrderTotal: Number(subtotal.toFixed(2)),
              status: "processing",
            });
          return await subOrder.save({ session: dbSession });
        },
      );

      await Promise.all(subOrderPromises);

      await dbSession.commitTransaction();
      dbSession.endSession();

      return res.status(201).json({
        success: true,
        message: "Cash on Delievery order registered successfully.",
        orderId: parentOrder._id,
      });
    }

    if (paymentMethod === "Stripe_Card") {
      const parentOrder = new Order({
        customerID,
        totalPrice,
        paymentMethod: "card",
        shippingAddress,
      });
      await parentOrder.save({ session: dbSession });

      const subOrderPromises = Object.keys(vendorGrouptedItems).map(
        async (vendorID) => {
          const itemList = vendorGrouptedItems[vendorID];
          const subtotal = itemList.reduce((sum: any, i: { subtotal: any; }) => sum + i.subtotal, 0);
          const subOrder = new subOrderItems({
            ParentorderID: String((parentOrder as any)._id),
            vendorID,
            items: itemList,
            platformComissionCut: 0,
            vendorNetEarned: 0,
            subOrderTotal: Number(subtotal.toFixed(2)),
            status: "pending",
          });
          return await subOrder.save({ session: dbSession });
        },
      );
      await Promise.all(subOrderPromises);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: lineItems,
        mode: "payment",
        success_url: `${env.Frontend_URL}/orders?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.Frontend_URL}/cart`,
        shipping_address_collection: { allowed_countries: ["US", "CA"] },
        metadata: {
          customerId: customerID,
          ParentorderID: String((parentOrder as any)._id),
        },
      });

      await dbSession.commitTransaction();
      dbSession.endSession();

      return res.status(201).json({
        success: true,
        url: session.url,
      });
    }
  } catch (error) {
    try {
      await dbSession?.abortTransaction();
      dbSession?.endSession();
    } catch {
      // transaction already committed or aborted — nothing to roll back
    }
    next(error);
  }
};
