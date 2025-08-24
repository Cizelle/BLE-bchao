import React, { useState, useEffect } from "react";
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Button,
  Platform,
} from "react-native";
import { PermissionsAndroid, Permission } from "react-native";
import Geolocation from "react-native-geolocation-service";
import BleManager from "react-native-ble-manager";
import BLEAdvertiser from "react-native-ble-advertiser";
import { victimStorageManager, VictimData } from "./src/VictimStorageManager";

const MY_DEVICE_ID = "NODE-" + Math.floor(Math.random() * 1000);
const INITIAL_LOCATION = { latitude: 28.7041, longitude: 77.1025 };


const requestAppPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== "android") return true;
  try {
    const permissionsToRequest: Permission[] = [
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
    ];
    const granted = await PermissionsAndroid.requestMultiple(permissionsToRequest);
    return Object.values(granted).every(
      (result) => result === PermissionsAndroid.RESULTS.GRANTED
    );
  } catch (err) {
    console.warn("Permission request error", err);
    return false;
  }
};

const App = () => {
  const [role, setRole] = useState<"none" | "victim" | "rescuer">("none");
  const [discoveredVictims, setDiscoveredVictims] = useState<VictimData[]>([]);
  const [bleStatus, setBleStatus] = useState("Initializing...");
  const [currentLocation, setCurrentLocation] = useState(INITIAL_LOCATION);

  /**
   * Location tracking
   */
  const startLocationTracking = async () => {
    const hasPermission = await requestAppPermissions();
    if (!hasPermission) return;

    Geolocation.watchPosition(
      (position) => {
        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => console.log("Geolocation error:", error),
      { enableHighAccuracy: true, distanceFilter: 10, interval: 5000, fastestInterval: 2000 }
    );
  };

  /**
   * Victim Mode = advertise + gossip relay
   */
  const startVictimMode = async () => {
    try {
      BLEAdvertiser.setCompanyId(0x1234);
      await BLEAdvertiser.stopBroadcast();
      setBleStatus("📡 Victim mode: advertising location");
    } catch (err) {
      console.log("Victim advertise error:", err);
      setBleStatus("❌ Victim advertise failed");
    }
  };

  const stopVictimMode = async () => {
    try {
      await BLEAdvertiser.stopBroadcast();
    } catch {}
  };

  /**
   * Rescuer Mode = scan + gossip relay
   */
  const startRescuerMode = async () => {
    try {
      BleManager.start({ showAlert: false });
      BleManager.scan([], 5, true).then(() =>
        setBleStatus("🔍 Rescuer mode: scanning...")
      );

      // Listen to discovered devices
    } catch (err) {
      console.log("Rescuer scan error:", err);
      setBleStatus("❌ Rescuer scan failed");
    }
  };

  const stopRescuerMode = async () => {
    try {
      await BleManager.stopScan();
    } catch {}
  };

  /**
   * Role selection
   */
  const handleRoleSelect = async (newRole: "victim" | "rescuer") => {
    const ok = await requestAppPermissions();
    if (!ok) {
      setBleStatus("Permissions denied");
      return;
    }

    setRole(newRole);
    await startLocationTracking();

    if (newRole === "victim") {
      startVictimMode();
    } else {
      startRescuerMode();
    }
  };

  /**
   * Victim data auto-save
   */
  useEffect(() => {
    if (role === "victim") {
      const myVictimData: VictimData = {
        deviceId: MY_DEVICE_ID,
        role: "victim",
        gpsLocation: currentLocation,
        timestamp: Date.now(),
      };
      victimStorageManager.storeVictim(myVictimData);
    }
  }, [currentLocation, role]);

  /**
   * Poll victim store for rescuer display
   */
  useEffect(() => {
    const intervalId = setInterval(async () => {
      const victims = await victimStorageManager.getAllVictims();
      setDiscoveredVictims(victims);
    }, 5000);
    return () => clearInterval(intervalId);
  }, []);

  /**
   * Cleanup
   */
  useEffect(() => {
    return () => {
      stopVictimMode();
      stopRescuerMode();
    };
  }, []);

  /**
   * UI
   */
  const renderHome = () => (
    <View style={styles.homeContainer}>
      <Text style={styles.title}>BLE Mesh App</Text>
      <Text style={styles.subtitle}>My Device ID: {MY_DEVICE_ID}</Text>
      <Text style={styles.sectionTitle}>Choose Your Role</Text>
      <View style={styles.buttonContainer}>
        <Button title="I am a Victim" onPress={() => handleRoleSelect("victim")} color="#ff4444" />
        <View style={{ width: 20 }} />
        <Button title="I am a Rescuer" onPress={() => handleRoleSelect("rescuer")} color="#44aaff" />
      </View>
    </View>
  );

  const renderRoleView = () => (
    <View style={styles.roleContainer}>
      <Text style={styles.sectionTitle}>
        {role === "victim" ? "Victim Node" : "Rescuer Node"}
      </Text>
      <Text style={styles.statusText}>{bleStatus}</Text>
      <Text style={styles.statusText}>
        My Location: Lat {currentLocation.latitude.toFixed(4)}, Lon{" "}
        {currentLocation.longitude.toFixed(4)}
      </Text>
      {role === "rescuer" && (
        <>
          <Text style={styles.subtitle}>
            Discovered Victims ({discoveredVictims.length}):
          </Text>
          <View style={styles.listContainer}>
            {discoveredVictims.length === 0 ? (
              <Text style={styles.noDataText}>Waiting for signals...</Text>
            ) : (
              discoveredVictims.map((v) => (
                <View key={v.deviceId} style={styles.victimCard}>
                  <Text style={styles.cardText}>ID: {v.deviceId}</Text>
                  <Text style={styles.cardText}>
                    Loc: {v.gpsLocation.latitude.toFixed(4)}, {v.gpsLocation.longitude.toFixed(4)}
                  </Text>
                  <Text style={styles.cardText}>
                    Last Seen: {new Date(v.timestamp).toLocaleTimeString()}
                  </Text>
                </View>
              ))
            )}
          </View>
        </>
      )}
      <Button
        title="Go Back / Stop Mesh"
        onPress={() => {
          stopVictimMode();
          stopRescuerMode();
          setRole("none");
          setBleStatus("Stopped.");
        }}
        color="#888"
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.content}>
        {role === "none" ? renderHome() : renderRoleView()}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#222" },
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  homeContainer: { width: "100%", alignItems: "center" },
  title: { fontSize: 32, fontWeight: "bold", color: "#fff", marginBottom: 5 },
  sectionTitle: { fontSize: 24, fontWeight: "600", color: "#fff", marginVertical: 20 },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: 10,
  },
  roleContainer: { width: "100%", alignItems: "center" },
  statusText: { fontSize: 16, color: "#ccc", marginBottom: 5 },
  subtitle: { fontSize: 18, fontWeight: "600", color: "#fff", marginTop: 10, marginBottom: 10 },
  listContainer: { width: "100%", maxHeight: 400 },
  victimCard: {
    backgroundColor: "#333",
    padding: 10,
    borderRadius: 8,
    marginVertical: 5,
    width: "100%",
    borderColor: "#555",
    borderWidth: 1,
  },
  cardText: { color: "#fff", fontSize: 14 },
  noDataText: { color: "#aaa", fontStyle: "italic", marginTop: 10 },
});

export default App;
