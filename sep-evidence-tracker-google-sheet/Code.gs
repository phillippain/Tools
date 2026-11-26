/**
 * SEP Evidence Upload Tracker 2026 - Google Sheets back end.
 * Container-bound: paste into Extensions > Apps Script from the Google Sheet that will hold the record.
 * Files: Code.gs (this), Items.gs (the 196 items), Index.html (the page).
 */
var SHEET_TICKS = 'Ticks';
var SHEET_FOLDERS = 'Folders';
var SHEET_LOG = 'Log';
var SHEET_SUMMARY = 'Summary';
var TICK_HEADERS = ['ID', 'Goal', 'Team', 'Year', 'Item', 'Uploaded?', 'Uploaded by', 'Uploaded at', 'Note'];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('SEP tracker')
    .addItem('Set up / repair sheets', 'setup')
    .addToUi();
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('SEP Evidence Upload Tracker 2026')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Creates the sheets and one row per item. Safe to re-run: existing ticks are kept and missing items are added. */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var t = ss.getSheetByName(SHEET_TICKS) || ss.insertSheet(SHEET_TICKS);
  if (t.getLastRow() === 0) {
    t.getRange(1, 1, 1, TICK_HEADERS.length).setValues([TICK_HEADERS]).setFontWeight('bold');
    t.setFrozenRows(1);
  }
  var have = {};
  if (t.getLastRow() > 1) {
    t.getRange(2, 1, t.getLastRow() - 1, 1).getValues().forEach(function (r) { have[r[0]] = true; });
  }
  var rows = [];
  ITEMS.forEach(function (i) {
    if (!have[i.id]) rows.push([i.id, i.goal === 'N' ? 'Numeracy' : 'Reading', i.team, i.year, i.title, false, '', '', '']);
  });
  if (rows.length) {
    var start = t.getLastRow() + 1;
    t.getRange(start, 1, rows.length, TICK_HEADERS.length).setValues(rows);
    t.getRange(start, 6, rows.length, 1).insertCheckboxes();
  }
  t.autoResizeColumns(1, 4);
  t.setColumnWidth(5, 320);

  var f = ss.getSheetByName(SHEET_FOLDERS) || ss.insertSheet(SHEET_FOLDERS);
  if (f.getLastRow() === 0) {
    f.getRange(1, 1, 1, 3).setValues([['Key', 'Team', 'Folder link (https)']]).setFontWeight('bold');
    f.setFrozenRows(1);
    var teams = [];
    ITEMS.forEach(function (i) { if (teams.indexOf(i.team) < 0) teams.push(i.team); });
    f.getRange(2, 1, teams.length, 2).setValues(teams.map(function (n) { return [teamKey_(n), n]; }));
  }

  var l = ss.getSheetByName(SHEET_LOG) || ss.insertSheet(SHEET_LOG);
  if (l.getLastRow() === 0) {
    l.getRange(1, 1, 1, 5).setValues([['When', 'Who', 'Item ID', 'Action', 'Note']]).setFontWeight('bold');
    l.setFrozenRows(1);
  }

  var s = ss.getSheetByName(SHEET_SUMMARY) || ss.insertSheet(SHEET_SUMMARY);
  s.clear();
  s.getRange(1, 1, 1, 5).setValues([['Team', 'Uploaded', 'Total', '% uploaded', '']]).setFontWeight('bold');
  var names = [];
  ITEMS.forEach(function (i) { if (names.indexOf(i.team) < 0) names.push(i.team); });
  names.forEach(function (n, k) {
    var r = k + 2;
    s.getRange(r, 1).setValue(n);
    s.getRange(r, 2).setFormula('=COUNTIFS(Ticks!$C:$C,$A' + r + ',Ticks!$F:$F,TRUE)');
    s.getRange(r, 3).setFormula('=COUNTIF(Ticks!$C:$C,$A' + r + ')');
    s.getRange(r, 4).setFormula('=IF(C' + r + '=0,0,B' + r + '/C' + r + ')').setNumberFormat('0%');
  });
  var tr = names.length + 2;
  s.getRange(tr, 1).setValue('All teams').setFontWeight('bold');
  s.getRange(tr, 2).setFormula('=SUM(B2:B' + (tr - 1) + ')');
  s.getRange(tr, 3).setFormula('=SUM(C2:C' + (tr - 1) + ')');
  s.getRange(tr, 4).setFormula('=IF(C' + tr + '=0,0,B' + tr + '/C' + tr + ')').setNumberFormat('0%');
  s.autoResizeColumns(1, 4);
  ss.setActiveSheet(s);
}

