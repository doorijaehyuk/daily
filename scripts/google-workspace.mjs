#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { google } from 'googleapis';

const ROOT = '/home/doorihyuk/.openclaw/workspace';
const SECRETS_DIR = path.join(ROOT, 'secrets');
const CLIENT_FILE = path.join(SECRETS_DIR, 'google-oauth-client.json');
const TOKEN_FILE = path.join(SECRETS_DIR, 'google-oauth-token.json');
const STATE_FILE = path.join(SECRETS_DIR, 'google-oauth-state.json');

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/drive.file'
];

function loadClient() {
  if (!fs.existsSync(CLIENT_FILE)) {
    throw new Error(`Missing OAuth client file: ${CLIENT_FILE}`);
  }
  const raw = JSON.parse(fs.readFileSync(CLIENT_FILE, 'utf8'));
  const c = raw.installed || raw.web || raw;
  const redirect = (c.redirect_uris || [])[0] || 'http://localhost:8085/oauth2callback';
  return { clientId: c.client_id, clientSecret: c.client_secret, redirectUri: redirect };
}

function oauthClient() {
  const { clientId, clientSecret, redirectUri } = loadClient();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function saveJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function getAuthClient() {
  const o = oauthClient();
  if (!fs.existsSync(TOKEN_FILE)) throw new Error(`Missing token file: ${TOKEN_FILE}`);
  const token = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  o.setCredentials(token);
  return o;
}

async function cmdAuthUrl() {
  const o = oauthClient();
  const state = crypto.randomBytes(16).toString('hex');
  saveJSON(STATE_FILE, { state, createdAt: new Date().toISOString() });
  const url = o.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES, state });
  console.log(url);
}

async function cmdAuthExchange(redirectUrl) {
  if (!redirectUrl) throw new Error('Usage: auth-exchange <redirect_url>');
  const o = oauthClient();
  const u = new URL(redirectUrl);
  const code = u.searchParams.get('code');
  const state = u.searchParams.get('state');
  if (!code) throw new Error('No code found in redirect URL');
  if (fs.existsSync(STATE_FILE)) {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')).state;
    if (s && state && s !== state) throw new Error('State mismatch');
  }
  const { tokens } = await o.getToken(code);
  o.setCredentials(tokens);
  saveJSON(TOKEN_FILE, tokens);
  console.log('OK: token saved');
}

async function cmdCalendarQuickAdd(text) {
  if (!text) throw new Error('Usage: calendar-quickadd <text>');
  const auth = getAuthClient();
  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.events.quickAdd({ calendarId: 'primary', text });
  console.log(JSON.stringify({ id: res.data.id, htmlLink: res.data.htmlLink, summary: res.data.summary }, null, 2));
}

async function cmdCalendarList() {
  const auth = getAuthClient();
  const calendar = google.calendar({ version: 'v3', auth });
  const now = new Date();
  const end = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14);
  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: now.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 20
  });
  const out = (res.data.items || []).map(e => ({ id: e.id, summary: e.summary, start: e.start?.dateTime || e.start?.date, end: e.end?.dateTime || e.end?.date }));
  console.log(JSON.stringify(out, null, 2));
}

async function cmdGmailUnread() {
  const auth = getAuthClient();
  const gmail = google.gmail({ version: 'v1', auth });
  const list = await gmail.users.messages.list({ userId: 'me', q: 'is:unread', maxResults: 20 });
  const ids = (list.data.messages || []).map(m => m.id);
  const out = [];
  for (const id of ids.slice(0, 10)) {
    const m = await gmail.users.messages.get({ userId: 'me', id, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date'] });
    const headers = Object.fromEntries((m.data.payload?.headers || []).map(h => [h.name.toLowerCase(), h.value]));
    out.push({ id, from: headers.from || '', subject: headers.subject || '', date: headers.date || '' });
  }
  console.log(JSON.stringify(out, null, 2));
}

async function cmdDriveList(folderId = 'root') {
  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });
  const q = `'${folderId}' in parents and trashed=false`;
  const res = await drive.files.list({ q, fields: 'files(id,name,mimeType,modifiedTime,webViewLink)', pageSize: 50 });
  console.log(JSON.stringify(res.data.files || [], null, 2));
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  try {
    if (cmd === 'auth-url') return await cmdAuthUrl();
    if (cmd === 'auth-exchange') return await cmdAuthExchange(args[0]);
    if (cmd === 'calendar-quickadd') return await cmdCalendarQuickAdd(args.join(' '));
    if (cmd === 'calendar-list') return await cmdCalendarList();
    if (cmd === 'gmail-unread') return await cmdGmailUnread();
    if (cmd === 'drive-list') return await cmdDriveList(args[0]);
    console.log(`Usage:\n  node scripts/google-workspace.mjs auth-url\n  node scripts/google-workspace.mjs auth-exchange <redirect_url>\n  node scripts/google-workspace.mjs calendar-quickadd "tomorrow 3pm dentist"\n  node scripts/google-workspace.mjs calendar-list\n  node scripts/google-workspace.mjs gmail-unread\n  node scripts/google-workspace.mjs drive-list [folderId]`);
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }
}

main();
