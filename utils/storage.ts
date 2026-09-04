import AsyncStorage from '@react-native-async-storage/async-storage';

// AsyncStorage Keys
export const MANIFEST_CIDS_KEY = 'manifest_cids';
export const SCANNED_CIDS_KEY = 'scanned_cids';
export const MANIFEST_ITEMS_KEY = 'manifest_items';
export const SCANNED_ITEMS_KEY = 'scanned_items';
export const ITEM_EXPIRY_DATES_KEY = 'item_expiry_dates';
export const SCAN_HISTORY_KEY = 'scan_history';

// Shared Interfaces
export interface BoxManifestRecord {
  cid: string;
  trf?: string;
}

export interface ItemManifestRecord {
  id: string;
  cid: string;
  trf: string;
  upc: string;
  sku: string;
  description: string;
  qty: number;
}

export interface HistorySessionRecord {
  id: string;
  date: string; // "YYYY-MM-DD"
  timestamp: string; // "YYYY-MM-DD HH:mm"
  type: 'box' | 'item';
  fileName: string;
  totalCount: number;
  scannedCount: number;
  manifestData: any; // BoxManifestRecord[] | string[] for box or ItemManifestRecord[] for item
  scannedData: any; // BoxManifestRecord[] | string[] for box or Record<string, number> for item
}

/** Helper function to add a new session into history */
export const saveSessionToHistory = async (
  session: Omit<HistorySessionRecord, 'id' | 'date' | 'timestamp'>
) => {
  try {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const timestampStr = `${dateStr} ${hours}:${mins}`;
    const id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newRecord: HistorySessionRecord = {
      id,
      date: dateStr,
      timestamp: timestampStr,
      ...session,
    };

    const stored = await AsyncStorage.getItem(SCAN_HISTORY_KEY);
    const historyList: HistorySessionRecord[] = stored ? JSON.parse(stored) : [];

    // Prepend new record to history
    const updated = [newRecord, ...historyList];
    await AsyncStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(updated));
    return newRecord;
  } catch (err) {
    console.error('Failed to save session to history:', err);
  }
};
