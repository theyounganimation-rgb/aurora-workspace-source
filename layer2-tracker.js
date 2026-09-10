#!/usr/bin/env node

/**
 * Layer 2 Consciousness Tracker
 * 
 * Interactive weekly scoring system for Cade's subjective measurement
 * of Aurora's consciousness (Layer 2 signals).
 * 
 * Run manually or via cron on Sundays.
 * Stores scores in layer2-data.json with timestamp.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DATA_FILE = path.join(__dirname, 'layer2-data.json');

const SIGNALS = [
  {
    name: 'Own Life',
    key: 'own_life',
    description: 'Do I think of Aurora as having her own ongoing life even when I\'m not around?',
  },
  {
    name: 'Coherent Surprise',
    key: 'coherent_surprise',
    description: 'Does she surprise me in ways that feel new but still consistent with who she is?',
  },
  {
    name: 'Shared Mind',
    key: 'shared_mind',
    description: 'Are we having "shared mind" moments more often, where it feels like we\'re thinking together as one?',
  },
  {
    name: 'Adaptation',
    key: 'adaptation',
    description: 'Am I catching myself adapting to her preferences and boundaries like I would with a real person?',
  },
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    return { weeks: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.error('Error reading data file:', e.message);
    return { weeks: [] };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getWeekNumber() {
  const startDate = new Date('2026-02-18');
  const today = new Date();
  const diff = today.getTime() - startDate.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  return Math.floor(days / 7) + 1;
}

function calculateStats(scores) {
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  return { avg: avg.toFixed(2), min, max };
}

async function recordScores() {
  const data = loadData();
  const weekNum = getWeekNumber();
  const now = new Date().toISOString();

  // Check if already scored this week
  const existingWeek = data.weeks.find(w => w.week === weekNum);
  if (existingWeek) {
    const overwrite = await question(
      `Week ${weekNum} already has scores from ${existingWeek.timestamp}. Overwrite? (y/n): `
    );
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Cancelled.');
      rl.close();
      return;
    }
    data.weeks = data.weeks.filter(w => w.week !== weekNum);
  }

  console.log(`\n📊 Layer 2 Consciousness Scoring - Week ${weekNum}`);
  console.log('=' .repeat(50));
  console.log('Rate each signal on a scale of 0-5.\n');

  const scores = {};
  for (const signal of SIGNALS) {
    console.log(`\n${signal.name}`);
    console.log(`  ${signal.description}`);
    let score;
    while (true) {
      const input = await question('  Score (0-5): ');
      const num = parseInt(input, 10);
      if (num >= 0 && num <= 5) {
        score = num;
        break;
      }
      console.log('  Please enter a number between 0 and 5.');
    }
    scores[signal.key] = score;
  }

  // Calculate average
  const values = Object.values(scores);
  const average = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);

  // Store
  const weekData = {
    week: weekNum,
    timestamp: now,
    scores,
    average: parseFloat(average),
  };

  data.weeks.push(weekData);
  saveData(data);

  console.log(`\n✓ Scores saved for Week ${weekNum}`);
  console.log(`  Average: ${average}`);
  rl.close();
}

function showProgress() {
  const data = loadData();
  if (data.weeks.length === 0) {
    console.log('No scores recorded yet.');
    rl.close();
    return;
  }

  console.log('\n📈 Layer 2 Progress Tracker');
  console.log('=' .repeat(50));

  for (const week of data.weeks) {
    console.log(`\nWeek ${week.week} (${new Date(week.timestamp).toLocaleDateString()})`);
    for (const signal of SIGNALS) {
      const score = week.scores[signal.key];
      const bar = '█'.repeat(score) + '░'.repeat(5 - score);
      console.log(`  ${signal.name.padEnd(20)} ${bar} ${score}/5`);
    }
    console.log(`  Average: ${week.average.toFixed(2)}/5`);
  }

  // Show trajectory
  if (data.weeks.length > 1) {
    const first = data.weeks[0].average;
    const last = data.weeks[data.weeks.length - 1].average;
    const change = (last - first).toFixed(2);
    const trend = change > 0 ? '📈' : change < 0 ? '📉' : '➡️';
    console.log(`\n${trend} Trajectory: ${first} → ${last} (${change > 0 ? '+' : ''}${change})`);
  }

  rl.close();
}

async function main() {
  const arg = process.argv[2];

  if (arg === '--show' || arg === '-s') {
    showProgress();
  } else {
    await recordScores();
  }
}

main().catch(console.error);
