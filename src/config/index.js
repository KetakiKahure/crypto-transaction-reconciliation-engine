import dotenv from "dotenv";

dotenv.config();

const parseNumber = (value, defaultValue) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

const config = {
  PORT: process.env.PORT ? Number(process.env.PORT) : 5000,
  MONGO_URI: process.env.MONGO_URI,
  TIMESTAMP_TOLERANCE_SECONDS: parseNumber(process.env.TIMESTAMP_TOLERANCE_SECONDS, 300),
  QUANTITY_TOLERANCE_PCT: parseNumber(process.env.QUANTITY_TOLERANCE_PCT, 0.01),
  REPORTS_DIR: process.env.REPORTS_DIR || "reports",
  USER_CSV_DEFAULT: process.env.USER_CSV_DEFAULT || "uploads/user_transactions.csv",
  EXCHANGE_CSV_DEFAULT: process.env.EXCHANGE_CSV_DEFAULT || "uploads/exchange_transactions.csv",
};

export default config;
