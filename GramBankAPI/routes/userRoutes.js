const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const QRCode = require("qrcode");
const axios = require("axios");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Otp = require("../models/Otp");
const qs = require("qs");

const router = express.Router();

function generateAccountNumber() {
  const bankCode = "2130";
  const randomNumber = Math.floor(1000000000 + Math.random() * 9000000000);
  return bankCode + randomNumber.toString();
}

router.post("/signup", async (req, res) => {
  try {
    const { name, aadhaarNumber, panNumber, mpin, phone } = req.body;

    if (!name || !aadhaarNumber || !panNumber || !mpin)
      return res.status(400).json({ error: "All fields are required" });

    const aadhaarRegex = /^\d{12}$/;
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

    if (!aadhaarRegex.test(aadhaarNumber))
      return res.status(400).json({ error: "Invalid Aadhaar number" });

    if (!panRegex.test(panNumber))
      return res.status(400).json({ error: "Invalid PAN number" });

    const existingUser = await User.findOne({ aadhaarNumber });
    if (existingUser)
      return res.status(400).json({ error: "User already exists" });

    const mpinHash = await bcrypt.hash(mpin, 10);

    let accountNumber;
    let isUnique = false;

    while (!isUnique) {
      accountNumber = generateAccountNumber();
      const existingAcc = await User.findOne({ accountNumber });
      if (!existingAcc) isUnique = true;
    }

    const upiId = `${accountNumber}@grambank`;
    const upiString = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(name)}&cu=INR`;

    const qrDataUrl = await QRCode.toDataURL(upiString);
    const base64Image = qrDataUrl.split(",")[1];

    let qrImageUrl = "";
    if (process.env.IMGBB_API_KEY) {
      try {
        const uploadRes = await axios.post(
          `https://api.imgbb.com/1/upload`,
          qs.stringify({ key: process.env.IMGBB_API_KEY, image: base64Image }),
          { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );
        qrImageUrl = uploadRes.data.data?.url || "";
      } catch (imgErr) {
        qrImageUrl = "";
      }
    }
