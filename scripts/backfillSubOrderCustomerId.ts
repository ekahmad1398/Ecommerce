import mongoose from "mongoose";
import env from "../src/config.js";
import subOrderItems from "../src/models/orderItems.js";
import Order from "../src/models/Order.js";

// One-off migration: copy customerID from the parent order onto suborders
// created before the field existed. Run: npx tsx scripts/backfillSubOrderCustomerId.ts
async function backfill() {
  await mongoose.connect(env.MONGODB_URI);

  const missing = await subOrderItems
    .find({ customerID: { $exists: false } })
    .select("ParentorderID")
    .lean();

  console.log(`Found ${missing.length} suborders missing customerID`);

  let updated = 0;
  let skipped = 0;
  for (const subOrder of missing) {
    const parent = await Order.findById(subOrder.ParentorderID)
      .select("customerID")
      .lean();
    if (!parent?.customerID) {
      skipped++;
      continue;
    }
    await subOrderItems.updateOne(
      { _id: subOrder._id },
      { $set: { customerID: parent.customerID } },
    );
    updated++;
  }

  console.log(`Updated: ${updated}, Skipped (no parent/customer): ${skipped}`);
  await mongoose.disconnect();
}

backfill().catch((error) => {
  console.error(error);
  process.exit(1);
});
