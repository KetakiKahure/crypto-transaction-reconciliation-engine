import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    runId: String,

    source: {
      type: String,
      enum: ["USER", "EXCHANGE"],
    },

    transactionId: String,

    timestamp: Date,

    asset: String,

    type: String,

    quantity: Number,

    price_usd: Number,

    fee: Number,

    note: String,

    rawData: Object,

    isValid: {
      type: Boolean,
      default: true,
    },

    validationErrors: [String],
  },
  {
    timestamps: true,
  }
);

// module.exports = mongoose.model(
//   "Transaction",
//   transactionSchema
// );

export default mongoose.model("Transaction", transactionSchema);