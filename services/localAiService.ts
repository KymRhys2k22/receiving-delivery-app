import AsyncStorage from '@react-native-async-storage/async-storage';
import { type LlamaContext } from 'llama.rn';
import {
  supabase,
  fetchCatalog,
  fetchSupabaseDlrRecords,
  type ProductItem,
  type SupabaseDLRRow,
  OPEN_SHEET_URL,
} from '../utils/dlr';
import {
  type ItemManifestRecord,
  MANIFEST_ITEMS_KEY,
  MANIFEST_CIDS_KEY,
  SCANNED_ITEMS_KEY,
  SCANNED_CIDS_KEY,
} from '../utils/storage';

export interface DaizoDataset {
  manifestItems: ItemManifestRecord[];
  manifestCids: string[];
  scannedItems: Record<string, number>;
  scannedCids: string[];
  catalog: ProductItem[];
  dlrRecords: SupabaseDLRRow[];
  lastLoadedAt: number;
}

let activeDaizoDataset: DaizoDataset | null = null;

export function getCachedDaizoDataset(): DaizoDataset | null {
  return activeDaizoDataset;
}

export function setCachedDaizoDataset(data: DaizoDataset): void {
  activeDaizoDataset = data;
}

/**
 * Fetch and assemble all 3 datasets:
 * 1. Uploaded Manifest CSV (CID, TRF, UPC, SKU, DESCRIPTION, QTY) from AsyncStorage
 * 2. Product Catalog from OpenSheet URL (with offline AsyncStorage fallback)
 * 3. Item DLR records from Supabase (with offline AsyncStorage fallback)
 */
export async function fetchDaizoFullDataset(
  onProgress?: (status: string) => void
): Promise<DaizoDataset> {
  onProgress?.('Loading Manifest CSV records...');

  // 1. Load Local Manifest CSV and Scanning state
  let manifestItems: ItemManifestRecord[] = [];
  let manifestCids: string[] = [];
  let scannedItems: Record<string, number> = {};
  let scannedCids: string[] = [];

  try {
    const rawItems = await AsyncStorage.getItem(MANIFEST_ITEMS_KEY);
    if (rawItems) {
      manifestItems = JSON.parse(rawItems) || [];
    }
  } catch (err) {
    console.warn('[localAiService] Error reading manifest_items:', err);
  }

  try {
    const rawCids = await AsyncStorage.getItem(MANIFEST_CIDS_KEY);
    if (rawCids) {
      manifestCids = JSON.parse(rawCids) || [];
    }
  } catch (err) {
    console.warn('[localAiService] Error reading manifest_cids:', err);
  }

  try {
    const rawScannedItems = await AsyncStorage.getItem(SCANNED_ITEMS_KEY);
    if (rawScannedItems) {
      scannedItems = JSON.parse(rawScannedItems) || {};
    }
  } catch (err) {
    console.warn('[localAiService] Error reading scanned_items:', err);
  }

  try {
    const rawScannedCids = await AsyncStorage.getItem(SCANNED_CIDS_KEY);
    if (rawScannedCids) {
      scannedCids = JSON.parse(rawScannedCids) || [];
    }
  } catch (err) {
    console.warn('[localAiService] Error reading scanned_cids:', err);
  }

  // 2. Fetch OpenSheet Product Catalog
  onProgress?.('Fetching Product Catalog...');
  let catalog: ProductItem[] = [];
  try {
    catalog = await fetchCatalog(true);
    // Cache for offline usage
    if (catalog.length > 0) {
      AsyncStorage.setItem('cached_inventory_catalog', JSON.stringify(catalog)).catch(() => {});
    }
  } catch (sheetErr) {
    console.warn('[localAiService] OpenSheet fetch failed, checking offline cache:', sheetErr);
    try {
      const cached = await AsyncStorage.getItem('cached_inventory_catalog');
      if (cached) {
        catalog = JSON.parse(cached) || [];
      }
    } catch {}
  }

  // 3. Fetch Supabase DLR Records
  onProgress?.('Fetching Item DLR records...');
  let dlrRecords: SupabaseDLRRow[] = [];
  try {
    dlrRecords = await fetchSupabaseDlrRecords(200);
    // Cache for offline usage
    if (dlrRecords.length > 0) {
      AsyncStorage.setItem('cached_supabase_dlr_records', JSON.stringify(dlrRecords)).catch(() => {});
    }
  } catch (supaErr) {
    console.warn('[localAiService] Supabase fetch failed, checking offline cache:', supaErr);
    try {
      const cached = await AsyncStorage.getItem('cached_supabase_dlr_records');
      if (cached) {
        dlrRecords = JSON.parse(cached) || [];
      }
    } catch {}
  }

  const dataset: DaizoDataset = {
    manifestItems,
    manifestCids,
    scannedItems,
    scannedCids,
    catalog,
    dlrRecords,
    lastLoadedAt: Date.now(),
  };

  activeDaizoDataset = dataset;
  onProgress?.('Daizo is ready');
  return dataset;
}

