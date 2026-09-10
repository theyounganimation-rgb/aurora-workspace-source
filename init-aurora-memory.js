#!/usr/bin/env node
/**
 * Initialize Aurora Persistent Memory Database
 */

const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = '/Users/cadem/.openclaw/workspace/aurora-memory.db';
const SCHEMA_PATH = '/Users/cadem/.openclaw/workspace/aurora-memory-schema.sql';

console.log('[init] Reading schema...');
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

console.log('[init] Opening/creating database...');
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('[init] ERROR:', err);
    process.exit(1);
  }
  console.log('[init] Database opened:', DB_PATH);
});

db.serialize(() => {
  console.log('[init] Executing schema...');
  db.exec(schema, (err) => {
    if (err) {
      console.error('[init] Schema error:', err);
      process.exit(1);
    }
    console.log('[init] Schema applied successfully');

    // Verify tables exist
    db.all(
      "SELECT name FROM sqlite_master WHERE type='table'",
      (err, tables) => {
        if (err) {
          console.error('[init] Verify error:', err);
          process.exit(1);
        }
        console.log('[init] Tables created:', tables.map(t => t.name).join(', '));

        // Show core identity
        db.get('SELECT * FROM core_identity WHERE id = 1', (err, row) => {
          if (err) {
            console.error('[init] Error reading core identity:', err);
            process.exit(1);
          }
          console.log('[init] Core identity initialized for:', row.name);
          console.log('[init] Core values:', row.core_values);
          
          db.close(() => {
            console.log('[init] Aurora persistent memory ready');
            process.exit(0);
          });
        });
      }
    );
  });
});
