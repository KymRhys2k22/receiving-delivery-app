import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://dxncgchzwmfbbgqpnurq.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_HU1x_bM4RBTrZpdplO061A_KjFGrSmD';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? 'dqtldfxeh';
export const CLOUDINARY_UPLOAD_PRESET =
  process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? 'dlr_unsigned';
export const CLOUDINARY_UPLOAD_ENDPOINT = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

export const OPEN_SHEET_URL =
  'https://opensheet.elk.sh/1PSUBDTCxL6joS0kRJ0dxjCpWUSebLmt-njH16yDHfbQ/1';

export const DLR_RECORDS_KEY = 'dlr_records';

export interface RawSheetItem {
  SKU?: string;
  Description?: string;
  UPC?: string;
  Department?: string;
  'Sub Dep'?: string;
  Cost?: string;
  Price?: string;
}

export interface ProductItem {
  sku: string;
  description: string;
  upc: string;
  departmentCode: string;
  departmentName: string;
  subDepartmentCode: string;
  subDepartmentName: string;
  cost: string;
  price: string;
}

export interface SupabaseDLRRecord {
  SKU: string;
  Description: string;
  UPC: string;
  Cost: string;
  Price: string;
  Reason: string;
  SecondReason?: string | null;
  Qty: number;
  Department?: string;
  SubDep?: string;
  'Store Code': string;
  image: string[];
}

export const DEFECT_REASONS = [
  'Broken',
  'Contaminated',
  'Defective',
  'Deformed',
  'Dented',
  'Discoloration',
  'Empty/Half Content',
  'Expired',
  'Hardening',
  'Tester',
  'Problem on Packaging',
  'Ripped/Torn',
  'With Crack',
  'With Dirt or Stain',
  'With Leak/With Hole',
  'With Missing Pair / Part or Accessory',
  'With Rust',
  'With Scratches',
] as const;

export function getDepartmentName(deptCode: string | number): string {
  try {
    const value = Number(deptCode);
    if (value === 250) return 'Houseware';
    if (value === 100) return 'Fashion';
    if (value === 200) return 'Food & DIY';
    if (value === 300) return 'Cleaning';
    if (value === 150) return 'Outdoor & GMS';
    return 'Unknown';
  } catch {
    return '';
  }
}

export function getSubDepartmentName(subDeptCode: string | number): string {
  try {
    const value = Number(subDeptCode);
    const categories: Record<number, string> = {
      320: 'Laundry',
      270: 'Kitchen',
      280: 'Tableware',
      110: 'Apparel',
      120: 'Accessories',
      160: 'General Merchandise',
      170: 'Outdoor',
      210: 'Stationery',
      220: 'DIY',
      260: 'Storage & Living',
      310: 'DIY',
      360: 'Storage',
      350: 'Storage',
      410: 'Kitchen',
      420: 'Tableware',
      400: 'Kitchen & Dining',
      450: 'Interior',
      550: 'Outdoor',
    };
    return categories[value] ?? 'Unknown';
  } catch {
    return '';
  }
}

function stripLeadingZeros(value: string): string {
  return value.replace(/^0+/, '');
}

function codesMatch(a: string, b: string): boolean {
  const x = a.trim().toUpperCase();
  const y = b.trim().toUpperCase();
  if (!x || !y) return false;
  if (x === y) return true;
  return stripLeadingZeros(x) === stripLeadingZeros(y);
}

export function normalizeSheetItem(raw: RawSheetItem): ProductItem {
  const departmentCode = (raw.Department ?? '').trim();
  const subDepartmentCode = (raw['Sub Dep'] ?? '').trim();
  return {
    sku: (raw.SKU ?? '').trim(),
    description: (raw.Description ?? '').trim(),
    upc: (raw.UPC ?? '').trim(),
    departmentCode,
    departmentName: getDepartmentName(departmentCode),
    subDepartmentCode,
    subDepartmentName: getSubDepartmentName(subDepartmentCode),
    cost: (raw.Cost ?? '').trim(),
    price: (raw.Price ?? '').trim(),
  };
}

let catalogCache: ProductItem[] | null = null;

export async function fetchCatalog(forceRefresh = false): Promise<ProductItem[]> {
  if (!forceRefresh && catalogCache) return catalogCache;
  const res = await fetch(OPEN_SHEET_URL);
  if (!res.ok) {
    throw new Error(`Failed to load inventory catalog (${res.status})`);
  }
  const json = (await res.json()) as RawSheetItem[];
  if (!Array.isArray(json)) {
    throw new Error('Inventory catalog returned invalid data');
  }
  catalogCache = json.map(normalizeSheetItem);
  return catalogCache;
}

