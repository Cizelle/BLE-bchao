import { PermissionsAndroid, Platform, NativeModules, DeviceEventEmitter } from 'react-native';

import BleManager from 'react-native-ble-manager';
import type { BleManagerDidUpdateStateEvent } from 'react-native-ble-manager/src/types'; // Correct type import path

import { Buffer } from 'buffer';
import { victimStorageManager, VictimData } from './VictimStorageManager';
import { SERVICES_UUID, VICTIM_CHARACTERISTIC_UUID } from './UUIDs';

const BleManagerModule = NativeModules.BleManager;

const BLE_SCAN_TIME_MS = 10000; // 10 seconds of scanning
const BLE_ADVERTISE_TIME_MS = 5000; // 5 seconds of advertising

class BleMeshService {
    private isScanning = false;
    private isAdvertising = false;

    constructor() {
        BleManager.start({ showAlert: false });
    }

    /* --------------------------------------------------
     * Shared Logic (Permissions & State)
     * -------------------------------------------------- */

    async requestPermissions(): Promise<boolean> {
        if (Platform.OS === 'android') {
            const isGranted = await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
            ]);

            const allGranted =
                isGranted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED &&
                isGranted['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
                isGranted['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED &&
                isGranted['android.permission.BLUETOOTH_ADVERTISE'] === PermissionsAndroid.RESULTS.GRANTED;

            if (!allGranted) {
                console.warn('Bluetooth permissions denied.');
            }
            return allGranted;
        }
        return true;
    }

    setupStateListener(onStateChange: (state: BleManagerDidUpdateStateEvent) => void) {
        return DeviceEventEmitter.addListener('BleManagerDidUpdateState', onStateChange);
    }

    /* --------------------------------------------------
     * Gossip Protocol (The Mesh Logic)
     * -------------------------------------------------- */

    private encodeVictimData(data: VictimData): string {
        const jsonString = JSON.stringify(data);
        return Buffer.from(jsonString).toString('base64');
    }

    private decodeVictimData(base64String: string): VictimData | null {
        try {
            const jsonString = Buffer.from(base64String, 'base64').toString('utf8');
            const data = JSON.parse(jsonString) as VictimData;
            return data;
        } catch (e) {
            console.error('Failed to decode/parse victim data:', e);
            return null;
        }
    }

    async startGossipMesh(myVictimData: VictimData | null) {
        if (this.isScanning || this.isAdvertising) {
            this.stopGossipMesh();
        }
        
        // This is the core state machine for the gossip protocol
        const gossipLoop = async () => {
            // Step 1: Scan for nearby victims
            await this.startScanAndRead();

            // Step 2: Get the most recent victims
            const victimsToAdvertise = await this.getLatestVictimsForAdvertising(myVictimData);
            
            // Step 3: Advertise the collected data
            await this.startAdvertising(victimsToAdvertise);
        };
        
        // Start the continuous loop
        setInterval(gossipLoop, BLE_SCAN_TIME_MS + BLE_ADVERTISE_TIME_MS);
    }
    
    stopGossipMesh() {
        if (this.isScanning) BleManager.stopScan();
        if (this.isAdvertising) {
            BleManagerModule.stopPeripheral();
        }
        // TODO: clear the interval
    }

    private async getLatestVictimsForAdvertising(myVictimData: VictimData | null): Promise<VictimData[]> {
        const storedVictims = await victimStorageManager.getAllVictims();
        const latestVictims = storedVictims.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
        if (myVictimData) {
            // Also include my own data in the advertising packet
            latestVictims.push(myVictimData);
        }
        return latestVictims;
    }

 private async startAdvertising(victims: VictimData[]) {
    try {
        this.isAdvertising = true;
        const payload = JSON.stringify(victims);
        const data = this.encodeVictimData({
            deviceId: "MESH_NODE",
            role: "victim",
            gpsLocation: {latitude: 0, longitude: 0},
            timestamp: Date.now(),
            payload: payload
        });

        // Use the native module's startPeripheral method
        await BleManagerModule.startPeripheral({
            advertiseData: data,
            serviceUUID: SERVICES_UUID,
            txPowerLevel: 1, // HIGH
            includeDeviceName: false,
        });

        console.log("Advertising started with data:", payload);
        
        setTimeout(() => {
            // Use the native module's stopPeripheral method
            BleManagerModule.stopPeripheral(); 
            this.isAdvertising = false;
            console.log("Advertising stopped.");
        }, BLE_ADVERTISE_TIME_MS);

    } catch (e) {
        console.error("Advertising failed:", e);
    }
}
    
    private async startScanAndRead() {
        try {
            this.isScanning = true;
            console.log("Starting BLE scan...");
            await BleManager.scan([SERVICES_UUID], BLE_SCAN_TIME_MS, false);

            const discovered = await BleManager.getDiscoveredPeripherals();
            for (const peripheral of discovered) {
                // Check if the peripheral has the service UUID and advertising data
                if (peripheral.advertising && peripheral.advertising.serviceUUIDs && peripheral.advertising.serviceUUIDs.includes(SERVICES_UUID)) {
                    console.log(`Discovered a peripheral with the correct UUID: ${peripheral.id}`);
                    this.connectAndRead(peripheral.id);
                }
            }

        } catch (e) {
            console.error("Scanning failed:", e);
        } finally {
            this.isScanning = false;
        }
    }
    
   // Place this inside the BleMeshService class

// Place this inside the BleMeshService class

private async connectAndRead(peripheralId: string) {
    try {
        await BleManager.connect(peripheralId);
        console.log(`Connected to peripheral: ${peripheralId}`);

        // 1. Retrieve all services and characteristics
        const servicesAndCharacteristics = await BleManager.retrieveServices(peripheralId);

        // 2. Find our specific Service object
        // Use services.find() on the `services` array (s: any to avoid TS error)
        const service = servicesAndCharacteristics.services && servicesAndCharacteristics.services.find(
            (s: any) => s.uuid.toUpperCase() === SERVICES_UUID.toUpperCase()
        );

        if (!service) {
            console.log("Service not found");
            return;
        }

        // 3. Find the Characteristic object within the characteristics array
        const characteristic = servicesAndCharacteristics.characteristics && servicesAndCharacteristics.characteristics.find(
            (c: any) => c.service.toUpperCase() === SERVICES_UUID.toUpperCase() && c.uuid.toUpperCase() === VICTIM_CHARACTERISTIC_UUID.toUpperCase()
        );

        if (!characteristic) {
            console.log("Characteristic not found");
            return;
        }

        // 4. Read the Characteristic
        const readData = await BleManager.read(
            peripheralId,
            SERVICES_UUID,
            VICTIM_CHARACTERISTIC_UUID
        );

        // ... (rest of the function is correct)
        const victimDataString = Buffer.from(readData).toString('utf8');
        const victims: VictimData[] = JSON.parse(victimDataString);

        for (const victim of victims) {
            await victimStorageManager.storeVictim(victim);
        }
        console.log("Read and stored new victims:", victims);

    } catch (e) {
        console.error(`Connection/Read failed for ${peripheralId}:`, e);
    } finally {
        BleManager.disconnect(peripheralId);
    }
}
          
    
}

export const bleMeshService = new BleMeshService();