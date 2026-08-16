/**
 * HOME OPERATIONS SYSTEM — Apps Script backend
 * ------------------------------------------------
 * V1 backend: Google Sheets as source of truth, this script as the API.
 * Deploy as a Web App (Execute as: Me, Access: Anyone) and paste the
 * /exec URL into the frontend as VITE_APPS_SCRIPT_URL.
 *
 * All endpoints are GET-only (query params) to avoid CORS preflight,
 * matching the pattern used in the other vishwanathrajasekaran.in apps.
 *
 * One-time setup: run setupSheets() once from the Apps Script editor
 * (select it in the function dropdown, click Run). It creates every
 * sheet tab, headers, the four household users (PIN 0000 — change
 * these in the USERS sheet before going live), and the starter tasks.
 */

const SHEETS = {
  USERS: 'USERS',
  TASK_MASTER: 'TASK_MASTER',
  TASK_LOG: 'TASK_LOG',
  PUSH_SUBSCRIPTIONS: 'PUSH_SUBSCRIPTIONS',
};

const STATUS = { PENDING: 'PENDING', DONE: 'DONE', NOT_DONE: 'NOT_DONE', SKIPPED: 'SKIPPED', PARTIAL: 'PARTIAL' };

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
function taskAppliesToday(freq, date) {
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
  const existingKeys = new Set(existing.map((o) => o.TaskID + '|' + o.Date));

  const newRows = [];
  master.forEach((task) => {
    if (!taskAppliesToday(task.Frequency, today)) return;
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

  const master = rowsAsObjects(sheet(SHEETS.TASK_MASTER));
  const masterById = {};
  master.forEach((t) => { masterById[t.TaskID] = t; });

  const log = rowsAsObjects(sheet(SHEETS.TASK_LOG)).filter((o) => o.Date === todayStr());
  const now = new Date();

  const tasks = log
    .filter((o) => {
      const ids = String(o.AssigneeIDs || '').split(',').map((s) => s.trim());
      return ids.indexOf('ALL') !== -1 || ids.indexOf(userId) !== -1;
    })
    .map((o) => {
      const task = masterById[o.TaskID] || {};
      const dueDateTime = combineDateAndTime(todayStr(), o.DueTime);
      return {
        occurrenceId: o.OccurrenceID,
        name: task.TaskName || o.TaskID,
        dueTime: o.DueTime,
        priority: task.Priority || 'Routine',
        assignee: task.AssigneeLabel || o.AssigneeIDs,
        status: o.Status,
        overdue: o.Status === STATUS.PENDING && dueDateTime && now > dueDateTime,
      };
    });

  tasks.sort((a, b) => (a.dueTime || '').localeCompare(b.dueTime || ''));
  return { tasks };
}

function combineDateAndTime(dateStr, timeStr) {
  if (!timeStr) return null;
  const [h, m] = String(timeStr).split(':').map(Number);
  const d = new Date(dateStr + 'T00:00:00');
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

// ---------------------------------------------------------------------
// Update an occurrence
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
  const logRows = rowsAsObjects(logSheet).filter((o) => o.Date === todayStr() && o.Status === STATUS.PENDING);
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
    const due = combineDateAndTime(o.Date, o.DueTime);
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

function ensureSheet(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  }
  return sh;
}
