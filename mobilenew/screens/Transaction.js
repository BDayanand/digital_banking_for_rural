import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Modal from "react-native-modal";
import { api_url } from "../config";
import { checkConnection, getConnectionStatus } from "../utilitis/network";
import { queueTransaction, processQueue } from "../utilitis/offlineQueue";

const Transaction = ({ navigation }) => {
  const [beneficiary, setBeneficiary] = useState("");
  const [account, setAccount] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [amount, setAmount] = useState("");
  const [otp, setOtp] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [fraudData, setFraudData] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [otpModal, setOtpModal] = useState(false);

  useEffect(() => {
    (async () => {
      const storedPhone = await AsyncStorage.getItem("phoneNumber");
      if (storedPhone) setPhone(storedPhone);
    })();
  }, []);

  const handleSendOtp = async () => {
    if (!beneficiary || !account || !ifsc || !amount) {
      Alert.alert("⚠️ Missing Fields", "Please fill all details before proceeding.");
      return;
    }

    Alert.alert(
      "Confirm Payment",
      `You are sending ₹${amount} to ${beneficiary} (${account}). Are you sure to continue?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Continue", onPress: () => {
          if (Number(amount) < 10000) {
            sendWithoutOtp();
          } else {
            sendOtpAndProceed();
          }
        }}
      ]
    );
  };

  const sendWithoutOtp = async () => {
    const isOnline = await checkConnection();

    if (!isOnline) {
      try {
        const data = {
          beneficiary_name: beneficiary.trim(),
          to_account: account.trim(),
          ifsc: ifsc.trim().toUpperCase(),
          amount: Number(amount),
          phone,
        };

        const localId = await queueTransaction('bank_transfer', data);

        setFraudData({
          offline: true,
          success: true,
          localId,
          message: "Transaction saved. Will be processed when internet is available."
        });
        setShowModal(true);
        
        setBeneficiary("");
        setAccount("");
        setIfsc("");
        setAmount("");
        return;
      } catch (error) {
        Alert.alert("Error", "Failed to save transaction offline");
        return;
      }
    }

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("token");

      const res = await axios.post(
        `${api_url}/txns/send`,
        {
          beneficiary_name: beneficiary.trim(),
          to_account: account.trim(),
          ifsc: ifsc.trim().toUpperCase(),
          amount: Number(amount),
          phone,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const { is_fraud, fraud_reason, balance_after, is_scheduled, scheduled_at, delay_reason } = res.data;

      if (is_scheduled) {
        setFraudData({
          success: true,
          is_scheduled: true,
          scheduled_at: scheduled_at,
          delay_reason: delay_reason,
          balance_after,
        });
      } else if (is_fraud) {
        setFraudData({
          success: true,
          is_fraud: true,
          fraud_reason,
          balance_after,
        });
      } else {
        setFraudData({
          success: true,
          balance_after,
        });
      }
      setShowModal(true);
      
      setBeneficiary("");
      setAccount("");
      setIfsc("");
      setAmount("");
    } catch (err) {
      console.error("Transaction error:", err);
      Alert.alert("Error", err.response?.data?.error || "Transaction failed");
    } finally {
      setLoading(false);
    }
  };

  const sendOtpAndProceed = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Session expired", "Please log in again");
        navigation.replace("Login");
        return;
      }

      const formattedPhone = phone.startsWith("+91") ? phone : `+91${phone}`;
      await axios.post(
        `${api_url}/txns/send-otp`,
        { },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setOtpModal(true);
    } catch (err) {
      console.error("OTP Error:", err);
      Alert.alert("Error", err.response?.data?.error || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtpAndSend = async () => {
    if (!otp) {
      Alert.alert("⚠️ Enter OTP");
      return;
    }

    const isOnline = await checkConnection();

    if (!isOnline) {
      try {
        const data = {
          beneficiary_name: beneficiary.trim(),
          to_account: account.trim(),
          ifsc: ifsc.trim().toUpperCase(),
          amount: Number(amount),
          otp,
          phone,
        };

        const localId = await queueTransaction('bank_transfer', data);

        setOtpModal(false);
        setFraudData({
          offline: true,
          success: true,
          localId,
          message: "Transaction saved. Will be processed when internet is available."
        });
        setShowModal(true);
        
        setBeneficiary("");
        setAccount("");
        setIfsc("");
        setAmount("");
        setOtp("");
        return;
      } catch (error) {
        Alert.alert("Error", "Failed to save transaction offline");
        return;
      }
    }

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("token");

      const res = await axios.post(
        `${api_url}/txns/send`,
        {
          beneficiary_name: beneficiary.trim(),
          to_account: account.trim(),
          ifsc: ifsc.trim().toUpperCase(),
          amount: Number(amount),
          otp,
          phone,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const { is_fraud, fraud_reason, balance_after, is_scheduled, scheduled_at, delay_reason } = res.data;
      setOtpModal(false);

      if (is_scheduled) {
        // Transaction is delayed
        setFraudData({
          success: true,
          is_scheduled: true,
          scheduled_at: scheduled_at,
          delay_reason: delay_reason,
          balance_after,
        });
      } else if (is_fraud) {
        setFraudData({
          reason: fraud_reason || "Suspicious transaction detected.",
          blocked: true,
          balance_after,
        });
      } else {
        setFraudData({
          success: true,
          balance_after,
        });
      }

      setShowModal(true);
      setBeneficiary("");
      setAccount("");
      setIfsc("");
      setAmount("");
      setOtp("");
    } catch (err) {
      console.error("Transaction error:", err);
      Alert.alert("Error", err.response?.data?.error || "Transaction failed.");
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    if (fraudData?.success) navigation.navigate("Dashboard");
  };

  return (
    <View style={styles.main}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Send Money</Text>
      </View>

      <View style={styles.container}>
        <View style={styles.card}>
          <TextInput
            style={styles.input}
            placeholder="Beneficiary Name"
            value={beneficiary}
            onChangeText={setBeneficiary}
            placeholderTextColor="black"
          />
          <TextInput
            style={styles.input}
            placeholder="Account Number"
            keyboardType="number-pad"
            value={account}
            onChangeText={setAccount}
            placeholderTextColor="black"
          />
          <TextInput
            style={styles.input}
            placeholder="IFSC Code"
            autoCapitalize="characters"
            value={ifsc}
            onChangeText={setIfsc}
            placeholderTextColor="black"
          />
          <TextInput
            style={styles.input}
            placeholder="Amount ₹"
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
            placeholderTextColor="black"
          />

          <TouchableOpacity
            style={[styles.sendButton, loading && { opacity: 0.7 }]}
            onPress={handleSendOtp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.sendButtonText}>Proceed ➡️</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* OTP MODAL */}
      <Modal isVisible={otpModal} onBackdropPress={() => setOtpModal(false)}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>Enter OTP</Text>
          <Text style={styles.modalSub}>We sent an OTP to {phone}</Text>

          <TextInput
            style={styles.inputModal}
            placeholder="4 Digit OTP"
            keyboardType="number-pad"
            maxLength={4}
            value={otp}
            onChangeText={setOtp}
            placeholderTextColor="black"
          />

          <TouchableOpacity
            style={styles.verifyButton}
            onPress={handleVerifyOtpAndSend}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.verifyText}>Verify & Pay</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setOtpModal(false)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* RESULT MODAL */}
      <Modal isVisible={showModal} onBackdropPress={closeModal}>
        <View style={styles.modalBox}>
          {fraudData?.offline ? (
            <>
              <Text style={styles.offlineTitle}>Saved Offline</Text>
              <Text style={styles.modalSub}>
                Transaction saved. Will be processed when internet is available.
              </Text>
              <Text style={styles.balance}>
                Check history for status
              </Text>
            </>
          ) : fraudData?.success ? (
            fraudData?.is_scheduled ? (
              <>
                <Text style={styles.successTitle}>⏳ Transaction Scheduled</Text>
                <Text style={styles.modalSub}>
                  Your transaction of ₹{amount} is delayed for security.
                </Text>
                <Text style={styles.modalSub}>
                  {fraudData.delay_reason}
                </Text>
                <Text style={styles.balance}>
                  Scheduled for: {fraudData.scheduled_at ? new Date(fraudData.scheduled_at).toLocaleTimeString() : '1 hour'}
                </Text>
                <Text style={styles.balance}>
                  Check History tab for status
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.successTitle}>₹ Payment Successful</Text>
                <Text style={styles.modalSub}>Transaction completed.</Text>
                <Text style={styles.balance}>
                  New Balance: ₹{fraudData.balance_after}
                </Text>
              </>
            )
          ) : (
            <>
              <Text style={styles.failTitle}>⚠️ Fraud Detected</Text>
              <Text style={styles.modalSub}>
                {fraudData?.reason || "Suspicious activity detected"}
              </Text>
              <Text style={styles.balance}>Transaction Blocked</Text>
            </>
          )}

          <TouchableOpacity style={styles.okButton} onPress={closeModal}>
            <Text style={styles.okText}>OK</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  main: {
    flex: 1,
    backgroundColor: "#F1E9FF",
  },

  header: {
    backgroundColor: "#5E2CED",
    paddingTop: 50,
    paddingBottom: 15,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backArrow: { color: "#fff", fontSize: 26, marginRight: 10 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },

  container: { padding: 20 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    elevation: 3,
  },

  input: {
    backgroundColor: "#F4F4FF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },

  sendButton: {
    backgroundColor: "#5E2CED",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  sendButtonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },

  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 22,
    alignItems: "center",
  },

  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#5E2CED" },
  modalSub: { color: "#555", marginVertical: 6, textAlign: "center" },

  inputModal: {
    width: "90%",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginVertical: 10,
    borderColor: "#ddd",
    textAlign: "center",
  },

  verifyButton: {
    backgroundColor: "#5E2CED",
    width: "90%",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 5,
  },
  verifyText: { color: "#fff", fontWeight: "bold" },
  cancelText: { color: "#5E2CED", fontWeight: "bold", marginTop: 10 },

  successTitle: { color: "#36C964", fontWeight: "bold", fontSize: 18 },
  failTitle: { color: "#FF3B30", fontWeight: "bold", fontSize: 18 },
  offlineTitle: { color: "#F59E0B", fontWeight: "bold", fontSize: 18 },
  balance: { marginTop: 10, color: "#555" },

  okButton: {
    backgroundColor: "#5E2CED",
    padding: 12,
    borderRadius: 10,
    marginTop: 15,
  },
  okText: { color: "#fff", fontWeight: "bold" },
});

export default Transaction;
