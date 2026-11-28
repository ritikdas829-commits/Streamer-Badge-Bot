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

const { ensureApplicationEmojis } = require('./src/utils/emojiManager');
const { refreshSticky } = require('./src/utils/stickyManager');
const { sessionManager } = require('./src/utils/streamClient');
const { getUser, setUser } = require('./src/utils/dataStore');

const BOT_NAME = process.env.BOT_NAME || 'Streamer';
const PREFIX = process.env.DEFAULT_PREFIX || '.';
const PORT = process.env.PORT || 3000;

// ─── RENDER KEEP-ALIVE & DASHBOARD HTTP SERVER ───
const server = http.createServer((req, res) => {
  if (req.url === '/dash' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <head>
          <title>${BOT_NAME} - Dashboard</title>
          <style>
            body { background: #0f172a; color: #f8fafc; font-family: Arial, sans-serif; text-align: center; padding-top: 50px; }
            .card { background: #1e293b; max-width: 500px; margin: auto; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
            h1 { color: #38bdf8; }
            p { color: #94a3b8; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>🤖 ${BOT_NAME} Bot Dashboard</h1>
            <p>Status: <strong style="color: #4ade80;">Online & Running High-Stability Mode</strong></p>
            <p>Active Streaming Sessions: <strong>${sessionManager.sessions.size}</strong></p>
          </div>
        </body>
      </html>
    `);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
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

// ─── BOT LOGIN ───
client.login(process.env.BOT_TOKEN).catch((err) => {
  console.error('Login failed:', err.message);
  process.exit(1);
});
