// ============================================================
//  OrderFlow ↔ Google Sheets — Two-Way Sync
//  Paste this entire file into Extensions → Apps Script → Code.gs
// ============================================================

// ── CONFIGURATION (fill these in) ───────────────────────────
const SUPABASE_URL = 'https://eszktnsfpoqvbybtmxft.supabase.co';
const SUPABASE_KEY = 'YOUR_SUPABASE_SERVICE_ROLE_KEY'; // ← paste service role key
const SHEET_NAME   = 'Sheet1';                          // ← your sheet tab name
// ────────────────────────────────────────────────────────────

// Column index map (0-based, matches sheet layout A–M)
const COL = {
  id:            0,  // A — UUID, read-only. Empty = new row.
  order_no:      1,  // B
  customer_name: 2,  // C
  category_name: 3,  // D — human-readable; script resolves ↔ UUID
  date:          4,  // E
  due_date:      5,  // F
  dispatch_date: 6,  // G
  length:        7,  // H
  width:         8,  // I
  qty:           9,  // J
  description:  10,  // K
  status:       11,  // L
  created_at:   12,  // M — auto-filled, read-only
};

const TOTAL_COLS = 13; // A through M

// ============================================================
//  CATEGORY HELPERS
// ============================================================

/** Fetch all categories from Supabase. Returns [{id, name}, ...] */
function getCategories_() {
  const res = UrlFetchApp.fetch(
    `${SUPABASE_URL}/rest/v1/categories?select=id,name&order=name`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
      muteHttpExceptions: true,
    }
  );
  if (res.getResponseCode() !== 200) {
    throw new Error(`Failed to fetch categories: ${res.getContentText()}`);
  }
  return JSON.parse(res.getContentText());
}

/** Resolve category name → UUID (case-insensitive). Returns null if not found. */
function nameToId_(name, categories) {
  if (!name) return null;
  const norm  = String(name).trim().toLowerCase();
  const match = categories.find(c => c.name.trim().toLowerCase() === norm);
  return match ? match.id : null;
}

/** Resolve category UUID → display name. Falls back to UUID if not found. */
function idToName_(id, categories) {
  if (!id) return '';
  const match = categories.find(c => c.id === id);
  return match ? match.name : String(id); // graceful fallback
}

// ============================================================
//  DIRECTION 1: Supabase → Sheet
//  Called by the Supabase Database Webhook (doPost)
// ============================================================

/**
 * Receives POST from Supabase Database Webhook.
 * Payload shape: { type: 'INSERT'|'UPDATE'|'DELETE', record: {...}, old_record: {...} }
 */
