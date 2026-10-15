import cron from "node-cron";
import subOrder from "../models/orderItems.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import mongoose from "mongoose";
const cronWorker = async () => {
    cron.schedule("0 * * * *", async () => {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const onehourago = new Date(Date.now() - 60 * 60 * 1000);
            const expiredSubOrders = await subOrder
                .find({
                status: "pending",
                createdAt: { $lt: onehourago },
            })
                .session(session);
            if (expiredSubOrders.length === 0)
                return;
            for (const expiredSubOrder of expiredSubOrders) {
                for (const item of expiredSubOrder.items) {
                    await Product.findByIdAndUpdate(item.productID, {
                        $inc: { stock: item.quantity },
                    }, { session });
                }
                await subOrder.deleteOne({ _id: expiredSubOrder._id }, { session });
                await Order.findByIdAndDelete({ _id: expiredSubOrder.ParentorderID }, { session });
            }
            await session.commitTransaction();
        }
        catch (error) {
            console.log(error);
            await session.abortTransaction();
        }
        finally {
            session.endSession();
        }
    });
};
export default cronWorker;