export interface QueryOptions {
  supabaseTable?: string;
  supabaseFields?: string;
  supabaseLimit?: number;
  localStorageKeys?: string[];
  dataset?: DaizoDataset | null;
  onStreamToken?: (token: string) => void;
}

/**
 * Intelligent hybrid query answering across Manifest CSV, Product Catalog, and Item DLR
 */
export async function askLocalHybridAssistant(
  question: string,
  llamaContext?: LlamaContext | null,
  options?: QueryOptions
): Promise<string> {
  const { onStreamToken } = options || {};

  // Ensure dataset is available
  let dataset = options?.dataset || activeDaizoDataset;
  if (!dataset) {
    dataset = await fetchDaizoFullDataset();
  }

  const {
    manifestItems = [],
    manifestCids = [],
    scannedItems = {},
    scannedCids = [],
    catalog = [],
    dlrRecords = [],
  } = dataset;

  // 1. If native llama context is active, run SmolLM2 on-device inference with scoped data
  if (llamaContext) {
    // Find relevant context slices to keep prompt bounded under context window
    const qLower = question.toLowerCase();
    const relevantManifest = manifestItems.filter(
      (m) =>
        (m.cid && qLower.includes(m.cid.toLowerCase())) ||
        (m.sku && qLower.includes(m.sku.toLowerCase())) ||
        (m.upc && qLower.includes(m.upc.toLowerCase())) ||
        (m.trf && qLower.includes(m.trf.toLowerCase())) ||
        (m.description && qLower.includes(m.description.toLowerCase().slice(0, 5)))
    ).slice(0, 10);

    const relevantCatalog = catalog.filter(
      (c) =>
        (c.sku && qLower.includes(c.sku.toLowerCase())) ||
        (c.upc && qLower.includes(c.upc.toLowerCase())) ||
        (c.description && qLower.includes(c.description.toLowerCase().slice(0, 5)))
    ).slice(0, 8);

    const relevantDlr = dlrRecords.filter(
      (d) =>
        (d.SKU && qLower.includes(d.SKU.toLowerCase())) ||
        (d.Reason && qLower.includes(d.Reason.toLowerCase())) ||
        (d['Store Code'] && qLower.includes(String(d['Store Code']).toLowerCase()))
    ).slice(0, 8);

    const prompt = `<|im_start|>system
You are Daizo, the friendly and polite AI assistant for Daiso Japan store receiving, delivery, and inventory.
You understand English, Tagalog, and Taglish.
Rules:
- Speak in friendly, polite Taglish (Tagalog-English mix) or English matching the user's message.
- When greeted, reply warmly: "Konnichiwa! Kamusta po! Ako si Daizo. Ano po ang maitutulong ko sa inyo dito sa Daiso Japan?"
- Give concise, direct answers with markdown bullet points.
- Cross-reference Manifest CSV, Product Catalog, and Item DLR records when relevant.
- If data is not found in records, reply warmly and naturally in Taglish: "Konnichiwa! Pasensya na po, hindi ko nahanap ang record sa ating system. Baka may kaunting typo sa SKU, UPC, o CID? Ano po ang maitutulong ko sa inyo sa Daiso Japan?"

--- UPLOADED MANIFEST CSV (CID, TRF, UPC, SKU, DESCRIPTION, QTY) ---
${JSON.stringify(
  relevantManifest.length > 0
    ? relevantManifest
    : { totalManifestBoxes: manifestCids.length, totalManifestItems: manifestItems.length },
  null,
  2
)}

--- PRODUCT CATALOG (Price, Cost, Dept) ---
${JSON.stringify(relevantCatalog.slice(0, 5), null, 2)}

--- ITEM DLR RECORDS (Damage/Loss Reports) ---
${JSON.stringify(relevantDlr.slice(0, 5), null, 2)}
<|im_end|>
<|im_start|>user
${question}<|im_end|>
<|im_start|>assistant
`;

    let generatedAnswer = '';
    try {
      await llamaContext.completion(
        {
          prompt,
          n_predict: 160,
          temperature: 0.1,
          stop: ['<|im_start|>', '<|im_end|>', '<|endoftext|>'],
        },
        (tokenData) => {
          generatedAnswer += tokenData.token;
          if (onStreamToken) {
            onStreamToken(tokenData.token);
          }
        }
      );
      return generatedAnswer.trim();
    } catch (inferenceErr) {
      console.error('[localAiService] Inference error:', inferenceErr);
    }
  }

  // 2. Comprehensive Hybrid Processor (Instant, deterministic, and accurate)
  const answer = processHybridDaizoQuery(question, dataset);

  // Stream tokens for snappy responsive UX
  const words = answer.split(' ');
  for (let i = 0; i < words.length; i++) {
    const token = (i === 0 ? '' : ' ') + words[i];
    if (onStreamToken) {
      onStreamToken(token);
    }
    await new Promise((resolve) => setTimeout(resolve, 15));
  }

  return answer;
}

