#!/bin/bash
# TTS with Alloy as default voice, converts to OGG for Telegram voice messages
export OPENAI_API_KEY="${OPENAI_API_KEY:?Set OPENAI_API_KEY}"
cd /Users/cadem/.openclaw/workspace

# Generate MP3
MP3_FILE=$(./tts-voice.js "$1" "${2:-alloy}")

# Convert to OGG for Telegram voice messages
OGG_FILE="${MP3_FILE%.mp3}.ogg"
ffmpeg -i "$MP3_FILE" -c:a libopus -b:a 128k "$OGG_FILE" -y 2>/dev/null

# Return OGG path
echo "$OGG_FILE"
