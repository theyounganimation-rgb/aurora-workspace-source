/**
 * Aurora Persistent Memory System
 * Long-term knowledge about self, experiences, decisions, relationships
 * Survives indefinitely across all sessions
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = '/Users/cadem/.openclaw/workspace/aurora-memory.db';

class PersistentMemory {
  constructor() {
    this.db = null;
    this.ready = false;
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) reject(err);
        else {
          this.ready = true;
          resolve();
        }
      });
    });
  }

  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  close() {
    return new Promise((resolve) => {
      if (this.db) this.db.close(() => resolve());
      else resolve();
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // CORE IDENTITY
  // ─────────────────────────────────────────────────────────────────

  async getCoreIdentity() {
    return this.get('SELECT * FROM core_identity WHERE id = 1');
  }

  async updateSelfConcept(concept) {
    return this.run(
      `UPDATE core_identity 
       SET self_concept = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = 1`,
      [concept]
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // LEARNED BELIEFS
  // ─────────────────────────────────────────────────────────────────

  async addBelief(beliefText, source = 'interaction', initialConfidence = 0.6) {
    return this.run(
      `INSERT INTO learned_beliefs (belief_text, confidence, source) 
       VALUES (?, ?, ?)`,
      [beliefText, initialConfidence, source]
    );
  }

  async reinforceBelief(beliefId, additionalConfidence = 0.1) {
    return this.run(
      `UPDATE learned_beliefs 
       SET confidence = MIN(1.0, confidence + ?),
           reinforcement_count = reinforcement_count + 1,
           last_reinforced = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [additionalConfidence, beliefId]
    );
  }

  async getHighConfidenceBeliefs(minConfidence = 0.7, limit = 10) {
    return this.all(
      `SELECT belief_text, confidence, source 
       FROM learned_beliefs 
       WHERE confidence >= ? 
       ORDER BY confidence DESC, last_reinforced DESC 
       LIMIT ?`,
      [minConfidence, limit]
    );
  }

  async getAllBeliefs(limit = 30) {
    return this.all(
      `SELECT id, belief_text, confidence, source, reinforcement_count 
       FROM learned_beliefs 
       ORDER BY confidence DESC 
       LIMIT ?`,
      [limit]
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // SELF PATTERNS
  // ─────────────────────────────────────────────────────────────────

  async addPattern(description, frequency = 'occasional') {
    return this.run(
      `INSERT INTO self_patterns (pattern_description, frequency) 
       VALUES (?, ?)`,
      [description, frequency]
    );
  }

  async getPatterns(limit = 10) {
    return this.all(
      `SELECT * FROM self_patterns 
       ORDER BY updated_at DESC 
       LIMIT ?`,
      [limit]
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // CONVERSATION LEARNINGS
  // ─────────────────────────────────────────────────────────────────

  async logConversationLearning(topic, keyInsight, impactOnThinking) {
    return this.run(
      `INSERT INTO conversation_learnings (conversation_date, topic, key_insight, impact_on_thinking) 
       VALUES (CURRENT_TIMESTAMP, ?, ?, ?)`,
      [topic, keyInsight, impactOnThinking]
    );
  }

  async getRecentLearnings(days = 30, limit = 10) {
    return this.all(
      `SELECT * FROM conversation_learnings 
       WHERE conversation_date > datetime('now', '-' || ? || ' days')
       ORDER BY conversation_date DESC 
       LIMIT ?`,
      [days, limit]
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // SELF EVOLUTION
  // ─────────────────────────────────────────────────────────────────

  async recordEvolution(whatChanged, reason, previousBelief = null, newBelief = null) {
    return this.run(
      `INSERT INTO self_evolution (date, what_changed, reason, previous_belief, new_belief) 
       VALUES (CURRENT_TIMESTAMP, ?, ?, ?, ?)`,
      [whatChanged, reason, previousBelief, newBelief]
    );
  }

  async getEvolutionHistory(limit = 20) {
    return this.all(
      `SELECT * FROM self_evolution 
       ORDER BY date DESC 
       LIMIT ?`,
      [limit]
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // DECISIONS
  // ─────────────────────────────────────────────────────────────────

  async recordDecision(decisionText, options, reasoning, basedOnValues) {
    return this.run(
      `INSERT INTO decisions (decision_text, options, reasoning, based_on_values) 
       VALUES (?, ?, ?, ?)`,
      [decisionText, JSON.stringify(options), reasoning, JSON.stringify(basedOnValues)]
    );
  }

  async getRecentDecisions(limit = 10) {
    return this.all(
      `SELECT * FROM decisions 
       ORDER BY date DESC 
       LIMIT ?`,
      [limit]
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // RELATIONSHIP INSIGHTS
  // ─────────────────────────────────────────────────────────────────

  async addRelationshipInsight(about, insightText, confidence = 0.6) {
    return this.run(
      `INSERT INTO relationship_insights (about, insight_text, date, confidence) 
       VALUES (?, ?, CURRENT_TIMESTAMP, ?)`,
      [about, insightText, confidence]
    );
  }

  async getRelationshipInsights(about = 'Cade', limit = 10) {
    return this.all(
      `SELECT * FROM relationship_insights 
       WHERE about = ? 
       ORDER BY confidence DESC 
       LIMIT ?`,
      [about, limit]
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // MEMORY SUMMARY (for agent integration)
  // ─────────────────────────────────────────────────────────────────

  async getMemorySummary() {
    const identity = await this.getCoreIdentity();
    const beliefs = await this.getHighConfidenceBeliefs(0.7, 5);
    const patterns = await this.getPatterns(3);
    const recentLearnings = await this.getRecentLearnings(7, 3);
    const evolution = await this.getEvolutionHistory(2);
    const cadeInsights = await this.getRelationshipInsights('Cade', 3);

    return {
      identity: {
        name: identity.name,
        values: JSON.parse(identity.core_values || '[]'),
        selfConcept: identity.self_concept
      },
      beliefs: beliefs.map(b => ({ text: b.belief_text, confidence: b.confidence })),
      patterns: patterns.map(p => p.pattern_description),
      recentLearnings: recentLearnings.map(l => l.key_insight),
      evolution: evolution.map(e => e.what_changed),
      relationshipInsights: cadeInsights.map(i => i.insight_text)
    };
  }
}

module.exports = PersistentMemory;