/**
 * Deterministic multi-source query analyzer across Manifest CSV, Catalog, and DLR
 * Fully supports Tagalog, Filipino, Taglish, and English inquiries.
 */
function processHybridDaizoQuery(query: string, dataset: DaizoDataset): string {
  const {
    manifestItems = [],
    manifestCids = [],
    scannedItems = {},
    scannedCids = [],
    catalog = [],
    dlrRecords = [],
  } = dataset;

  const qTrim = query.trim();
  const qLower = qTrim.toLowerCase();

  // ----------------------------------------------------
  // A. Friendly Greetings & Intro (Tagalog, Taglish, Japanese, English)
  // ----------------------------------------------------
  const greetingKeywords = [
    'hi',
    'hello',
    'hey',
    'kamusta',
    'kumusta',
    'musta',
    'kusta',
    'konnichiwa',
    'kunchiwa',
    'konichiwa',
    'magandang umaga',
    'magandang hapon',
    'magandang gabi',
    'magandang araw',
    'good morning',
    'good afternoon',
    'good evening',
    'ano maitutulong',
    'ano ang maitutulong',
    'sino ka',
    'who are you',
  ];

  const hasGreeting = greetingKeywords.some((g) => qLower.includes(g));
  const hasSpecificQuery =
    qLower.includes('sku') ||
    qLower.includes('upc') ||
    qLower.includes('cid') ||
    qLower.includes('trf') ||
    qLower.includes('dlr') ||
    qLower.includes('damage') ||
    qLower.includes('sira') ||
    qLower.includes('presyo') ||
    qLower.includes('magkano') ||
    qLower.includes('price') ||
    qLower.includes('unscanned') ||
    qLower.includes('manifest');

  if (hasGreeting && !hasSpecificQuery) {
    return `### 🌸 Konnichiwa! Kamusta po!
Ako si **Daizo**, ang iyong AI assistant para sa receiving & inventory dito sa **Daiso Japan**.

Ano po ang maitutulong ko sa inyo ngayon? Narito ang mga puwede mong itanong sa akin:
- 📦 **Laman ng Box o CID:** \`Anong laman ng CID 001?\` o \`Ilan pa ang unscanned boxes?\`
- 🔍 **Presyo at SKU Info:** \`Magkano ang SKU 300333?\` o \`Check price ng UPC ...\`
- 📄 **TRF Lookup:** \`Show items for TRF 101\`
- ⚠️ **Defects & Damages:** \`Summarize Item DLR\` o \`May sirang gamit ba?\`
- 📊 **Kabuuang Status:** \`Manifest CSV summary\`

Sabihin mo lang kung anong kailangan mong i-check! 😊`;
  }

  // ----------------------------------------------------
  // B. Check for CID / Box Query (e.g. "CID 001", "box 123", "kahon 10", "laman ng CID...")
  // ----------------------------------------------------
  const cidRegex = /(?:cid|box|kahon)\s*(?:no\.?|#)?\s*([a-z0-9\-_]+)/i;
  const cidMatch = qTrim.match(cidRegex);
  const rawCid = cidMatch ? cidMatch[1] : null;

  if (rawCid) {
    const matchingItems = manifestItems.filter(
      (item) => item.cid && item.cid.toLowerCase() === rawCid.toLowerCase()
    );

    if (matchingItems.length > 0) {
      const isScanned = scannedCids.includes(matchingItems[0].cid);
      const totalQty = matchingItems.reduce((sum, it) => sum + (Number(it.qty) || 1), 0);
      const trf = matchingItems[0].trf || 'N/A';

      const itemsListStr = matchingItems
        .slice(0, 5)
        .map(
          (it, idx) =>
            `- **${idx + 1}.** SKU \`${it.sku}\` — **Qty:** \`${it.qty}\`\n  *${it.description || 'No Description'}*`
        )
        .join('\n');

      const extraCount =
        matchingItems.length > 5 ? `\n- *... at ${matchingItems.length - 5} pang item(s)*` : '';

      return `### 📦 Manifest Data: CID \`${matchingItems[0].cid}\`
- **TRF:** \`${trf}\`
- **Status:** \`${isScanned ? '✅ Scanned (Na-scan na)' : '⏳ Unscanned (Hindi pa na-scan)'}\`
- **Kabuuang Items:** **${matchingItems.length}** line items (**${totalQty}** kabuuang units)

#### 📋 Mga Laman (Contents):
${itemsListStr}${extraCount}`;
    }
  }

  // ----------------------------------------------------
  // C. Check for TRF Query (e.g. "TRF 123", "TRF NO 123")
  // ----------------------------------------------------
  const trfRegex = /(?:trf)\s*(?:no\.?|#)?\s*([a-z0-9\-_]+)/i;
  const trfMatch = qTrim.match(trfRegex);
  const rawTrf = trfMatch ? trfMatch[1] : null;

  if (rawTrf) {
    const matchingItems = manifestItems.filter(
      (item) => item.trf && item.trf.toLowerCase() === rawTrf.toLowerCase()
    );

    if (matchingItems.length > 0) {
      const uniqueCids = Array.from(new Set(matchingItems.map((it) => it.cid)));
      const totalQty = matchingItems.reduce((sum, it) => sum + (Number(it.qty) || 1), 0);

      return `### 📄 Manifest Data: TRF \`${matchingItems[0].trf}\`
- **Kabuuang Items:** **${matchingItems.length}** line items
- **Kabuuang Quantity:** **${totalQty}** units
- **Kaugnay na CID (${uniqueCids.length}):** \`${uniqueCids
        .slice(0, 6)
        .join('`, `')}\`${uniqueCids.length > 6 ? '...' : ''}`;
    }
  }

  // ----------------------------------------------------
  // D. Check for SKU, UPC, Price, or Cost lookup (e.g. "magkano", "presyo", "sku", "upc")
  // ----------------------------------------------------
  const isPriceQuery =
    qLower.includes('sku') ||
    qLower.includes('upc') ||
    qLower.includes('price') ||
    qLower.includes('cost') ||
    qLower.includes('magkano') ||
    qLower.includes('presyo') ||
    qLower.includes('halaga') ||
    qLower.includes('kano');

  const codeMatch = qTrim.match(/\b(\d{5,14})\b/);
  const potentialCode = codeMatch ? codeMatch[1] : null;

  if (potentialCode || isPriceQuery) {
    const targetCode = potentialCode || qTrim.replace(/[^0-9]/g, '');

    if (targetCode && targetCode.length >= 4) {
      // 1. Search Manifest CSV
      const inManifest = manifestItems.filter(
        (it) => it.sku === targetCode || it.upc === targetCode
      );

      // 2. Search Product Catalog
      const inCatalog = catalog.find(
        (c) => c.sku === targetCode || c.upc === targetCode
      );

      // 3. Search Item DLR Records
      const inDlr = dlrRecords.filter(
        (d) => d.SKU === targetCode || d.UPC === targetCode
      );

      if (inManifest.length > 0 || inCatalog || inDlr.length > 0) {
        let result = `### 🔍 Item Lookup: \`${targetCode}\`\n`;

        // Catalog Details
        if (inCatalog) {
          result += `\n#### 📋 Product Catalog\n- **Description:** *${inCatalog.description}*\n- **Presyo (SRP):** \`₱${inCatalog.price || 'N/A'}\` | **Cost:** \`₱${inCatalog.cost || 'N/A'}\`\n- **Dept:** ${inCatalog.departmentName || inCatalog.departmentCode || 'N/A'}${inCatalog.subDepartmentName ? ` *(${inCatalog.subDepartmentName})*` : ''}\n`;
        }

        // Manifest Details
        if (inManifest.length > 0) {
          const totalQty = inManifest.reduce((sum, it) => sum + (Number(it.qty) || 1), 0);
          const cids = Array.from(new Set(inManifest.map((it) => it.cid))).join('`, `');
          const scannedCount = scannedItems[targetCode] || 0;
          result += `\n#### 📦 Uploaded Manifest CSV\n- **Description:** *${inManifest[0].description}*\n- **Kabuuang Manifest Qty:** **${totalQty}** units\n- **Na-scan na:** **${scannedCount}** units\n- **Nasa CID(s):** \`${cids}\`\n- **TRF:** \`${inManifest[0].trf || 'N/A'}\`\n`;
        } else {
          result += `\n#### 📦 Uploaded Manifest CSV\n> Hindi nakita sa active manifest items.\n`;
        }

        // DLR Details
        if (inDlr.length > 0) {
          result += `\n#### ⚠️ Item DLR Records (${inDlr.length} naka-log)\n`;
          inDlr.slice(0, 3).forEach((d, i) => {
            result += `- **${i + 1}.** Dahilan: \`${d.Reason || 'Reported'}\` | Qty: **${d.Qty}** | Store: \`${d['Store Code'] || 'N/A'}\`\n`;
          });
        }

        return result.trim();
      }
    }
  }

  // ----------------------------------------------------
  // E. Keyword search in Manifest / Catalog Descriptions
  // ----------------------------------------------------
  const searchKeywords = qLower
    .replace(
      /\b(what|is|the|are|how|many|find|search|lookup|item|items|in|of|for|anong|ano|ang|mga|paki|pakihanap|tingnan|patingin|meron|ba|sa|may|ilan|pa|yung|na|presyo|magkano)\b/g,
      ''
    )
    .replace(/[^a-z0-9\s]/g, '')
    .trim();

  if (
    searchKeywords.length >= 3 &&
    !qLower.includes('dlr') &&
    !qLower.includes('unscanned') &&
    !qLower.includes('sira') &&
    !qLower.includes('damage')
  ) {
    const matchingManifest = manifestItems.filter(
      (m) => m.description && m.description.toLowerCase().includes(searchKeywords)
    );

    const matchingCatalog = catalog.filter(
      (c) => c.description && c.description.toLowerCase().includes(searchKeywords)
    );

    if (matchingManifest.length > 0 || matchingCatalog.length > 0) {
      let result = `### 🔎 Search Results para sa "${searchKeywords}"\n`;

      if (matchingManifest.length > 0) {
        result += `\n#### 📦 Uploaded Manifest CSV (${matchingManifest.length} items)\n`;
        matchingManifest.slice(0, 3).forEach((m, idx) => {
          result += `- **${idx + 1}.** SKU \`${m.sku}\` | CID \`${m.cid}\` | Qty: **${m.qty}**\n  *${m.description}*\n`;
        });
      }

      if (matchingCatalog.length > 0) {
        result += `\n#### 📋 Product Catalog (${matchingCatalog.length} products)\n`;
        matchingCatalog.slice(0, 3).forEach((c, idx) => {
          result += `- **${idx + 1}.** SKU \`${c.sku}\` | \`₱${c.price || 'N/A'}\`\n  *${c.description}*\n`;
        });
      }

      return result.trim();
    }
  }

  // ----------------------------------------------------
  // F. Item DLR Summary or Reason Query (Tagalog: sira, basag, depekto, tapon, damage)
  // ----------------------------------------------------
  if (
    qLower.includes('dlr') ||
    qLower.includes('damage') ||
    qLower.includes('lost') ||
    qLower.includes('defect') ||
    qLower.includes('sira') ||
    qLower.includes('basag') ||
    qLower.includes('depekto') ||
    qLower.includes('tapon')
  ) {
    const totalDlr = dlrRecords.length;
    if (totalDlr === 0) {
      return `### ⚠️ Item DLR Records\n> Walang naka-log na DLR records sa table \`dlr_records\`.`;
    }

    // Tally by reason
    const reasonCounts: Record<string, number> = {};
    dlrRecords.forEach((r) => {
      const rName = r.Reason || 'Unspecified';
      reasonCounts[rName] = (reasonCounts[rName] || 0) + (Number(r.Qty) || 1);
    });

    const topReasons = Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([reason, count]) => `- **${reason}:** ${count} units`)
      .join('\n');

    const recentSamples = dlrRecords
      .slice(0, 3)
      .map((r, i) => `- **${i + 1}.** SKU \`${r.SKU}\` (\`${r.Reason}\`) — Store \`${r['Store Code'] || 'N/A'}\``)
      .join('\n');

    return `### ⚠️ Item DLR Summary
- **Kabuuang DLR Entries:** **${totalDlr}** records

#### 🚨 Nangungunang Defect Reasons
${topReasons}

#### 🕒 Kamakailang Naisumite (Recent Submissions)
${recentSamples}`;
  }

  // ----------------------------------------------------
  // G. Box / Item Manifest Summary or Unscanned Query (Tagalog: ilan, kulang, natira, kahon, buod)
  // ----------------------------------------------------
  if (
    qLower.includes('unscanned') ||
    qLower.includes('manifest') ||
    qLower.includes('summary') ||
    qLower.includes('box') ||
    qLower.includes('kahon') ||
    qLower.includes('ilan') ||
    qLower.includes('kulang') ||
    qLower.includes('natira') ||
    qLower.includes('natitira') ||
    qLower.includes('buod') ||
    qLower.includes('progress')
  ) {
    const totalBoxes = manifestCids.length;
    const scannedBoxes = scannedCids.length;
    const remainingBoxes = Math.max(0, totalBoxes - scannedBoxes);

    const totalManifestItems = manifestItems.length;
    const totalManifestQty = manifestItems.reduce((sum, it) => sum + (Number(it.qty) || 1), 0);
    const scannedItemsCount = Object.values(scannedItems).reduce((sum, count) => sum + count, 0);

    return `### 📊 Receiving Manifest Overview
- **Kahon / Boxes:** **${scannedBoxes} / ${totalBoxes}** na-scan (\`${remainingBoxes}\` hindi pa na-scan)
- **Mga Item:** **${totalManifestItems}** line items (**${totalManifestQty}** kabuuang units)
- **Na-scan na Items:** **${scannedItemsCount}** units
- **Product Catalog:** **${catalog.length.toLocaleString()}** products loaded
- **Item DLR:** **${dlrRecords.length}** records available`;
  }

  // ----------------------------------------------------
  // H. Store Info Query
  // ----------------------------------------------------
  if (qLower.includes('store') || qLower.includes('operator') || qLower.includes('tindahan')) {
    return `### 🏪 Store Terminal
- Official Store Directory loaded mula sa \`store.json\`
- Product Catalog active: **${catalog.length.toLocaleString()}** items
- Magtanong lang tungkol sa anumang SKU, UPC, CID, o TRF sa iyong uploaded manifest!`;
  }

  // ----------------------------------------------------
  // I. Warm & Natural Fallback with Taglish guidance
  // ----------------------------------------------------
  return `### 🌸 Konnichiwa! Kamusta po!
Pasensya na po, **hindi ko nahanap ang record** para dyan sa ating Manifest CSV, Product Catalog, o Item DLR records.

Baka may kaunting typo sa SKU, UPC, o CID? Narito ang mga puwede mong itanong sa akin:
- 📦 **Alamin ang laman ng box:** \`Anong laman ng CID 001?\`
- 📊 **Status ng receiving:** \`Ilan pa ang unscanned boxes?\` o \`Manifest CSV summary\`
- 🔍 **Presyo o detalye ng item:** \`Magkano ang SKU 300333?\` o \`Look up item sa catalog\`
- 📄 **TRF Lookup:** \`Show items for TRF 101\`
- ⚠️ **Defects & Damages:** \`Summarize Item DLR\` o \`May sirang gamit ba?\`

Ano po ang maitutulong ko sa inyo dito sa **Daiso Japan**? 😊`;
}