console.log("QR Image URL:", qrImageUrl);
    const newUser = await User.create({
      name,
      aadhaarNumber,
      panNumber,
      mpinHash,
      accountNumber,
      phoneNumber: phone,
      upiId,
      upiQR: qrImageUrl
    });

    res.status(201).json({
      message: "User registered successfully",
      userId: newUser._id,
      accountNumber: newUser.accountNumber,
      upiId: newUser.upiId,
      upiQR: newUser.upiQR
    });
  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { aadhaarNumber, mpin } = req.body;

    console.log("Login attempt:", { aadhaarNumber, mpinLength: mpin?.length });

    if (!aadhaarNumber || !mpin)
      return res.status(400).json({ error: "Aadhaar number and MPIN required" });

    const user = await User.findOne({ aadhaarNumber });

    if (!user) {
      console.log("User not found for aadhaar:", aadhaarNumber);
      return res.status(404).json({ error: "User not found" });
    }

    console.log("User found:", user.name, "mpinHash:", user.mpinHash?.substring(0, 10) + "...");

    if (user.status === "FROZEN")
      return res.status(403).json({ error: "Account is frozen. Contact support." });

    const isMatch = await bcrypt.compare(mpin, user.mpinHash);
    console.log("MPIN match:", isMatch);

    if (!isMatch)
      return res.status(401).json({ error: "Invalid MPIN" });

    const token = jwt.sign(
      { id: user._id, aadhaarNumber: user.aadhaarNumber },
      process.env.JWT_SECRET || "default_secret_key",
      { expiresIn: "7d" }
    );

    await user.save();
    console.log("Login successful, token:", token);

    const userData = {
      id: user._id,
      name: user.name,
      aadhaarNumber: user.aadhaarNumber,
      accountNumber: user.accountNumber,
      upiId: user.upiId,
      phoneNumber: user.phoneNumber,
      balance: user.balance,
      ifsc: user.ifsc || "GBRK0002130"
    };

    res.json({
      message: "Login successful",
      token,
      user: userData
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/users/search", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone number required" });

    const user = await User.findOne({ phoneNumber: phone }).select("name phoneNumber upiId accountNumber");

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(user);
  } catch (err) {
    console.error("Search user error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/all-contacts", async (req, res) => {
  try {
    const users = await User.find(
      { status: "ACTIVE" },
      { name: 1, phoneNumber: 1, upiId: 1, accountNumber: 1 }
    ).sort({ name: 1 });

    res.json(users.map(u => ({
      name: u.name,
      phone: u.phoneNumber,
      upiId: u.upiId,
      accountNumber: u.accountNumber,
      isGramBankUser: true,
    })));
  } catch (err) {
    console.error("Contacts fetch error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/admin/all-users", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const users = await User.find()
      .select("-mpinHash -__v")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalUsers = await User.countDocuments();

    res.status(200).json({
      totalUsers,
      currentPage: page,
      totalPages: Math.ceil(totalUsers / limit),
      users
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/admin/add-balance/:userId", async (req, res) => {
  try {
    const { amount, reason } = req.body;
    const user = await User.findById(req.params.userId);

    if (!user) return res.status(404).json({ error: "User not found" });

    const before = user.balance;
    user.balance += amount;
    await user.save();

    await Transaction.create({
      txn_id: `ADMIN-${Date.now()}`,
      user_id: user._id,
      amount,
      balance_before: before,
      balance_after: user.balance,
      type: "CREDIT",
      is_fraud: false,
      note: reason || "Admin credit"
    });

    res.json({
      message: "Amount added successfully",
      balance_before: before,
      balance_after: user.balance
    });
  } catch (err) {
    console.error("Add balance error:", err);
    res.status(500).json({ error: "Failed to add balance" });
  }
});

router.post("/admin/migrate-ifsc", async (req, res) => {
  try {
    const result = await User.updateMany(
      { ifsc: { $exists: false } },
      { $set: { ifsc: "GBRK0002130" } }
    );
    res.json({ message: `${result.modifiedCount} users updated with IFSC code` });
  } catch (err) {
    console.error("IFSC migration error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/forgot-mpin/request", async (req, res) => {
  try {
    const { aadhaarNumber, phoneNumber } = req.body;

    if (!aadhaarNumber || !phoneNumber)
      return res.status(400).json({ error: "Aadhaar number and phone number required" });

    const user = await User.findOne({ aadhaarNumber });

    if (!user)
      return res.status(404).json({ error: "User not found" });

    if (user.phoneNumber !== phoneNumber)
      return res.status(400).json({ error: "Phone number does not match our records" });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const formattedPhone = `+91${phoneNumber}`;

    await Otp.create({
      phone: formattedPhone,
      code: otpCode,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    console.log(`[Forgot MPIN OTP] Phone: ${formattedPhone}, OTP: ${otpCode}`);

    try {
      const twilio = require("twilio");
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await client.messages.create({
        body: `GramBank: Your MPIN reset OTP is ${otpCode}. Valid for 5 minutes.`,
        from: '+17759316114',
        to: formattedPhone,
      });
    } catch (smsErr) {
      console.log("SMS error (OTP still saved):", smsErr.message);
    }

    res.json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error("Forgot MPIN request error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/forgot-mpin/reset", async (req, res) => {
  try {
    const { aadhaarNumber, phoneNumber, otp, newMpin } = req.body;

    if (!aadhaarNumber || !phoneNumber || !otp || !newMpin)
      return res.status(400).json({ error: "All fields are required" });

    if (!/^\d{4}$/.test(newMpin))
      return res.status(400).json({ error: "MPIN must be 4 digits" });

    const user = await User.findOne({ aadhaarNumber });

    if (!user)
      return res.status(404).json({ error: "User not found" });

    if (user.phoneNumber !== phoneNumber)
      return res.status(400).json({ error: "Phone number does not match" });

    const formattedPhone = `+91${phoneNumber}`;
    const otpRecord = await Otp.findOne({ phone: formattedPhone, code: otp }).sort({ createdAt: -1 });

    if (!otpRecord)
      return res.status(400).json({ error: "Invalid OTP" });

    if (otpRecord.expiresAt < new Date())
      return res.status(400).json({ error: "OTP expired" });

    const newMpinHash = await bcrypt.hash(newMpin, 10);
    user.mpinHash = newMpinHash;
    await user.save();

    await Otp.deleteMany({ phone: formattedPhone, code: otp });

    res.json({ message: "MPIN reset successfully" });
  } catch (err) {
    console.error("Forgot MPIN reset error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/admin/freeze/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByIdAndUpdate(
      userId,
      { status: "FROZEN" },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ message: "User frozen successfully", user });
  } catch (err) {
    console.error("Freeze user error:", err);
    res.status(500).json({ error: "Failed to freeze user" });
  }
});

router.post("/admin/unfreeze/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByIdAndUpdate(
      userId,
      { status: "ACTIVE" },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ message: "User unfrozen successfully", user });
  } catch (err) {
    console.error("Unfreeze user error:", err);
    res.status(500).json({ error: "Failed to unfreeze user" });
  }
});

module.exports = router;