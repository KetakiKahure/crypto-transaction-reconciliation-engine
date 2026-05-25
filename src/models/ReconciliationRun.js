import mongoose from "mongoose";

const reconciliationEntrySchema = new mongoose.Schema(
  {
    category: String,
    reason: String,
    userTransaction: Object,
    exchangeTransaction: Object,
    timestampDiffSeconds: Number,
    quantityDiffPct: Number,
  },
  { _id: false }
);

const reconciliationRunSchema = new mongoose.Schema(
  {
    runId: {
      type: String,
      unique: true,
      required: true,
    },
    userFilePath: String,
    exchangeFilePath: String,
    config: {
      timestampToleranceSeconds: Number,
      quantityTolerancePct: Number,
    },
    status: {
      type: String,
      enum: ["pending", "complete", "failed"],
      default: "pending",
    },
    stats: {
      userRows: Number,
      exchangeRows: Number,
      invalidUserRows: Number,
      invalidExchangeRows: Number,
      matched: Number,
      conflicting: Number,
      unmatchedUser: Number,
      unmatchedExchange: Number,
      invalidUser: Number,
      invalidExchange: Number,
      totalEntries: Number,
    },
    reportFilePath: String,
    entries: [reconciliationEntrySchema],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("ReconciliationRun", reconciliationRunSchema);