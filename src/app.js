import express from "express";
import cors from "cors";
import reconciliationRoutes from "./routes/reconciliationRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Crypto Reconciliation Engine</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: #0f172a;
            color: white;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
          }

          .container {
            text-align: center;
            max-width: 700px;
            padding: 40px;
          }

          h1 {
            color: #38bdf8;
            margin-bottom: 10px;
          }

          p {
            line-height: 1.6;
            color: #cbd5e1;
          }

          .badge {
            display: inline-block;
            margin-top: 20px;
            padding: 10px 18px;
            background: #1e293b;
            border-radius: 8px;
            color: #38bdf8;
            font-weight: bold;
          }

          a {
            color: #38bdf8;
            text-decoration: none;
          }
        </style>
      </head>

      <body>
        <div class="container">
          <h1>Crypto Reconciliation Engine</h1>

          <p>
            A Node.js + MongoDB backend system for reconciling
            crypto exchange and user transaction datasets.
          </p>

          <p>
            Features include CSV ingestion, validation,
            transaction matching, duplicate detection,
            reconciliation reporting, and REST APIs.
          </p>

          <div class="badge">
            API Status: Running
          </div>

          <p style="margin-top:30px;">
            <a href="/health">Health Check</a>
          </p>
        </div>
      </body>
    </html>
  `);
});
app.use("/api", reconciliationRoutes);

export default app;
