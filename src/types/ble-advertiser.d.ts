declare module "react-native-ble-advertiser" {
  export const ADVERTISE_MODE_LOW_LATENCY: number;
  export const ADVERTISE_MODE_BALANCED: number;
  export const ADVERTISE_MODE_LOW_POWER: number;
  export const ADVERTISE_TX_POWER_ULTRA_LOW: number;
  export const ADVERTISE_TX_POWER_LOW: number;
  export const ADVERTISE_TX_POWER_MEDIUM: number;
  export const ADVERTISE_TX_POWER_HIGH: number;

  export function setCompanyId(id: number): void;

  export function broadcast(
    deviceName: string,
    serviceUUIDs: string[],
    options?: {
      includeDeviceName?: boolean;
      manufacturerId?: number;
      manufacturerData?: number[];
      advertiseMode?: number;
      txPowerLevel?: number;
    }
  ): Promise<void>;

  export function stopBroadcast(): Promise<void>;
}
