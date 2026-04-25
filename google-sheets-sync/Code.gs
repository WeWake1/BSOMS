// ============================================================
//  OrderFlow ↔ Google Sheets — Two-Way Sync  (v2)
//  Paste this entire file into Extensions → Apps Script → Code.gs
//  After pasting: Deploy → Manage deployments → edit existing → Save new version
// ============================================================

// ── CONFIGURATION ────────────────────────────────────────────
const SUPABASE_URL = 'https://eszktnsfpoqvbybtmxft.supabase.co';
const SUPABASE_KEY = 'YOUR_SUPABASE_SERVICE_ROLE_KEY'; // ← your service role key
const SHEET_NAME   = 'Sheet1';

// Set to false to disable auto-sync on cell edits.
// When true: a row auto-syncs as soon as order_no, customer_name,
// category_name, and qty are all filled in.
const AUTO_SYNC = true;
// ─────────────────────────────────────────────────────────────

// Column index map (0-based). 12 columns total (A–L). No created_at.
const COL = {
  id:            0,  // A — UUID. Empty = new row. Never edit manually.
  order_no:      1,  // B ← required for auto-sync trigger
  customer_name: 2,  // C ← required for auto-sync trigger
  category_name: 3,  // D ← required for auto-sync trigger
  date:          4,  // E — auto-filled with today on row start
  due_date:      5,  // F — auto-filled with today+7 on row start
  dispatch_date: 6,  // G
  length:        7,  // H — stored as text e.g. 43"2
  width:         8,  // I — stored as text e.g. 37"5
  qty:           9,  // J ← required for auto-sync trigger
  description:  10,  // K
  status:       11,  // L — Pending / In Progress / Packing / Dispatched
};

const TOTAL_COLS    = 12;
const VALID_STATUSES = ['Pending', 'In Progress', 'Packing', 'Dispatched'];

// ============================================================
//  MENU
// ============================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('OrderFlow')
    .addItem('Sync to App ↑',        'syncToSupabase')
    .addSeparator()
    .addItem('Delete Selected Order(s)', 'deleteSelectedOrders')
    .addSeparator()
    .addItem('Refresh from App ↓',    'refreshFromSupabase')
    .addToUi();
}

// ============================================================
//  AUTO-FILL DATES + SMART AUTO-SYNC  (onEdit trigger)
// ============================================================

