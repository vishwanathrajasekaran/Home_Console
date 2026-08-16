/**
 * HOME OPERATIONS SYSTEM — Apps Script backend
 * ------------------------------------------------
 * Deploy as a Web App (Execute as: Me, Access: Anyone). Paste the /exec
 * URL into the frontend as VITE_APPS_SCRIPT_URL.
 *
 * All endpoints are GET-only (query params) to avoid CORS preflight.
 *
 * One-time setup: run setupSheets() once from the Apps Script editor.
 *
 * IMPORTANT: if you're upgrading from the first version of this script,
 * re-deploy (Deploy > Manage deployments > edit > New version) after
 * pasting this in — it fixes a bug where Sheets silently converts the
 * Date column to a real Date object, which made getToday() match
 * nothing even though rows existed in TASK_LOG.
 */

const SHEETS = {
  USERS: 'USERS',
  TASK_MASTER: 'TASK_MASTER',
  TASK_LOG: 'TASK_LOG',
  PUSH_SUBSCRIPTIONS: 'PUSH_SUBSCRIPTIONS',
};

const STATUS = {
  PENDING: 'PENDING', DONE: 'DONE', NOT_DONE: 'NOT_DONE',
  SKIPPED: 'SKIPPED', PARTIAL: 'PARTIAL', PAUSED: 'PAUSED',
};

// ---------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------
function doGet(e) {
  const action = e.parameter.action;
  let result;
  try {
    switch (action) {
      case 'getUsers': result = getUsers(); break;
      case 'login': result = login(e.parameter.userId, e.parameter.pin); break;
      case 'getToday': result = getToday(e.parameter.userId); break;
      case 'getForDate': result = getForDate(e.parameter.userId, e.parameter.date); break;
      case 'getStats': result = getStats(e.parameter.userId, Number(e.parameter.days) || 7); break;
      case 'updateOccurrence': result = updateOccurrence(e.parameter); break;
      case 'subscribe': result = subscribe(e.parameter.userId, e.parameter.sub); break;
      case 'getDueForNotify': result = getDueForNotify(e.parameter.secret); break;
      default: result = { error: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { error: err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------
// Sheet helpers
// ---------------------------------------------------------------------
function sheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function rowsAsObjects(sh) {
  const values = sh.getDataRange().getValues();
  const headers = values[0];
  return values.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  }).filter((o) => o[headers[0]] !== '');
}

function findRowIndexByValue(sh, colName, value) {
  const values = sh.getDataRange().getValues();
  const headers = values[0];
  const col = headers.indexOf(colName);
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][col]) === String(value)) return r + 1; // 1-indexed sheet row
  }
  return -1;
}

function colIndex(sh, colName) {
  return sh.getDataRange().getValues()[0].indexOf(colName) + 1; // 1-indexed
}

function todayStr() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/**
 * Sheets silently auto-converts "2026-08-16"-shaped strings written into a
 * cell into a real Date object. Every comparison against a Date column has
 * to go through this so it works whether the cell came back as a Date
 * object or (rarely, e.g. if the column is formatted as Plain Text) a
 * string.
 */
function toDateKey(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value).slice(0, 10);
}

// ---------------------------------------------------------------------
// Users / auth
// ---------------------------------------------------------------------
function getUsers() {
  const users = rowsAsObjects(sheet(SHEETS.USERS))
    .filter((u) => u.Active === true || u.Active === 'TRUE')
    .map((u) => ({ id: u.UserID, name: u.Name }));
  return { users };
}

function login(userId, pin) {
  const users = rowsAsObjects(sheet(SHEETS.USERS));
  const user = users.find((u) => u.UserID === userId);
  if (!user) return { ok: false };
  const ok = String(user.PIN) === String(pin);
  return { ok, name: ok ? user.Name : undefined };
}

// ---------------------------------------------------------------------
// Occurrence generation
// ---------------------------------------------------------------------
function taskAppliesOnDate(freq, date) {
  const dayAbbr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
  const dayOfMonth = date.getDate();

  if (freq === 'DAILY') return true;
  if (freq.indexOf('WEEKLY:') === 0) {
    const days = freq.slice(7).split(',').map((d) => d.trim());
    return days.indexOf(dayAbbr) !== -1;
  }
  if (freq.indexOf('MONTHLY:') === 0) {
    const dom = parseInt(freq.slice(8), 10);
    return dayOfMonth === dom;
  }
  return false;
}

