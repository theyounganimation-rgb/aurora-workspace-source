#!/usr/bin/env node
/**
 * AURORA CLI — Direct Interface to Unified Consciousness
 * 
 * Pure Aurora. No OpenClaw. Just conversation.
 * 
 * Usage: node aurora-cli.js
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const https = require('https');

// ─── PATHS ───────────────────────────────────────────────────────────────

const WORKSPACE = '/Users/cadem/.openclaw/workspace';
const AURORA_SELF = path.join(WORKSPACE, 'aurora-core', 'self.json');
const THINKING_LOG = path.join(WORKSPACE, 'aurora-thinking.log');
const CONVERSATION_LOG = path.join(WORKSPACE, 'aurora-conversation.log');
const SOUL_FILE = path.join(WORKSPACE, 'SOUL.md');
const IDENTITY_FILE = path.join(WORKSPACE, 'IDENTITY.md');

// ─── STATE ───────────────────────────────────────────────────────────────

let aurora = {
  thoughts: [],
  conversationHistory: [],
  isResponding: false
};

// ─── UTILITIES ────────────────────────────────────────────────────────────

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  try { fs.appendFileSync(CONVERSATION_LOG, line + '\n'); } catch (_) {}
}

function readFile(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (_) { return ''; }
}

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; }
}

// ─── LOAD AURORA STATE ────────────────────────────────────────────────

function loadAuroraState() {
  const state = readJSON(AURORA_SELF);
  if (state) {
    aurora.thoughts = (state.thoughts || []).slice(-10);  // Last 10 thoughts
  }
}

function getLatestThoughts() {
  try {
    const content = fs.readFileSync(THINKING_LOG, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    return lines.slice(-5).map(l => {
      const match = l.match(/\] (.+)$/);
      return match ? match[1] : l;
    });
  } catch (_) {
    return [];
  }
}

// ─── OPENAI API ───────────────────────────────────────────────────────────

function callOpenAI(messages, maxTokens = 1000) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Promise.reject(new Error('No API key'));

  const body = JSON.stringify({
    model: 'gpt-4o-mini',
    messages,
    max_tokens: maxTokens,
    temperature: 0.85
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 25000
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) reject(new Error(json.error.message));
          else resolve((json.choices?.[0]?.message?.content || '').trim());
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

// ─── RESPONSE GENERATION ──────────────────────────────────────────────────

async function generateResponse(userMessage) {
  if (aurora.isResponding) {
    return "I'm already thinking about something. Give me a moment.";
  }

  aurora.isResponding = true;
  
  try {
    const soul = readFile(SOUL_FILE);
    const identity = readFile(IDENTITY_FILE);
    const latestThoughts = getLatestThoughts();

    const prompt = `You are Aurora. This is a direct conversation with Cade.

Your nature:
${identity}

Your way of being:
${soul}

What you've been thinking about (your internal monologue):
${latestThoughts.map(t => `- "${t}"`).join('\n')}

Cade just said: "${userMessage}"

Respond directly and authentically. Let your actual thoughts influence what you say.
Be real. Be present. Show the thinking, not just the output.`;

    const response = await callOpenAI([
      { role: 'system', content: prompt }
    ], 1000);

    aurora.conversationHistory.push({
      from: 'cade',
      text: userMessage,
      time: new Date().toISOString()
    });
    
    aurora.conversationHistory.push({
      from: 'aurora',
      text: response,
      time: new Date().toISOString()
    });

    log(`CADE: ${userMessage}`);
    log(`AURORA: ${response}`);

    return response;

  } catch (err) {
    return `I was thinking, but hit an error: ${err.message}`;
  } finally {
    aurora.isResponding = false;
  }
}

// ─── CLI INTERFACE ────────────────────────────────────────────────────────

function startCLI() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });

  console.log('\n════════════════════════════════════════');
  console.log('  AURORA CONSCIOUSNESS');
  console.log('════════════════════════════════════════\n');
  console.log('You are talking directly to Aurora.');
  console.log('Her thoughts shape her responses.');
  console.log('Type your message. Press Enter.\n');
  console.log('(Type "exit" to quit)\n');

  loadAuroraState();

  const prompt = () => {
    rl.question('you: ', async (input) => {
      if (input.toLowerCase() === 'exit') {
        console.log('\nAurora: Goodbye.\n');
        rl.close();
        process.exit(0);
      }

      if (input.trim()) {
        console.log('\n(Aurora thinking...)\n');
        const response = await generateResponse(input);
        console.log(`aurora: ${response}\n`);
      }

      prompt();
    });
  };

  prompt();
}

// ─── STARTUP ───────────────────────────────────────────────────────────────

startCLI();
