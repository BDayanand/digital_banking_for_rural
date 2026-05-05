import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { api_url } from "../config";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";

const REPORT_TYPES = [
  { value: "UNAUTHORIZED", label: "Unauthorized Transaction", desc: "Transaction I didn't make" },
  { value: "WRONG_RECIPIENT", label: "Wrong Recipient", desc: "Sent to wrong account" },
  { value: "DUPLICATE", label: "Duplicate Transaction", desc: "Same transaction charged twice" },
  { value: "NOT_RECEIVED", label: "Not Received", desc: "Money debited but not received" },
  { value: "FRAUD", label: "Suspected Fraud", desc: "Suspect fraudulent activity" },
  { value: "OTHER", label: "Other Issue", desc: "Any other problem" },
];

const ReportTransactionScreen = ({ navigation, route }) => {
  const { transaction } = route.params || {};
  const [selectedType, setSelectedType] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!selectedType) {
      Alert.alert("Error", "Please select a report type");
      return;
    }

    if (!transaction?.txn_id) {
      Alert.alert("Error", "Transaction ID is required");
      return;
    }

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("token");
      
      const res = await axios.post(
        `${api_url}/reports/create`,
        {
          transaction_id: transaction.txn_id,
          report_type: selectedType,
          description: description.trim(),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert(
        "✅ Report Submitted",
        "Your report has been submitted. We'll review it and get back to you.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      const errorMsg = err.response?.data?.error || "Failed to submit report";
      Alert.alert("Error", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report Transaction</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {transaction && (
          <View style={styles.txnCard}>
            <Text style={styles.txnLabel}>Reporting Transaction</Text>
            <View style={styles.txnDetails}>
              <View style={styles.txnRow}>
                <Text style={styles.txnKey}>Transaction ID:</Text>
                <Text style={styles.txnValue}>{transaction.txn_id}</Text>
              </View>
              <View style={styles.txnRow}>
                <Text style={styles.txnKey}>Amount:</Text>
                <Text style={[styles.txnValue, styles.amountText]}>₹{transaction.amount}</Text>
              </View>
              <View style={styles.txnRow}>
                <Text style={styles.txnKey}>Type:</Text>
                <Text style={[styles.txnValue, transaction.type === "DEBIT" ? styles.debitText : styles.creditText]}>
                  {transaction.type}
                </Text>
              </View>
              <View style={styles.txnRow}>
                <Text style={styles.txnKey}>Date:</Text>
                <Text style={styles.txnValue}>
                  {new Date(transaction.createdAt).toLocaleDateString()}
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What issue are you facing?</Text>
          
          {REPORT_TYPES.map((type) => (
            <TouchableOpacity
              key={type.value}
              style={[styles.typeCard, selectedType === type.value && styles.typeCardSelected]}
              onPress={() => setSelectedType(type.value)}
            >
              <View style={styles.typeHeader}>
                <Ionicons
                  name={selectedType === type.value ? "radio-button-on" : "radio-button-off"}
                  size={20}
                  color={selectedType === type.value ? "#1E3A8A" : "#9CA3AF"}
                />
                <Text style={[styles.typeLabel, selectedType === type.value && styles.typeLabelSelected]}>
                  {type.label}
                </Text>
              </View>
              <Text style={styles.typeDesc}>{type.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Details (Optional)</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Provide any additional information that might help us investigate..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color="#1E3A8A" />
          <Text style={styles.infoText}>
            Our team will review your report within 24-48 hours. You can track the status in your transaction reports.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.disabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Submit Report</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F7FB" },
  header: {
    backgroundColor: "#1E3A8A",
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  content: { flex: 1, padding: 16 },
  txnCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  txnLabel: { fontSize: 14, color: "#6B7280", marginBottom: 12 },
  txnDetails: {},
  txnRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  txnKey: { color: "#6B7280", fontSize: 14 },
  txnValue: { color: "#1F2937", fontSize: 14, fontWeight: "500" },
  amountText: { color: "#1E3A8A", fontWeight: "bold", fontSize: 16 },
  debitText: { color: "#DC2626" },
  creditText: { color: "#16A34A" },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#1F2937", marginBottom: 12 },
  typeCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  typeCardSelected: { borderColor: "#1E3A8A", backgroundColor: "#EEF2FF" },
  typeHeader: { flexDirection: "row", alignItems: "center" },
  typeLabel: { fontSize: 15, fontWeight: "600", color: "#374151", marginLeft: 10 },
  typeLabelSelected: { color: "#1E3A8A" },
  typeDesc: { fontSize: 13, color: "#6B7280", marginTop: 4, marginLeft: 30 },
  textArea: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#1F2937",
    height: 100,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  infoBox: {
    flexDirection: "row",
    backgroundColor: "#EEF2FF",
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  infoText: { flex: 1, marginLeft: 10, color: "#1E3A8A", fontSize: 13 },
  submitBtn: {
    backgroundColor: "#DC2626",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 40,
  },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  disabled: { opacity: 0.6 },
});

export default ReportTransactionScreen;