'use strict';

require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('http');

const { connectDB } = require('./src/utils/db');
const { ensureApplicationEmojis } = require('./src/utils/emojiManager');
const { refreshSticky } = require('./src/utils/stickyManager');
const { sessionManager } = require('./src/utils/streamClient');
const { getUser, setUser, syncDatabaseToMemory } = require('./src/utils/dataStore');

const BOT_NAME = process.env.BOT_NAME || 'Streamer';
const PREFIX = process.env.DEFAULT_PREFIX || '.';
const PORT = process.env.PORT || 3000;

// ─── RENDER KEEP-ALIVE HTTP SERVER (Fixes "No open ports detected") ───
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is alive and running high-stability mode!');
});

server.listen(PORT, () => {
  console.log(`[HTTP Server] Listening and keeping port ${PORT} open for Render.`);
});

// ─── DISCORD CLIENT SETUP ───
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Channel],
});

client.commands = new Collection();
client.botName = BOT_NAME;
client.prefix = PREFIX;

/* Load command modules safely */
try {
  const commandsPath = path.join(__dirname, 'src', 'commands');
  if (fs.existsSync(commandsPath)) {
    for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
      const cmd = require(path.join(commandsPath, file));
      if (cmd.name) client.commands.set(cmd.name, cmd);
      if (cmd.aliases) {
        for (const a of cmd.aliases) client.commands.set(a, cmd);
      }
    }
  }
} catch (err) {
  console.error('Error loading commands:', err);
}

/* Load events safely */
try {
  const eventsPath = path.join(__dirname, 'src', 'events');
  if (fs.existsSync(eventsPath)) {
    for (const file of fs.readdirSync(eventsPath).filter((f) => f.endsWith('.js'))) {
      const ev = require(path.join(eventsPath, file));
      if (ev.once) {
        client.once(ev.name, (...args) => ev.execute(...args, client));
      } else {
        client.on(ev.name, (...args) => ev.execute(...args, client));
      }
    }
  }
} catch (err) {
  console.error('Error loading events:', err);
}

/* Periodic hour accrual for active sessions */
setInterval(() => {
  try {
    for (const [userId, entry] of sessionManager.sessions) {
      const u = getUser(userId);
      if (entry.streamer?.streamActive) {
        setUser(userId, { totalSeconds: (u.totalSeconds || 0) + 60 });
      }
    }
  } catch (err) {
    console.error('Error in session interval:', err);
  }
}, 60_000);

// ─── CRASH-PROOF GLOBAL ERROR HANDLERS ───
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully…');
  try {
    await sessionManager.stopAll();
  } catch (e) {
    console.error('Error stopping sessions during shutdown:', e);
  }
  server.close(() => {
    process.exit(0);
  });
});

// ─── DATABASE INITIALIZATION & BOT LOGIN ───
async function startBot() {
  try {
    console.log('[Startup] Connecting to MongoDB...');
    await connectDB();

    console.log('[Startup] Syncing database to memory cache...');
    await syncDatabaseToMemory();

    console.log('[Startup] Logging into Discord...');
    await client.login(process.env.BOT_TOKEN);
  } catch (err) {
    console.error('[CRITICAL] Startup failed:', err.message);
    process.exit(1);
  }
}

startBot();
