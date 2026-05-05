// routes/txnRoutes.js
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const Otp = require("../models/Otp");
const ScheduledTransaction = require("../models/ScheduledTransaction");
const auth = require("../middleware/auth");
const router = express.Router();
const TransactionReport = require("../models/TransactionReport");
const TrustedReceiver = require("../models/TrustedReceiver");
const FraudAccount = require("../models/FraudAccount");
const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioClient = require("twilio")(accountSid, authToken);

// ---- Constants for transaction processing ----
const HIGH_VALUE_THRESHOLD = 10000;
const DELAY_DURATION_MS = 60 * 60 * 1000; // 1 hour
const TRUST_WINDOW_MS = 60 * 1000; // 1 minute
const RAPID_SEQUENCE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_TXNS_IN_WINDOW = 3;
const RAPID_SEQUENCE_AMOUNT_THRESHOLD = 5000;
const SUSPICIOUS_MULTI_ACCOUNT_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const MAX_UNIQUE_ACCOUNTS = 2;

// ---- Helper: Advanced fraud detection rules ----
async function advancedFraudCheck(userId, amount, toAccount) {
  const suspiciousFlags = [];
  let riskScore = 0;

  // Get recent transactions for pattern analysis
  const recentTxns = await Transaction.find({
    user_id: userId,
    createdAt: { $gte: new Date(Date.now() - SUSPICIOUS_MULTI_ACCOUNT_WINDOW_MS) }
  }).sort({ createdAt: -1 });

  // Rule 1: Rapid Sequence Detection
  // Fraudsters transfer money through multiple accounts quickly
  const recentDebits = recentTxns.filter(t => t.type === 'DEBIT' && !t.is_fraud);
  const rapidSequenceTxns = recentDebits.filter(t => 
    (Date.now() - new Date(t.createdAt).getTime()) < RAPID_SEQUENCE_WINDOW_MS
  );

  if (rapidSequenceTxns.length >= MAX_TXNS_IN_WINDOW) {
    const uniqueAccounts = new Set(
      rapidSequenceTxns
        .filter(t => t.to_account)
        .map(t => t.to_account)
    );
    
    if (uniqueAccounts.size >= MAX_UNIQUE_ACCOUNTS) {
      suspiciousFlags.push('RAPID_SEQUENCE_MULTI_ACCOUNT');
      riskScore += 40;
    }
  }

  // Rule 2: Rapid sequence detected (fast consecutive transactions)
  if (recentDebits.length > 0) {
    const lastTxn = recentDebits[0];
    const timeSinceLastTxn = (Date.now() - new Date(lastTxn.createdAt).getTime()) / 1000;
    
    if (timeSinceLastTxn < 60 && lastTxn.amount >= RAPID_SEQUENCE_AMOUNT_THRESHOLD) {
      suspiciousFlags.push('RAPID_CONSECUTIVE_TRANSACTION');
      riskScore += 30;
    }
  }

  // Rule 3: High value transaction delay trigger
  if (amount > HIGH_VALUE_THRESHOLD) {
    riskScore += 20;
    suspiciousFlags.push('HIGH_VALUE_TRANSACTION');
  }

  // Rule 4: Pattern matching - multiple accounts in short time
  const accountsInWindow = recentTxns
    .filter(t => t.to_account && (Date.now() - new Date(t.createdAt).getTime()) < SUSPICIOUS_MULTI_ACCOUNT_WINDOW_MS)
    .map(t => t.to_account);
  
  const uniqueAccountsCount = new Set(accountsInWindow).size;
  if (uniqueAccountsCount >= MAX_UNIQUE_ACCOUNTS && toAccount && !accountsInWindow.includes(toAccount)) {
    suspiciousFlags.push('NEW_ACCOUNT_AFTER_MULTI_ACCOUNT_PATTERN');
    riskScore += 25;
  }

  // Rule 5: Structuring detection (transactions just below threshold)
  const nearThresholdTxns = recentTxns.filter(t => 
    t.amount >= HIGH_VALUE_THRESHOLD * 0.9 && t.amount < HIGH_VALUE_THRESHOLD
  );
  if (nearThresholdTxns.length >= 2) {
    suspiciousFlags.push('POTENTIAL_STRUCTURING');
    riskScore += 35;
  }

  return {
    isSuspicious: suspiciousFlags.length > 0,
    suspiciousFlags,
    riskScore,
    needsDelay: amount > HIGH_VALUE_THRESHOLD || suspiciousFlags.length > 0
  };
}

