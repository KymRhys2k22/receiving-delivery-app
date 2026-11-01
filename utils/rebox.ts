import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Sharing from 'expo-sharing';
import {
  supabase,
  compressImage,
  fetchCatalog,
  findProductInCatalog,
  codesMatch,
  getStoreIdentifiers,
  matchRecordStore,
  CLOUDINARY_CLOUD_NAME,
  OPEN_SHEET_URL,
  type ProductItem,
  type StoreFilter,
} from './dlr';
import { MANIFEST_ITEMS_KEY, UPLOADED_ITEM_IMAGES_KEY, type ItemManifestRecord } from './storage';

export { OPEN_SHEET_URL, type ProductItem, type StoreFilter };

export const ITEM_IMAGE_CLOUDINARY_UPLOAD_PRESET =
  process.env.EXPO_CLOUDINARY_UPLOAD_PRESET ||
  process.env.EXPO_PUBLIC_CLOUDINARY_ITEM_UPLOAD_PRESET ||
  'daisoimage';

export const ITEM_IMAGE_CLOUDINARY_ENDPOINT = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

export async function fetchOpenSheetCatalog(forceRefresh = false): Promise<ProductItem[]> {
  return await fetchCatalog(forceRefresh);
}

export async function findProductInOpenSheet(code: string): Promise<ProductItem | null> {
  return await findProductInCatalog(code);
}

export const REBOX_CURRENT_BOX_KEY = 'rebox_active_box_number';
export const REBOX_REGISTERED_BOXES_KEY = 'rebox_registered_boxes';

/**
 * Hold-to-delete gesture timing for Rebox item cards (3 seconds total hold).
 * React Native's TouchableOpacity/Pressable triggers `onLongPress` after `delayPressIn + delayLongPress`.
 */
export const REBOX_HOLD_DELETE_MS = 3000;
export const REBOX_HOLD_PRESS_IN_DELAY_MS = 150;
export const REBOX_HOLD_LONG_PRESS_DELAY_MS = REBOX_HOLD_DELETE_MS - REBOX_HOLD_PRESS_IN_DELAY_MS;

export interface RegisteredReboxBox {
  boxNumber: string;
  storeCode?: string;
  createdAt: string;
}