function getItems() { return ITEMS; }

function getState() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var t = ss.getSheetByName(SHEET_TICKS);
  if (!t) throw new Error('The sheet has not been set up yet. Open the spreadsheet and run SEP tracker > Set up / repair sheets.');
  var ticks = {};
  if (t.getLastRow() > 1) {
    t.getRange(2, 1, t.getLastRow() - 1, TICK_HEADERS.length).getValues().forEach(function (r) {
      if (r[5] === true) {
        ticks[r[0]] = { done: true, by: String(r[6]), at: r[7] instanceof Date ? r[7].toISOString() : String(r[7]), note: String(r[8]) };
      }
    });
  }
  var folders = {};
  var f = ss.getSheetByName(SHEET_FOLDERS);
  if (f && f.getLastRow() > 1) {
    f.getRange(2, 1, f.getLastRow() - 1, 3).getValues().forEach(function (r) {
      if (/^https:\/\//.test(String(r[2]))) folders[r[0]] = String(r[2]);
    });
  }
  return { ticks: ticks, folders: folders, me: currentUser_() };
}

/** Tick or untick an item. fallbackName is used only when Google cannot supply the user's email. */
function setTick(id, done, note, fallbackName) {
  var valid = ITEMS.some(function (i) { return i.id === id; });
  if (!valid) throw new Error('Unknown item.');
  var who = currentUser_() || clean_(fallbackName, 80);
  done = done === true;
  if (done && !who) throw new Error('Please enter your name first.');
  note = clean_(note, 200);

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var t = ss.getSheetByName(SHEET_TICKS);
    var ids = t.getRange(2, 1, Math.max(t.getLastRow() - 1, 1), 1).getValues();
    var row = -1;
    for (var k = 0; k < ids.length; k++) { if (ids[k][0] === id) { row = k + 2; break; } }
    if (row < 0) throw new Error('Item row not found. Run SEP tracker > Set up / repair sheets.');
    var cur = t.getRange(row, 6, 1, 4).getValues()[0];
    var now = new Date();
    var out;
    if (!done) {
      t.getRange(row, 6, 1, 4).setValues([[false, '', '', '']]);
      out = { done: false, by: '', at: '', note: '' };
      log_(ss, now, who, id, 'unticked', '');
    } else if (cur[0] === true) {
      t.getRange(row, 9).setValue(note);
      out = { done: true, by: String(cur[1]), at: cur[2] instanceof Date ? cur[2].toISOString() : String(cur[2]), note: note };
      log_(ss, now, who, id, 'note', note);
    } else {
      t.getRange(row, 6, 1, 4).setValues([[true, who, now, note]]);
      t.getRange(row, 8).setNumberFormat('d mmm yyyy h:mm am/pm');
      out = { done: true, by: who, at: now.toISOString(), note: note };
      log_(ss, now, who, id, 'ticked', note);
    }
    return out;
  } finally {
    lock.releaseLock();
  }
}

function setFolder(team, url) {
  var ok = ITEMS.some(function (i) { return i.team === team; });
  if (!ok) throw new Error('Unknown team.');
  url = String(url || '').trim();
  if (url && !/^https:\/\//.test(url)) throw new Error('The link must start with https://');
  var f = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_FOLDERS);
  var key = teamKey_(team);
  var keys = f.getRange(2, 1, Math.max(f.getLastRow() - 1, 1), 1).getValues();
  for (var k = 0; k < keys.length; k++) {
    if (keys[k][0] === key) { f.getRange(k + 2, 3).setValue(url); return true; }
  }
  f.appendRow([key, team, url]);
  return true;
}

function currentUser_() {
  try { return Session.getActiveUser().getEmail() || ''; } catch (e) { return ''; }
}
function teamKey_(n) { return String(n).replace(/[^A-Za-z0-9]/g, '_'); }
/** Trim, cap length, and stop spreadsheet formulas being injected. */
function clean_(s, max) {
  s = String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
function log_(ss, when, who, id, action, note) {
  ss.getSheetByName(SHEET_LOG).appendRow([when, who, id, action, note]);
}
