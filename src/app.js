import express from "express";
import cors from "cors";
import reconciliationRoutes from "./routes/reconciliationRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", reconciliationRoutes);

export default app;
