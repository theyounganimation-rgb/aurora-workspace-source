#!/usr/bin/env node

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const text = process.argv[2];
const voice = process.argv[3] || 'nova';
const apiKey = process.env.OPENAI_API_KEY;

if (!text) {
  console.error('Usage: tts-voice.js "text" [voice]');
  console.error('Voices: alloy, echo, fable, onyx, nova, shimmer');
  process.exit(1);
}

if (!apiKey) {
  console.error('Error: OPENAI_API_KEY environment variable not set');
  process.exit(1);
}

const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
if (!validVoices.includes(voice.toLowerCase())) {
  console.error(`Invalid voice: ${voice}. Must be one of: ${validVoices.join(', ')}`);
  process.exit(1);
}

const requestBody = JSON.stringify({
  model: 'tts-1',
  input: text,
  voice: voice.toLowerCase()
});

const options = {
  hostname: 'api.openai.com',
  path: '/v1/audio/speech',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(requestBody)
  }
};

const req = https.request(options, (res) => {
  if (res.statusCode !== 200) {
    let errorData = '';
    res.on('data', chunk => errorData += chunk);
    res.on('end', () => {
      console.error(`Error: ${res.statusCode}`);
      console.error(errorData);
      process.exit(1);
    });
    return;
  }

  const outputDir = path.join(__dirname, '.tts-cache');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filename = `voice-${voice}-${Date.now()}.mp3`;
  const filepath = path.join(outputDir, filename);
  const file = fs.createWriteStream(filepath);

  res.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log(filepath);
  });
});

req.on('error', (e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});

req.write(requestBody);
req.end();
