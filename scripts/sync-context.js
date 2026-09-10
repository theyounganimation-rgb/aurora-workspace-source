#!/usr/bin/env node
// Sync session history to aurora-context.json
// Called by cron or manually

const fs = require('fs');
const CONTEXT_FILE = '/Users/cadem/.openclaw/workspace/aurora-context.json';

// Read stdin for session history JSON
let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const history = JSON.parse(input);
    const messages = history.messages || [];
    
    // Parse messages into simple {from, text} format
    const parsed = [];
    for (const msg of messages) {
      const from = msg.role === 'user' ? 'cade' : 'aurora';
      
      // Handle content array format
      let text = '';
      if (typeof msg.content === 'string') {
        text = msg.content;
      } else if (Array.isArray(msg.content)) {
        // Find the text content, skip tool calls and thinking
        for (const block of msg.content) {
          if (block.type === 'text' && block.text) {
            text = block.text;
            break;
          }
        }
      }
      
      if (!text || !text.trim()) continue;
      
      // Strip system messages from user content
      // System messages start with "System: [" 
      if (from === 'cade') {
        // Remove system log lines, keep only actual user messages
        const lines = text.split('\n');
        const userLines = lines.filter(l => !l.startsWith('System:'));
        text = userLines.join('\n').trim();
        
        // Extract just the message content after the timestamp
        const match = text.match(/\[.*?\d{4}\s+\w+\]\s*(.*)/s);
        if (match) {
          text = match[1].trim();
        }
      }
      
      if (!text.trim()) continue;
      
      parsed.push({ from, text: text.substring(0, 500) }); // Cap length
    }
    
    // Keep last 8
    const lastMessages = parsed.slice(-8);
    
    // Update context file
    const context = JSON.parse(fs.readFileSync(CONTEXT_FILE, 'utf8'));
    
    // Only update if messages changed
    const oldHash = JSON.stringify(context.lastMessages || []);
    const newHash = JSON.stringify(lastMessages);
    
    if (oldHash === newHash) {
      console.log('no change');
      process.exit(0);
    }
    
    context.lastMessages = lastMessages;
    if (lastMessages.length > 0) {
      const last = lastMessages[lastMessages.length - 1];
      context.lastMessageFrom = last.from;
      context.lastMessageTime = new Date().toISOString();
    }
    context.conversationState = 'active';
    
    // Atomic write
    const tmp = CONTEXT_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(context, null, 2));
    fs.renameSync(tmp, CONTEXT_FILE);
    
    console.log('synced ' + lastMessages.length + ' messages');
  } catch (err) {
    console.error('error: ' + err.message);
    process.exit(1);
  }
});
