import fs from "fs";
import path from "path";
import { Parser } from "json2csv";
import normalizeType from "../utils/typeMapper.js";
import normalizeAsset from "../utils/assetMapper.js";

const categorizeEntry = ({ category, reason, userTransaction, exchangeTransaction, timestampDiffSeconds, quantityDiffPct }) => ({
  category,
  reason,
  userTransaction,
  exchangeTransaction,
  timestampDiffSeconds,
  quantityDiffPct,
});

const getTimestampDiffSeconds = (left, right) => {
  if (!left || !right) return Number.POSITIVE_INFINITY;
  return Math.abs(left.getTime() - right.getTime()) / 1000;
};

const getQuantityDiffPct = (left, right) => {
  if (left === null || right === null || left === undefined || right === undefined) {
    return Number.POSITIVE_INFINITY;
  }

  if (left === 0 && right === 0) {
    return 0;
  }

  const maxValue = Math.max(Math.abs(left), Math.abs(right));
  if (maxValue === 0) {
    return Number.POSITIVE_INFINITY;
  }

  return (Math.abs(left - right) / maxValue) * 100;
};

const classifyMatch = (timestampDiffSeconds, quantityDiffPct, config) => {
  const timeMatch = timestampDiffSeconds <= config.timestampToleranceSeconds;
  const quantityMatch = quantityDiffPct <= config.quantityTolerancePct;

  if (timeMatch && quantityMatch) {
    return "Matched";
  }

  if (timeMatch || quantityMatch) {
    return "Conflicting";
  }

  if (
    timestampDiffSeconds <= config.timestampToleranceSeconds * 2 &&
    quantityDiffPct <= config.quantityTolerancePct * 5
  ) {
    return "Conflicting";
  }

  return "Unmatched";
};

const buildReason = (user, exchange, timestampDiffSeconds, quantityDiffPct, category) => {
  if (category === "Matched") {
    return "Matched within configured tolerances.";
  }

  if (category === "Conflicting") {
    const issues = [];
    if (timestampDiffSeconds > 0) {
      issues.push(`timestamp differs by ${timestampDiffSeconds.toFixed(1)}s`);
    }
    if (quantityDiffPct > 0) {
      issues.push(`quantity differs by ${quantityDiffPct.toFixed(2)}%`);
    }
    return `Matched by asset/type, but ${issues.join(" and ")} beyond tolerance.`;
  }

  if (user && !user.isValid) {
    return `User row is invalid: ${user.validationErrors.join("; ")}`;
  }

  if (exchange && !exchange.isValid) {
    return `Exchange row is invalid: ${exchange.validationErrors.join("; ")}`;
  }

  return "No matching opposite-side transaction found.";
};

const createReportRow = (category, reason, userTransaction, exchangeTransaction, timestampDiffSeconds, quantityDiffPct) =>
  categorizeEntry({
    category,
    reason,
    userTransaction,
    exchangeTransaction,
    timestampDiffSeconds,
    quantityDiffPct,
  });

const canMatchAsset = (leftAsset, rightAsset) => {
  if (!leftAsset || !rightAsset) return false;
  return normalizeAsset(leftAsset) === normalizeAsset(rightAsset);
};

const canMatchType = (leftType, rightType) => {
  if (!leftType || !rightType) return false;

  const leftCanonical = normalizeType(leftType);
  const rightCanonical = normalizeType(rightType);

  return leftCanonical === rightCanonical;
};

const buildCsvRow = (entry) => {
  const user = entry.userTransaction || {};
  const exchange = entry.exchangeTransaction || {};

  return {
    category: entry.category,
    reason: entry.reason,
    user_transaction_id: user.transactionId || "",
    user_timestamp: user.timestamp ? user.timestamp.toISOString() : "",
    user_type: user.rawData?.type || user.type || "",
    user_asset: user.rawData?.asset || user.asset || "",
    user_quantity: user.quantity ?? "",
    user_price_usd: user.price_usd ?? "",
    user_fee: user.fee ?? "",
    user_note: user.note || "",
    user_validation_errors: user.validationErrors ? user.validationErrors.join(" | ") : "",
    exchange_transaction_id: exchange.transactionId || "",
    exchange_timestamp: exchange.timestamp ? exchange.timestamp.toISOString() : "",
    exchange_type: exchange.rawData?.type || exchange.type || "",
    exchange_asset: exchange.rawData?.asset || exchange.asset || "",
    exchange_quantity: exchange.quantity ?? "",
    exchange_price_usd: exchange.price_usd ?? "",
    exchange_fee: exchange.fee ?? "",
    exchange_note: exchange.note || "",
    exchange_validation_errors: exchange.validationErrors
      ? exchange.validationErrors.join(" | ")
      : "",
    timestamp_diff_seconds:
      Number.isFinite(entry.timestampDiffSeconds) ? entry.timestampDiffSeconds.toFixed(1) : "",
    quantity_diff_pct:
      Number.isFinite(entry.quantityDiffPct)
        ? entry.quantityDiffPct.toFixed(3)
        : "",
  };
};

