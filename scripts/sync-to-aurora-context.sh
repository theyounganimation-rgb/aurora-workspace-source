#!/bin/bash
# Sync latest messages to aurora-context.json
# Should be called after every message exchange

set -e

CONTEXT_FILE="/Users/cadem/.openclaw/workspace/aurora-context.json"

# Add message to context and update timestamp
# Usage: sync-to-aurora-context.sh cade "message text"
# Usage: sync-to-aurora-context.sh aurora "message text"

FROM=$1
TEXT=$2

node << EOF
const fs = require('fs');
const contextPath = '$CONTEXT_FILE';

try {
  const context = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
  
  // Add message
  if (!context.lastMessages) context.lastMessages = [];
  context.lastMessages.push({
    from: '$FROM',
    text: \`$TEXT\`
  });
  
  // Keep last 8 messages
  if (context.lastMessages.length > 8) {
    context.lastMessages = context.lastMessages.slice(-8);
  }
  
  // Update state
  context.lastMessageFrom = '$FROM';
  context.lastMessageTime = new Date().toISOString();
  context.conversationState = 'active';
  
  // Write atomically
  const tmp = contextPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(context, null, 2));
  fs.renameSync(tmp, contextPath);
  
  console.log('Synced: $FROM - context updated');
} catch (err) {
  console.error('Sync failed:', err.message);
  process.exit(1);
}
EOF