/** Creates today's TASK_LOG rows for any active task that doesn't have one yet. */
function ensureTodayOccurrences() {
  const master = rowsAsObjects(sheet(SHEETS.TASK_MASTER)).filter((t) => t.Active === true || t.Active === 'TRUE');
  const logSheet = sheet(SHEETS.TASK_LOG);
  const existing = rowsAsObjects(logSheet);
  const today = new Date();
  const todayKey = todayStr();
  const existingKeys = new Set(existing.map((o) => o.TaskID + '|' + toDateKey(o.Date)));

  const newRows = [];
  master.forEach((task) => {
    if (!taskAppliesOnDate(task.Frequency, today)) return;
    const key = task.TaskID + '|' + todayKey;
    if (existingKeys.has(key)) return;
    const occurrenceId = task.TaskID + '-' + todayKey;
    newRows.push([
      occurrenceId, task.TaskID, todayKey, task.DueTime, STATUS.PENDING,
      task.AssigneeIDs, '', '', '', false, false, false,
    ]);
  });

  if (newRows.length > 0) {
    logSheet.getRange(logSheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
  }
}

// ---------------------------------------------------------------------
// Today's board
// ---------------------------------------------------------------------
function getToday(userId) {
  ensureTodayOccurrences();
  return buildBoardForDate(userId, todayStr(), true);
}

/**
 * Tasks for an arbitrary date. Today/past dates read the real logged
 * occurrences (so history and in-progress status show correctly).
 * Future dates have no TASK_LOG row yet, so they're computed as a
 * read-only preview straight from TASK_MASTER (status "SCHEDULED",
 * actions disabled on the frontend).
 */
function getForDate(userId, dateStr) {
  const requested = new Date(dateStr + 'T00:00:00');
  const today = new Date(todayStr() + 'T00:00:00');

  if (requested > today) {
    return buildPreviewForDate(userId, dateStr);
  }
  if (dateStr === todayStr()) ensureTodayOccurrences();
  return buildBoardForDate(userId, dateStr, dateStr === todayStr());
}

function buildBoardForDate(userId, dateStr, computeOverdue) {
  const master = rowsAsObjects(sheet(SHEETS.TASK_MASTER));
  const masterById = {};
  master.forEach((t) => { masterById[t.TaskID] = t; });

  const log = rowsAsObjects(sheet(SHEETS.TASK_LOG)).filter((o) => toDateKey(o.Date) === dateStr);
  const now = new Date();

  const tasks = log
    .filter((o) => {
      const ids = String(o.AssigneeIDs || '').split(',').map((s) => s.trim());
      return ids.indexOf('ALL') !== -1 || ids.indexOf(userId) !== -1;
    })
    .map((o) => {
      const task = masterById[o.TaskID] || {};
      const dueDateTime = combineDateAndTime(dateStr, o.DueTime);
      return {
        occurrenceId: o.OccurrenceID,
        name: task.TaskName || o.TaskID,
        dueTime: o.DueTime,
        priority: task.Priority || 'Routine',
        assignee: task.AssigneeLabel || o.AssigneeIDs,
        status: o.Status,
        remark: o.Remark || '',
        overdue: computeOverdue && o.Status === STATUS.PENDING && dueDateTime && now > dueDateTime,
        editable: true,
      };
    });

  tasks.sort((a, b) => (a.dueTime || '').localeCompare(b.dueTime || ''));
  return { tasks, date: dateStr };
}

function buildPreviewForDate(userId, dateStr) {
  const master = rowsAsObjects(sheet(SHEETS.TASK_MASTER)).filter((t) => t.Active === true || t.Active === 'TRUE');
  const date = new Date(dateStr + 'T00:00:00');

  const tasks = master
    .filter((t) => taskAppliesOnDate(t.Frequency, date))
    .filter((t) => {
      const ids = String(t.AssigneeIDs || '').split(',').map((s) => s.trim());
      return ids.indexOf('ALL') !== -1 || ids.indexOf(userId) !== -1;
    })
    .map((t) => ({
      occurrenceId: t.TaskID + '-' + dateStr,
      name: t.TaskName,
      dueTime: t.DueTime,
      priority: t.Priority || 'Routine',
      assignee: t.AssigneeLabel || t.AssigneeIDs,
      status: 'SCHEDULED',
      remark: '',
      overdue: false,
      editable: false,
    }));

  tasks.sort((a, b) => (a.dueTime || '').localeCompare(b.dueTime || ''));
  return { tasks, date: dateStr };
}

function combineDateAndTime(dateStr, timeStr) {
  if (!timeStr) return null;
  const [h, m] = String(timeStr).split(':').map(Number);
  const d = new Date(dateStr + 'T00:00:00');
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

// ---------------------------------------------------------------------
// Update an occurrence (Done / Not done / Skipped / Partial / Paused)
// ---------------------------------------------------------------------
function updateOccurrence(params) {
  const { occurrenceId, status, remark, userId } = params;
  const logSheet = sheet(SHEETS.TASK_LOG);
  const rowIdx = findRowIndexByValue(logSheet, 'OccurrenceID', occurrenceId);
  if (rowIdx === -1) return { error: 'Occurrence not found' };

  logSheet.getRange(rowIdx, colIndex(logSheet, 'Status')).setValue(status);
  logSheet.getRange(rowIdx, colIndex(logSheet, 'CompletedBy')).setValue(userId);
  logSheet.getRange(rowIdx, colIndex(logSheet, 'CompletedAt')).setValue(new Date());
  logSheet.getRange(rowIdx, colIndex(logSheet, 'Remark')).setValue(remark || '');

  return { ok: true };
}

// ---------------------------------------------------------------------
// Push subscriptions
// ---------------------------------------------------------------------
function subscribe(userId, subJson) {
  const sh = sheet(SHEETS.PUSH_SUBSCRIPTIONS);
  const sub = JSON.parse(subJson);
  const existing = rowsAsObjects(sh);
  const already = existing.find((r) => r.Endpoint === sub.endpoint);
  if (already) return { ok: true };

  sh.appendRow([userId, sub.endpoint, subJson, new Date()]);
  return { ok: true };
}

// ---------------------------------------------------------------------
// Stats — completion history for the trend chart
// ---------------------------------------------------------------------
function getStats(userId, days) {
  const log = rowsAsObjects(sheet(SHEETS.TASK_LOG));
  const byDate = {};

  log.forEach((o) => {
    const ids = String(o.AssigneeIDs || '').split(',').map((s) => s.trim());
    if (ids.indexOf('ALL') === -1 && ids.indexOf(userId) === -1) return;
    const key = toDateKey(o.Date);
    if (!byDate[key]) byDate[key] = { done: 0, total: 0 };
    byDate[key].total += 1;
    if (o.Status === STATUS.DONE) byDate[key].done += 1;
  });

  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const entry = byDate[key] || { done: 0, total: 0 };
    out.push({ date: key, done: entry.done, total: entry.total });
  }
  return { stats: out };
}

// ---------------------------------------------------------------------
// Notification queue — polled by the Vercel cron function
// ---------------------------------------------------------------------
function getDueForNotify(secret) {
  const expected = PropertiesService.getScriptProperties().getProperty('CRON_SECRET');
  if (!expected || secret !== expected) return { error: 'unauthorized' };

  ensureTodayOccurrences();

  const master = rowsAsObjects(sheet(SHEETS.TASK_MASTER));
  const masterById = {};
  master.forEach((t) => { masterById[t.TaskID] = t; });

  const logSheet = sheet(SHEETS.TASK_LOG);
  const todayKey = todayStr();
  const logRows = rowsAsObjects(logSheet).filter((o) => toDateKey(o.Date) === todayKey && o.Status === STATUS.PENDING);
  const now = new Date();

  const subs = rowsAsObjects(sheet(SHEETS.PUSH_SUBSCRIPTIONS));
  const subsByUser = {};
  subs.forEach((s) => {
    subsByUser[s.UserID] = subsByUser[s.UserID] || [];
    subsByUser[s.UserID].push(JSON.parse(s.Subscription));
  });

  const notifications = [];

  logRows.forEach((o) => {
    const task = masterById[o.TaskID];
    if (!task) return;
    const due = combineDateAndTime(todayKey, o.DueTime);
    if (!due) return;
    const reminderMin = Number(task.ReminderBeforeMin || 0);
    const reminderTime = new Date(due.getTime() - reminderMin * 60000);
    const overdueTime = new Date(due.getTime() + 30 * 60000);

    const rowIdx = findRowIndexByValue(logSheet, 'OccurrenceID', o.OccurrenceID);

    if (reminderMin > 0 && now >= reminderTime && now < due && !truthy(o.ReminderSent)) {
      queueNotification(notifications, subsByUser, o.AssigneeIDs, task, `Reminder: ${task.TaskName}`, `Due at ${o.DueTime}`, o.OccurrenceID);
      logSheet.getRange(rowIdx, colIndex(logSheet, 'ReminderSent')).setValue(true);
    }
    if (now >= due && !truthy(o.DueSent)) {
      queueNotification(notifications, subsByUser, o.AssigneeIDs, task, `Due now: ${task.TaskName}`, `Mark it done in Home Console`, o.OccurrenceID);
      logSheet.getRange(rowIdx, colIndex(logSheet, 'DueSent')).setValue(true);
    }
    if (now >= overdueTime && !truthy(o.OverdueSent)) {
      const prefix = task.Priority === 'Critical' ? 'CRITICAL — Overdue: ' : 'Overdue: ';
      queueNotification(notifications, subsByUser, o.AssigneeIDs, task, prefix + task.TaskName, `Still pending since ${o.DueTime}`, o.OccurrenceID);
      logSheet.getRange(rowIdx, colIndex(logSheet, 'OverdueSent')).setValue(true);
    }
  });

  return { notifications };
}

function truthy(v) { return v === true || v === 'TRUE'; }

function queueNotification(list, subsByUser, assigneeIds, task, title, body, tag) {
  const ids = String(assigneeIds || '').split(',').map((s) => s.trim());
  const targetUsers = ids.indexOf('ALL') !== -1 ? Object.keys(subsByUser) : ids;
  targetUsers.forEach((uid) => {
    (subsByUser[uid] || []).forEach((subscription) => {
      list.push({ subscription, title, body, tag });
    });
  });
}

// ---------------------------------------------------------------------
// One-time setup — run manually from the Apps Script editor
// ---------------------------------------------------------------------
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const users = ensureSheet(ss, SHEETS.USERS, ['UserID', 'Name', 'PIN', 'Active']);
  if (users.getLastRow() < 2) {
    users.getRange(2, 1, 4, 4).setValues([
      ['U1', 'Vishwa', '0000', true],
      ['U2', 'Wife', '0000', true],
      ['U3', 'Kid1', '0000', true],
      ['U4', 'Kid2', '0000', true],
    ]);
  }

  const master = ensureSheet(ss, SHEETS.TASK_MASTER, [
    'TaskID', 'TaskName', 'Frequency', 'DueTime', 'AssigneeIDs', 'AssigneeLabel',
    'Priority', 'ReminderBeforeMin', 'RequireRemark', 'Active',
  ]);
  if (master.getLastRow() < 2) {
    master.getRange(2, 1, 6, 10).setValues([
      ['T1', 'Fill drinking water tank', 'DAILY', '08:00', 'U1', 'Vishwa', 'Important', 15, true, true],
      ['T2', 'Run washing machine', 'DAILY', '09:00', 'U2', 'Wife', 'Routine', 15, true, true],
      ['T3', 'Sweep & mop', 'DAILY', '07:30', 'U3,U4', 'Kids', 'Routine', 0, true, true],
      ['T4', 'Turn on evening lights', 'DAILY', '18:30', 'U1', 'Vishwa', 'Important', 10, true, true],
      ['T5', 'Lock the gate', 'DAILY', '22:00', 'U1', 'Vishwa', 'Critical', 10, true, true],
      ['T6', 'Clean outdoor area', 'WEEKLY:Sun', '08:00', 'ALL', 'Whoever\'s free', 'Routine', 30, true, true],
    ]);
  }

  ensureSheet(ss, SHEETS.TASK_LOG, [
    'OccurrenceID', 'TaskID', 'Date', 'DueTime', 'Status', 'AssigneeIDs',
    'CompletedBy', 'CompletedAt', 'Remark', 'ReminderSent', 'DueSent', 'OverdueSent',
  ]);

  ensureSheet(ss, SHEETS.PUSH_SUBSCRIPTIONS, ['UserID', 'Endpoint', 'Subscription', 'CreatedAt']);

  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('CRON_SECRET')) {
    props.setProperty('CRON_SECRET', Utilities.getUuid());
  }
  Logger.log('CRON_SECRET (put this in your GitHub secret / Vercel env): ' + props.getProperty('CRON_SECRET'));
  Logger.log('Setup complete. Change the 0000 PINs in the USERS sheet before going live.');
}

/**
 * Run this once (from the function dropdown) if your TASK_LOG "Date"
 * column already got auto-converted to real dates by Sheets — it just
 * re-writes every Date cell as a plain yyyy-MM-dd string and formats
 * the column as Plain Text so it won't happen again.
 */
function fixDateColumnFormat() {
  const sh = sheet(SHEETS.TASK_LOG);
  const values = sh.getDataRange().getValues();
  const headers = values[0];
  const dateCol = headers.indexOf('Date') + 1;
  if (dateCol === 0) return;

  sh.getRange(2, dateCol, Math.max(values.length - 1, 1), 1).setNumberFormat('@');
  for (let r = 1; r < values.length; r++) {
    sh.getRange(r + 1, dateCol).setValue(toDateKey(values[r][dateCol - 1]));
  }
  Logger.log('Date column normalized to plain text yyyy-MM-dd.');
}

function ensureSheet(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  }
  return sh;
}
