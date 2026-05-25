import path from "path";
import { v4 as uuidv4 } from "uuid";
import ReconciliationRun from "../models/ReconciliationRun.js";
import ingestCSV from "../services/csvIngestionService.js";
import {
  reconcileTransactions,
  buildCsvReport,
} from "../services/reconciliationService.js";
import config from "../config/index.js";

const resolveCsvPath = (filePath, defaultPath) => {
  if (!filePath) {
    return path.resolve(process.cwd(), defaultPath);
  }

  return path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);
};

const parseJsonField = (value) => {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value;
};

const getRequestConfig = (body) => {
  const overrides = parseJsonField(body.config) || {};

  return {
    timestampToleranceSeconds:
      body.timestampToleranceSeconds ??
      overrides.timestampToleranceSeconds ??
      body.TIMESTAMP_TOLERANCE_SECONDS ??
      overrides.TIMESTAMP_TOLERANCE_SECONDS ??
      config.TIMESTAMP_TOLERANCE_SECONDS,
    quantityTolerancePct:
      body.quantityTolerancePct ??
      overrides.quantityTolerancePct ??
      body.QUANTITY_TOLERANCE_PCT ??
      overrides.QUANTITY_TOLERANCE_PCT ??
      config.QUANTITY_TOLERANCE_PCT,
  };
};

export const reconcile = async (req, res) => {
  try {
    const runId = uuidv4();
    const uploadedFiles = req.files || {};
    const userUploaded = uploadedFiles.user?.[0];
    const exchangeUploaded = uploadedFiles.exchange?.[0];

    const userFilePath = userUploaded
      ? userUploaded.path
      : resolveCsvPath(req.body.userFilePath, config.USER_CSV_DEFAULT);
    const exchangeFilePath = exchangeUploaded
      ? exchangeUploaded.path
      : resolveCsvPath(req.body.exchangeFilePath, config.EXCHANGE_CSV_DEFAULT);

    const runConfig = getRequestConfig(req.body);

    const userIngest = await ingestCSV(userFilePath, "USER", runId);
    const exchangeIngest = await ingestCSV(exchangeFilePath, "EXCHANGE", runId);

    const reconciliation = reconcileTransactions(
      userIngest.transactions,
      exchangeIngest.transactions,
      runConfig
    );

    const reportFilePath = await buildCsvReport(
      reconciliation.entries,
      runId,
      config.REPORTS_DIR
    );

    const runDoc = new ReconciliationRun({
      runId,
      userFilePath,
      exchangeFilePath,
      config: runConfig,
      status: "complete",
      stats: {
        userRows: userIngest.totalRows,
        exchangeRows: exchangeIngest.totalRows,
        invalidUserRows: userIngest.invalidRows,
        invalidExchangeRows: exchangeIngest.invalidRows,
        matched: reconciliation.summary.matched,
        conflicting: reconciliation.summary.conflicting,
        unmatchedUser: reconciliation.summary.unmatchedUser,
        unmatchedExchange: reconciliation.summary.unmatchedExchange,
        invalidUser: reconciliation.summary.invalidUser,
        invalidExchange: reconciliation.summary.invalidExchange,
        totalEntries: reconciliation.entries.length,
      },
      reportFilePath,
      entries: reconciliation.entries,
    });

    await runDoc.save();

    res.status(201).json({
      runId,
      reportFilePath,
      stats: runDoc.stats,
    });
  } catch (error) {
    console.error("Reconciliation failed:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getReport = async (req, res) => {
  const runId = req.params.runId;

  const run = await ReconciliationRun.findOne({ runId }).lean();
  if (!run) {
    return res.status(404).json({ error: "Reconciliation run not found" });
  }

  res.json(run);
};

export const getSummary = async (req, res) => {
  const runId = req.params.runId;

  const run = await ReconciliationRun.findOne({ runId }).lean();
  if (!run) {
    return res.status(404).json({ error: "Reconciliation run not found" });
  }

  res.json(run.stats);
};

export const getUnmatched = async (req, res) => {
  const runId = req.params.runId;

  const run = await ReconciliationRun.findOne({ runId }).lean();
  if (!run) {
    return res.status(404).json({ error: "Reconciliation run not found" });
  }

  const unmatchedEntries = run.entries.filter((entry) =>
    entry.category.startsWith("Unmatched")
  );

  res.json(unmatchedEntries);
};