export const reconcileTransactions = (userTransactions, exchangeTransactions, config) => {
  const userRows = userTransactions.map((transaction, index) => ({
    ...transaction,
    __sideIndex: index,
  }));

  const exchangeRows = exchangeTransactions.map((transaction, index) => ({
    ...transaction,
    __sideIndex: index,
  }));

  const matchedExchangeIndices = new Set();
  const entries = [];

  for (const user of userRows) {
    if (!user.isValid) {
      entries.push(
        createReportRow(
          "Invalid (User only)",
          buildReason(user, null, 0, 0, "Unmatched"),
          user,
          null,
          Number.POSITIVE_INFINITY,
          Number.POSITIVE_INFINITY
        )
      );
      continue;
    }

    // First priority: try to match by transaction ID
    let bestCandidate = null;
    let bestTimestampDiff = Number.POSITIVE_INFINITY;
    let bestQuantityDiff = Number.POSITIVE_INFINITY;

    const idMatch = exchangeRows.find(
      (exchange) =>
        !matchedExchangeIndices.has(exchange.__sideIndex) &&
        exchange.isValid &&
        exchange.transactionId &&
        user.transactionId &&
        exchange.transactionId === user.transactionId
    );

    if (idMatch) {
      bestCandidate = idMatch;
      bestTimestampDiff = getTimestampDiffSeconds(user.timestamp, idMatch.timestamp);
      bestQuantityDiff = getQuantityDiffPct(user.quantity, idMatch.quantity);
    } else {
      // Second priority: fuzzy match by asset, type, time, quantity
      const candidates = exchangeRows
        .map((exchange) => {
          const timestampDiffSeconds = getTimestampDiffSeconds(user.timestamp, exchange.timestamp);
          const quantityDiffPct = getQuantityDiffPct(user.quantity, exchange.quantity);
          return {
            exchange,
            timestampDiffSeconds,
            quantityDiffPct,
          };
        })
        .filter(({ exchange, timestampDiffSeconds, quantityDiffPct }) => {
          return (
            !matchedExchangeIndices.has(exchange.__sideIndex) &&
            exchange.isValid &&
            canMatchAsset(user.asset, exchange.asset) &&
            canMatchType(user.type, exchange.type) &&
            timestampDiffSeconds <= config.timestampToleranceSeconds * 10 &&
            quantityDiffPct <= config.quantityTolerancePct * 50
          );
        })
        .sort((a, b) => {
          const scoreA = a.timestampDiffSeconds + a.quantityDiffPct * 1000;
          const scoreB = b.timestampDiffSeconds + b.quantityDiffPct * 1000;
          return scoreA - scoreB;
        });

      bestCandidate = candidates[0]?.exchange;
      bestTimestampDiff = candidates[0]?.timestampDiffSeconds ?? Number.POSITIVE_INFINITY;
      bestQuantityDiff = candidates[0]?.quantityDiffPct ?? Number.POSITIVE_INFINITY;
    }

    if (bestCandidate) {
      const matchCategory = classifyMatch(bestTimestampDiff, bestQuantityDiff, config);
      const reason = buildReason(user, bestCandidate, bestTimestampDiff, bestQuantityDiff, matchCategory);
      const category = matchCategory === "Matched" ? "Matched" : "Conflicting";

      entries.push(createReportRow(category, reason, user, bestCandidate, bestTimestampDiff, bestQuantityDiff));
      matchedExchangeIndices.add(bestCandidate.__sideIndex);
      continue;
    }

    entries.push(
      createReportRow(
        "Unmatched (User only)",
        buildReason(user, null, 0, 0, "Unmatched"),
        user,
        null,
        Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY
      )
    );
  }

  for (const exchange of exchangeRows) {
    if (matchedExchangeIndices.has(exchange.__sideIndex)) {
      continue;
    }

    if (!exchange.isValid) {
      entries.push(
        createReportRow(
          "Invalid (Exchange only)",
          buildReason(null, exchange, 0, 0, "Unmatched"),
          null,
          exchange,
          Number.POSITIVE_INFINITY,
          Number.POSITIVE_INFINITY
        )
      );
      continue;
    }

    entries.push(
      createReportRow(
        "Unmatched (Exchange only)",
        buildReason(null, exchange, 0, 0, "Unmatched"),
        null,
        exchange,
        Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY
      )
    );
  }

  const summary = {
    matched: entries.filter((entry) => entry.category === "Matched").length,
    conflicting: entries.filter((entry) => entry.category === "Conflicting").length,
    unmatchedUser: entries.filter((entry) => entry.category === "Unmatched (User only)").length,
    unmatchedExchange: entries.filter((entry) => entry.category === "Unmatched (Exchange only)").length,
    invalidUser: entries.filter((entry) => entry.category === "Invalid (User only)").length,
    invalidExchange: entries.filter((entry) => entry.category === "Invalid (Exchange only)").length,
  };

  return { entries, summary };
};

export const buildCsvReport = async (entries, runId, reportsDir) => {
  const csvFileName = `reconciliation-report-${runId}.csv`;
  const csvFilePath = path.resolve(reportsDir, csvFileName);

  await fs.promises.mkdir(path.dirname(csvFilePath), { recursive: true });

  const parser = new Parser({ fields: Object.keys(buildCsvRow(entries[0] || {})) });
  const csvRows = entries.map(buildCsvRow);
  const csv = parser.parse(csvRows);

  await fs.promises.writeFile(csvFilePath, csv, "utf-8");

  return csvFilePath;
};