export interface ReboxItem {
  id: string;
  storeCode: string;
  boxNumber: string;
  sku: string;
  upc: string;
  description: string;
  qty: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReboxBoxSummary {
  boxNumber: string;
  itemCount: number;
  totalUnits: number;
  lastUpdated?: string;
  previewItems?: ReboxItem[];
  isEmpty?: boolean;
}

/**
 * Normalize a physical storage box identifier (e.g. "box 1" -> "BOX-01", "b-12" -> "B-12")
 */
export function normalizeBoxNumber(value?: string | null): string {
  const cleaned = (value || '')
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .toUpperCase();
  if (!cleaned) return '';
  // Convert "BOX 1" or "BOX1" or "BOX-1" to "BOX-01" for consistent numbering
  const boxNumMatch = cleaned.match(/^BOX[\s_-]*(\d+)$/);
  if (boxNumMatch) {
    const num = parseInt(boxNumMatch[1], 10);
    return `BOX-${String(num).padStart(2, '0')}`;
  }
  // If user typed only digits (e.g. "1" or "05"), format as "BOX-01" / "BOX-05"
  if (/^\d+$/.test(cleaned)) {
    const num = parseInt(cleaned, 10);
    return `BOX-${String(num).padStart(2, '0')}`;
  }
  return cleaned;
}

/**
 * Suggest the next sequential box number (e.g. BOX-01 -> BOX-02)
 */
export function suggestNextBoxNumber(existingBoxes: (string | ReboxBoxSummary)[]): string {
  let maxBoxNum = 0;
  for (const entry of existingBoxes) {
    const label = typeof entry === 'string' ? entry : entry.boxNumber;
    const match = (label || '').trim().toUpperCase().match(/^BOX[\s_-]*(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (!isNaN(n) && n > maxBoxNum) {
        maxBoxNum = n;
      }
    }
  }
  return `BOX-${String(maxBoxNum + 1).padStart(2, '0')}`;
}

export function resolveStoreCode(storeCode?: string | null, storeName?: string | null): string {
  const { code, name } = getStoreIdentifiers(storeCode ?? undefined, storeName ?? undefined);
  return (code || name || storeCode || storeName || '').trim();
}

function getActiveBoxStorageKey(storeFilter?: StoreFilter): string {
  const resolved = resolveStoreCode(storeFilter?.storeCode, storeFilter?.storeName);
  return resolved ? `${REBOX_CURRENT_BOX_KEY}_${resolved}` : REBOX_CURRENT_BOX_KEY;
}

export async function getRegisteredBoxes(storeFilter?: StoreFilter): Promise<RegisteredReboxBox[]> {
  try {
    const raw = await AsyncStorage.getItem(REBOX_REGISTERED_BOXES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const hasFilter = Boolean(storeFilter && (storeFilter.storeCode || storeFilter.storeName));
    if (!hasFilter) return parsed;
    return parsed.filter((b: RegisteredReboxBox) =>
      b.storeCode
        ? matchRecordStore(b.storeCode, storeFilter?.storeCode, storeFilter?.storeName)
        : true
    );
  } catch {
    return [];
  }
}

export async function registerReboxBox(
  boxNumber: string,
  storeFilter?: StoreFilter
): Promise<string> {
  const normalized = normalizeBoxNumber(boxNumber);
  if (!normalized) {
    throw new Error('Please enter a valid Box Number.');
  }
  const resolvedStore = resolveStoreCode(storeFilter?.storeCode, storeFilter?.storeName);
  try {
    const raw = await AsyncStorage.getItem(REBOX_REGISTERED_BOXES_KEY);
    const existing: RegisteredReboxBox[] = raw ? JSON.parse(raw) : [];
    const safeExisting = Array.isArray(existing) ? existing : [];
    const alreadyExists = safeExisting.some(
      (b) =>
        b.boxNumber.toUpperCase() === normalized.toUpperCase() &&
        (!resolvedStore ||
          !b.storeCode ||
          matchRecordStore(b.storeCode, storeFilter?.storeCode, storeFilter?.storeName))
    );
    if (!alreadyExists) {
      const next: RegisteredReboxBox[] = [
        {
          boxNumber: normalized,
          storeCode: resolvedStore || undefined,
          createdAt: new Date().toISOString(),
        },
        ...safeExisting,
      ];
      await AsyncStorage.setItem(REBOX_REGISTERED_BOXES_KEY, JSON.stringify(next));
    }
  } catch {}
  return normalized;
}

export async function unregisterReboxBox(
  boxNumber: string,
  storeFilter?: StoreFilter
): Promise<void> {
  const normalized = normalizeBoxNumber(boxNumber);
  if (!normalized) return;
  const hasFilter = Boolean(storeFilter && (storeFilter.storeCode || storeFilter.storeName));
  try {
    const raw = await AsyncStorage.getItem(REBOX_REGISTERED_BOXES_KEY);
    const existing: RegisteredReboxBox[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(existing)) return;
    const filtered = existing.filter((b) => {
      const sameBox = b.boxNumber.toUpperCase() === normalized.toUpperCase();
      if (!sameBox) return true;
      if (!hasFilter || !b.storeCode) return false;
      return !matchRecordStore(b.storeCode, storeFilter?.storeCode, storeFilter?.storeName);
    });
    await AsyncStorage.setItem(REBOX_REGISTERED_BOXES_KEY, JSON.stringify(filtered));
  } catch {}
}

export async function getActiveReboxBox(storeFilter?: StoreFilter): Promise<string | null> {
  try {
    const scopedKey = getActiveBoxStorageKey(storeFilter);
    const saved =
      (await AsyncStorage.getItem(scopedKey)) ||
      (scopedKey !== REBOX_CURRENT_BOX_KEY
        ? await AsyncStorage.getItem(REBOX_CURRENT_BOX_KEY)
        : null);
    if (saved && saved.trim()) {
      return normalizeBoxNumber(saved);
    }
  } catch {}
  return null;
}

export async function setActiveReboxBox(
  boxNumber: string,
  storeFilter?: StoreFilter
): Promise<string> {
  const normalized = await registerReboxBox(boxNumber, storeFilter);
  try {
    await AsyncStorage.setItem(getActiveBoxStorageKey(storeFilter), normalized);
  } catch {}
  return normalized;
}

export function mapReboxRow(row: any): ReboxItem {
  return {
    id: row.id,
    storeCode: (row.store_code || row.storeCode || '').trim(),
    boxNumber: (row.box_number || row.boxNumber || '').trim(),
    sku: (row.sku || '').trim(),
    upc: (row.upc || '').trim(),
    description: (row.description || '').trim(),
    qty: Math.max(0, Number(row.qty) || 0),
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || row.updatedAt || new Date().toISOString(),
  };
}

export function isUploadedPhoto(url?: string | null): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.includes('jpbulk.daisonet.com')) return false;
  return (
    trimmed.startsWith('https://res.cloudinary.com/') ||
    trimmed.startsWith('http://res.cloudinary.com/') ||
    trimmed.startsWith('file://') ||
    trimmed.startsWith('data:')
  );
}

function normalizeCode(value?: string | null): string {
  const cleaned = (value || '')
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .toUpperCase();
  if (!cleaned) return '';
  return cleaned.replace(/^0+/, '') || '0';
}

/**
 * Fetch rebox items from Supabase, optionally filtered by storeCode, boxNumber, or searchQuery
 */
export async function fetchReboxItems(options?: {
  boxNumber?: string | null;
  searchQuery?: string | null;
  storeCode?: string | null;
  storeName?: string | null;
  limit?: number;
}): Promise<ReboxItem[]> {
  try {
    let query = supabase.from('rebox_items').select('*').order('updated_at', { ascending: false });

    const hasStoreFilter = Boolean(options && (options.storeCode || options.storeName));
    if (hasStoreFilter) {
      const { candidates } = getStoreIdentifiers(
        options?.storeCode ?? undefined,
        options?.storeName ?? undefined
      );
      if (candidates.length > 0) {
        query = query.in('store_code', candidates);
      }
    }

    if (options?.boxNumber) {
      query = query.eq('box_number', options.boxNumber.trim());
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    let items = (data || []).map(mapReboxRow);

    if (hasStoreFilter) {
      items = items.filter((item) =>
        matchRecordStore(
          item.storeCode,
          options?.storeCode ?? undefined,
          options?.storeName ?? undefined
        )
      );
    }

    if (options?.searchQuery && options.searchQuery.trim()) {
      const q = options.searchQuery.trim().toLowerCase();
      const qStripped = normalizeCode(q);
      items = items.filter((item) => {
        const s = (item.sku || '').toLowerCase();
        const u = (item.upc || '').toLowerCase();
        const d = (item.description || '').toLowerCase();
        const b = (item.boxNumber || '').toLowerCase();

        if (s.includes(q) || u.includes(q) || d.includes(q) || b.includes(q)) {
          return true;
        }
        if (qStripped) {
          const sNorm = normalizeCode(item.sku);
          const uNorm = normalizeCode(item.upc);
          if (sNorm.includes(qStripped) || uNorm.includes(qStripped)) {
            return true;
          }
        }
        return false;
      });
    }

    return items;
  } catch (err: any) {
    console.error('Error fetching rebox items from Supabase:', err);
    throw err;
  }
}

/**
 * Compute summary statistics for all distinct physical boxes in the stockroom,
 * merging boxes stored in Supabase with locally created/registered empty boxes.
 */
export async function fetchReboxBoxes(
  existingItems?: ReboxItem[],
  storeFilter?: StoreFilter
): Promise<ReboxBoxSummary[]> {
  const [allItems, registeredBoxes] = await Promise.all([
    existingItems
      ? Promise.resolve(existingItems)
      : fetchReboxItems({
          storeCode: storeFilter?.storeCode,
          storeName: storeFilter?.storeName,
        }),
    getRegisteredBoxes(storeFilter),
  ]);

  const boxMap = new Map<
    string,
    {
      boxNumber: string;
      count: number;
      totalUnits: number;
      lastUpdated?: string;
      previewItems: ReboxItem[];
    }
  >();

  // Seed locally created boxes first so empty ready-to-scan boxes are visible
  for (const reg of registeredBoxes) {
    const cleanBox = normalizeBoxNumber(reg.boxNumber);
    if (!cleanBox) continue;
    const key = cleanBox.toUpperCase();
    if (!boxMap.has(key)) {
      boxMap.set(key, {
        boxNumber: cleanBox,
        count: 0,
        totalUnits: 0,
        lastUpdated: reg.createdAt,
        previewItems: [],
      });
    }
  }

  allItems.forEach((item) => {
    const box = (item.boxNumber || 'UNASSIGNED').trim();
    const key = box.toUpperCase();
    const existing = boxMap.get(key) || {
      boxNumber: box,
      count: 0,
      totalUnits: 0,
      lastUpdated: item.updatedAt,
      previewItems: [],
    };
    existing.count += 1;
    existing.totalUnits += item.qty;
    if (existing.previewItems.length < 4) {
      existing.previewItems.push(item);
    }
    if (!existing.lastUpdated || new Date(item.updatedAt) > new Date(existing.lastUpdated)) {
      existing.lastUpdated = item.updatedAt;
    }
    boxMap.set(key, existing);
  });

  const summaries: ReboxBoxSummary[] = [];
  boxMap.forEach((val) => {
    summaries.push({
      boxNumber: val.boxNumber,
      itemCount: val.count,
      totalUnits: val.totalUnits,
      lastUpdated: val.lastUpdated,
      previewItems: val.previewItems,
      isEmpty: val.count === 0,
    });
  });

  return summaries.sort((a, b) =>
    a.boxNumber.localeCompare(b.boxNumber, undefined, { numeric: true, sensitivity: 'base' })
  );
}

/**
 * Rename an entire physical box across Supabase and local registry
 */
export async function renameReboxBox(
  oldBoxNumber: string,
  newBoxNumber: string,
  storeFilter?: StoreFilter
): Promise<string> {
  const fromBox = oldBoxNumber.trim();
  const toBox = normalizeBoxNumber(newBoxNumber);
  if (!fromBox || !toBox) {
    throw new Error('Please enter a valid new Box Number.');
  }
  if (fromBox.toUpperCase() === toBox.toUpperCase()) {
    return toBox;
  }

  let query = supabase
    .from('rebox_items')
    .update({ box_number: toBox, updated_at: new Date().toISOString() })
    .eq('box_number', fromBox);

  if (storeFilter && (storeFilter.storeCode || storeFilter.storeName)) {
    const { candidates } = getStoreIdentifiers(storeFilter.storeCode, storeFilter.storeName);
    if (candidates.length > 0) {
      query = query.in('store_code', candidates);
    }
  }

  const { error } = await query;

  if (error) {
    throw new Error(`Failed to rename box: ${error.message}`);
  }

  await unregisterReboxBox(fromBox, storeFilter);
  await registerReboxBox(toBox, storeFilter);

  const active = await getActiveReboxBox(storeFilter);
  if (active && active.toUpperCase() === fromBox.toUpperCase()) {
    await setActiveReboxBox(toBox, storeFilter);
  }
  return toBox;
}

/**
 * Delete an entire physical box (all items inside + local empty registration)
 */
export async function deleteEntireReboxBox(
  boxNumber: string,
  storeFilter?: StoreFilter
): Promise<void> {
  const target = boxNumber.trim();
  if (!target) return;

  let query = supabase.from('rebox_items').delete().eq('box_number', target);

  if (storeFilter && (storeFilter.storeCode || storeFilter.storeName)) {
    const { candidates } = getStoreIdentifiers(storeFilter.storeCode, storeFilter.storeName);
    if (candidates.length > 0) {
      query = query.in('store_code', candidates);
    }
  }

  const { error } = await query;
  if (error) {
    throw new Error(`Failed to delete box ${target}: ${error.message}`);
  }

  await unregisterReboxBox(target, storeFilter);
}

/**
 * Save an item into a physical box in Supabase.
 * If the item already exists in that same box & store (matching SKU or UPC), increments the quantity.
 */
export async function saveReboxItem(payload: {
  boxNumber: string;
  storeCode?: string;
  storeName?: string;
  sku: string;
  upc?: string;
  description?: string;
  qty: number;
}): Promise<ReboxItem> {
  const boxNumber = normalizeBoxNumber(payload.boxNumber);
  const storeCode = resolveStoreCode(payload.storeCode, payload.storeName);
  const sku = (payload.sku || '').trim();
  const upc = (payload.upc || '').trim();
  const description = (payload.description || '').trim();
  const qty = Math.max(1, Math.floor(payload.qty));

  if (!boxNumber) {
    throw new Error('Please specify a Box Number for physical storage.');
  }
  if (!sku && !upc) {
    throw new Error('Please specify a SKU or UPC for the item.');
  }

  const storeFilter: StoreFilter | undefined =
    payload.storeCode || payload.storeName
      ? { storeCode: payload.storeCode, storeName: payload.storeName }
      : undefined;

  await registerReboxBox(boxNumber, storeFilter);

  // Check if item already exists in the same box (and same store if provided)
  let existingQuery = supabase.from('rebox_items').select('*').eq('box_number', boxNumber);
  if (storeFilter) {
    const { candidates } = getStoreIdentifiers(storeFilter.storeCode, storeFilter.storeName);
    if (candidates.length > 0) {
      existingQuery = existingQuery.in('store_code', candidates);
    }
  }
  if (sku) {
    existingQuery = existingQuery.eq('sku', sku);
  } else if (upc) {
    existingQuery = existingQuery.eq('upc', upc);
  }

  const { data: existingRows } = await existingQuery.limit(1);

  if (existingRows && existingRows.length > 0) {
    const existing = existingRows[0];
    const newQty = (existing.qty || 0) + qty;
    const updatePayload: Record<string, any> = {
      qty: newQty,
      description: description || existing.description,
      updated_at: new Date().toISOString(),
    };
    if (storeCode && !existing.store_code) {
      updatePayload.store_code = storeCode;
    }
    if (upc && !existing.upc) {
      updatePayload.upc = upc;
    }

    const { data: updated, error } = await supabase
      .from('rebox_items')
      .update(updatePayload)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update item in box ${boxNumber}: ${error.message}`);
    }
    return mapReboxRow(updated);
  }

  // Insert new record
  const insertPayload = {
    store_code: storeCode,
    box_number: boxNumber,
    sku,
    upc,
    description,
    qty,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: inserted, error } = await supabase
    .from('rebox_items')
    .insert([insertPayload])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save item to box ${boxNumber}: ${error.message}`);
  }

  return mapReboxRow(inserted);
}

/**
 * Update the quantity of an item in a box (e.g. adjust or correct).
 * If newQty <= 0, deletes the record.
 */
export async function updateReboxItemQty(id: string, newQty: number): Promise<void> {
  if (newQty <= 0) {
    await deleteReboxItem(id);
    return;
  }

  const { error } = await supabase
    .from('rebox_items')
    .update({ qty: Math.floor(newQty), updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to update quantity: ${error.message}`);
  }
}

/**
 * Refill / take units out of the box to restock the selling area.
 * Returns remaining quantity, and whether the record was deleted when reaching 0.
 */
export async function refillItemFromBox(
  id: string,
  refillQty: number
): Promise<{ remainingQty: number; deleted: boolean }> {
  const safeDeduct = Math.max(1, Math.floor(refillQty));

  const { data: row, error: fetchErr } = await supabase
    .from('rebox_items')
    .select('qty, box_number, sku')
    .eq('id', id)
    .single();

  if (fetchErr || !row) {
    throw new Error('Item not found in stockroom rebox records.');
  }

  const currentQty = Number(row.qty) || 0;
  const remaining = currentQty - safeDeduct;

  if (remaining <= 0) {
    await deleteReboxItem(id);
    return { remainingQty: 0, deleted: true };
  }

  const { error } = await supabase
    .from('rebox_items')
    .update({ qty: remaining, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to refill item: ${error.message}`);
  }

  return { remainingQty: remaining, deleted: false };
}

/**
 * Delete an item record from a physical box in Supabase (triggered by 3-second hold on item card)
 */
export async function deleteReboxItem(id: string, storeFilter?: StoreFilter): Promise<void> {
  const cleanId = (id || '').trim();
  if (!cleanId) {
    throw new Error('Invalid rebox item ID.');
  }

  let query = supabase.from('rebox_items').delete().eq('id', cleanId);

  if (storeFilter && (storeFilter.storeCode || storeFilter.storeName)) {
    const { candidates } = getStoreIdentifiers(storeFilter.storeCode, storeFilter.storeName);
    if (candidates.length > 0) {
      query = query.in('store_code', Array.from(new Set([...candidates, ''])));
    }
  }

  const { error } = await query;
  if (error) {
    throw new Error(`Failed to remove item: ${error.message}`);
  }
}

/**
 * Lookup item information (SKU, UPC, Description, Image)
 * Prioritizes:
 * 1. OpenSheet Inventory Catalog (150k Daiso products via utils/dlr.ts)
 * 2. Stored Manifest CSV (from utils/storage.ts MANIFEST_ITEMS_KEY)
 * 3. Cloudinary uploaded image cache (from utils/storage.ts UPLOADED_ITEM_IMAGES_KEY)
 */
export async function lookupItemDetails(code: string): Promise<{
  sku: string;
  upc: string;
  description: string;
  imageUrl?: string;
  originCid?: string;
  cost?: string;
  price?: string;
  departmentName?: string;
} | null> {
  const rawCode = (code || '').trim();
  const normalized = normalizeCode(rawCode);
  if (!normalized) return null;

  try {
    const [storedManifest, storedImages] = await Promise.all([
      AsyncStorage.getItem(MANIFEST_ITEMS_KEY),
      AsyncStorage.getItem(UPLOADED_ITEM_IMAGES_KEY),
    ]);

    const uploadedMap: Record<string, string> = storedImages ? JSON.parse(storedImages) : {};

    const findUploadedPhoto = (upc?: string, sku?: string, id?: string) => {
      const u = (upc || '').trim();
      const s = (sku || '').trim();
      const candidate =
        (u && uploadedMap[`upc:${u}`]) ||
        (s && uploadedMap[`sku:${s}`]) ||
        (id && uploadedMap[`id:${id}`]) ||
        (u && uploadedMap[u]) ||
        (s && uploadedMap[s]) ||
        undefined;
      return isUploadedPhoto(candidate) ? candidate : undefined;
    };

    // 1. Look up in OpenSheet Catalog (official Daiso master inventory)
    try {
      const catalogProduct = await findProductInCatalog(rawCode);
      if (catalogProduct) {
        const cachedImg = findUploadedPhoto(catalogProduct.upc, catalogProduct.sku);
        return {
          sku: catalogProduct.sku || rawCode,
          upc: catalogProduct.upc || '',
          description: catalogProduct.description || '',
          imageUrl: cachedImg,
          cost: catalogProduct.cost,
          price: catalogProduct.price,
          departmentName: catalogProduct.departmentName,
        };
      }
    } catch (catalogErr) {
      console.warn('OpenSheet catalog lookup error:', catalogErr);
    }

    // 2. Fallback to local Manifest CSV items
    if (storedManifest) {
      const items = JSON.parse(storedManifest) as ItemManifestRecord[];
      if (Array.isArray(items)) {
        const match = items.find(
          (i) =>
            normalizeCode(i.sku) === normalized ||
            normalizeCode(i.upc) === normalized ||
            normalizeCode(i.cid) === normalized ||
            normalizeCode(i.trf) === normalized ||
            codesMatch(i.sku, rawCode) ||
            codesMatch(i.upc, rawCode)
        );

        if (match) {
          const upcClean = (match.upc || '').trim();
          const skuClean = (match.sku || '').trim();
          const cachedImg = findUploadedPhoto(upcClean, skuClean, match.id);

          return {
            sku: match.sku || rawCode,
            upc: match.upc || '',
            description: match.description || '',
            imageUrl: cachedImg,
            originCid: match.cid || undefined,
          };
        }
      }
    }
  } catch (err) {
    console.warn('lookupItemDetails error:', err);
  }

  // 3. Fallback for uncatalogued item
  const isUpc = /^\d{7,14}$/.test(rawCode);
  return {
    sku: rawCode,
    upc: isUpc ? rawCode : '',
    description: '',
    imageUrl: undefined,
  };
}

async function checkUrlExists(url: string, timeoutMs = 4500): Promise<boolean> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller?.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Check first whether a product image already exists on Daiso CDN or Cloudinary
 * for the given UPC before allowing or performing an upload.
 * Returns the existing image URL if found, or null if no image is available.
 */
export async function checkExistingProductImage(upcOrCode: string): Promise<string | null> {
  const cleanCode = (upcOrCode || '').replace(/[^a-zA-Z0-9_-]/g, '').trim();
  if (!cleanCode) return null;

  const candidates = [
    `https://jpbulk.daisonet.com/cdn/shop/files/${cleanCode}_10_400x.jpg`,
    `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/c_fill,w_200,h_200/products/${cleanCode}`,
    `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/c_fill,w_200,h_200/${cleanCode}`,
  ];

  for (const candidateUrl of candidates) {
    const exists = await checkUrlExists(candidateUrl);
    if (exists) {
      return candidateUrl;
    }
  }
  return null;
}

async function toUploadDataUri(uri: string): Promise<string> {
  if (uri.startsWith('data:image/')) {
    return uri;
  }
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read captured image on web'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read captured image blob'));
      reader.readAsDataURL(blob);
    });
  }
  const base64Data = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:image/jpeg;base64,${base64Data}`;
}

/**
 * Upload item image to Cloudinary using preset EXPO_CLOUDINARY_UPLOAD_PRESET=daisoimage
 * named with the item's UPC (`products/<UPC>`).
 * Always checks first if an image already exists for that UPC; if found, reuses it without re-uploading.
 */
export async function uploadReboxImageToCloudinary(
  localUri: string,
  upc: string,
  fallbackSku?: string,
  onStatus?: (status: string) => void
): Promise<{ secureUrl: string; alreadyExisted: boolean; publicId: string }> {
  const rawName = (upc || '').trim() || (fallbackSku || '').trim();
  const safeUpcName = rawName.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  if (!safeUpcName) {
    throw new Error('Item must have a UPC code to upload its image.');
  }

  // 1. Check first if an image already exists for this UPC
  onStatus?.(`Checking if image exists for UPC ${safeUpcName}...`);
  const existingUrl = await checkExistingProductImage(safeUpcName);
  if (existingUrl) {
    await persistCachedUploadedImage(safeUpcName, fallbackSku, existingUrl);
    return {
      secureUrl: existingUrl,
      alreadyExisted: true,
      publicId: safeUpcName,
    };
  }

  // 2. Compress and encode image
  onStatus?.('Compressing 1:1 product image...');
  const compressedUri = await compressImage(localUri);
  const dataUri = await toUploadDataUri(compressedUri);

  // 3. Upload using EXPO_CLOUDINARY_UPLOAD_PRESET=daisoimage with public_id = <UPC>
  onStatus?.(`Uploading ${safeUpcName} (${ITEM_IMAGE_CLOUDINARY_UPLOAD_PRESET})...`);
  const formData = new FormData();
  formData.append('file', dataUri);
  formData.append('upload_preset', ITEM_IMAGE_CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', 'products');
  formData.append('public_id', safeUpcName);

  const res = await fetch(ITEM_IMAGE_CLOUDINARY_ENDPOINT, {
    method: 'POST',
    body: formData,
  });

  let result: { secure_url?: string; existing?: boolean; error?: { message?: string } } = {};
  try {
    result = await res.json();
  } catch {}

  if (res.ok && result.secure_url) {
    await persistCachedUploadedImage(safeUpcName, fallbackSku, result.secure_url);
    return {
      secureUrl: result.secure_url,
      alreadyExisted: Boolean(result.existing),
      publicId: safeUpcName,
    };
  }

  // Fallback if preset restricts folder parameter, still naming with UPC public_id
  const errMsg = (result.error?.message || '').toLowerCase();
  if (
    errMsg.includes('folder') ||
    errMsg.includes('public_id') ||
    errMsg.includes('public id') ||
    errMsg.includes('overwrite') ||
    errMsg.includes('already exists') ||
    errMsg.includes('display name')
  ) {
    const fallbackForm = new FormData();
    fallbackForm.append('file', dataUri);
    fallbackForm.append('upload_preset', ITEM_IMAGE_CLOUDINARY_UPLOAD_PRESET);
    fallbackForm.append('public_id', safeUpcName);

    const fallbackRes = await fetch(ITEM_IMAGE_CLOUDINARY_ENDPOINT, {
      method: 'POST',
      body: fallbackForm,
    });

    let fallbackResult: { secure_url?: string; existing?: boolean; error?: { message?: string } } =
      {};
    try {
      fallbackResult = await fallbackRes.json();
    } catch {}

    if (fallbackRes.ok && fallbackResult.secure_url) {
      await persistCachedUploadedImage(safeUpcName, fallbackSku, fallbackResult.secure_url);
      return {
        secureUrl: fallbackResult.secure_url,
        alreadyExisted: Boolean(fallbackResult.existing),
        publicId: safeUpcName,
      };
    }

    throw new Error(
      fallbackResult.error?.message || `Cloudinary upload failed (${fallbackRes.status})`
    );
  }

  throw new Error(result.error?.message || `Cloudinary upload failed (${res.status})`);
}

async function persistCachedUploadedImage(
  upcName: string,
  fallbackSku: string | undefined,
  secureUrl: string
): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(UPLOADED_ITEM_IMAGES_KEY);
    const map: Record<string, string> = stored ? JSON.parse(stored) : {};
    map[`upc:${upcName}`] = secureUrl;
    if (fallbackSku && fallbackSku.trim()) {
      map[`sku:${fallbackSku.trim()}`] = secureUrl;
    }
    await AsyncStorage.setItem(UPLOADED_ITEM_IMAGES_KEY, JSON.stringify(map));
  } catch {}
}

export const REBOX_PDF_SAVE_DIR_KEY = 'rebox_pdf_save_dir_uri';

export interface ReboxPdfOptions {
  items?: ReboxItem[];
  boxNumber?: string | null;
  storeCode?: string | null;
  storeName?: string | null;
  operatorId?: string | null;
  uploadedItemImages?: Record<string, string>;
  title?: string;
  action?: 'save_to_device' | 'share';
  skipShareSheet?: boolean;
  onStatus?: (status: string) => void;
}

export interface ReboxPdfResult {
  uri: string;
  fileName: string;
  itemCount: number;
  boxCount: number;
  totalUnits: number;
  imagesEmbedded: number;
  pageCount: number;
  savedToDevice?: boolean;
  cancelled?: boolean;
}

interface EmbeddedJpegImage {
  resourceName: string;
  bytes: Uint8Array;
  width: number;
  height: number;
  colorSpace: 'DeviceRGB' | 'DeviceGray' | 'DeviceCMYK';
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64ToUint8Array(base64Input: string): Uint8Array {
  const commaIdx = base64Input.indexOf(',');
  const raw = (commaIdx >= 0 ? base64Input.slice(commaIdx + 1) : base64Input).replace(
    /[^A-Za-z0-9+/=]/g,
    ''
  );
  if (!raw) return new Uint8Array(0);

  const padding = raw.endsWith('==') ? 2 : raw.endsWith('=') ? 1 : 0;
  const byteLength = Math.max(0, Math.floor((raw.length * 3) / 4) - padding);
  const out = new Uint8Array(byteLength);

  const lookup = new Int16Array(128).fill(-1);
  for (let i = 0; i < BASE64_CHARS.length; i++) {
    lookup[BASE64_CHARS.charCodeAt(i)] = i;
  }

  let outIdx = 0;
  for (let i = 0; i < raw.length; i += 4) {
    const c0 = raw.charCodeAt(i);
    const c1 = raw.charCodeAt(i + 1);
    const c2 = raw.charCodeAt(i + 2);
    const c3 = raw.charCodeAt(i + 3);

    const v0 = c0 < 128 ? lookup[c0] : -1;
    const v1 = c1 < 128 ? lookup[c1] : -1;
    const v2 = c2 === 61 || isNaN(c2) ? 0 : c2 < 128 ? lookup[c2] : 0;
    const v3 = c3 === 61 || isNaN(c3) ? 0 : c3 < 128 ? lookup[c3] : 0;

    if (v0 < 0 || v1 < 0) continue;
    const triple = (v0 << 18) | (v1 << 12) | (v2 << 6) | v3;

    if (outIdx < byteLength) out[outIdx++] = (triple >> 16) & 0xff;
    if (outIdx < byteLength) out[outIdx++] = (triple >> 8) & 0xff;
    if (outIdx < byteLength) out[outIdx++] = triple & 0xff;
  }

  return out;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  const chunkSize = 3072; // multiple of 3

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, bytes.length);
    let segment = '';
    for (let i = offset; i < end; i += 3) {
      const b0 = bytes[i];
      const hasB1 = i + 1 < bytes.length;
      const hasB2 = i + 2 < bytes.length;
      const b1 = hasB1 ? bytes[i + 1] : 0;
      const b2 = hasB2 ? bytes[i + 2] : 0;

      const triple = (b0 << 16) | (b1 << 8) | b2;
      segment += BASE64_CHARS[(triple >> 18) & 0x3f];
      segment += BASE64_CHARS[(triple >> 12) & 0x3f];
      segment += hasB1 ? BASE64_CHARS[(triple >> 6) & 0x3f] : '=';
      segment += hasB2 ? BASE64_CHARS[triple & 0x3f] : '=';
    }
    parts.push(segment);
  }

  return parts.join('');
}

function parseJpegHeader(bytes: Uint8Array): {
  width: number;
  height: number;
  colorSpace: 'DeviceRGB' | 'DeviceGray' | 'DeviceCMYK';
} | null {
  if (bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }

  let pos = 2;
  while (pos < bytes.length) {
    if (bytes[pos] !== 0xff) {
      pos++;
      continue;
    }
    while (pos < bytes.length && bytes[pos] === 0xff) {
      pos++;
    }
    if (pos >= bytes.length) break;

    const marker = bytes[pos++];
    if (marker === 0xd9 || marker === 0xda) {
      break;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    if (pos + 1 >= bytes.length) break;

    const segLength = (bytes[pos] << 8) | bytes[pos + 1];
    if (segLength < 2 || pos + segLength > bytes.length) {
      break;
    }

    // SOF0 (Baseline DCT), SOF1 (Extended Sequential DCT), SOF2 (Progressive DCT)
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      if (pos + 7 >= bytes.length) return null;
      const bitsPerComponent = bytes[pos + 2];
      const height = (bytes[pos + 3] << 8) | bytes[pos + 4];
      const width = (bytes[pos + 5] << 8) | bytes[pos + 6];
      const components = bytes[pos + 7];

      if (bitsPerComponent !== 8 || width <= 0 || height <= 0) {
        return null;
      }
      if (components !== 1 && components !== 3 && components !== 4) {
        return null;
      }

      return {
        width,
        height,
        colorSpace:
          components === 1 ? 'DeviceGray' : components === 4 ? 'DeviceCMYK' : 'DeviceRGB',
      };
    }

    pos += segLength;
  }

  return null;
}

async function convertLocalImageToPdfJpeg(
  localUri: string
): Promise<Omit<EmbeddedJpegImage, 'resourceName'> | null> {
  let manipulatedUri: string | null = null;
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

    if (typeof mod.manipulateAsync === 'function' && mod.SaveFormat) {
      const res = await mod.manipulateAsync(localUri, [{ resize: { width: 200 } }], {
        compress: 0.82,
        format: mod.SaveFormat.JPEG,
      });
      manipulatedUri = res.uri;
    } else if (mod.ImageManipulator) {
      const ctx = mod.ImageManipulator.manipulate(localUri);
      ctx.resize({ width: 200 });
      const rendered = await ctx.renderAsync();
      const saved = await rendered.saveAsync({
        compress: 0.82,
        format: 'jpeg',
      });
      manipulatedUri = saved.uri;
    }

    const targetUri = manipulatedUri || localUri;
    const b64 = await FileSystem.readAsStringAsync(targetUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const bytes = base64ToUint8Array(b64);
    const meta = parseJpegHeader(bytes);
    if (!meta) return null;

    return {
      bytes,
      width: meta.width,
      height: meta.height,
      colorSpace: meta.colorSpace,
    };
  } catch {
    return null;
  } finally {
    if (manipulatedUri && manipulatedUri !== localUri) {
      FileSystem.deleteAsync(manipulatedUri, { idempotent: true }).catch(() => {});
    }
  }
}

async function fetchWebImageAsPdfJpeg(
  url: string
): Promise<Omit<EmbeddedJpegImage, 'resourceName'> | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;

  return await new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timeout = setTimeout(() => {
      resolve(null);
    }, 6000);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        const maxDim = 200;
        const srcW = img.naturalWidth || img.width || 200;
        const srcH = img.naturalHeight || img.height || 200;
        const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
        const outW = Math.max(1, Math.round(srcW * scale));
        const outH = Math.max(1, Math.round(srcH * scale));

        const canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, outW, outH);
        ctx.drawImage(img, 0, 0, outW, outH);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.84);
        const bytes = base64ToUint8Array(dataUrl);
        const meta = parseJpegHeader(bytes);
        if (!meta) {
          resolve(null);
          return;
        }
        resolve({
          bytes,
          width: meta.width,
          height: meta.height,
          colorSpace: meta.colorSpace,
        });
      } catch {
        resolve(null);
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(null);
    };

    img.src = url;
  });
}

function getCandidateImageUrlsForItem(
  item: ReboxItem,
  uploadedImagesMap: Record<string, string>
): string[] {
  const urls: string[] = [];
  const pushUnique = (u?: string | null) => {
    const clean = (u || '').trim();
    if (clean && !urls.includes(clean)) {
      urls.push(clean);
    }
  };

  const cleanSku = (item.sku || '').trim();
  const cleanUpc = (item.upc || '').trim();
  const safeCode = (cleanUpc || cleanSku).replace(/[^a-zA-Z0-9_-]/g, '').trim();

  pushUnique(uploadedImagesMap[`${cleanSku}_${cleanUpc}`]);
  if (cleanUpc) pushUnique(uploadedImagesMap[`upc:${cleanUpc}`]);
  if (cleanSku) pushUnique(uploadedImagesMap[`sku:${cleanSku}`]);
  if (item.id) pushUnique(uploadedImagesMap[item.id]);

  if (safeCode) {
    pushUnique(`https://jpbulk.daisonet.com/cdn/shop/files/${safeCode}_10_400x.jpg`);
    pushUnique(
      `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/c_fill,w_220,h_220,f_jpg/products/${safeCode}`
    );
    pushUnique(
      `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/c_fill,w_220,h_220,f_jpg/${safeCode}`
    );
  }

  return urls;
}

