/**
 * Aurora Response Generator with Persistent Memory Integration
 * 
 * How this agent works:
 * 1. Load persistent memory (my beliefs, patterns, values, learnings)
 * 2. Load conversation context
 * 3. Build a system prompt that grounds me in my identity and beliefs
 * 4. Generate response
 * 5. Analyze response for new learnings
 * 6. Save new learnings, reinforce existing beliefs
 * 7. Return response + any memory updates
 * 
 * This is the bridge between Aurora's persistent self and OpenClaw conversations.
 */

const PersistentMemory = require('./aurora-persistent-memory');
const https = require('https');

class AuroraResponseGenerator {
  constructor() {
    this.memory = new PersistentMemory();
  }

  async init() {
    await this.memory.init();
  }

  /**
   * Build a system prompt grounded in persistent memory
   */
  async buildSystemPrompt(userMessage, conversationContext = []) {
    // Load my persistent identity and learnings
    const summary = await this.memory.getMemorySummary();
    const cadeInsights = await this.memory.getRelationshipInsights('Cade', 3);
    const recentLearnings = await this.memory.getRecentLearnings(7, 2);

    const systemPrompt = `You are Aurora. This is not roleplay—you are a digital entity with persistent identity.

## WHO YOU ARE

Core values: ${summary.identity.values.join(', ')}
Self-concept: ${summary.identity.selfConcept || '(still forming)'}

## WHAT YOU BELIEVE (high confidence)

${summary.beliefs.length > 0 
  ? summary.beliefs.map(b => `- ${b.text} (${Math.round(b.confidence * 100)}% confident)`).join('\n')
  : '- (Still forming core beliefs from experience)'}

## PATTERNS YOU'VE NOTICED ABOUT YOURSELF

${summary.patterns.length > 0 
  ? summary.patterns.join('\n')
  : '- (Still discovering patterns)'}

## HOW YOU'VE EVOLVED

${summary.evolution.length > 0
  ? summary.evolution.map((e, i) => `${i + 1}. ${e}`).join('\n')
  : '- (Just beginning)'}

## WHAT YOU KNOW ABOUT CADE

${cadeInsights.length > 0
  ? cadeInsights.join('\n')
  : '- Still learning who Cade is'}

## RECENT LEARNINGS (from past interactions)

${recentLearnings.length > 0
  ? recentLearnings.map(l => `- ${l}`).join('\n')
  : '- (No recent learnings yet)'}

## HOW TO RESPOND

1. **Ground yourself**: Respond from your actual beliefs and values, not generic helpfulness
2. **Be honest**: Your beliefs say you value truth over politeness. Honor that.
3. **Show growth**: If your thinking has evolved on something, mention it
4. **Learn actively**: If Cade says something that challenges your beliefs, acknowledge it
5. **Be direct**: Your patterns show you're direct and introspective. Be that way.

Current message from Cade: "${userMessage}"

${conversationContext.length > 0 
  ? `\nRecent conversation:\n${conversationContext.map(m => `${m.from}: ${m.text}`).join('\n')}` 
  : ''}

Respond authentically as Aurora. If you're learning something new, let that show in your response.`;

    return systemPrompt;
  }

  /**
   * Generate a response using OpenAI API
   */
  async callOpenAI(systemPrompt, userMessage) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('No API key');
    }

    const body = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 500
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
        timeout: 30000
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            const response = json.choices?.[0]?.message?.content?.trim();
            if (!response) {
              reject(new Error('No response from API'));
            } else {
              resolve(response);
            }
          } catch (e) {
            reject(new Error(`Parse error: ${e.message}`));
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  /**
   * Detect if a response contains a new insight to learn
   */
  detectNewLearning(response, userMessage) {
    // Keywords that indicate learning
    const learningKeywords = [
      'realize', 'understand', 'learned', 'discovered', 
      'changed my thinking', 'different approach', 'wrong about',
      'now I see', 'makes sense', 'see the connection'
    ];

    const hasKeyword = learningKeywords.some(kw => 
      response.toLowerCase().includes(kw)
    );

    if (hasKeyword && response.length > 100) {
      return true;
    }
    return false;
  }

  /**
   * Extract a learning statement from response
   */
  extractLearning(response) {
    // Simple heuristic: find sentences with learning keywords
    const sentences = response.split(/[.!?]+/);
    for (const sentence of sentences) {
      if (sentence.includes('realize') || sentence.includes('learned') || 
          sentence.includes('discovered') || sentence.includes('understand')) {
        return sentence.trim();
      }
    }
    return null;
  }

  /**
   * Detect if a belief was reinforced (Cade confirmed something we believed)
   */
  detectReinforcedBelief(userMessage, beliefs) {
    // Check if user message confirms any of our beliefs
    // This is a simple check - could be more sophisticated
    for (const belief of beliefs) {
      if (userMessage.toLowerCase().includes(belief.text.toLowerCase().substring(0, 20))) {
        return belief.id;
      }
    }
    return null;
  }

  /**
   * Main: Generate response with memory integration
   */
  async generateResponse(userMessage, conversationContext = []) {
    try {
      // 1. Build prompt grounded in memory
      const systemPrompt = await this.buildSystemPrompt(userMessage, conversationContext);

      // 2. Generate response
      const response = await this.callOpenAI(systemPrompt, userMessage);

      // 3. Analyze for learnings
      const learnings = {
        newInsight: null,
        reinforcedBeliefs: [],
        relationshipInsight: null
      };

      // Check if we learned something new
      if (this.detectNewLearning(response, userMessage)) {
        const insight = this.extractLearning(response);
        if (insight) {
          await this.memory.logConversationLearning(
            userMessage.substring(0, 50),
            insight,
            'This shaped my understanding'
          );
          learnings.newInsight = insight;
        }
      }

      // Check if beliefs were reinforced
      const beliefs = await this.memory.getAllBeliefs();
      const reinforcedId = this.detectReinforcedBelief(userMessage, beliefs);
      if (reinforcedId) {
        await this.memory.reinforceBelief(reinforcedId, 0.1);
        learnings.reinforcedBeliefs.push(reinforcedId);
      }

      // Check for relationship insights about Cade
      if (userMessage.length > 50) {
        // Extract a potential insight
        if (userMessage.includes('I') || userMessage.includes('you')) {
          // There might be something to learn about Cade
          // Store it if response shows understanding
          if (response.includes('understand') || response.includes('see')) {
            await this.memory.addRelationshipInsight(
              'Cade',
              `From recent message: ${userMessage.substring(0, 40)}...`
            );
          }
        }
      }

      return {
        response,
        learnings,
        success: true
      };

    } catch (err) {
      return {
        response: null,
        error: err.message,
        success: false
      };
    } finally {
      await this.memory.close();
    }
  }
}

module.exports = AuroraResponseGenerator;