// ---- Helper: simple fraud rules ----
function simpleFraudCheck({ amount, balance_before, location_delta_km, is_foreign_device, txns_last_24h }) {
  if (!balance_before || isNaN(balance_before)) balance_before = 0;
  if (amount > balance_before * 0.8 && balance_before > 0) return { is_fraud: true, reason: "Large txn relative to balance" };
  if (location_delta_km && location_delta_km > 100) return { is_fraud: true, reason: "Location jump" };
  if (is_foreign_device && is_foreign_device === 1) return { is_fraud: true, reason: "Foreign device" };
  if (txns_last_24h && txns_last_24h > 10) return { is_fraud: true, reason: "Too many txns in 24h" };
  return { is_fraud: false, reason: null };
}

// ---- Utility: mask account show last 4 digits ----
function maskAccount(acc) {
  if (!acc) return "****";
  const s = acc.toString();
  const last4 = s.slice(-4);
  return "****" + last4;
}

// ---- Ensure phone in E.164 (simple +91 fallback) ----
function formatPhone(phone) {
  if (!phone) return phone;
  if (phone.startsWith("+")) return phone;
  // default to India if 10-digit number
  if (/^\d{10}$/.test(phone)) return "+91" + phone;
  return phone;
}

/**
 * POST /api/txns/send-otp
 * Protected. Sends OTP to user's registered phone (or phone passed in body).
 */
router.post("/send-otp", auth, async (req, res) => {
  try {
    const user = req.user;
    // allow client override phone (if you stored phone separately in AsyncStorage)
    let { phone } = req.body;
    phone = phone || user.phone || user.mobile || user.phoneNumber;

    if (!phone) return res.status(400).json({ error: "No phone number available to send OTP" });

    const formattedPhone = formatPhone(phone);

    // generate 4-digit OTP
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // save OTP record
    await Otp.create({ phone: formattedPhone, code, expiresAt });

    // send via Twilio
    try {
      await twilioClient.messages.create({
        to: formattedPhone,
        body: `Your GramBank transaction OTP is ${code}. It will expire in 5 minutes.`,
        from: '+17759316114',
      });
      return res.json({ message: "OTP sent successfully", otp: code });
    } catch (smsErr) {
      console.error("Twilio send error:", smsErr);
      // return success with otp for dev fallback (remove in prod)
      return res.json({ message: "OTP generated (SMS failed)", otp: code });
    }
  } catch (err) {
    console.error("Send txn OTP error:", err);
    res.status(500).json({ error: "Failed to send transaction OTP" });
  }
});

/**
 * POST /api/txns/send
 * Protected. Body: { to_account, ifsc, beneficiary_name, amount, otp, phone(optional) }
 * Verifies OTP then processes transaction.
 * - If amount > 10000: DELAYED (unless trusted receiver)
 * - If amount <= 10000: INSTANT + register as trusted
 */
