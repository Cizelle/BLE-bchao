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
var react_1 = require("react");
var react_native_1 = require("react-native");
var BleMeshService_1 = require("./src/BleMeshService");
var VictimStorageManager_1 = require("./src/VictimStorageManager");
// Constants
var MY_DEVICE_ID = 'VICTIM-A';
var INITIAL_LOCATION = { latitude: 28.7041, longitude: 77.1025 };
var App = function () {
    var _a = (0, react_1.useState)('none'), role = _a[0], setRole = _a[1];
    var _b = (0, react_1.useState)([]), discoveredVictims = _b[0], setDiscoveredVictims = _b[1];
    var handleRoleSelect = function (newRole) { return __awaiter(void 0, void 0, void 0, function () {
        var isPermissionGranted, myVictimData;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, BleMeshService_1.bleMeshService.requestPermissions()];
                case 1:
                    isPermissionGranted = _a.sent();
                    if (!isPermissionGranted) {
                        console.warn('Permissions denied. Cannot proceed.');
                        return [2 /*return*/];
                    }
                    // Stop any existing mesh activity
                    BleMeshService_1.bleMeshService.stopGossipMesh();
                    setRole(newRole);
                    myVictimData = {
                        deviceId: MY_DEVICE_ID,
                        role: 'victim',
                        gpsLocation: INITIAL_LOCATION,
                        timestamp: Date.now(),
                    };
                    if (!(newRole === 'victim')) return [3 /*break*/, 3];
                    return [4 /*yield*/, BleMeshService_1.bleMeshService.startGossipMesh(myVictimData)];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 3: 
                // Rescuers do not broadcast their own location
                return [4 /*yield*/, BleMeshService_1.bleMeshService.startGossipMesh(null)];
                case 4:
                    // Rescuers do not broadcast their own location
                    _a.sent();
                    _a.label = 5;
                case 5: return [2 /*return*/];
            }
        });
    }); };
    (0, react_1.useEffect)(function () {
        var refreshVictims = function () { return __awaiter(void 0, void 0, void 0, function () {
            var victims;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, VictimStorageManager_1.victimStorageManager.getAllVictims()];
                    case 1:
                        victims = _a.sent();
                        setDiscoveredVictims(victims);
                        return [2 /*return*/];
                }
            });
        }); };
        var stateSubscription = BleMeshService_1.bleMeshService.setupStateListener(function (state) {
            if (state.state !== 'PoweredOn') {
                console.warn("BLE state: ".concat(state.state, ". Please ensure Bluetooth is enabled."));
            }
        });
        refreshVictims();
        var intervalId = setInterval(refreshVictims, 5000);
        return function () {
            BleMeshService_1.bleMeshService.stopGossipMesh();
            stateSubscription.remove();
            clearInterval(intervalId);
        };
    }, []);
    var renderHome = function () { return (<react_native_1.View style={styles.homeContainer}>
      <react_native_1.Text style={styles.sectionTitle}>Choose Your Role</react_native_1.Text>
      <react_native_1.View style={styles.buttonContainer}>
        <react_native_1.Button title="I am a Victim" onPress={function () { return handleRoleSelect('victim'); }}/>
        <react_native_1.Button title="I am a Rescuer" onPress={function () { return handleRoleSelect('rescuer'); }}/>
      </react_native_1.View>
    </react_native_1.View>); };
    var renderRoleView = function () { return (<react_native_1.View style={styles.roleContainer}>
      <react_native_1.Text style={styles.sectionTitle}>{role === 'victim' ? 'Victim Mode' : 'Rescuer Mode'}</react_native_1.Text>
      <react_native_1.Text style={styles.statusText}>
        {role === 'victim' ? 'Status: Broadcasting your data...' : 'Status: Scanning for victims...'}
      </react_native_1.Text>

      <react_native_1.Text style={styles.subtitle}>Discovered Victims:</react_native_1.Text>
      {discoveredVictims.length === 0 ? (<react_native_1.Text style={styles.statusText}>No victims discovered yet.</react_native_1.Text>) : (discoveredVictims.map(function (v) { return (<react_native_1.View key={v.deviceId} style={styles.victimCard}>
            <react_native_1.Text style={styles.cardText}>ID: {v.deviceId}</react_native_1.Text>
            <react_native_1.Text style={styles.cardText}>Loc: Lat {v.gpsLocation.latitude.toFixed(2)}, Lon {v.gpsLocation.longitude.toFixed(2)}</react_native_1.Text>
            <react_native_1.Text style={styles.cardText}>Seen: {new Date(v.timestamp).toLocaleTimeString()}</react_native_1.Text>
          </react_native_1.View>); }))}
      
      <react_native_1.View style={styles.buttonContainer}>
          <react_native_1.Button title="Go Back" onPress={function () { return setRole('none'); }}/>
      </react_native_1.View>
    </react_native_1.View>); };
    return (<react_native_1.SafeAreaView style={styles.container}>
      <react_native_1.StatusBar barStyle="light-content"/>
      <react_native_1.View style={styles.content}>
        {role === 'none' ? renderHome() : renderRoleView()}
      </react_native_1.View>
    </react_native_1.SafeAreaView>);
};
// ... (Existing styles)
var styles = react_native_1.StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
    homeContainer: { width: '100%', alignItems: 'center' },
    sectionTitle: { fontSize: 24, fontWeight: '600', color: '#fff', marginBottom: 20 },
    buttonContainer: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 20 },
    roleContainer: { width: '100%', alignItems: 'center' },
    statusText: { fontSize: 16, color: '#ccc', marginBottom: 10 },
    subtitle: { fontSize: 20, fontWeight: '600', color: '#fff', marginTop: 30, marginBottom: 10 },
    victimCard: {
        backgroundColor: '#333',
        padding: 10,
        borderRadius: 5,
        marginVertical: 5,
        width: '100%',
    },
    cardText: { color: '#fff', fontSize: 14 },
});
exports.default = App;
