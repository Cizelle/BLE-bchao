import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Button,
  PermissionsAndroid,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import BackgroundService from 'react-native-background-actions';
import { bleMeshService } from './src/BleMeshService';
import { victimStorageManager, VictimData } from './src/VictimStorageManager';
import { BleManagerDidUpdateStateEvent } from 'react-native-ble-manager/src/types';
import Geolocation from 'react-native-geolocation-service';
import { backgroundBleTask } from './src/BackgroundBleTask';

// Constants for this device
const MY_DEVICE_ID = 'NODE-' + Math.floor(Math.random() * 1000); // Unique ID for testing
const INITIAL_LOCATION = { latitude: 28.7041, longitude: 77.1025 }; // Example GPS

// Background task options
const taskOptions = {
  taskName: 'BleMeshService',
  taskTitle: 'BLE Mesh Service Running',
  taskDesc: 'Broadcasting and relaying victim data',
  taskIcon: {
    name: 'ic_launcher',
    type: 'mipmap',
  },
  color: '#ff00ff',
  linkingURI: 'your-app-scheme://', // Optional: if you want to link back to the app
  parameters: {
    delay: 5000, // delay between each background task cycle in ms
  },
};

const App = () => {
  const [role, setRole] = useState<'none' | 'victim' | 'rescuer'>('none');
  const [discoveredVictims, setDiscoveredVictims] = useState<VictimData[]>([]);
  const [bleStatus, setBleStatus] = useState('Initializing...');
  const [currentLocation, setCurrentLocation] = useState(INITIAL_LOCATION);

  /**
   * requestAppPermissions
   * - requests ACCESS_FINE_LOCATION
   * - requests BLUETOOTH_SCAN, BLUETOOTH_CONNECT, BLUETOOTH_ADVERTISE if available
   * - robust to different Android / RN versions by checking permission constants
   */
  const requestAppPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;

    try {
      const P = PermissionsAndroid.PERMISSIONS;
      const permissionsToRequest: string[] = [];

      // Always ask location (needed on older Android for BLE scanning)
      if (P.ACCESS_FINE_LOCATION) permissionsToRequest.push(P.ACCESS_FINE_LOCATION);

      // Android 12+ runtime BLE permissions (request only if constant exists)
      if (P.BLUETOOTH_SCAN) permissionsToRequest.push(P.BLUETOOTH_SCAN);
      if (P.BLUETOOTH_CONNECT) permissionsToRequest.push(P.BLUETOOTH_CONNECT);
      if (P.BLUETOOTH_ADVERTISE) permissionsToRequest.push(P.BLUETOOTH_ADVERTISE);

      // If nothing to request (older RN/platform), treat as granted
      if (permissionsToRequest.length === 0) return true;

      const granted = await PermissionsAndroid.requestMultiple(permissionsToRequest);

      // Check every requested permission was granted
      let allGranted = true;
      for (const perm of permissionsToRequest) {
        if (granted[perm] !== PermissionsAndroid.RESULTS.GRANTED) {
          allGranted = false;
          break;
        }
      }

      if (!allGranted) {
        console.warn('Permissions denied:', granted);
        // Suggest the user open settings to grant if they blocked permanently
        Alert.alert(
          'Permissions required',
          'Bluetooth and/or Location permission(s) were denied. The app needs them to function. You can open Settings to enable them.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
          { cancelable: true }
        );
      }

      return allGranted;
    } catch (err) {
      console.warn('Permission request error', err);
      return false;
    }
  };

  /**
   * startLocationTracking
   * checks permissions and starts Geolocation.watchPosition
   */
  const startLocationTracking = async () => {
    const hasPermission = await requestAppPermissions();
    if (!hasPermission) {
      console.log('Permissions denied: location/ble not available.');
      setBleStatus('Permissions denied. Cannot start location tracking.');
      return;
    }

    // Start tracking (returns watchId but we keep simple)
    Geolocation.watchPosition(
      (position: any) => {
        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        console.log('Geolocation watch error:', error);
      },
      { enableHighAccuracy: true, distanceFilter: 10, interval: 5000, fastestInterval: 2000 }
    );
  };

  /**
   * handleRoleSelect
   * - unified permission check
   * - starts background or foreground BLE behavior
   */
  const handleRoleSelect = async (newRole: 'victim' | 'rescuer') => {
    setBleStatus('Requesting permissions...');
    const isPermissionGranted = await requestAppPermissions();
    if (!isPermissionGranted) {
      setBleStatus('Bluetooth/Location permissions DENIED');
      return;
    }

    // Stop previous mesh if any
    bleMeshService.stopGossipMesh();
    setRole(newRole);

    if (newRole === 'victim') {
      // Victim: background advertising/relaying
      try {
        if (!BackgroundService.isRunning()) {
          await BackgroundService.start(backgroundBleTask, taskOptions);
        }
        await startLocationTracking();
        setBleStatus('Running: Advertising and Relaying Victim Data (Background Mode)...');
      } catch (err) {
        console.warn('Failed to start background service:', err);
        setBleStatus('Failed to start background service');
      }
    } else {
      // Rescuer: foreground scanning/relaying
      await startLocationTracking();
      try {
        await bleMeshService.startGossipMesh(null);
        setBleStatus('Running: Scanning and Relaying Victim Data (Foreground Mode)...');
      } catch (err) {
        console.warn('Failed to start gossip mesh:', err);
        setBleStatus('Failed to start gossip mesh');
      }
    }
  };

  /**
   * Main Effect Hook for UI updates and cleanup
   */
  useEffect(() => {
    const refreshVictims = async () => {
      const victims = await victimStorageManager.getAllVictims();
      setDiscoveredVictims(victims);
    };

    const stateSubscription = bleMeshService.setupStateListener((state: BleManagerDidUpdateStateEvent) => {
      if (String(state.state) !== 'poweredOn') {
        setBleStatus(`BLE Disabled: ${state.state}. Please turn on Bluetooth.`);
      } else {
        setBleStatus('Bluetooth Ready.');
      }
    });

    const intervalId = setInterval(refreshVictims, 5000);

    return () => {
      // Cleanup on component unmount
      bleMeshService.stopGossipMesh();
      // remove may be undefined depending on lib — guard defensively
      try {
        stateSubscription?.remove?.();
      } catch {}
      clearInterval(intervalId);
      try {
        BackgroundService.stop();
      } catch {}
    };
  }, []);

  /**
   * Store victim data when role= victim and location updates
   */
  useEffect(() => {
    if (role === 'victim') {
      const myVictimData: VictimData = {
        deviceId: MY_DEVICE_ID,
        role: 'victim',
        gpsLocation: currentLocation,
        timestamp: Date.now(),
      };
      victimStorageManager.storeVictim(myVictimData);
    }
  }, [currentLocation, role]);

  /**
   * UI renderers
   */
  const renderHome = () => (
    <View style={styles.homeContainer}>
      <Text style={styles.title}>BLE Mesh App</Text>
      <Text style={styles.subtitle}>My Device ID: {MY_DEVICE_ID}</Text>
      <Text style={styles.sectionTitle}>Choose Your Role</Text>
      <View style={styles.buttonContainer}>
        <Button title="I am a Victim" onPress={() => handleRoleSelect('victim')} color="#ff4444" />
        <View style={{ width: 20 }} />
        <Button title="I am a Rescuer" onPress={() => handleRoleSelect('rescuer')} color="#44aaff" />
      </View>
    </View>
  );

  const renderRoleView = () => (
    <View style={styles.roleContainer}>
      <Text style={styles.sectionTitle}>
        {role === 'victim' ? 'Victim Node' : 'Rescuer Node'}
      </Text>
      <Text style={styles.statusText}>{bleStatus}</Text>
      <Text style={styles.statusText}>
        {role === 'victim' ? 'Broadcasting/Relaying...' : 'Scanning/Relaying...'}
      </Text>
      <Text style={styles.statusText}>
        My Location: Lat {currentLocation.latitude.toFixed(4)}, Lon {currentLocation.longitude.toFixed(4)}
      </Text>

      <Text style={styles.subtitle}>Discovered Victims ({discoveredVictims.length}):</Text>
      <View style={styles.listContainer}>
        {discoveredVictims.length === 0 ? (
          <Text style={styles.noDataText}>Waiting for nearby signals...</Text>
        ) : (
          discoveredVictims.map((v) => (
            <View key={v.deviceId} style={styles.victimCard}>
              <Text style={styles.cardText}>ID: {v.deviceId}</Text>
              <Text style={styles.cardText}>Role: {v.role}</Text>
              <Text style={styles.cardText}>
                Loc: Lat {v.gpsLocation.latitude.toFixed(4)}, Lon {v.gpsLocation.longitude.toFixed(4)}
              </Text>
              <Text style={styles.cardText}>Last Seen: {new Date(v.timestamp).toLocaleTimeString()}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title="Go Back / Stop Mesh"
          onPress={() => {
            // Stop background & mesh when going back
            try {
              BackgroundService.stop();
            } catch {}
            bleMeshService.stopGossipMesh();
            setRole('none');
            setBleStatus('Stopped.');
          }}
          color="#888"
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.content}>
        {role === 'none' ? renderHome() : renderRoleView()}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#222' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  homeContainer: { width: '100%', alignItems: 'center' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 5 },
  sectionTitle: { fontSize: 24, fontWeight: '600', color: '#fff', marginVertical: 20 },
  buttonContainer: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 10 },
  roleContainer: { width: '100%', alignItems: 'center' },
  statusText: { fontSize: 16, color: '#ccc', marginBottom: 5 },
  subtitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginTop: 10, marginBottom: 10 },
  listContainer: { width: '100%', maxHeight: 400, overflow: 'scroll' },
  victimCard: {
    backgroundColor: '#333',
    padding: 10,
    borderRadius: 8,
    marginVertical: 5,
    width: '100%',
    borderColor: '#555',
    borderWidth: 1,
  },
  cardText: { color: '#fff', fontSize: 14 },
  noDataText: { color: '#aaa', fontStyle: 'italic', marginTop: 10 },
});

export default App;
