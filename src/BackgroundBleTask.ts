import { PermissionsAndroid } from 'react-native';
import { bleMeshService, MY_SERVICE_UUID } from './BleMeshService';
import { victimStorageManager, VictimData } from './VictimStorageManager';
import Geolocation from 'react-native-geolocation-service';
import BackgroundService from 'react-native-background-actions';

const MY_DEVICE_ID = 'NODE-' + Math.floor(Math.random() * 1000);

const sleep = (time: number) => new Promise(resolve => setTimeout(resolve, time));

// This is the function that will run as a background task
export const backgroundBleTask = async (taskDataArguments: any) => {
  const { delay } = taskDataArguments;

  // Ensure BLE and Location permissions are granted
  const blePermissionGranted = await bleMeshService.requestPermissions();
  const locationPermissionGranted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  );
  if (!blePermissionGranted || locationPermissionGranted !== PermissionsAndroid.RESULTS.GRANTED) {
      console.warn('Permissions not granted for background task. Stopping.');
      return;
  }

  // Start location tracking for the background task
  let currentLocation = { latitude: 0, longitude: 0 };
  Geolocation.watchPosition(
      (position: any) => {
          currentLocation = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
          };
      },
      (error) => console.log(error),
      { enableHighAccuracy: true, distanceFilter: 10 }
  );

  // Main background loop
  await new Promise(async (resolve) => {
    for (let i = 0; BackgroundService.isRunning(); i++) {
      console.log('Background task running...', i);

      // Get the latest victim data from storage
      const storedVictims = await victimStorageManager.getAllVictims();
      const victimDataToAdvertise: VictimData = {
          deviceId: MY_DEVICE_ID,
          role: "victim", // The app is designed to be a victim in the background
          gpsLocation: currentLocation,
          timestamp: Date.now(),
      };

      // Start BLE scanning and advertising for a short period
      await bleMeshService.startGossipMesh(victimDataToAdvertise);

      // Wait for a few seconds before the next cycle
      await sleep(delay); 
    }
  });
};