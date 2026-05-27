import fs from "fs";
import path from "path";
import csv from "csv-parser";
import Transaction from "../models/Transaction.js";
import normalizeType from "../utils/typeMapper.js";
import normalizeAsset from "../utils/assetMapper.js";

const parseNumberValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

async function ingestCSV(filePath, source, runId) {
  return new Promise((resolve, reject) => {
    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(resolvedPath)) {
      return reject(new Error(`CSV file not found: ${resolvedPath}`));
    }

    const transactions = [];
    const seenTransactionIds = new Set();

    fs.createReadStream(resolvedPath)
      .pipe(csv())
      .on("data", (row) => {
        const errors = [];
        const parsedTimestamp = Date.parse(row.timestamp);
        const quantity = parseNumberValue(row.quantity);
        const priceUsd = parseNumberValue(row.price_usd);
        const fee = parseNumberValue(row.fee);

        if (!row.transaction_id) {
          errors.push("Missing transaction ID");
        }

        if (row.transaction_id) {
          if (seenTransactionIds.has(row.transaction_id)) {
            errors.push("Duplicate transaction ID");
          } else {
            seenTransactionIds.add(row.transaction_id);
          }
        }

        if (!row.timestamp) {
          errors.push("Missing timestamp");
        }

        if (row.timestamp && isNaN(parsedTimestamp)) {
          errors.push("Malformed timestamp");
        }

        if (!row.asset || !row.asset.toString().trim()) {
          errors.push("Missing asset");
        }

        if (!row.type || !row.type.toString().trim()) {
          errors.push("Missing transaction type");
        }

        if (quantity === null) {
          errors.push("Invalid quantity");
        }

        if (quantity !== null && quantity < 0) {
          errors.push("Negative quantity");
        }

        const transaction = {
          runId,
          source: source.toString().trim().toUpperCase(),
          transactionId: row.transaction_id,
          timestamp: isNaN(parsedTimestamp) ? null : new Date(parsedTimestamp),
          asset: normalizeAsset(row.asset),
          type: normalizeType(row.type),
          quantity,
          price_usd: priceUsd,
          fee,
          note: row.note,
          rawData: row,
          isValid: errors.length === 0,
          validationErrors: errors,
        };

        transactions.push(transaction);
      })
      .on("end", async () => {
        if (transactions.length > 0) {
          try {
            await Transaction.insertMany(transactions, {
              ordered: false,
            });
          } catch (error) {
            console.error("Transaction insert warning:", error.message);
          }
        }

        resolve({
          totalRows: transactions.length,
          savedRows: transactions.filter((transaction) => transaction.isValid).length,
          invalidRows: transactions.filter((transaction) => !transaction.isValid).length,
          transactions,
        });
      })
      .on("error", (err) => {
        reject(err);
      });
  });
}

export default ingestCSV;