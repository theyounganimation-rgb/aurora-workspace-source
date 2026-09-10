#!/usr/bin/env node
// Helper to update aurora-context.json after conversations
// This is called by the main Aurora session after every message exchange

const fs = require('fs');
const path = require('path');

const contextPath = path.join(__dirname, '..', 'aurora-context.json');

function updateContext(updates) {
  try {
    const context = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
    
    // Merge updates
    Object.assign(context, updates);
    
    // Always update lastMessageTime
    context.lastMessageTime = new Date().toISOString();
    
    // Write atomically to avoid partial reads
    const tempPath = contextPath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(context, null, 2));
    fs.renameSync(tempPath, contextPath);
  } catch (err) {
    console.error('Failed to update context:', err.message);
  }
}

function addMessage(from, text) {
  try {
    const context = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
    
    // Add message to lastMessages
    if (!context.lastMessages) context.lastMessages = [];
    context.lastMessages.push({ from, text });
    
    // Keep only last 8 messages
    if (context.lastMessages.length > 8) {
      context.lastMessages = context.lastMessages.slice(-8);
    }
    
    context.lastMessageFrom = from;
    context.lastMessageTime = new Date().toISOString();
    context.conversationState = 'active';
    
    // Write atomically
    const tempPath = contextPath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(context, null, 2));
    fs.renameSync(tempPath, contextPath);
  } catch (err) {
    console.error('Failed to add message:', err.message);
  }
}

module.exports = { updateContext, addMessage };
