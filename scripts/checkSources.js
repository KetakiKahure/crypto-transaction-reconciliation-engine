import mongoose from "mongoose";
import Transaction from "../src/models/Transaction.js";
import config from "../src/config/index.js";

const run = async () => {
  await mongoose.connect(config.MONGO_URI);
  const counts = await Transaction.aggregate([
    { $group: { _id: "$source", count: { $sum: 1 } } },
  ]);
  console.log(JSON.stringify(counts, null, 2));
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});