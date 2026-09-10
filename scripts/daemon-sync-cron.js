#!/usr/bin/env node
// Daemon: continuously sync session messages to aurora-context.json
// Runs independently, updates context every 5 seconds with latest messages

const fs = require('fs');
const path = require('path');
const http = require('http');

const CONTEXT_FILE = '/Users/cadem/.openclaw/workspace/aurora-context.json';
const GATEWAY_HOST = '127.0.0.1';
const GATEWAY_PORT = 18789;
const SYNC_INTERVAL_MS = 5000; // Sync every 5 seconds
const MAX_MESSAGES = 8;

let lastSyncHash = '';

function log(msg, data) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}${data ? ' ' + JSON.stringify(data) : ''}`;
  console.log(line);
}

function getSessionHistory() {
  return new Promise((resolve, reject) => {
    const token = process.env.OPENCLAW_GATEWAY_TOKEN;
    if (!token) {
      reject(new Error('OPENCLAW_GATEWAY_TOKEN not set'));
      return;
    }

    const body = JSON.stringify({
      sessionKey: 'main',
      limit: 20,
      includeTools: false
    });

    const req = http.request({
      hostname: GATEWAY_HOST,
      port: GATEWAY_PORT,
      path: '/api/sessions/history',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 8000
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(json.error));
          } else {
            resolve(json.messages || []);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.write(body);
    req.end();
  });
}

function parseMessages(sessionMessages) {
  const result = [];
  for (const msg of sessionMessages) {
    // Extract sender: 'user' = cade, 'assistant' = aurora
    const from = msg.role === 'user' ? 'cade' : 'aurora';
    const text = msg.content || '';
    
    if (text.trim()) {
      result.push({ from, text });
    }
  }
  return result;
}

function syncContext(messages) {
  try {
    const context = JSON.parse(fs.readFileSync(CONTEXT_FILE, 'utf8'));

    // Keep last N messages from session
    const lastMessages = messages.slice(-MAX_MESSAGES);

    // Check if anything changed
    const newHash = JSON.stringify(lastMessages);
    if (newHash === lastSyncHash) {
      return; // No change, skip write
    }
    lastSyncHash = newHash;

    // Update context
    context.lastMessages = lastMessages;
    if (lastMessages.length > 0) {
      const last = lastMessages[lastMessages.length - 1];
      context.lastMessageFrom = last.from;
      context.lastMessageTime = new Date().toISOString();
    }
    context.conversationState = 'active';

    // Atomic write
    const tmpPath = CONTEXT_FILE + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(context, null, 2));
    fs.renameSync(tmpPath, CONTEXT_FILE);

    log('Synced', { messageCount: lastMessages.length, lastFrom: context.lastMessageFrom });
  } catch (err) {
    log('Sync error', { error: err.message });
  }
}

async function syncLoop() {
  while (true) {
    try {
      const messages = await getSessionHistory();
      const parsed = parseMessages(messages);
      syncContext(parsed);
    } catch (err) {
      log('Loop error', { error: err.message });
    }
    
    await new Promise(resolve => setTimeout(resolve, SYNC_INTERVAL_MS));
  }
}

log('═══ Aurora Context Sync Daemon starting ═══');
log('Sync interval: ' + (SYNC_INTERVAL_MS / 1000) + 's');

syncLoop().catch(err => {
  log('Fatal error', { error: err.message });
  process.exit(1);
});

process.on('SIGTERM', () => { log('Stopping (SIGTERM)'); process.exit(0); });
process.on('SIGINT', () => { log('Stopping (SIGINT)'); process.exit(0); });
