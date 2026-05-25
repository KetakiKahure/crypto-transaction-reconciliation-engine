import express from "express";
import multer from "multer";
import path from "path";
import {
  reconcile,
  getReport,
  getSummary,
  getUnmatched,
} from "../controllers/reconciliationController.js";

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.resolve(process.cwd(), "uploads"));
    },
    filename: (req, file, cb) => {
      const timestamp = Date.now();
      const safeName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, "_");
      cb(null, `${timestamp}-${safeName}`);
    },
  }),
});

const router = express.Router();

router.post(
  "/reconcile",
  upload.fields([
    { name: "user", maxCount: 1 },
    { name: "exchange", maxCount: 1 },
  ]),
  reconcile
);
router.get("/report/:runId", getReport);
router.get("/report/:runId/summary", getSummary);
router.get("/report/:runId/unmatched", getUnmatched);

export default router;