function onEdit(e) {
  const sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET_NAME) return;

  const row = e.range.getRow();
  const col = e.range.getColumn(); // 1-based

  // Skip header row
  if (row <= 1) return;

  const rowData = sheet.getRange(row, 1, 1, TOTAL_COLS).getValues()[0];

  // ── Auto-fill date and due_date when order_no (col B = index 1) is first filled ──
  if (col === COL.order_no + 1) {
    const currentDate    = rowData[COL.date];
    const currentDueDate = rowData[COL.due_date];

    if (!currentDate) {
      const today = new Date();
      sheet.getRange(row, COL.date + 1).setValue(Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd'));
      rowData[COL.date] = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
    if (!currentDueDate) {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      sheet.getRange(row, COL.due_date + 1).setValue(Utilities.formatDate(nextWeek, Session.getScriptTimeZone(), 'yyyy-MM-dd'));
      rowData[COL.due_date] = Utilities.formatDate(nextWeek, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
    if (!rowData[COL.status]) {
      sheet.getRange(row, COL.status + 1).setValue('Pending');
      rowData[COL.status] = 'Pending';
    }
  }

  // ── Smart auto-sync: only fire when all 4 required fields are present ──
  if (!AUTO_SYNC) return;

  const orderNo      = String(rowData[COL.order_no]      || '').trim();
  const customerName = String(rowData[COL.customer_name] || '').trim();
  const categoryName = String(rowData[COL.category_name] || '').trim();
  const qty          = String(rowData[COL.qty]           || '').trim();

  if (!orderNo || !customerName || !categoryName || !qty) return;

  // All required fields present — sync this single row
  syncSingleRow_(sheet, row, rowData);
}

// ============================================================
//  CATEGORY HELPERS
// ============================================================

function getCategories_() {
  const res = UrlFetchApp.fetch(
    `${SUPABASE_URL}/rest/v1/categories?select=id,name&order=name`,
    {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
      muteHttpExceptions: true,
    }
  );
  if (res.getResponseCode() !== 200) throw new Error(`Failed to fetch categories: ${res.getContentText()}`);
  return JSON.parse(res.getContentText());
}

function nameToId_(name, categories) {
  if (!name) return null;
  const norm = String(name).trim().toLowerCase();
  const match = categories.find(c => c.name.trim().toLowerCase() === norm);
  return match ? match.id : null;
}

function idToName_(id, categories) {
  if (!id) return '';
  const match = categories.find(c => c.id === id);
  return match ? match.name : String(id);
}

// ============================================================
//  DIRECTION 1: Supabase → Sheet  (webhook receiver)
// ============================================================

function doPost(e) {
  try {
    const payload   = JSON.parse(e.postData.contents);
    const type      = payload.type;
    const record    = payload.record;
    const oldRecord = payload.old_record;

    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    const cats  = getCategories_();

    if (type === 'INSERT') {
      // FIX 2.6: Check if row already exists before appending (prevents duplicates
      // caused by the webhook firing back after a sheet-initiated POST)
      const existingRow = findRowById_(sheet, record.id);
      if (existingRow !== -1) {
        sheet.getRange(existingRow, 1, 1, TOTAL_COLS).setValues([orderToRow_(record, cats)]);
      } else {
        sheet.appendRow(orderToRow_(record, cats));
      }
    } else if (type === 'UPDATE') {
      const rowIdx = findRowById_(sheet, record.id);
      if (rowIdx === -1) {
        sheet.appendRow(orderToRow_(record, cats));
      } else {
        sheet.getRange(rowIdx, 1, 1, TOTAL_COLS).setValues([orderToRow_(record, cats)]);
      }
    } else if (type === 'DELETE') {
      const rowIdx = findRowById_(sheet, oldRecord.id);
      if (rowIdx !== -1) sheet.deleteRow(rowIdx);
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

function orderToRow_(record, cats) {
  return [
    record.id            || '',
    record.order_no      || '',
    record.customer_name || '',
    idToName_(record.category_id, cats),
    record.date          || '',
    record.due_date      || '',
    record.dispatch_date || '',
    record.length        != null ? record.length : '',  // stored as text already
    record.width         != null ? record.width  : '',  // stored as text already
    record.qty           != null ? record.qty    : '',
    record.description   || '',
    record.status        || 'Pending',
    // created_at intentionally excluded
  ];
}

function findRowById_(sheet, id) {
  if (!id) return -1;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const colA = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < colA.length; i++) {
    if (String(colA[i][0]).trim() === String(id).trim()) return i + 2;
  }
  return -1;
}

// ============================================================
//  DIRECTION 2: Sheet → Supabase
// ============================================================

/**
 * Sync a single row to Supabase (called by auto-sync onEdit).
 * POST if no UUID in col A, PATCH if UUID exists.
 */
function syncSingleRow_(sheet, rowNum, rowData) {
  try {
    const cats = getCategories_();
    const result = upsertRow_(sheet, rowNum, rowData, cats);
    if (result.error) {
      Logger.log(`Auto-sync row ${rowNum} error: ${result.error}`);
    }
  } catch (err) {
    Logger.log(`Auto-sync row ${rowNum} exception: ${err.message}`);
  }
}

/**
 * Batch sync ALL rows. Called by "Sync to App ↑" menu item.
 */
function syncToSupabase() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  const data  = sheet.getDataRange().getValues();
  const cats  = getCategories_();

  let inserted = 0;
  let updated  = 0;
  const errors = [];

  for (let i = 1; i < data.length; i++) {
    const row      = data[i];
    const orderNo  = String(row[COL.order_no]      || '').trim();
    const custName = String(row[COL.customer_name] || '').trim();
    if (!orderNo && !custName) continue; // skip completely empty rows

    const result = upsertRow_(sheet, i + 1, row, cats);
    if (result.error) {
      errors.push(`Row ${i + 1}: ${result.error}`);
    } else if (result.action === 'inserted') {
      inserted++;
    } else {
      updated++;
    }
  }

  const summary =
    `✅ Sync complete\n` +
    `   • ${inserted} order(s) created\n` +
    `   • ${updated} order(s) updated` +
    (errors.length ? `\n\n⚠️ ${errors.length} error(s):\n${errors.join('\n')}` : '');

  SpreadsheetApp.getUi().alert('OrderFlow Sync', summary, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Core upsert: POST (new) or PATCH (existing) a single row.
 * Returns { action: 'inserted'|'updated', error: string|null }
 */
function upsertRow_(sheet, rowNum, rowData, cats) {
  const id           = String(rowData[COL.id] || '').trim();
  const categoryName = String(rowData[COL.category_name] || '').trim();
  const categoryId   = nameToId_(categoryName, cats);

  if (!categoryId) {
    return { action: null, error: `Unknown category "${categoryName}" — add it in the app first` };
  }

  const payload = buildPayload_(rowData, categoryId);

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
      return { action: null, error: `HTTP ${code}: ${res.getContentText()}` };
    }
    return { action: 'updated', error: null };
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
      return { action: null, error: `HTTP ${code}: ${res.getContentText()}` };
    }
    const created = JSON.parse(res.getContentText());
    if (created && created[0] && created[0].id) {
      sheet.getRange(rowNum, COL.id + 1).setValue(created[0].id);
    }
    return { action: 'inserted', error: null };
  }
}

function buildPayload_(row, categoryId) {
  const parseDate = v => {
    if (!v) return null;
    if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const s = String(v).trim();
    return s || null;
  };
  const parseDim = v => {
    // Store dimensions as raw text (e.g. '43"2', '80', '74.6')
    const s = String(v || '').trim();
    return s || null;
  };
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  return {
    order_no:      String(row[COL.order_no]      || '').trim() || null,
    customer_name: String(row[COL.customer_name] || '').trim() || null,
    category_id:   categoryId,
    date:          parseDate(row[COL.date])     || today,
    due_date:      parseDate(row[COL.due_date]) || today,
    dispatch_date: parseDate(row[COL.dispatch_date]),
    length:        parseDim(row[COL.length]),
    width:         parseDim(row[COL.width]),
    qty:           parseInt(String(row[COL.qty] || '1'), 10) || 1,
    description:   String(row[COL.description] || '').trim() || null,
    status:        validateStatus_(row[COL.status]),
  };
}

function validateStatus_(val) {
  const s = String(val || '').trim();
  return VALID_STATUSES.includes(s) ? s : 'Pending';
}

// ============================================================
//  DELETE SELECTED ORDER(S)  (Fix 2.1)
// ============================================================

/**
 * Deletes all orders whose rows are currently selected (supports multi-row selection).
 * Reads the UUID from column A of each selected row and sends DELETE to Supabase.
 */
function deleteSelectedOrders() {
  const ss     = SpreadsheetApp.getActiveSpreadsheet();
  const sheet  = ss.getSheetByName(SHEET_NAME);
  const ui     = SpreadsheetApp.getUi();
  const ranges = sheet.getActiveRangeList().getRanges();

  // Collect all unique row numbers from the selection (exclude header row 1)
  const selectedRows = new Set();
  ranges.forEach(range => {
    for (let r = range.getRow(); r <= range.getLastRow(); r++) {
      if (r > 1) selectedRows.add(r);
    }
  });

  if (selectedRows.size === 0) {
    ui.alert('No rows selected', 'Select one or more data rows first, then try again.', ui.ButtonSet.OK);
    return;
  }

  // Read UUIDs from column A for selected rows
  const rowsWithIds = [];
  selectedRows.forEach(rowNum => {
    const id = String(sheet.getRange(rowNum, COL.id + 1).getValue() || '').trim();
    if (id) rowsWithIds.push({ rowNum, id });
  });

  const rowsWithoutIds = selectedRows.size - rowsWithIds.length;

  const msg =
    `Delete ${selectedRows.size} selected row(s) from Supabase?\n` +
    (rowsWithIds.length > 0    ? `• ${rowsWithIds.length} will be deleted from the database.\n` : '') +
    (rowsWithoutIds > 0        ? `• ${rowsWithoutIds} have no ID and will only be removed from the sheet.\n` : '') +
    `\nThis cannot be undone.`;

  const confirm = ui.alert('Confirm Delete', msg, ui.ButtonSet.YES_NO);
  if (confirm !== ui.Button.YES) return;

  let deleted = 0;
  const errors = [];

  // Delete from Supabase
  rowsWithIds.forEach(({ id, rowNum }) => {
    try {
      const res = UrlFetchApp.fetch(
        `${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer': 'return=representation',
          },
          muteHttpExceptions: true,
        }
      );
      const code = res.getResponseCode();
      if (code < 200 || code >= 300) {
        errors.push(`Row ${rowNum}: HTTP ${code}`);
      } else {
        deleted++;
      }
    } catch (err) {
      errors.push(`Row ${rowNum}: ${err.message}`);
    }
  });

  // Delete rows from sheet in reverse order (so row numbers don't shift)
  const sortedRows = Array.from(selectedRows).sort((a, b) => b - a);
  sortedRows.forEach(rowNum => sheet.deleteRow(rowNum));

  const summary =
    `✅ Done\n• ${deleted + rowsWithoutIds} row(s) removed` +
    (errors.length ? `\n\n⚠️ Errors:\n${errors.join('\n')}` : '');
  ui.alert('Delete Complete', summary, ui.ButtonSet.OK);
}

// ============================================================
//  FULL REFRESH: Pull all orders from Supabase into sheet
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
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
      muteHttpExceptions: true,
    }
  );

  if (res.getResponseCode() !== 200) {
    ui.alert('Error', `Failed to fetch: ${res.getContentText()}`, ui.ButtonSet.OK);
    return;
  }

  const orders  = JSON.parse(res.getContentText());
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, TOTAL_COLS).clearContent();

  if (orders.length > 0) {
    const rows = orders.map(o => orderToRow_(o, cats));
    sheet.getRange(2, 1, rows.length, TOTAL_COLS).setValues(rows);
  }

  ui.alert('OrderFlow', `✅ Refreshed ${orders.length} order(s) from app.`, ui.ButtonSet.OK);
}
