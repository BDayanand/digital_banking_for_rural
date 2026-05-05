require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const cron = require("node-cron");

const userRoutes = require("./routes/userRoutes");
const txnRoutes = require("./routes/txnRoutes");
const otpRoutes = require("./routes/otpRoutes");
const app = express();

// ✅ Universal CORS Setup (Compatible with Express 5)
app.use(
  cors({
    origin: "*", 
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ✅ Safe alternative to avoid path-to-regexp '*' error
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// Middleware
app.use(bodyParser.json());
app.use(express.json());

// ✅ MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// ✅ Routes
app.use("/api/users", userRoutes);
app.use("/api/txns", txnRoutes);
app.use("/api/otp", otpRoutes);
app.use("/api/dashboard", require("./routes/dashboard.routes"));
app.use("/api/fraud", require("./routes/fraudRoutes"));
app.use("/api/reports", require("./routes/reportRoutes"));
app.use("/api/chatbot", require("./routes/chatbotRoutes"));
app.use("/api/live-chat", require("./routes/liveChatRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/upi-collect", require("./routes/upiCollectRoutes"));

// ✅ Default route
app.get("/", (req, res) => {
  res.json({ message: "GramBank API is running 🚀" });
});

// ✅ Cron Job: Process scheduled transactions every minute
cron.schedule("* * * * *", async () => {
  try {
    const ScheduledTransaction = require("./models/ScheduledTransaction");
    const User = require("./models/User");
    const Transaction = require("./models/Transaction");

    const now = new Date();
    console.log(`[CRON] Running at ${now.toISOString()}`);

    const pendingTxns = await ScheduledTransaction.find({
      status: "PENDING",
      auto_process_at: { $lte: now },
      processing_locked: false,
      is_reported: false,
    }).populate("user_id");

    console.log(`[CRON] Found ${pendingTxns.length} transactions ready to process`);

    for (const schedTxn of pendingTxns) {
      try {
        if (schedTxn.status !== "PENDING") continue;

        schedTxn.processing_locked = true;
        await schedTxn.save();

        const user = schedTxn.user_id;
        if (!user || user.balance < schedTxn.amount) {
          schedTxn.status = "FAILED";
          schedTxn.delay_reason = "Insufficient balance";
          schedTxn.processed_at = now;
          await schedTxn.save();
          console.log(`[CRON] Failed ${schedTxn.txn_id}: insufficient balance`);
          continue;
        }

        const balance_before = user.balance;
        const balance_after = +(balance_before - schedTxn.amount).toFixed(2);

        user.balance = balance_after;
        user.transactionsCount = (user.transactionsCount || 0) + 1;
        await user.save();

        await Transaction.create({
          txn_id: schedTxn.txn_id,
          user_id: user._id,
          to_account: schedTxn.to_account,
          to_upi: schedTxn.to_upi,
          ifsc: schedTxn.ifsc,
          beneficiary_name: schedTxn.beneficiary_name,
          amount: schedTxn.amount,
          balance_before,
          balance_after,
          type: "DEBIT",
          is_fraud: false,
        });

        const receiver = await User.findOne({ accountNumber: schedTxn.to_account });
        if (receiver) {
          const r_before = receiver.balance;
          const r_after = +(receiver.balance + schedTxn.amount).toFixed(2);

          await Transaction.create({
            txn_id: `${schedTxn.txn_id}-CREDIT`,
            user_id: receiver._id,
            from_account: user.accountNumber,
            to_account: receiver.accountNumber,
            amount: schedTxn.amount,
            balance_before: r_before,
            balance_after: r_after,
            type: "CREDIT",
            is_fraud: false,
          });

          receiver.balance = r_after;
          receiver.transactionsCount = (receiver.transactionsCount || 0) + 1;
          await receiver.save();
        }

        schedTxn.status = "COMPLETED";
        schedTxn.processed_at = now;
        await schedTxn.save();
        console.log(`[CRON] Completed ${schedTxn.txn_id}`);
      } catch (err) {
        console.error(`[CRON] Failed processing ${schedTxn.txn_id}:`, err);
        try {
          schedTxn.status = "FAILED";
          schedTxn.delay_reason = err.message || "Processing error";
          schedTxn.processed_at = now;
          await schedTxn.save();
        } catch (saveErr) {
          console.error(`[CRON] Failed to save status for ${schedTxn.txn_id}:`, saveErr);
        }
      }
    }
  } catch (err) {
    console.error("[CRON] Error:", err);
  }
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));