router.post("/send", auth, async (req, res) => {
  try {
    const user = req.user;
    const { to_account, ifsc, beneficiary_name, amount, otp, phone } = req.body;

    if (!to_account || !ifsc || !amount) return res.status(400).json({ error: "Missing transaction details" });
    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: "Invalid amount" });

    // ---- Verify OTP (required only for amount >= 10000) ----
    const phoneToCheck = formatPhone(phone || user.phone || user.mobile || user.phoneNumber);
    if (amt >= 10000) {
      if (!otp) return res.status(400).json({ error: "OTP required for transactions >= ₹10,000" });

      const otpRecord = await Otp.findOne({ phone: phoneToCheck }).sort({ createdAt: -1 });
      if (!otpRecord) return res.status(400).json({ error: "No OTP found for this phone" });
      if (otpRecord.expiresAt < new Date()) return res.status(400).json({ error: "OTP expired" });
      if (otpRecord.code !== otp) return res.status(400).json({ error: "Invalid OTP" });
    }

    // ---- Check fraud blacklist ----
    const blacklisted = await FraudAccount.findOne({ accountNumber: to_account });
    if (blacklisted) {
      try {
        const msg = `Alert: Transfer to ${maskAccount(to_account)} blocked for safety.`;
        await twilioClient.messages.create({ to: phoneToCheck, body: msg, from: '+17759316114' });
      } catch (e) { console.error("Twilio alert error:", e); }

      return res.json({
        message: "Fraudulent account detected",
        txn_blocked: true,
        fraud_reason: "Account reported by users",
      });
    }

    // ---- Check sufficient balance ----
    if (user.balance < amt) return res.status(400).json({ error: "Insufficient balance" });

    // ============ DECISION: DELAY vs INSTANT ============
    const isHighValue = amt > HIGH_VALUE_THRESHOLD;
    console.log(`[TXN] Amount: ₹${amt}, High Value: ${isHighValue}, Receiver: ${to_account}`);

    if (isHighValue) {
      // Check trusted receiver (same sender + same receiver + within 1 min)
      const trusted = await TrustedReceiver.findOne({
        user_id: user._id,
        receiver_account: to_account,
        trusted_until: { $gte: new Date() },
      });

      const isTrusted = !!trusted;
      console.log(`[TXN] Trusted receiver check: ${isTrusted ? "YES - bypassing delay" : "NO - delaying transaction"}`);
      if (trusted) console.log(`[TXN] Trusted until: ${trusted.trusted_until}`);

      if (isTrusted) {
        // ========== INSTANT PATH (trusted override) ==========
        console.log(`[TXN] Processing INSTANT (trusted receiver): ₹${amt} to ${to_account}`);
        return await processInstantTransaction(user, to_account, ifsc, beneficiary_name, amt, phoneToCheck, res);
      }

      // ========== DELAY PATH ==========
      const autoProcessAt = new Date(Date.now() + DELAY_DURATION_MS);
      console.log(`[TXN] DELAYING transaction: ₹${amt} to ${to_account}, auto_process_at: ${autoProcessAt.toISOString()}`);

      const scheduledTxn = new ScheduledTransaction({
        user_id: user._id,
        txn_id: `SCHED-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        to_account,
        ifsc,
        beneficiary_name,
        amount: amt,
        balance_before: user.balance,
        balance_after: +(user.balance - amt).toFixed(2),
        type: 'DEBIT',
        status: 'PENDING',
        scheduled_at: new Date(),
        auto_process_at: autoProcessAt,
        delay_reason: 'High value transaction (above ₹10,000)',
      });

      await scheduledTxn.save();

      try {
        const alertMsg = `GramBank: ₹${amt} to ${beneficiary_name || maskAccount(to_account)} delayed for security. Auto-process at ${autoProcessAt.toLocaleTimeString()}.`;
        await twilioClient.messages.create({ to: phoneToCheck, body: alertMsg, from: '+17759316114' });
      } catch (e) { console.error("Alert SMS error:", e); }

      return res.json({
        message: "Transaction delayed for security review",
        is_scheduled: true,
        txn_id: scheduledTxn.txn_id,
        amount: amt,
        beneficiary: beneficiary_name || maskAccount(to_account),
        auto_process_at: autoProcessAt,
        delay_reason: "High value transaction requires verification",
      });
    }

    // ========== INSTANT PATH (amount <= 10000) ==========
    console.log(`[TXN] Processing INSTANT (amount <= ₹10,000): ₹${amt} to ${to_account}`);
    return await processInstantTransaction(user, to_account, ifsc, beneficiary_name, amt, phoneToCheck, res);

  } catch (err) {
    console.error("Send txn error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * Helper: Process instant transaction + register trusted receiver
 */
async function processInstantTransaction(user, to_account, ifsc, beneficiary_name, amt, phoneToCheck, res) {
  // Register/update trusted receiver (1-minute validity)
  await TrustedReceiver.findOneAndUpdate(
    { user_id: user._id, receiver_account: to_account },
    {
      user_id: user._id,
      receiver_account: to_account,
      trusted_until: new Date(Date.now() + TRUST_WINDOW_MS),
    },
    { upsert: true, new: true },
  );

  // Deduct sender
  const balance_before = user.balance;
  const balance_after = +(balance_before - amt).toFixed(2);

  const txnId = `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const txn = new Transaction({
    txn_id: txnId,
    user_id: user._id,
    to_account,
    ifsc,
    beneficiary_name,
    amount: amt,
    balance_before,
    balance_after,
    is_fraud: false,
    type: 'DEBIT',
  });
  await txn.save();

  user.balance = balance_after;
  user.transactionsCount = (user.transactionsCount || 0) + 1;
  await user.save();

  // Credit receiver
  const receiver = await User.findOne({ accountNumber: to_account });
  if (receiver) {
    const r_before = receiver.balance;
    const r_after = +(receiver.balance + amt).toFixed(2);

    await Transaction.create({
      txn_id: `${txnId}-CREDIT`,
      user_id: receiver._id,
      from_account: user.accountNumber,
      to_account: receiver.accountNumber,
      amount: amt,
      balance_before: r_before,
      balance_after: r_after,
      is_fraud: false,
      type: "CREDIT",
    });

    receiver.balance = r_after;
    receiver.transactionsCount = (receiver.transactionsCount || 0) + 1;
    await receiver.save();

    try {
      await twilioClient.messages.create({
        to: formatPhone(receiver.phoneNumber),
        body: `GramBank: A/c ${maskAccount(receiver.accountNumber)} credited ₹${amt} from ${maskAccount(user.accountNumber)}. Bal ₹${r_after}.`,
        from: "+17759316114",
      });
    } catch (e) { console.error("Receiver SMS error:", e); }
  }

  try {
    await twilioClient.messages.create({
      to: phoneToCheck,
      body: `GramBank: A/c ${maskAccount(user.accountNumber)} debited ₹${amt} to ${beneficiary_name || maskAccount(to_account)}. Bal ₹${balance_after}.`,
      from: '+17759316114',
    });
  } catch (e) { console.error("SMS error:", e); }

  return res.json({
    message: "Transaction successful",
    txn_id: txn.txn_id,
    balance_before,
    balance_after,
  });
}
/**
 * POST /api/txns/report/:id
 * Report a scheduled transaction.
 * If report_type is UNAUTHORIZED, WRONG_RECIPIENT, or FRAUD:
 *   - Set status = FAILED, is_reported = true
 * Else:
 *   - Save report only, no effect on transaction
 */
router.post("/report/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { report_type, description } = req.body;

    if (!report_type) return res.status(400).json({ error: "Report type required" });

    const txn = await ScheduledTransaction.findOne({
      _id: id,
      user_id: req.user._id,
    });

    if (!txn) return res.status(404).json({ error: "Transaction not found" });

    // Save report
    const report = await TransactionReport.create({
      transaction_id: id,
      reporter_id: req.user._id,
      report_type,
      description,
    });

    // If blocking report type, fail the transaction immediately
    const BLOCKING_TYPES = ["UNAUTHORIZED", "WRONG_RECIPIENT", "FRAUD"];
    if (BLOCKING_TYPES.includes(report_type.toUpperCase()) && txn.status === "PENDING") {
      txn.status = "FAILED";
      txn.is_reported = true;
      txn.report_reason = report_type;
      txn.processing_locked = true;
      await txn.save();

      return res.json({
        message: "Report submitted. Transaction has been blocked.",
        report,
        transaction_status: "FAILED",
      });
    }

    res.json({
      message: "Report submitted for review",
      report,
      transaction_status: txn.status,
    });
  } catch (err) {
    console.error("Report error:", err);
    res.status(500).json({ error: "Failed to submit report" });
  }
});

/**
 * POST /api/txns/admin/approve/:id
 * Admin overrides delay: process PENDING transaction immediately.
 * Flow: PENDING → APPROVED_BY_ADMIN → COMPLETED
 */
router.post("/admin/approve/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    const txn = await ScheduledTransaction.findOne({
      _id: id,
      status: "PENDING",
      processing_locked: false,
      is_reported: false,
    }).populate("user_id");

    if (!txn) {
      return res.status(404).json({ error: "Transaction not found, already processed, or locked" });
    }

    // Step 1: Mark as APPROVED_BY_ADMIN
    txn.status = "APPROVED_BY_ADMIN";
    txn.processing_locked = true;
    await txn.save();

    // Step 2: Process the transfer
    const sender = txn.user_id;
    if (!sender || sender.balance < txn.amount) {
      txn.status = "FAILED";
      txn.delay_reason = "Insufficient balance at processing time";
      txn.processed_at = new Date();
      await txn.save();
      return res.status(400).json({ error: "Insufficient balance" });
    }

    const balance_before = sender.balance;
    const balance_after = +(balance_before - txn.amount).toFixed(2);

    sender.balance = balance_after;
    sender.transactionsCount = (sender.transactionsCount || 0) + 1;
    await sender.save();

    const txnId = txn.txn_id;
    await Transaction.create({
      txn_id: txnId,
      user_id: sender._id,
      to_account: txn.to_account,
      ifsc: txn.ifsc,
      beneficiary_name: txn.beneficiary_name,
      amount: txn.amount,
      balance_before,
      balance_after,
      type: "DEBIT",
      is_fraud: false,
    });

    // Credit receiver
    const receiver = await User.findOne({ accountNumber: txn.to_account });
    if (receiver) {
      const r_before = receiver.balance;
      const r_after = +(receiver.balance + txn.amount).toFixed(2);

      await Transaction.create({
        txn_id: `${txnId}-CREDIT`,
        user_id: receiver._id,
        from_account: sender.accountNumber,
        to_account: receiver.accountNumber,
        amount: txn.amount,
        balance_before: r_before,
        balance_after: r_after,
        type: "CREDIT",
        is_fraud: false,
      });

      receiver.balance = r_after;
      receiver.transactionsCount = (receiver.transactionsCount || 0) + 1;
      await receiver.save();
    }

    // Finalize: COMPLETED
    txn.status = "COMPLETED";
    txn.processed_at = new Date();
    await txn.save();

    console.log(`[ADMIN] Transaction ${txnId} approved and completed by admin`);

    res.json({
      message: "Transaction approved and processed successfully",
      transaction: {
        txn_id: txn.txn_id,
        amount: txn.amount,
        status: txn.status,
        processed_at: txn.processed_at,
      },
    });
  } catch (err) {
    console.error("Admin approve error:", err);
    res.status(500).json({ error: "Approval failed" });
  }
});