function doPost(e) {
  try {
    const payload   = JSON.parse(e.postData.contents);
    const type      = payload.type;        // INSERT | UPDATE | DELETE
    const record    = payload.record;      // new/current row
    const oldRecord = payload.old_record;  // previous row (for DELETE/UPDATE)

    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    const cats  = getCategories_();

    if (type === 'INSERT') {
      appendOrderRow_(sheet, record, cats);
    } else if (type === 'UPDATE') {
      updateOrderRow_(sheet, record, cats);
    } else if (type === 'DELETE') {
      deleteOrderRow_(sheet, oldRecord.id);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', type }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log('doPost error: ' + err.message);
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function appendOrderRow_(sheet, record, cats) {
  sheet.appendRow(orderToRow_(record, cats));
}

function updateOrderRow_(sheet, record, cats) {
  const rowIdx = findRowById_(sheet, record.id);
  if (rowIdx === -1) {
    // Doesn't exist in sheet yet — append
    appendOrderRow_(sheet, record, cats);
  } else {
    sheet.getRange(rowIdx, 1, 1, TOTAL_COLS).setValues([orderToRow_(record, cats)]);
  }
}

function deleteOrderRow_(sheet, id) {
  const rowIdx = findRowById_(sheet, id);
  if (rowIdx !== -1) sheet.deleteRow(rowIdx);
}

/** Convert a Supabase order record to a sheet row array (A–M). */
function orderToRow_(record, cats) {
  return [
    record.id            || '',
    record.order_no      || '',
    record.customer_name || '',
    idToName_(record.category_id, cats),
    record.date          || '',
    record.due_date      || '',
    record.dispatch_date || '',
    record.length        != null ? record.length : '',
    record.width         != null ? record.width  : '',
    record.qty           != null ? record.qty    : '',
    record.description   || '',
    record.status        || 'Pending',
    record.created_at    || '',
  ];
}

/**
 * Find the 1-based row index of an order by its UUID in column A.
 * Returns -1 if not found.
 */
function findRowById_(sheet, id) {
  if (!id) return -1;
  const colA = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 1).getValues();
  for (let i = 0; i < colA.length; i++) {
    if (String(colA[i][0]).trim() === String(id).trim()) return i + 2; // +2 for header + 0-index
  }
  return -1;
}

// ============================================================
//  DIRECTION 2: Sheet → Supabase
//  Called by "Sync to App ↑" menu item / button
// ============================================================

/**
 * Batch sync all rows in the sheet to Supabase.
 * - Row with empty col A (id) → POST (create new order)
 * - Row with UUID in col A    → PATCH (update existing order)
 * - After POST, writes returned UUID back into col A
 */
function syncToSupabase() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  const data  = sheet.getDataRange().getValues();
  const cats  = getCategories_();

  let inserted = 0;
  let updated  = 0;
  const errors = [];

  for (let i = 1; i < data.length; i++) { // skip header row
    const row = data[i];

    // Skip rows where both order_no and customer_name are empty
    const orderNo      = String(row[COL.order_no]      || '').trim();
    const customerName = String(row[COL.customer_name] || '').trim();
    if (!orderNo && !customerName) continue;

    const id           = String(row[COL.id] || '').trim();
    const categoryName = String(row[COL.category_name] || '').trim();
    const categoryId   = nameToId_(categoryName, cats);

    if (!categoryId) {
      errors.push(`Row ${i + 1}: Unknown category "${categoryName}" — skipped`);
      continue;
    }

    const payload = buildPayload_(row, categoryId);

    try {
      if (id) {
        // PATCH — update existing order
        const res = UrlFetchApp.fetch(
          `${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(id)}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation',
            },
            payload: JSON.stringify(payload),
            muteHttpExceptions: true,
          }
        );
        const code = res.getResponseCode();
        if (code < 200 || code >= 300) {
          errors.push(`Row ${i + 1} (PATCH): HTTP ${code} — ${res.getContentText()}`);
        } else {
          updated++;
        }
      } else {
        // POST — create new order
        const res = UrlFetchApp.fetch(
          `${SUPABASE_URL}/rest/v1/orders`,
          {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation',
            },
            payload: JSON.stringify(payload),
            muteHttpExceptions: true,
          }
        );
        const code = res.getResponseCode();
        if (code < 200 || code >= 300) {
          errors.push(`Row ${i + 1} (POST): HTTP ${code} — ${res.getContentText()}`);
        } else {
          const created = JSON.parse(res.getContentText());
          if (created && created[0] && created[0].id) {
            // Write the new UUID back into column A so future syncs PATCH instead of POST
            sheet.getRange(i + 1, COL.id + 1).setValue(created[0].id);
          }
          inserted++;
        }
      }
    } catch (err) {
      errors.push(`Row ${i + 1}: ${err.message}`);
    }
  }

  const summary =
    `✅ Sync complete\n` +
    `   • ${inserted} order(s) created\n` +
    `   • ${updated} order(s) updated` +
    (errors.length ? `\n\n⚠️ ${errors.length} error(s):\n${errors.join('\n')}` : '');

  SpreadsheetApp.getUi().alert('OrderFlow Sync', summary, SpreadsheetApp.getUi().ButtonSet.OK);
}

/** Build the Supabase REST payload from a sheet row. */
function buildPayload_(row, categoryId) {
  const parseNum = v => (v !== '' && v != null && !isNaN(Number(v))) ? Number(v) : null;
  const parseDate = v => {
    if (!v) return null;
    if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const s = String(v).trim();
    return s || null;
  };

  return {
    order_no:      String(row[COL.order_no]      || '').trim() || null,
    customer_name: String(row[COL.customer_name] || '').trim() || null,
    category_id:   categoryId,
    date:          parseDate(row[COL.date])          || new Date().toISOString().slice(0, 10),
    due_date:      parseDate(row[COL.due_date])      || new Date().toISOString().slice(0, 10),
    dispatch_date: parseDate(row[COL.dispatch_date]),
    length:        parseNum(row[COL.length]),
    width:         parseNum(row[COL.width]),
    qty:           parseNum(row[COL.qty]) || 1,
    description:   String(row[COL.description] || '').trim() || null,
    status:        validateStatus_(row[COL.status]),
  };
}

const VALID_STATUSES = ['Pending', 'In Progress', 'Packing', 'Dispatched'];

function validateStatus_(val) {
  const s = String(val || '').trim();
  return VALID_STATUSES.includes(s) ? s : 'Pending';
}

// ============================================================
//  OPTIONAL: Full refresh — pull ALL orders from Supabase into sheet
//  Useful for initial setup or resetting the sheet.
// ============================================================

function refreshFromSupabase() {
  const ui = SpreadsheetApp.getUi();
  const confirm = ui.alert(
    'Refresh from App',
    '⚠️ This will OVERWRITE all rows in the sheet with data from Supabase.\nContinue?',
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  const cats  = getCategories_();

  const res = UrlFetchApp.fetch(
    `${SUPABASE_URL}/rest/v1/orders?select=*&order=created_at.desc`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
      muteHttpExceptions: true,
    }
  );

  if (res.getResponseCode() !== 200) {
    ui.alert('Error', `Failed to fetch orders: ${res.getContentText()}`, ui.ButtonSet.OK);
    return;
  }

  const orders  = JSON.parse(res.getContentText());
  const lastRow = sheet.getLastRow();

  // Clear all data rows (keep header row 1)
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, TOTAL_COLS).clearContent();
  }

  if (orders.length > 0) {
    const rows = orders.map(o => orderToRow_(o, cats));
    sheet.getRange(2, 1, rows.length, TOTAL_COLS).setValues(rows);
  }

  ui.alert('OrderFlow', `✅ Refreshed ${orders.length} order(s) from app.`, ui.ButtonSet.OK);
}

// ============================================================
//  MENU — added automatically when the sheet opens
// ============================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('OrderFlow')
    .addItem('Sync to App ↑', 'syncToSupabase')
    .addSeparator()
    .addItem('Refresh from App ↓', 'refreshFromSupabase')
    .addToUi();
}