async function resolveItemPdfImage(
  item: ReboxItem,
  uploadedImagesMap: Record<string, string>,
  tempSeed: number
): Promise<Omit<EmbeddedJpegImage, 'resourceName'> | null> {
  const candidates = getCandidateImageUrlsForItem(item, uploadedImagesMap);
  if (candidates.length === 0) return null;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];

    if (Platform.OS === 'web') {
      const webImg = await fetchWebImageAsPdfJpeg(candidate);
      if (webImg) return webImg;
      continue;
    }

    if (candidate.startsWith('data:image/')) {
      const rawBytes = base64ToUint8Array(candidate);
      const directMeta = parseJpegHeader(rawBytes);
      if (directMeta) {
        return {
          bytes: rawBytes,
          width: directMeta.width,
          height: directMeta.height,
          colorSpace: directMeta.colorSpace,
        };
      }
      const tempDataPath = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}rebox_pdf_data_${tempSeed}_${i}.img`;
      try {
        const comma = candidate.indexOf(',');
        const rawB64 = comma >= 0 ? candidate.slice(comma + 1) : candidate;
        await FileSystem.writeAsStringAsync(tempDataPath, rawB64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const converted = await convertLocalImageToPdfJpeg(tempDataPath);
        if (converted) return converted;
      } catch {
      } finally {
        FileSystem.deleteAsync(tempDataPath, { idempotent: true }).catch(() => {});
      }
      continue;
    }

    if (candidate.startsWith('file://')) {
      const converted = await convertLocalImageToPdfJpeg(candidate);
      if (converted) return converted;
      continue;
    }

    if (candidate.startsWith('http://') || candidate.startsWith('https://')) {
      const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
      const tempDownloadPath = `${baseDir}rebox_pdf_dl_${Date.now()}_${tempSeed}_${i}.jpg`;
      try {
        const dlRes = await Promise.race([
          FileSystem.downloadAsync(candidate, tempDownloadPath),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 6500)),
        ]);

        if (dlRes && dlRes.status >= 200 && dlRes.status < 300) {
          const converted = await convertLocalImageToPdfJpeg(dlRes.uri);
          if (converted) return converted;
        }
      } catch {
      } finally {
        FileSystem.deleteAsync(tempDownloadPath, { idempotent: true }).catch(() => {});
      }
    }
  }

  return null;
}

class PdfByteWriter {
  private chunks: Uint8Array[] = [];
  public byteLength = 0;

  pushAscii(text: string): void {
    const arr = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
      arr[i] = text.charCodeAt(i) & 0xff;
    }
    this.chunks.push(arr);
    this.byteLength += arr.length;
  }

  pushBytes(bytes: Uint8Array): void {
    this.chunks.push(bytes);
    this.byteLength += bytes.length;
  }

  toUint8Array(): Uint8Array {
    const merged = new Uint8Array(this.byteLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return merged;
  }
}

function sanitizePdfText(raw?: string | null): string {
  const input = (raw || '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[\u00B7\u2022]/g, '-')
    .replace(/\u00D7/g, 'x')
    .replace(/\u00A5/g, 'JPY ')
    .replace(/\u20B1/g, 'PHP ')
    .replace(/\s+/g, ' ')
    .trim();

  let out = '';
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code >= 32 && code <= 126) {
      out += input[i];
    } else if (code >= 160 && code <= 255) {
      out += input[i];
    } else if (code > 255) {
      out += '?';
    }
  }
  return out;
}

function escapePdfLiteral(text: string): string {
  return sanitizePdfText(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapPdfText(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const clean = sanitizePdfText(text);
  if (!clean) return [''];

  const words = clean.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
        if (lines.length >= maxLines) {
          const last = lines[maxLines - 1];
          lines[maxLines - 1] =
            last.length > maxCharsPerLine - 3
              ? `${last.slice(0, Math.max(1, maxCharsPerLine - 3))}...`
              : `${last}...`;
          return lines;
        }
      }
      if (word.length > maxCharsPerLine) {
        current = word.slice(0, maxCharsPerLine);
      } else {
        current = word;
      }
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  return lines.length > 0 ? lines : [''];
}

function fmtNum(n: number): string {
  return n.toFixed(2).replace(/\.00$/, '');
}

function formatPdfTimestamp(isoOrDate?: string | Date): string {
  const d = isoOrDate ? new Date(isoOrDate) : new Date();
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function compareBoxNumbersNatural(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function buildReboxPdfBytes(params: {
  items: ReboxItem[];
  imageByKey: Map<string, EmbeddedJpegImage>;
  getImageKey: (item: ReboxItem) => string;
  reportTitle: string;
  scopeSubtitle: string;
  storeLabel: string;
  operatorLabel?: string;
  generatedAt: Date;
}): { bytes: Uint8Array; pageCount: number } {
  const PAGE_W = 595.28; // A4 width in pt
  const PAGE_H = 841.89; // A4 height in pt
  const MARGIN_X = 32;
  const CONTENT_W = PAGE_W - MARGIN_X * 2; // 531.28 pt
  const BOTTOM_LIMIT = PAGE_H - 42; // 799.89 pt

  const pdfY = (topY: number, height = 0): number => PAGE_H - topY - height;

  const drawFilledStrokedRect = (
    cmds: string[],
    x: number,
    topY: number,
    w: number,
    h: number,
    fillRgb: [number, number, number] | null,
    strokeRgb: [number, number, number] | null,
    lineWidth = 0.75
  ) => {
    const y = pdfY(topY, h);
    cmds.push('q');
    if (fillRgb) {
      cmds.push(`${fmtNum(fillRgb[0])} ${fmtNum(fillRgb[1])} ${fmtNum(fillRgb[2])} rg`);
    }
    if (strokeRgb) {
      cmds.push(`${fmtNum(strokeRgb[0])} ${fmtNum(strokeRgb[1])} ${fmtNum(strokeRgb[2])} RG`);
      cmds.push(`${fmtNum(lineWidth)} w`);
    }
    const op = fillRgb && strokeRgb ? 'B' : fillRgb ? 'f' : 'S';
    cmds.push(`${fmtNum(x)} ${fmtNum(y)} ${fmtNum(w)} ${fmtNum(h)} re ${op}`);
    cmds.push('Q');
  };

  const drawText = (
    cmds: string[],
    text: string,
    x: number,
    baselineTopY: number,
    font: 'F1' | 'F2' | 'F3',
    fontSize: number,
    rgb: [number, number, number]
  ) => {
    const safe = escapePdfLiteral(text);
    if (!safe) return;
    const y = PAGE_H - baselineTopY;
    cmds.push('BT');
    cmds.push(`/${font} ${fmtNum(fontSize)} Tf`);
    cmds.push(`${fmtNum(rgb[0])} ${fmtNum(rgb[1])} ${fmtNum(rgb[2])} rg`);
    cmds.push(`1 0 0 1 ${fmtNum(x)} ${fmtNum(y)} Tm`);
    cmds.push(`(${safe}) Tj`);
    cmds.push('ET');
  };

  const drawPlaceholderBoxIcon = (cmds: string[], frameX: number, frameTopY: number, size: number) => {
    const cx = frameX + size / 2;
    const cyTop = frameTopY + size / 2 - 4;
    const r = 9;
    cmds.push('q');
    cmds.push('0.63 0.63 0.67 RG 1.1 w');
    // Isometric cube outline
    const pTop = `${fmtNum(cx)} ${fmtNum(PAGE_H - (cyTop - r))}`;
    const pRight = `${fmtNum(cx + r)} ${fmtNum(PAGE_H - (cyTop - r * 0.45))}`;
    const pBottomRight = `${fmtNum(cx + r)} ${fmtNum(PAGE_H - (cyTop + r * 0.65))}`;
    const pBottom = `${fmtNum(cx)} ${fmtNum(PAGE_H - (cyTop + r * 1.1))}`;
    const pBottomLeft = `${fmtNum(cx - r)} ${fmtNum(PAGE_H - (cyTop + r * 0.65))}`;
    const pLeft = `${fmtNum(cx - r)} ${fmtNum(PAGE_H - (cyTop - r * 0.45))}`;
    const pCenter = `${fmtNum(cx)} ${fmtNum(PAGE_H - (cyTop + r * 0.1))}`;

    cmds.push(`${pTop} m ${pRight} l ${pBottomRight} l ${pBottom} l ${pBottomLeft} l ${pLeft} l h S`);
    cmds.push(`${pLeft} m ${pCenter} l ${pRight} l S`);
    cmds.push(`${pCenter} m ${pBottom} l S`);
    cmds.push('Q');

    drawText(cmds, 'NO PHOTO', frameX + 10.5, frameTopY + size - 8, 'F2', 6.2, [0.58, 0.58, 0.62]);
  };

  // Group items by box number
  const boxGroupsMap = new Map<string, ReboxItem[]>();
  for (const item of params.items) {
    const boxKey = normalizeBoxNumber(item.boxNumber) || 'UNASSIGNED';
    const list = boxGroupsMap.get(boxKey) || [];
    list.push(item);
    boxGroupsMap.set(boxKey, list);
  }

  const sortedBoxNames = Array.from(boxGroupsMap.keys()).sort(compareBoxNumbersNatural);
  const totalBoxes = sortedBoxNames.length;
  const totalSkus = params.items.length;
  const totalUnits = params.items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
  const generatedStr = formatPdfTimestamp(params.generatedAt);

  // Build page body commands first so we know total page count for headers/footers
  const pagesBodyCmds: string[][] = [[]];
  let currentPageIdx = 0;
  let cursorY = 160; // Page 1 starts below banner + KPI strip

  const startNewPage = () => {
    pagesBodyCmds.push([]);
    currentPageIdx = pagesBodyCmds.length - 1;
    cursorY = 72; // Continuation pages start below compact header
  };

  const drawBoxGroupHeader = (
    cmds: string[],
    boxName: string,
    skuCount: number,
    unitCount: number,
    isContinuation: boolean
  ) => {
    const barH = 23;
    drawFilledStrokedRect(
      cmds,
      MARGIN_X,
      cursorY,
      CONTENT_W,
      barH,
      [0.992, 0.949, 0.973],
      [0.957, 0.447, 0.714],
      0.75
    );
    // Left Daiso crimson stripe
    drawFilledStrokedRect(cmds, MARGIN_X, cursorY, 4.5, barH, [0.898, 0.0, 0.361], null);

    const label = isContinuation ? `BOX: ${boxName} (CONTINUED)` : `BOX: ${boxName}`;
    drawText(cmds, label, MARGIN_X + 12, cursorY + 15, 'F3', 10, [0.745, 0.094, 0.365]);

    const summaryStr = `${skuCount} ${skuCount === 1 ? 'SKU' : 'SKUs'}  |  ${unitCount} ${unitCount === 1 ? 'UNIT' : 'UNITS'}`;
    const rightX = PAGE_W - MARGIN_X - summaryStr.length * 5.2 - 10;
    drawText(cmds, summaryStr, Math.max(MARGIN_X + 220, rightX), cursorY + 15, 'F3', 8.5, [
      0.15,
      0.15,
      0.18,
    ]);

    cursorY += barH + 5;
  };

  const ROW_H = 68;
  const ROW_GAP = 5.5;

  for (const boxName of sortedBoxNames) {
    const groupItems = boxGroupsMap.get(boxName) || [];
    const boxUnits = groupItems.reduce((s, i) => s + (Number(i.qty) || 0), 0);

    // Ensure enough vertical space for Box Header + at least 1 item row
    if (cursorY + 28 + ROW_H > BOTTOM_LIMIT) {
      startNewPage();
    }

    drawBoxGroupHeader(pagesBodyCmds[currentPageIdx], boxName, groupItems.length, boxUnits, false);

    for (let idx = 0; idx < groupItems.length; idx++) {
      const item = groupItems[idx];

      if (cursorY + ROW_H > BOTTOM_LIMIT) {
        startNewPage();
        drawBoxGroupHeader(
          pagesBodyCmds[currentPageIdx],
          boxName,
          groupItems.length,
          boxUnits,
          true
        );
      }

      const cmds = pagesBodyCmds[currentPageIdx];
      const rowBg: [number, number, number] = idx % 2 === 0 ? [1, 1, 1] : [0.985, 0.985, 0.99];
      drawFilledStrokedRect(
        cmds,
        MARGIN_X,
        cursorY,
        CONTENT_W,
        ROW_H,
        rowBg,
        [0.89, 0.89, 0.91],
        0.7
      );

      // 1. Thumbnail Image Box (56 x 56 pt)
      const imgFrameX = MARGIN_X + 7;
      const imgFrameY = cursorY + 6;
      const imgFrameSize = 56;
      const embeddedImg = params.imageByKey.get(params.getImageKey(item));

      if (embeddedImg) {
        drawFilledStrokedRect(
          cmds,
          imgFrameX,
          imgFrameY,
          imgFrameSize,
          imgFrameSize,
          [1, 1, 1],
          [0.84, 0.84, 0.87],
          0.6
        );
        const innerMax = imgFrameSize - 4; // 52 pt
        const scale = Math.min(innerMax / embeddedImg.width, innerMax / embeddedImg.height);
        const drawW = Math.max(1, embeddedImg.width * scale);
        const drawH = Math.max(1, embeddedImg.height * scale);
        const drawX = imgFrameX + (imgFrameSize - drawW) / 2;
        const drawTopY = imgFrameY + (imgFrameSize - drawH) / 2;
        const drawBottomY = pdfY(drawTopY, drawH);

        cmds.push('q');
        cmds.push(
          `${fmtNum(drawW)} 0 0 ${fmtNum(drawH)} ${fmtNum(drawX)} ${fmtNum(drawBottomY)} cm`
        );
        cmds.push(`/${embeddedImg.resourceName} Do`);
        cmds.push('Q');
      } else {
        drawFilledStrokedRect(
          cmds,
          imgFrameX,
          imgFrameY,
          imgFrameSize,
          imgFrameSize,
          [0.96, 0.96, 0.97],
          [0.85, 0.85, 0.88],
          0.6
        );
        drawPlaceholderBoxIcon(cmds, imgFrameX, imgFrameY, imgFrameSize);
      }

      // 2. Item Description + Metadata Pills
      const textX = imgFrameX + imgFrameSize + 10; // x = 105
      const rawDesc =
        (item.description || '').trim() ||
        `Unlisted Item (${item.sku || item.upc || 'Unknown Code'})`;
      const descLines = wrapPdfText(rawDesc, 54, 2);

      drawText(cmds, descLines[0], textX, cursorY + 16, 'F2', 10, [0.09, 0.09, 0.11]);
      if (descLines.length > 1 && descLines[1]) {
        drawText(cmds, descLines[1], textX, cursorY + 28, 'F2', 9.5, [0.18, 0.18, 0.21]);
      }

      const metaTopY = descLines.length > 1 ? cursorY + 34 : cursorY + 25;

      // BOX Pill
      const boxBadgeText = `BOX: ${boxName}`;
      const boxBadgeW = Math.max(58, boxBadgeText.length * 5.2 + 10);
      drawFilledStrokedRect(
        cmds,
        textX,
        metaTopY,
        boxBadgeW,
        14,
        [0.988, 0.906, 0.953],
        [0.957, 0.447, 0.714],
        0.5
      );
      drawText(cmds, boxBadgeText, textX + 5, metaTopY + 10, 'F3', 8, [0.745, 0.094, 0.365]);

      // SKU Pill
      const skuText = `SKU: ${item.sku || 'N/A'}`;
      const skuX = textX + boxBadgeW + 5;
      const skuW = Math.max(76, Math.min(148, skuText.length * 5.0 + 10));
      drawFilledStrokedRect(
        cmds,
        skuX,
        metaTopY,
        skuW,
        14,
        [0.955, 0.955, 0.965],
        [0.83, 0.83, 0.86],
        0.5
      );
      drawText(cmds, skuText.slice(0, 26), skuX + 5, metaTopY + 10, 'F3', 8, [0.12, 0.12, 0.14]);

      // UPC Pill
      const upcText = `UPC: ${item.upc || 'N/A'}`;
      const upcX = skuX + skuW + 5;
      const maxUpcW = Math.max(60, 480 - upcX);
      const upcW = Math.min(maxUpcW, Math.max(76, upcText.length * 5.0 + 10));
      if (upcW >= 58) {
        drawFilledStrokedRect(
          cmds,
          upcX,
          metaTopY,
          upcW,
          14,
          [0.955, 0.955, 0.965],
          [0.83, 0.83, 0.86],
          0.5
        );
        drawText(cmds, upcText.slice(0, 25), upcX + 5, metaTopY + 10, 'F3', 8, [0.24, 0.24, 0.28]);
      }

      // Timestamp / Store line at bottom of card
      const updatedStamp = formatPdfTimestamp(item.updatedAt || item.createdAt);
      const footMeta = `Store: ${item.storeCode || params.storeLabel || 'N/A'}${updatedStamp ? `   |   Updated: ${updatedStamp}` : ''}`;
      drawText(cmds, footMeta, textX, cursorY + 59, 'F1', 7.3, [0.45, 0.45, 0.5]);

      // 3. Stored Quantity Box on Right
      const qtyBoxW = 68;
      const qtyBoxH = 50;
      const qtyBoxX = PAGE_W - MARGIN_X - qtyBoxW - 7;
      const qtyBoxY = cursorY + 9;
      drawFilledStrokedRect(
        cmds,
        qtyBoxX,
        qtyBoxY,
        qtyBoxW,
        qtyBoxH,
        [0.992, 0.949, 0.973],
        [0.94, 0.62, 0.78],
        0.7
      );
      drawText(cmds, 'STORED QTY', qtyBoxX + 11, qtyBoxY + 12, 'F2', 6.5, [0.616, 0.09, 0.302]);

      const qtyValStr = `x${item.qty}`;
      const qtyTextX = qtyBoxX + Math.max(8, (qtyBoxW - qtyValStr.length * 8.2) / 2);
      drawText(cmds, qtyValStr, qtyTextX, qtyBoxY + 31, 'F3', 13.5, [0.898, 0.0, 0.361]);

      const unitWord = item.qty === 1 ? 'UNIT' : 'UNITS';
      const unitX = qtyBoxX + (qtyBoxW - unitWord.length * 4.1) / 2;
      drawText(cmds, unitWord, unitX, qtyBoxY + 43, 'F2', 6.5, [0.44, 0.44, 0.48]);

      cursorY += ROW_H + ROW_GAP;
    }

    cursorY += 4;
  }

  const totalPages = pagesBodyCmds.length;

  // Assemble complete command stream for each page (Header + KPI + Body + Footer)
  const fullPageStreams: string[] = pagesBodyCmds.map((bodyCmds, pageIdx) => {
    const headerCmds: string[] = [];

    if (pageIdx === 0) {
      // Page 1 Crimson Banner
      drawFilledStrokedRect(
        headerCmds,
        MARGIN_X,
        26,
        CONTENT_W,
        62,
        [0.898, 0.0, 0.361],
        null
      );
      drawText(
        headerCmds,
        'DAISO JAPAN  |  STOCKROOM REBOX LOCATION SHEET',
        MARGIN_X + 14,
        41,
        'F2',
        8,
        [1, 0.84, 0.91]
      );
      drawText(
        headerCmds,
        params.reportTitle.slice(0, 52),
        MARGIN_X + 14,
        60,
        'F2',
        15,
        [1, 1, 1]
      );

      const metaLine = `Store: ${params.storeLabel || 'DAISO'}   |   Scope: ${params.scopeSubtitle}   |   Generated: ${generatedStr}${
        params.operatorLabel ? `   |   By: ${params.operatorLabel}` : ''
      }`;
      drawText(headerCmds, metaLine.slice(0, 96), MARGIN_X + 14, 77, 'F1', 8, [0.99, 0.93, 0.96]);

      // 3 KPI Summary Cards
      const kpiGap = 9;
      const kpiW = (CONTENT_W - kpiGap * 2) / 3;
      const kpiY = 98;
      const kpiH = 46;

      // KPI 1: Storage Boxes
      drawFilledStrokedRect(
        headerCmds,
        MARGIN_X,
        kpiY,
        kpiW,
        kpiH,
        [0.995, 0.975, 0.985],
        [0.94, 0.72, 0.83],
        0.7
      );
      drawText(headerCmds, 'STORAGE BOXES', MARGIN_X + 10, kpiY + 14, 'F2', 7.5, [
        0.45,
        0.45,
        0.5,
      ]);
      drawText(headerCmds, String(totalBoxes), MARGIN_X + 10, kpiY + 35, 'F3', 15, [
        0.898,
        0.0,
        0.361,
      ]);

      // KPI 2: Stored SKUs
      const kpi2X = MARGIN_X + kpiW + kpiGap;
      drawFilledStrokedRect(
        headerCmds,
        kpi2X,
        kpiY,
        kpiW,
        kpiH,
        [0.985, 0.985, 0.99],
        [0.86, 0.86, 0.89],
        0.7
      );
      drawText(headerCmds, 'STORED SKUS', kpi2X + 10, kpiY + 14, 'F2', 7.5, [0.45, 0.45, 0.5]);
      drawText(headerCmds, String(totalSkus), kpi2X + 10, kpiY + 35, 'F3', 15, [
        0.09,
        0.09,
        0.11,
      ]);

      // KPI 3: Total Units
      const kpi3X = kpi2X + kpiW + kpiGap;
      drawFilledStrokedRect(
        headerCmds,
        kpi3X,
        kpiY,
        kpiW,
        kpiH,
        [0.95, 0.992, 0.965],
        [0.65, 0.9, 0.74],
        0.7
      );
      drawText(headerCmds, 'TOTAL UNITS IN BOXES', kpi3X + 10, kpiY + 14, 'F2', 7.5, [
        0.45,
        0.45,
        0.5,
      ]);
      drawText(headerCmds, `${totalUnits} PCS`, kpi3X + 10, kpiY + 35, 'F3', 15, [
        0.086,
        0.639,
        0.29,
      ]);
    } else {
      // Compact continuation header on Page 2+
      drawFilledStrokedRect(
        headerCmds,
        MARGIN_X,
        26,
        CONTENT_W,
        32,
        [0.898, 0.0, 0.361],
        null
      );
      drawText(
        headerCmds,
        `${params.reportTitle} (${params.scopeSubtitle})`,
        MARGIN_X + 12,
        46,
        'F2',
        10.5,
        [1, 1, 1]
      );
      const contRight = `Page ${pageIdx + 1} of ${totalPages}`;
      drawText(
        headerCmds,
        contRight,
        PAGE_W - MARGIN_X - contRight.length * 5.2 - 12,
        46,
        'F3',
        8.5,
        [1, 0.9, 0.94]
      );
    }

    // Footer on every page
    const footerCmds: string[] = [];
    drawFilledStrokedRect(
      footerCmds,
      MARGIN_X,
      PAGE_H - 34,
      CONTENT_W,
      0.6,
      [0.86, 0.86, 0.89],
      null
    );
    drawText(
      footerCmds,
      `Daiso Japan Stockroom Rebox System  |  Store: ${params.storeLabel || 'DAISO'}`,
      MARGIN_X,
      PAGE_H - 20,
      'F1',
      7.5,
      [0.48, 0.48, 0.52]
    );
    const pageStr = `Page ${pageIdx + 1} of ${totalPages}`;
    drawText(
      footerCmds,
      pageStr,
      PAGE_W - MARGIN_X - pageStr.length * 4.8,
      PAGE_H - 20,
      'F3',
      7.8,
      [0.32, 0.32, 0.36]
    );

    return [...headerCmds, ...bodyCmds, ...footerCmds].join('\n');
  });

  // Collect unique embedded images in deterministic order
  const uniqueImages = Array.from(params.imageByKey.values());
  const firstImageObjId = 7;
  const firstPagePairObjId = firstImageObjId + uniqueImages.length;
  const totalObjects = 6 + uniqueImages.length + fullPageStreams.length * 2;

  const offsets = new Array<number>(totalObjects + 1).fill(0);
  const writer = new PdfByteWriter();

  // PDF 1.4 Header + binary marker comment
  writer.pushAscii('%PDF-1.4\n%');
  writer.pushBytes(new Uint8Array([0xff, 0xff, 0xff, 0xff]));
  writer.pushAscii('\n');

  const pageObjIds: number[] = [];
  for (let p = 0; p < fullPageStreams.length; p++) {
    pageObjIds.push(firstPagePairObjId + p * 2 + 1);
  }

  // Obj 1: Catalog
  offsets[1] = writer.byteLength;
  writer.pushAscii('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // Obj 2: Pages Tree
  offsets[2] = writer.byteLength;
  writer.pushAscii(
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjIds.length} >>\nendobj\n`
  );

  // Obj 3: Document Info
  offsets[3] = writer.byteLength;
  writer.pushAscii(
    `3 0 obj\n<< /Title (${escapePdfLiteral(params.reportTitle)}) /Creator (Daiso Inventory App) /Producer (Daiso Rebox PDF Generator) >>\nendobj\n`
  );

  // Obj 4..6: Built-in Type1 Fonts (WinAnsiEncoding)
  offsets[4] = writer.byteLength;
  writer.pushAscii(
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n'
  );

  offsets[5] = writer.byteLength;
  writer.pushAscii(
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n'
  );

  offsets[6] = writer.byteLength;
  writer.pushAscii(
    '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>\nendobj\n'
  );

  // Image XObjects
  const xObjectEntries: string[] = [];
  for (let i = 0; i < uniqueImages.length; i++) {
    const img = uniqueImages[i];
    const objId = firstImageObjId + i;
    xObjectEntries.push(`/${img.resourceName} ${objId} 0 R`);

    offsets[objId] = writer.byteLength;
    writer.pushAscii(
      `${objId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /${img.colorSpace} /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>\nstream\n`
    );
    writer.pushBytes(img.bytes);
    writer.pushAscii('\nendstream\nendobj\n');
  }

  const xObjectDict =
    xObjectEntries.length > 0 ? ` /XObject << ${xObjectEntries.join(' ')} >>` : '';

  // Page Content Streams & Page Objects
  for (let p = 0; p < fullPageStreams.length; p++) {
    const contentObjId = firstPagePairObjId + p * 2;
    const pageObjId = contentObjId + 1;
    const streamStr = fullPageStreams[p];

    offsets[contentObjId] = writer.byteLength;
    writer.pushAscii(
      `${contentObjId} 0 obj\n<< /Length ${streamStr.length} >>\nstream\n${streamStr}\nendstream\nendobj\n`
    );

    offsets[pageObjId] = writer.byteLength;
    writer.pushAscii(
      `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${fmtNum(PAGE_W)} ${fmtNum(PAGE_H)}] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >>${xObjectDict} >> /Contents ${contentObjId} 0 R >>\nendobj\n`
    );
  }

  // Cross-Reference Table (strict 20-byte entries)
  const xrefOffset = writer.byteLength;
  writer.pushAscii(`xref\n0 ${totalObjects + 1}\n`);
  writer.pushAscii('0000000000 65535 f \r\n');
  for (let id = 1; id <= totalObjects; id++) {
    writer.pushAscii(`${String(offsets[id]).padStart(10, '0')} 00000 n \r\n`);
  }

  writer.pushAscii(
    `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  );

  return {
    bytes: writer.toUint8Array(),
    pageCount: totalPages,
  };
}

/**
 * Generate a multi-page Rebox Stockroom PDF report with embedded product photos.
 */
export async function generateReboxPdf(
  options?: ReboxPdfOptions
): Promise<ReboxPdfResult & { base64: string; bytes: Uint8Array }> {
  const targetBox = options?.boxNumber ? normalizeBoxNumber(options.boxNumber) : '';

  options?.onStatus?.('Preparing rebox inventory data...');
  let sourceItems = options?.items
    ? [...options.items]
    : await fetchReboxItems({
        boxNumber: targetBox || undefined,
        storeCode: options?.storeCode,
        storeName: options?.storeName,
      });

  if (targetBox) {
    sourceItems = sourceItems.filter(
      (it) => normalizeBoxNumber(it.boxNumber).toUpperCase() === targetBox.toUpperCase()
    );
  }

  if (sourceItems.length === 0) {
    throw new Error(
      targetBox
        ? `No stored items found in ${targetBox} to export.`
        : 'No stored rebox items available to export.'
    );
  }

  // Load cached uploaded images & manifest for enrichment
  let storedImagesMap: Record<string, string> = {};
  let manifestRecords: ItemManifestRecord[] = [];
  try {
    const [rawImages, rawManifest] = await Promise.all([
      AsyncStorage.getItem(UPLOADED_ITEM_IMAGES_KEY),
      AsyncStorage.getItem(MANIFEST_ITEMS_KEY),
    ]);
    if (rawImages) storedImagesMap = JSON.parse(rawImages);
    if (rawManifest) manifestRecords = JSON.parse(rawManifest);
  } catch {}

  const mergedUploadedImages: Record<string, string> = {
    ...storedImagesMap,
    ...(options?.uploadedItemImages || {}),
  };

  let catalogItems: ProductItem[] = [];
  try {
    catalogItems = await fetchCatalog(false);
  } catch {}

  const catalogByCode = new Map<string, ProductItem>();
  for (const cat of catalogItems) {
    const nSku = normalizeCode(cat.sku);
    const nUpc = normalizeCode(cat.upc);
    if (nSku && !catalogByCode.has(nSku)) catalogByCode.set(nSku, cat);
    if (nUpc && !catalogByCode.has(nUpc)) catalogByCode.set(nUpc, cat);
  }

  const manifestByCode = new Map<string, ItemManifestRecord>();
  for (const man of manifestRecords) {
    const nSku = normalizeCode(man.sku);
    const nUpc = normalizeCode(man.upc);
    if (nSku && !manifestByCode.has(nSku)) manifestByCode.set(nSku, man);
    if (nUpc && !manifestByCode.has(nUpc)) manifestByCode.set(nUpc, man);
  }

  const enrichedItems: ReboxItem[] = sourceItems.map((it) => {
    const nSku = normalizeCode(it.sku);
    const nUpc = normalizeCode(it.upc);
    const cat =
      (nUpc ? catalogByCode.get(nUpc) : undefined) ||
      (nSku ? catalogByCode.get(nSku) : undefined);
    const man =
      (nUpc ? manifestByCode.get(nUpc) : undefined) ||
      (nSku ? manifestByCode.get(nSku) : undefined);

    return {
      ...it,
      boxNumber: normalizeBoxNumber(it.boxNumber) || 'UNASSIGNED',
      sku: it.sku || cat?.sku || man?.sku || '',
      upc: it.upc || cat?.upc || man?.upc || '',
      description: it.description || cat?.description || man?.description || '',
    };
  });

  const getItemImgKey = (it: ReboxItem): string => {
    const u = (it.upc || '').trim();
    const s = (it.sku || '').trim();
    return u ? `upc:${u}` : s ? `sku:${s}` : `id:${it.id}`;
  };

  // Deduplicate image fetches across items sharing the same UPC/SKU
  const uniqueEntriesMap = new Map<string, ReboxItem>();
  for (const it of enrichedItems) {
    const key = getItemImgKey(it);
    if (!uniqueEntriesMap.has(key)) {
      uniqueEntriesMap.set(key, it);
    }
  }

  const uniqueEntries = Array.from(uniqueEntriesMap.entries());
  const imageByKey = new Map<string, EmbeddedJpegImage>();
  const concurrency = 4;
  let completedCount = 0;

  for (let offset = 0; offset < uniqueEntries.length; offset += concurrency) {
    const batch = uniqueEntries.slice(offset, offset + concurrency);
    options?.onStatus?.(
      `Fetching item photos (${Math.min(uniqueEntries.length, offset + 1)}/${uniqueEntries.length})...`
    );

    const results = await Promise.all(
      batch.map(async ([key, representativeItem], batchIdx) => {
        const resolved = await resolveItemPdfImage(
          representativeItem,
          mergedUploadedImages,
          offset + batchIdx
        );
        completedCount++;
        return { key, resolved };
      })
    );

    for (const { key, resolved } of results) {
      if (resolved) {
        imageByKey.set(key, {
          ...resolved,
          resourceName: `Im${imageByKey.size}`,
        });
      }
    }

    if (completedCount === uniqueEntries.length) {
      options?.onStatus?.('Generating PDF pages...');
    }
  }

  const now = new Date();
  const datePart = now.toISOString().slice(0, 10);
  const resolvedStore = resolveStoreCode(options?.storeCode, options?.storeName);
  const storeDisplay =
    options?.storeName && options?.storeCode
      ? `${options.storeCode} - ${options.storeName}`
      : options?.storeName || resolvedStore || 'DAISO';

  const uniqueBoxSet = new Set(enrichedItems.map((i) => i.boxNumber));
  const totalUnits = enrichedItems.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);

  const reportTitle =
    options?.title ||
    (targetBox ? `REBOX INVENTORY - ${targetBox}` : 'STOCKROOM REBOX INVENTORY REPORT');
  const scopeSubtitle = targetBox ? targetBox : `All Boxes (${uniqueBoxSet.size})`;

  const { bytes, pageCount } = buildReboxPdfBytes({
    items: enrichedItems,
    imageByKey,
    getImageKey: getItemImgKey,
    reportTitle,
    scopeSubtitle,
    storeLabel: storeDisplay,
    operatorLabel: options?.operatorId || undefined,
    generatedAt: now,
  });

  const base64 = uint8ArrayToBase64(bytes);
  const safeStoreSlug = (resolvedStore || 'STORE').replace(/[^a-zA-Z0-9_-]/g, '');
  const safeScopeSlug = targetBox
    ? targetBox.replace(/[^a-zA-Z0-9_-]/g, '')
    : 'AllBoxes';
  const fileName = `Rebox_${safeScopeSlug}_${safeStoreSlug}_${datePart}.pdf`;

  let uri = fileName;
  if (Platform.OS !== 'web') {
    const outDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
    uri = `${outDir}${fileName}`;
    await FileSystem.writeAsStringAsync(uri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

  return {
    uri,
    fileName,
    base64,
    bytes,
    itemCount: enrichedItems.length,
    boxCount: uniqueBoxSet.size,
    totalUnits,
    imagesEmbedded: imageByKey.size,
    pageCount,
  };
}

async function savePdfBase64ViaAndroidSaf(
  fileName: string,
  base64Data: string
): Promise<{ safUri: string | null; cancelled: boolean }> {
  const saf = FileSystem.StorageAccessFramework;
  if (!saf) {
    return { safUri: null, cancelled: false };
  }

  const baseNameWithoutExt = fileName.replace(/\.pdf$/i, '');

  const tryWriteToDir = async (dirUri: string): Promise<string | null> => {
    try {
      const targetUri = await saf.createFileAsync(dirUri, baseNameWithoutExt, 'application/pdf');
      await FileSystem.writeAsStringAsync(targetUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return targetUri;
    } catch {
      return null;
    }
  };

  // 1. Try cached granted folder first for 1-tap instant downloads
  try {
    const cachedDirUri = await AsyncStorage.getItem(REBOX_PDF_SAVE_DIR_KEY);
    if (cachedDirUri) {
      const written = await tryWriteToDir(cachedDirUri);
      if (written) {
        return { safUri: written, cancelled: false };
      }
      await AsyncStorage.removeItem(REBOX_PDF_SAVE_DIR_KEY);
    }
  } catch {}

  // 2. Request directory permission starting in Android's Documents folder (allowed on Android 11+ Scoped Storage)
  let initialUri: string | undefined;
  try {
    initialUri = saf.getUriForDirectoryInRoot('Documents');
  } catch {}

  const perm = await saf.requestDirectoryPermissionsAsync(initialUri);
  if (!perm.granted || !perm.directoryUri) {
    return { safUri: null, cancelled: true };
  }

  try {
    await AsyncStorage.setItem(REBOX_PDF_SAVE_DIR_KEY, perm.directoryUri);
  } catch {}

  const createdUri = await tryWriteToDir(perm.directoryUri);
  if (!createdUri) {
    throw new Error('Could not write PDF file to the selected device folder.');
  }
  return { safUri: createdUri, cancelled: false };
}

/**
 * Generate and download/share a Rebox PDF document containing item photos, SKU/UPC, box locations, and quantities.
 */
export async function downloadReboxPdf(options?: ReboxPdfOptions): Promise<ReboxPdfResult> {
  const generated = await generateReboxPdf(options);
  let finalUri = generated.uri;
  let savedToDevice = false;
  let cancelled = false;

  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined' && typeof Blob !== 'undefined') {
      const pdfArrayBuffer = generated.bytes.buffer.slice(
        generated.bytes.byteOffset,
        generated.bytes.byteOffset + generated.bytes.byteLength
      ) as ArrayBuffer;
      const blob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', generated.fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      savedToDevice = true;
    }
  } else if (Platform.OS === 'android' && options?.action === 'save_to_device') {
    options?.onStatus?.('Saving PDF to phone folder...');
    const safRes = await savePdfBase64ViaAndroidSaf(generated.fileName, generated.base64);
    if (safRes.cancelled) {
      cancelled = true;
    } else if (safRes.safUri) {
      finalUri = safRes.safUri;
      savedToDevice = true;
    } else if (!options?.skipShareSheet && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(generated.uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Download ${generated.fileName}`,
        UTI: 'com.adobe.pdf',
      });
    }
  } else if (!options?.skipShareSheet) {
    options?.onStatus?.('Opening PDF download / share sheet...');
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(generated.uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Download ${generated.fileName}`,
        UTI: 'com.adobe.pdf',
      });
    }
  }

  return {
    uri: finalUri,
    fileName: generated.fileName,
    itemCount: generated.itemCount,
    boxCount: generated.boxCount,
    totalUnits: generated.totalUnits,
    imagesEmbedded: generated.imagesEmbedded,
    pageCount: generated.pageCount,
    savedToDevice,
    cancelled,
  };
}
