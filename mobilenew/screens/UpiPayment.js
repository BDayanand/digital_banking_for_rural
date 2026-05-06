import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { api_url } from "../config";
import { checkConnection } from "../utilitis/network";
import { queueTransaction } from "../utilitis/offlineQueue";

export default function UPIPaymentScreen({ route, navigation }) {
  const { upiId, name } = route.params;

  const [amount, setAmount] = useState("");
  const [upiPin, setUpiPin] = useState("");
  const [storedPin, setStoredPin] = useState(null);
  const [otp, setOtp] = useState("");

  const [showPinModal, setShowPinModal] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    loadPin();
  }, []);

  const loadPin = async () => {
    const pin = await AsyncStorage.getItem("upiPin");
    if (pin) setStoredPin(pin);
  };

  const proceedPayment = () => {
    if (!amount || isNaN(amount)) {
      Alert.alert("Enter valid amount");
      return;
    }
    Alert.alert(
      "Confirm Payment",
      `You are sending ₹${amount} to ${name || upiId}. Are you sure to continue?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Continue", onPress: () => setShowPinModal(true) }
      ]
    );
  };

  const handlePinSubmit = async () => {
    if (!storedPin) {
      if (upiPin.length < 4) {
        Alert.alert("UPI PIN must be 4 digits");
        return;
      }
      await AsyncStorage.setItem("upiPin", upiPin);
      setStoredPin(upiPin);
      Alert.alert("PIN Saved");
    } else {
      if (upiPin !== storedPin) {
        Alert.alert("Wrong PIN");
        return;
      }
    }

    setShowPinModal(false);

    if (Number(amount) < 10000) {
      makePaymentWithoutOtp();
    } else {
      sendOtp();
    }
  };

  const makePaymentWithoutOtp = async () => {
    const isOnline = await checkConnection();

    if (!isOnline) {
      try {
        const data = { upiId, amount };
        const localId = await queueTransaction('upi_payment', data);
        
        Alert.alert(
          "Saved Offline",
          "Transaction saved. Will be processed when internet is available.",
          [{ text: "OK", onPress: () => navigation.replace("Dashboard") }]
        );
        return;
      } catch (error) {
        Alert.alert("Error", "Failed to save transaction offline");
        return;
      }
    }

    try {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      const token = await AsyncStorage.getItem("token");
      const res = await axios.post(
        `${api_url}/txns/upi/send`,
        { upiId, amount },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.is_scheduled) {
        Alert.alert(
          "⏳ Transaction Scheduled",
          `Your payment of ₹${amount} is delayed for security.\n\n${res.data.delay_reason}\n\nWill be processed after 1 hour.\n\nCheck History tab for status.`,
          [{ text: "OK", onPress: () => navigation.replace("Dashboard") }]
        );
      } else {
        Alert.alert("Payment Success");
        navigation.replace("Dashboard");
      }
    } catch (e) {
      Alert.alert("Transaction Failed", e.response?.data?.error);
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      await axios.post(`${api_url}/txns/send-otp`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setShowOtpModal(true);
    } catch {
      Alert.alert("OTP failed");
    }
  };

  const makePayment = async () => {
    if (!otp) return;

    const isOnline = await checkConnection();

    if (!isOnline) {
      try {
        const data = { upiId, amount, otp };
        const localId = await queueTransaction('upi_payment', data);
        
        setShowOtpModal(false);
        Alert.alert(
          "Saved Offline",
          "Transaction saved. Will be processed when internet is available.",
          [{ text: "OK", onPress: () => navigation.replace("Dashboard") }]
        );
        return;
      } catch (error) {
        Alert.alert("Error", "Failed to save transaction offline");
        return;
      }
    }

    try {
      const token = await AsyncStorage.getItem("token");
      const res = await axios.post(
        `${api_url}/txns/upi/send`,
        { upiId, amount, otp },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setShowOtpModal(false);

      if (res.data.is_scheduled) {
        Alert.alert(
          "⏳ Transaction Scheduled",
          `Your payment of ₹${amount} is delayed for security.\n\n${res.data.delay_reason}\n\nWill be processed after 1 hour.\n\nCheck History tab for status.`,
          [{ text: "OK", onPress: () => navigation.replace("Dashboard") }]
        );
      } else {
        Alert.alert("Payment Success");
        navigation.replace("Dashboard");
      }
    } catch (e) {
      Alert.alert("Transaction Failed", e.response?.data?.error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pay</Text>
      </View>

      {/* Receiver Details */}
      <View style={styles.card}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.upi}>{upiId}</Text>
      </View>

      {/* Amount */}
      <TextInput
        style={styles.amountInput}
        placeholder="₹ Enter amount"
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
      />

      {/* Button */}
      <TouchableOpacity style={styles.payBtn} onPress={proceedPayment}>
        <Text style={styles.payText}>Proceed to Pay</Text>
      </TouchableOpacity>

      {/* PIN Modal */}
      <Modal visible={showPinModal} transparent animationType="slide">
        <View style={styles.modal}>
          <View style={styles.box}>
            <Text style={styles.title}>
              {storedPin ? "Enter UPI PIN" : "Set UPI PIN"}
            </Text>

            <TextInput
              placeholder="****"
              keyboardType="numeric"
              secureTextEntry
              style={styles.input}
              value={upiPin}
              onChangeText={setUpiPin}
            />

            <TouchableOpacity style={styles.primary} onPress={handlePinSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Continue</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* OTP Modal */}
      <Modal visible={showOtpModal} transparent animationType="slide">
        <View style={styles.modal}>
          <View style={styles.box}>
            <Text style={styles.title}>Enter OTP</Text>

            <TextInput
              placeholder="OTP"
              keyboardType="numeric"
              style={styles.input}
              value={otp}
              onChangeText={setOtp}
            />

            <TouchableOpacity style={styles.primary} onPress={makePayment}>
              <Text style={styles.primaryText}>Pay</Text>
            </TouchableOpacity>
             <TouchableOpacity style={styles.primary} onPress={() => setShowOtpModal(false)}>
              <Text style={styles.primaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:"#fff"},
  header:{flexDirection:"row",alignItems:"center",paddingTop:45,padding:15,backgroundColor:"#5e2ced"},
  back:{color:"#fff",fontSize:26,marginRight:10},
  headerTitle:{color:"#fff",fontSize:18,fontWeight:"bold"},
  card:{margin:20,padding:20,borderRadius:15,backgroundColor:"#f1e9ff"},
  name:{fontSize:20,fontWeight:"bold"},
  upi:{color:"#666",marginTop:5},
  amountInput:{fontSize:28,textAlign:"center",marginTop:20,borderBottomWidth:1,borderColor:"#ccc"},
  payBtn:{backgroundColor:"#5e2ced",margin:20,padding:15,borderRadius:12,alignItems:"center"},
  payText:{color:"#fff",fontSize:18,fontWeight:"bold"},
  modal:{flex:1,backgroundColor:"#00000088",alignItems:"center",justifyContent:"center"},
  box:{backgroundColor:"#fff",width:"85%",borderRadius:15,padding:18,alignItems:"center"},
  title:{fontSize:18,fontWeight:"bold"},
  input:{width:"90%",borderWidth:1,borderColor:"#aaa",borderRadius:8,padding:10,textAlign:"center",marginTop:10},
  primary:{backgroundColor:"#5e2ced",width:"90%",padding:12,marginTop:15,borderRadius:10,alignItems:"center"},
  primaryText:{color:"#fff",fontWeight:"bold"}
});