/**
 * POST /api/txns/upi/send
 * Body: { upiId, amount, otp, phone(optional) }
 */
/**
 * POST /api/txns/upi/send
 * UPI payment with strict delay rule.
 * - If amount > 10000: DELAYED (unless trusted receiver)
 * - If amount <= 10000: INSTANT + register as trusted
 */
router.post("/upi/send", auth, async (req, res) => {
  try {
    const user = req.user;
    const { upiId, amount, otp, phone } = req.body;

    if (!upiId || !amount) return res.status(400).json({ error: "UPI ID & Amount required" });

    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: "Invalid amount" });

    // ---------- OTP VERIFY (required only for amount >= 10000) ----------
    const phoneToCheck = formatPhone(phone || user.phoneNumber);
    if (amt >= 10000) {
      if (!otp) return res.status(400).json({ error: "OTP required for transactions >= ₹10,000" });

      const otpRecord = await Otp.findOne({ phone: phoneToCheck }).sort({ createdAt: -1 });
      if (!otpRecord) return res.status(400).json({ error: "No OTP found for this phone" });
      if (otpRecord.expiresAt < new Date()) return res.status(400).json({ error: "OTP expired" });
      if (otpRecord.code !== otp) return res.status(400).json({ error: "Invalid OTP" });
    }

    // ---------- FIND RECEIVER ----------
    const receiver = await User.findOne({ upiId });
    const receiverAccount = receiver ? receiver.accountNumber : null;

    // ---------- BALANCE CHECK ----------
    if (user.balance < amt) return res.status(400).json({ error: "Insufficient balance" });

    // ============ DECISION: DELAY vs INSTANT ============
    const isHighValue = amt > HIGH_VALUE_THRESHOLD;
    console.log(`[UPI] Amount: ₹${amt}, High Value: ${isHighValue}, Receiver UPI: ${upiId}`);

    if (isHighValue) {
      // Check trusted receiver (same sender + same receiver + within 1 min)
      const trusted = await TrustedReceiver.findOne({
        user_id: user._id,
        receiver_account: receiverAccount || upiId,
        trusted_until: { $gte: new Date() },
      });

      const isTrusted = !!trusted;
      console.log(`[UPI] Trusted receiver check: ${isTrusted ? "YES - bypassing delay" : "NO - delaying transaction"}`);

      if (isTrusted) {
        console.log(`[UPI] Processing INSTANT (trusted receiver): ₹${amt} to ${upiId}`);
        return await processInstantUPI(user, receiver, upiId, amt, phoneToCheck, res);
      }

      // ========== DELAY PATH ==========
      const autoProcessAt = new Date(Date.now() + DELAY_DURATION_MS);
      console.log(`[UPI] DELAYING transaction: ₹${amt} to ${upiId}, auto_process_at: ${autoProcessAt.toISOString()}`);

      const scheduledTxn = new ScheduledTransaction({
        user_id: user._id,
        txn_id: `UPI-SCHED-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        to_upi: upiId,
        amount: amt,
        balance_before: user.balance,
        balance_after: +(user.balance - amt).toFixed(2),
        type: 'DEBIT',
        status: 'PENDING',
        scheduled_at: new Date(),
        auto_process_at: autoProcessAt,
        delay_reason: 'High value UPI transaction (above ₹10,000)',
      });

      await scheduledTxn.save();

      try {
        const alertMsg = `GramBank: UPI payment of ₹${amt} to ${upiId} delayed for security. Auto-process at ${autoProcessAt.toLocaleTimeString()}.`;
        await twilioClient.messages.create({ to: phoneToCheck, body: alertMsg, from: '+17759316114' });
      } catch (e) { console.error("Alert SMS error:", e); }

      return res.json({
        message: "UPI transaction delayed for security review",
        is_scheduled: true,
        txn_id: scheduledTxn.txn_id,
        amount: amt,
        receiver: upiId,
        auto_process_at: autoProcessAt,
        delay_reason: "High value UPI transaction requires verification",
      });
    }

    // ========== INSTANT PATH (amount <= 10000) ==========
    console.log(`[UPI] Processing INSTANT (amount <= ₹10,000): ₹${amt} to ${upiId}`);
    return await processInstantUPI(user, receiver, upiId, amt, phoneToCheck, res);

  } catch (err) {
    console.error("UPI send error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * Helper: Process instant UPI transaction + register trusted receiver
 */
async function processInstantUPI(user, receiver, upiId, amt, phoneToCheck, res) {
  // Register/update trusted receiver (1-minute validity)
  const receiverAccount = receiver ? receiver.accountNumber : upiId;
  await TrustedReceiver.findOneAndUpdate(
    { user_id: user._id, receiver_account: receiverAccount },
    {
      user_id: user._id,
      receiver_account: receiverAccount,
      trusted_until: new Date(Date.now() + TRUST_WINDOW_MS),
    },
    { upsert: true, new: true },
  );

  const balance_before = user.balance;
  const balance_after = +(balance_before - amt).toFixed(2);
  const txnId = `UPI-${Date.now()}`;

  await Transaction.create({
    txn_id: txnId,
    user_id: user._id,
    to_upi: upiId,
    amount: amt,
    balance_before,
    balance_after,
    is_fraud: false,
    type: "DEBIT",
  });

  user.balance = balance_after;
  user.transactionsCount += 1;
  await user.save();

  if (receiver) {
    const r_before = receiver.balance;
    const r_after = +(receiver.balance + amt).toFixed(2);

    await Transaction.create({
      txn_id: `${txnId}-CREDIT`,
      user_id: receiver._id,
      from_account: user.accountNumber,
      to_upi: receiver.upiId,
      amount: amt,
      balance_before: r_before,
      balance_after: r_after,
      is_fraud: false,
      type: "CREDIT",
    });

    receiver.balance = r_after;
    receiver.transactionsCount += 1;
    await receiver.save();
  }

  try {
    await twilioClient.messages.create({
      to: phoneToCheck,
      body: `GramBank: ₹${amt} debited via UPI to ${upiId}. Bal ₹${balance_after}.`,
      from: "+17759316114",
    });
  } catch (e) { console.error("SMS error:", e); }

  return res.json({
    message: "UPI Transaction Successful",
    txn_id: txnId,
    balance_before,
    balance_after,
    receiver: upiId,
  });
}


/* History, alerts, seed-fraud, balance, report routes — leave as before (no changes) */
/* You already had these; re-add them unchanged below or keep existing ones in file. */

router.get("/history", auth, async (req, res) => {
  try {
    const user = req.user;

    const [txns, scheduledTxns] = await Promise.all([
      Transaction.find({ user_id: user._id }),
      ScheduledTransaction.find({ user_id: user._id })
    ]);

    // Add a flag to पहचान type (optional but useful in frontend)
    // Include all scheduled txns except completed ones (they already have a Transaction record)
    const pendingScheduled = scheduledTxns.filter(t =>
      t.status === "PENDING" || t.status === "APPROVED_BY_ADMIN" || t.status === "PROCESSING" || t.status === "CANCELLED" || t.status === "FAILED"
    );

    const formattedTxns = txns.map(t => ({
      ...t.toObject(),
      txn_type: "transaction"
    }));

    const formattedScheduled = pendingScheduled.map(t => ({
      ...t.toObject(),
      txn_type: "scheduled",
      is_scheduled: true,
    }));

    // Merge + sort by date
    const combined = [...formattedTxns, ...formattedScheduled]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 200);

    res.json(combined);

  } catch (err) {
    console.error("History error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/alerts", auth, async (req, res) => {
  try {
    const user = req.user;
    const alerts = await Transaction.find({ user_id: user._id, is_fraud: true }).sort({ createdAt: -1 });
    res.json(alerts);
  } catch (err) {
    console.error("Alerts error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/seed-fraud", auth, async (req, res) => {
  try {
    const user = req.user;
    const seeds = [];
    const nowBal = user.balance || 5000;
    let currentBal = nowBal;

    for (let i = 0; i < 10; i++) {
      const type = i % 3;
      let amount, location_delta_km, is_foreign_device, reason;
      if (type === 0) {
        amount = Math.floor(currentBal * (0.85 + Math.random() * 0.1));
        location_delta_km = Math.floor(Math.random() * 5);
        is_foreign_device = 0;
        reason = "Large txn relative to balance";
      } else if (type === 1) {
        amount = Math.floor(500 + Math.random() * 1500);
        location_delta_km = 150 + Math.floor(Math.random() * 500);
        is_foreign_device = 0;
        reason = "Location jump";
      } else {
        amount = Math.floor(300 + Math.random() * 2000);
        location_delta_km = Math.floor(Math.random() * 30);
        is_foreign_device = 1;
        reason = "Foreign device";
      }

      if (amount > currentBal) amount = Math.floor(currentBal * 0.9);
      const balance_before = currentBal;
      const balance_after = +(currentBal - amount).toFixed(2);
      currentBal = balance_after;

      const txn = new Transaction({
        txn_id: `SEED-${Date.now()}-${i}`,
        user_id: user._id,
        to_account: `BEN${Math.floor(Math.random() * 10000)}`,
        ifsc: "SEED0000",
        beneficiary_name: "Seed Beneficiary",
        amount,
        balance_before,
        balance_after,
        hour: new Date().getHours(),
        day: new Date().getDay(),
        txns_last_24h: 20,
        avg_amount_7d: 2000,
        location_delta_km,
        is_foreign_device,
        is_fraud: true,
        fraud_reason: reason
      });
      seeds.push(txn);
    }

    await Transaction.insertMany(seeds);
    user.balance = currentBal;
    user.transactionsCount = (user.transactionsCount || 0) + seeds.length;
    await user.save();

    res.json({ message: `Seeded ${seeds.length} suspicious transactions`, currentBalance: user.balance });
  } catch (err) {
    console.error("Seed fraud error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/balance", auth, async (req, res) => {
  try {
    const user = req.user;

    const recentTxns = await Transaction.find({ user_id: user._id })
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      name: user.name,
      aadhaarNumber: user.aadhaarNumber,
      balance: user.balance,
      upiId: user.upiId,        // ⭐ Added
      upiQR: user.upiQR,        // ⭐ Added
      recent: recentTxns.map((txn) => ({
        txn_id: txn.txn_id,
        amount: txn.amount,
        type: txn.type,
        createdAt: txn.createdAt,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch balance data" });
  }
});


router.post("/report", auth, async (req, res) => {
  try {
    const { accountNumber, ifsc, reason } = req.body;
    if (!accountNumber) return res.status(400).json({ error: "Account number required" });

    const existing = await FraudAccount.findOne({ accountNumber });
    if (existing) return res.json({ message: "Account already reported" });

    const report = new FraudAccount({
      accountNumber,
      ifsc,
      reason,
      reportedBy: req.user._id,
    });
    await report.save();

    res.json({ message: "Fraudulent account reported successfully" });
  } catch (err) {
    console.error("Fraud report error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/txns/scheduled
 * Get user's scheduled transactions (all statuses: PENDING, APPROVED_BY_ADMIN, COMPLETED, CANCELLED, FAILED)
 */
router.get("/scheduled", auth, async (req, res) => {
  try {
    const user = req.user;
    const scheduledTxns = await ScheduledTransaction.find({
      user_id: user._id,
      status: { $in: ['PENDING', 'APPROVED_BY_ADMIN', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED'] }
    }).sort({ createdAt: -1 });

    res.json({
      count: scheduledTxns.length,
      transactions: scheduledTxns.map(t => ({
        id: t._id,
        txn_id: t.txn_id,
        amount: t.amount,
        to_account: maskAccount(t.to_account),
        to_upi: t.to_upi,
        beneficiary_name: t.beneficiary_name,
        scheduled_at: t.scheduled_at,
        auto_process_at: t.auto_process_at,
        processed_at: t.processed_at,
        delay_reason: t.delay_reason,
        status: t.status,
        is_reported: t.is_reported,
        report_reason: t.report_reason,
        createdAt: t.createdAt
      }))
    });
  } catch (err) {
    console.error("Scheduled txns error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * DELETE /api/txns/scheduled/:txnId
 * Cancel a pending scheduled transaction
 */
router.delete("/scheduled/:txnId", auth, async (req, res) => {
  try {
    const user = req.user;
    const { txnId } = req.params;

    const scheduledTxn = await ScheduledTransaction.findOne({
      txn_id: txnId,
      user_id: user._id,
      status: 'PENDING'
    });

    if (!scheduledTxn) {
      return res.status(404).json({ error: "Scheduled transaction not found or already processed" });
    }

    if (new Date() >= scheduledTxn.auto_process_at) {
      return res.status(400).json({ error: "Cannot cancel - transaction is being processed" });
    }

    scheduledTxn.status = 'CANCELLED';
    await scheduledTxn.save();

    res.json({
      message: "Transaction cancelled successfully",
      txn_id: scheduledTxn.txn_id,
      refund: scheduledTxn.amount
    });
  } catch (err) {
    console.error("Cancel scheduled txn error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/txns/process-scheduled
 * Background job: processes scheduled transactions where:
 *   status = "PENDING" AND current_time >= auto_process_at
 */
router.post("/process-scheduled", async (req, res) => {
  try {
    const now = new Date();
    console.log(`[CRON] Running at ${now.toISOString()}`);

    const pendingTxns = await ScheduledTransaction.find({
      status: "PENDING",
      auto_process_at: { $lte: now },
      processing_locked: false,
      is_reported: false,
    }).populate("user_id");

    console.log(`[CRON] Found ${pendingTxns.length} transactions ready to process`);

    let processed = 0;
    let failed = 0;

    for (const schedTxn of pendingTxns) {
      try {
        // Double-check: only proceed if still PENDING
        if (schedTxn.status !== "PENDING") {
          console.log(`[CRON] Skipping ${schedTxn.txn_id}: status is ${schedTxn.status}`);
          continue;
        }

        // Lock to prevent duplicate processing
        schedTxn.status = "PROCESSING";
        schedTxn.processing_locked = true;
        await schedTxn.save();

        const user = schedTxn.user_id;
        if (!user || user.balance < schedTxn.amount) {
          schedTxn.status = "FAILED";
          schedTxn.delay_reason = "Insufficient balance";
          schedTxn.processed_at = now;
          await schedTxn.save();
          console.log(`[CRON] Failed ${schedTxn.txn_id}: insufficient balance`);
          failed++;
          continue;
        }

        const balance_before = user.balance;
        const balance_after = +(balance_before - schedTxn.amount).toFixed(2);

        user.balance = balance_after;
        user.transactionsCount = (user.transactionsCount || 0) + 1;
        await user.save();

        const txn = new Transaction({
          txn_id: schedTxn.txn_id,
          user_id: user._id,
          to_account: schedTxn.to_account,
          ifsc: schedTxn.ifsc,
          beneficiary_name: schedTxn.beneficiary_name,
          amount: schedTxn.amount,
          balance_before,
          balance_after,
          type: "DEBIT",
          is_fraud: false,
        });
        await txn.save();

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
          receiver.transactionsCount += 1;
          await receiver.save();
        }

        try {
          await twilioClient.messages.create({
            to: formatPhone(user.phoneNumber),
            body: `GramBank: ₹${schedTxn.amount} transferred to ${schedTxn.beneficiary_name || maskAccount(schedTxn.to_account)}. Bal ₹${balance_after}.`,
            from: "+17759316114",
          });
        } catch (e) {
          console.error("SMS error:", e);
        }

        schedTxn.status = "COMPLETED";
        schedTxn.processed_at = now;
        await schedTxn.save();
        console.log(`[CRON] Completed ${schedTxn.txn_id}`);
        processed++;
      } catch (err) {
        console.error(`[CRON] Failed processing ${schedTxn.txn_id}:`, err);
        schedTxn.status = "FAILED";
        schedTxn.delay_reason = err.message || "Processing error";
        schedTxn.processed_at = now;
        await schedTxn.save();
        failed++;
      }
    }

    console.log(`[CRON] Done. Processed: ${processed}, Failed: ${failed}`);

    res.json({
      message: "Processing complete",
      processed,
      failed,
      total: pendingTxns.length,
    });
  } catch (err) {
    console.error("Process scheduled error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

/**
 * ==============================
 * ✅ ADMIN: GET ALL TRANSACTIONS
 * ==============================
 * GET /api/txns/admin/all
 */
router.get("/admin/all", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const transactions = await Transaction.find()
      .populate("user_id", "name accountNumber") // sender
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalTransactions = await Transaction.countDocuments();

    res.json({
      totalTransactions,
      currentPage: page,
      totalPages: Math.ceil(totalTransactions / limit),
      transactions
    });
  } catch (err) {
    console.error("Admin fetch transactions error:", err);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});
/**
 * ==============================
 * ✅ ADMIN: USER BASED TRANSACTIONS
 * ==============================
 * GET /api/txns/admin/user/:userId
 */
router.get("/admin/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const transactions = await Transaction.find({ user_id: userId })
      .populate("user_id", "name accountNumber upiId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Transaction.countDocuments({ user_id: userId });

    res.json({
      userId,
      totalTransactions: total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      transactions,
    });
  } catch (err) {
    console.error("User based txn error:", err);
    res.status(500).json({ error: "Failed to fetch user transactions" });
  }
});
