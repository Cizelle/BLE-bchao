"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bleMeshService = void 0;
var react_native_1 = require("react-native");
var react_native_ble_manager_1 = require("react-native-ble-manager");
var buffer_1 = require("buffer");
var VictimStorageManager_1 = require("./VictimStorageManager");
var UUIDs_1 = require("./UUIDs");
var BLE_SCAN_TIME_MS = 10000; // 10 seconds of scanning
var BLE_ADVERTISE_TIME_MS = 5000; // 5 seconds of advertising
var BleMeshService = /** @class */ (function () {
    function BleMeshService() {
        this.isScanning = false;
        this.isAdvertising = false;
        react_native_ble_manager_1.default.start({ showAlert: false });
    }
    /* --------------------------------------------------
     * Shared Logic (Permissions & State)
     * -------------------------------------------------- */
    BleMeshService.prototype.requestPermissions = function () {
        return __awaiter(this, void 0, void 0, function () {
            var isGranted, allGranted;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(react_native_1.Platform.OS === 'android')) return [3 /*break*/, 2];
                        return [4 /*yield*/, react_native_1.PermissionsAndroid.requestMultiple([
                                react_native_1.PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                                react_native_1.PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                                react_native_1.PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                                react_native_1.PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
                            ])];
                    case 1:
                        isGranted = _a.sent();
                        allGranted = isGranted['android.permission.ACCESS_FINE_LOCATION'] === react_native_1.PermissionsAndroid.RESULTS.GRANTED &&
                            isGranted['android.permission.BLUETOOTH_SCAN'] === react_native_1.PermissionsAndroid.RESULTS.GRANTED &&
                            isGranted['android.permission.BLUETOOTH_CONNECT'] === react_native_1.PermissionsAndroid.RESULTS.GRANTED &&
                            isGranted['android.permission.BLUETOOTH_ADVERTISE'] === react_native_1.PermissionsAndroid.RESULTS.GRANTED;
                        if (!allGranted) {
                            console.warn('Bluetooth permissions denied.');
                        }
                        return [2 /*return*/, allGranted];
                    case 2: return [2 /*return*/, true];
                }
            });
        });
    };
    BleMeshService.prototype.setupStateListener = function (onStateChange) {
        return react_native_1.DeviceEventEmitter.addListener('BleManagerDidUpdateState', onStateChange);
    };
    /* --------------------------------------------------
     * Gossip Protocol (The Mesh Logic)
     * -------------------------------------------------- */
    BleMeshService.prototype.encodeVictimData = function (data) {
        var jsonString = JSON.stringify(data);
        return buffer_1.Buffer.from(jsonString).toString('base64');
    };
    BleMeshService.prototype.decodeVictimData = function (base64String) {
        try {
            var jsonString = buffer_1.Buffer.from(base64String, 'base64').toString('utf8');
            var data = JSON.parse(jsonString);
            return data;
        }
        catch (e) {
            console.error('Failed to decode/parse victim data:', e);
            return null;
        }
    };
    BleMeshService.prototype.startGossipMesh = function (myVictimData) {
        return __awaiter(this, void 0, void 0, function () {
            var gossipLoop;
            var _this = this;
            return __generator(this, function (_a) {
                if (this.isScanning || this.isAdvertising) {
                    this.stopGossipMesh();
                }
                gossipLoop = function () { return __awaiter(_this, void 0, void 0, function () {
                    var victimsToAdvertise;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: 
                            // Step 1: Scan for nearby victims
                            return [4 /*yield*/, this.startScanAndRead()];
                            case 1:
                                // Step 1: Scan for nearby victims
                                _a.sent();
                                return [4 /*yield*/, this.getLatestVictimsForAdvertising(myVictimData)];
                            case 2:
                                victimsToAdvertise = _a.sent();
                                // Step 3: Advertise the collected data
                                return [4 /*yield*/, this.startAdvertising(victimsToAdvertise)];
                            case 3:
                                // Step 3: Advertise the collected data
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); };
                // Start the continuous loop
                setInterval(gossipLoop, BLE_SCAN_TIME_MS + BLE_ADVERTISE_TIME_MS);
                return [2 /*return*/];
            });
        });
    };
    BleMeshService.prototype.stopGossipMesh = function () {
        if (this.isScanning)
            react_native_ble_manager_1.default.stopScan();
        if (this.isAdvertising)
            react_native_ble_manager_1.default.stopPeripheral();
        // TODO: clear the interval
    };
    BleMeshService.prototype.getLatestVictimsForAdvertising = function (myVictimData) {
        return __awaiter(this, void 0, void 0, function () {
            var storedVictims, latestVictims;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, VictimStorageManager_1.victimStorageManager.getAllVictims()];
                    case 1:
                        storedVictims = _a.sent();
                        latestVictims = storedVictims.sort(function (a, b) { return b.timestamp - a.timestamp; }).slice(0, 5);
                        if (myVictimData) {
                            // Also include my own data in the advertising packet
                            latestVictims.push(myVictimData);
                        }
                        return [2 /*return*/, latestVictims];
                }
            });
        });
    };
    BleMeshService.prototype.startAdvertising = function (victims) {
        return __awaiter(this, void 0, void 0, function () {
            var payload, data, advertisementOptions, e_1;
            var _a;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        this.isAdvertising = true;
                        payload = JSON.stringify(victims);
                        data = this.encodeVictimData({
                            deviceId: "MESH_NODE",
                            role: "victim",
                            gpsLocation: { latitude: 0, longitude: 0 },
                            timestamp: Date.now(),
                            // This payload will now contain the other victims
                            payload: payload
                        });
                        advertisementOptions = {
                            serviceUUID: UUIDs_1.SERVICES_UUID,
                            serviceData: (_a = {},
                                _a[UUIDs_1.SERVICES_UUID] = data,
                                _a),
                        };
                        return [4 /*yield*/, react_native_ble_manager_1.default.startPeripheral(advertisementOptions)];
                    case 1:
                        _b.sent();
                        console.log("Advertising started with data:", payload);
                        setTimeout(function () {
                            react_native_ble_manager_1.default.stopPeripheral();
                            _this.isAdvertising = false;
                            console.log("Advertising stopped.");
                        }, BLE_ADVERTISE_TIME_MS);
                        return [3 /*break*/, 3];
                    case 2:
                        e_1 = _b.sent();
                        console.error("Advertising failed:", e_1);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    BleMeshService.prototype.startScanAndRead = function () {
        return __awaiter(this, void 0, void 0, function () {
            var discovered, _i, discovered_1, peripheral, e_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, 4, 5]);
                        this.isScanning = true;
                        console.log("Starting BLE scan...");
                        return [4 /*yield*/, react_native_ble_manager_1.default.scan([UUIDs_1.SERVICES_UUID], BLE_SCAN_TIME_MS, false)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, react_native_ble_manager_1.default.getDiscoveredPeripherals()];
                    case 2:
                        discovered = _a.sent();
                        for (_i = 0, discovered_1 = discovered; _i < discovered_1.length; _i++) {
                            peripheral = discovered_1[_i];
                            // Check if the peripheral has the service UUID and advertising data
                            if (peripheral.advertising && peripheral.advertising.serviceUUIDs && peripheral.advertising.serviceUUIDs.includes(UUIDs_1.SERVICES_UUID)) {
                                console.log("Discovered a peripheral with the correct UUID: ".concat(peripheral.id));
                                this.connectAndRead(peripheral.id);
                            }
                        }
                        return [3 /*break*/, 5];
                    case 3:
                        e_2 = _a.sent();
                        console.error("Scanning failed:", e_2);
                        return [3 /*break*/, 5];
                    case 4:
                        this.isScanning = false;
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    BleMeshService.prototype.connectAndRead = function (peripheralId) {
        return __awaiter(this, void 0, void 0, function () {
            var services, service, characteristic, readData, victimDataString, victims, _i, victims_1, victim, e_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 8, 9, 10]);
                        return [4 /*yield*/, react_native_ble_manager_1.default.connect(peripheralId)];
                    case 1:
                        _a.sent();
                        console.log("Connected to peripheral: ".concat(peripheralId));
                        return [4 /*yield*/, react_native_ble_manager_1.default.retrieveServices(peripheralId)];
                    case 2:
                        services = _a.sent();
                        service = services.services.find(function (s) { return s.uuid === UUIDs_1.SERVICES_UUID; });
                        if (!service) {
                            console.log("Service not found");
                            return [2 /*return*/];
                        }
                        characteristic = service.characteristics.find(function (c) { return c.uuid === UUIDs_1.VICTIM_CHARACTERISTIC_UUID; });
                        if (!characteristic) {
                            console.log("Characteristic not found");
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, react_native_ble_manager_1.default.read(peripheralId, UUIDs_1.SERVICES_UUID, UUIDs_1.VICTIM_CHARACTERISTIC_UUID)];
                    case 3:
                        readData = _a.sent();
                        victimDataString = buffer_1.Buffer.from(readData).toString('utf8');
                        victims = JSON.parse(victimDataString);
                        _i = 0, victims_1 = victims;
                        _a.label = 4;
                    case 4:
                        if (!(_i < victims_1.length)) return [3 /*break*/, 7];
                        victim = victims_1[_i];
                        return [4 /*yield*/, VictimStorageManager_1.victimStorageManager.storeVictim(victim)];
                    case 5:
                        _a.sent();
                        _a.label = 6;
                    case 6:
                        _i++;
                        return [3 /*break*/, 4];
                    case 7:
                        console.log("Read and stored new victims:", victims);
                        return [3 /*break*/, 10];
                    case 8:
                        e_3 = _a.sent();
                        console.error("Connection/Read failed for ".concat(peripheralId, ":"), e_3);
                        return [3 /*break*/, 10];
                    case 9:
                        react_native_ble_manager_1.default.disconnect(peripheralId);
                        return [7 /*endfinally*/];
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    return BleMeshService;
}());
exports.bleMeshService = new BleMeshService();