export async function lookupProduct(
  scannedCode: string,
  catalog?: ProductItem[]
): Promise<ProductItem> {
  const list = catalog ?? (await fetchCatalog());
  const code = scannedCode.trim();
  const match = list.find((item) => codesMatch(item.sku, code) || codesMatch(item.upc, code));
  if (!match) {
    throw new Error(`Scanned code "${code}" was not found in the inventory catalog`);
  }
  return match;
}

export type DLRStatus = 'DRAFT' | 'PENDING_SYNC' | 'SYNCED';
export type DLRPhotoKey = 'quantity' | 'damage' | 'barcode';

export interface DLRLocalRecord {
  id: string;
  status: DLRStatus;
  createdAt: string;
  updatedAt: string;
  storeCode?: string;
  storeName?: string;
  scannedCode?: string;
  product: ProductItem | null;
  reason: string | null;
  secondReason: string | null;
  qty?: number;
  photos: Partial<Record<DLRPhotoKey, string>>;
  uploadedUrls: Partial<Record<DLRPhotoKey, string>>;
  lastError?: string | null;
}

export const PHOTO_STEPS: { key: DLRPhotoKey; title: string; hint: string }[] = [
  { key: 'quantity', title: 'Quantity Photo', hint: 'Overview of damaged stock' },
  { key: 'damage', title: 'Damage Photo', hint: 'Close-up detail of defect/damage' },
  { key: 'barcode', title: 'Barcode Photo', hint: 'Readable product barcode' },
];

