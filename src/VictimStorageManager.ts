// src/VictimStorageManager.ts (Updated for Gossip Protocol)

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface VictimData {
  deviceId: string;
  role: 'victim' | 'rescuer';
  gpsLocation: {
    latitude: number;
    longitude: number;
  };
  timestamp: number;
  // This is a new, optional field to store re-broadcasted data
  payload?: string;
}

const STORAGE_KEY = 'DISCOVERED_VICTIMS';

class VictimStorageManager {
  // 1. Retrieve all stored victims
  async getAllVictims(): Promise<VictimData[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const victimMap = JSON.parse(data) as { [key: string]: VictimData };
        return Object.values(victimMap);
      }
      return [];
    } catch (e) {
      console.error('Error fetching victims from storage:', e);
      return [];
    }
  }

  // 2. Store or update a single victim's data
  async storeVictim(newVictim: VictimData): Promise<void> {
    try {
      const currentData = await AsyncStorage.getItem(STORAGE_KEY);
      let victimMap: { [key: string]: VictimData } = {};

      if (currentData) {
        victimMap = JSON.parse(currentData);
      }

      const existingVictim = victimMap[newVictim.deviceId];

      if (!existingVictim || newVictim.timestamp > existingVictim.timestamp) {
        victimMap[newVictim.deviceId] = newVictim;
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(victimMap));
        console.log(`Stored/Updated victim: ${newVictim.deviceId}`);
      }
    } catch (e) {
      console.error('Error storing victim:', e);
    }
  }
}

export const victimStorageManager = new VictimStorageManager();