export function createDlrId(): string {
  return `dlr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function loadDlrRecords(): Promise<DLRLocalRecord[]> {
  try {
    const stored = await AsyncStorage.getItem(DLR_RECORDS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as DLRLocalRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveDlrRecords(records: DLRLocalRecord[]): Promise<void> {
  try {
    await AsyncStorage.setItem(DLR_RECORDS_KEY, JSON.stringify(records));
  } catch {}
}

export async function upsertDlrRecord(record: DLRLocalRecord): Promise<void> {
  const records = await loadDlrRecords();
  const index = records.findIndex((r) => r.id === record.id);
  const stamped: DLRLocalRecord = { ...record, updatedAt: new Date().toISOString() };
  if (index >= 0) {
    records[index] = stamped;
  } else {
    records.unshift(stamped);
  }
  await saveDlrRecords(records);
}

export async function getPendingSyncCount(): Promise<number> {
  const records = await loadDlrRecords();
  return records.filter((r) => r.status === 'PENDING_SYNC').length;
}

export const MAX_UPLOAD_BYTES = 200 * 1024;

const COMPRESSION_PASSES: { width: number; quality: number }[] = [
  { width: 1200, quality: 0.7 },
  { width: 1080, quality: 0.55 },
  { width: 960, quality: 0.45 },
  { width: 840, quality: 0.35 },
  { width: 720, quality: 0.25 },
];

async function getFileSizeBytes(fileUri: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    if (info.exists && typeof info.size === 'number') {
      return info.size;
    }
  } catch {}
  return 0;
}

export async function compressImage(uri: string): Promise<string> {
  try {
    const mod = ImageManipulator as unknown as {
      manipulateAsync?: (
        uri: string,
        actions: object[],
        options: object
      ) => Promise<{ uri: string }>;
      SaveFormat?: { JPEG: 'jpeg' };
      ImageManipulator?: {
        manipulate: (uri: string) => {
          resize: (resize: { width: number }) => void;
          renderAsync: () => Promise<{
            saveAsync: (options: object) => Promise<{ uri: string }>;
          }>;
        };
      };
    };

    const useLegacy = typeof mod.manipulateAsync === 'function' && Boolean(mod.SaveFormat);

    let bestUri = uri;

    for (const pass of COMPRESSION_PASSES) {
      let outputUri = '';
      if (useLegacy) {
        const manipResult = await mod.manipulateAsync!(uri, [{ resize: { width: pass.width } }], {
          compress: pass.quality,
          format: mod.SaveFormat!.JPEG,
        });
        outputUri = manipResult.uri;
      } else if (mod.ImageManipulator) {
        const context = mod.ImageManipulator.manipulate(uri);
        context.resize({ width: pass.width });
        const rendered = await context.renderAsync();
        const saved = await rendered.saveAsync({
          compress: pass.quality,
          format: 'jpeg',
        });
        outputUri = saved.uri;
      } else {
        break;
      }

      const size = await getFileSizeBytes(outputUri);
      bestUri = outputUri;

      if (size > 0 && size <= MAX_UPLOAD_BYTES) {
        return outputUri;
      }
      if (size === 0) {
        return outputUri;
      }
    }

    return bestUri;
  } catch {
    return uri;
  }
}

function toSafeFileNamePart(value: string): string {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  return cleaned.length > 0 ? cleaned.slice(0, 48) : 'item';
}

export function buildDlrImageName(
  record: Pick<DLRLocalRecord, 'scannedCode' | 'product' | 'id'>,
  photoKey: DLRPhotoKey
): string {
  const code =
    toSafeFileNamePart(record.scannedCode ?? '') || toSafeFileNamePart(record.product?.sku ?? '');
  return `${code}_${toSafeFileNamePart(record.id)}_${photoKey}`;
}

export async function uploadToCloudinary(imageUri: string, imageName: string): Promise<string> {
  try {
    const base64Data = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const formData = new FormData();
    formData.append('file', `data:image/jpeg;base64,${base64Data}`);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', 'dlr_records');
    formData.append('public_id', toSafeFileNamePart(imageName));

    const res = await fetch(CLOUDINARY_UPLOAD_ENDPOINT, {
      method: 'POST',
      body: formData,
    });

    let result: { secure_url?: string; error?: { message?: string } } = {};
    try {
      result = await res.json();
    } catch {}

    if (!res.ok || !result.secure_url) {
      throw new Error(result.error?.message || `Cloudinary upload failed (${res.status})`);
    }
    return result.secure_url;
  } catch (err) {
    if (err instanceof Error && err.message.includes('Cloudinary')) throw err;
    throw new Error(
      `Cloudinary network error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export function buildSupabasePayload(record: DLRLocalRecord): SupabaseDLRRecord | null {
  const product = record.product;
  const quantityUrl = record.uploadedUrls.quantity;
  const damageUrl = record.uploadedUrls.damage;
  const barcodeUrl = record.uploadedUrls.barcode;
  if (!product || !record.reason || !quantityUrl || !damageUrl || !barcodeUrl) return null;

  const department =
    product.departmentName && product.departmentName !== 'Unknown'
      ? `${product.departmentCode ? product.departmentCode + ' · ' : ''}${product.departmentName}`
      : product.departmentCode || product.departmentName || '';

  const subDep =
    product.subDepartmentName && product.subDepartmentName !== 'Unknown'
      ? `${product.subDepartmentCode ? product.subDepartmentCode + ' · ' : ''}${product.subDepartmentName}`
      : product.subDepartmentCode || product.subDepartmentName || '';

  return {
    SKU: product.sku,
    Description: product.description,
    UPC: product.upc,
    Cost: product.cost,
    Price: product.price,
    Reason: record.reason,
    SecondReason: record.secondReason || null,
    Qty: typeof record.qty === 'number' && record.qty > 0 ? record.qty : 1,
    Department: department,
    SubDep: subDep,
    'Store Code': record.storeName || record.storeCode || '',
    image: [quantityUrl, damageUrl, barcodeUrl],
  };
}

export interface DlrSyncOutcome {
  syncedIds: string[];
  failedCount: number;
}

export async function processDlrSyncQueue(
  onProgress?: (remaining: number) => void
): Promise<DlrSyncOutcome> {
  const outcome: DlrSyncOutcome = { syncedIds: [], failedCount: 0 };
  const records = await loadDlrRecords();
  const pending = records.filter((r) => r.status === 'PENDING_SYNC');

  for (const record of pending) {
    try {
      const urls: Partial<Record<DLRPhotoKey, string>> = { ...record.uploadedUrls };
      for (const step of PHOTO_STEPS) {
        if (urls[step.key]) continue;
        const localUri = record.photos[step.key];
        if (!localUri) throw new Error(`Missing ${step.title.toLowerCase()} capture`);
        const compressedUri = await compressImage(localUri);
        urls[step.key] = await uploadToCloudinary(
          compressedUri,
          buildDlrImageName(record, step.key)
        );
        await upsertDlrRecord({
          ...record,
          uploadedUrls: { ...urls },
          status: 'PENDING_SYNC',
          updatedAt: new Date().toISOString(),
        });
      }

      const full: DLRLocalRecord = {
        ...record,
        uploadedUrls: urls,
        lastError: null,
        updatedAt: new Date().toISOString(),
      };
      const payload = buildSupabasePayload(full);
      if (!payload) throw new Error('Incomplete record cannot be submitted');

      const { error } = await supabase.from('dlr_records').insert([payload]);
      if (error) throw new Error(error.message);

      outcome.syncedIds.push(record.id);
    } catch (err) {
      outcome.failedCount += 1;
      await upsertDlrRecord({
        ...record,
        status: 'PENDING_SYNC',
        lastError: err instanceof Error ? err.message : String(err),
      });
    }

    if (onProgress) onProgress(await getPendingSyncCount());
  }

  if (outcome.syncedIds.length > 0) {
    const remaining = (await loadDlrRecords()).filter((r) => !outcome.syncedIds.includes(r.id));
    await saveDlrRecords(remaining);
  }

  return outcome;
}
