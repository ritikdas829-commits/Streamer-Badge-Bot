'use strict';

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { encrypt, decrypt } = require('./encryption');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const EMOJI_CACHE = path.join(DATA_DIR, 'emojis.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(file, fallback = {}) {
  ensureDir();
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch {
    /* ignore */
  }
  return typeof fallback === 'function' ? fallback() : structuredClone(fallback);
}

function writeJson(file, data) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// ─── MONGODB USER SCHEMA & MODEL (Inside Storage) ───
const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  mainTokenEnc: { type: String, default: '' },
  altTokenEnc: { type: String, default: '' },
  roomInput: { type: String, default: '' },
  guildId: { type: String, default: null },
  channelId: { type: String, default: null },
  channelName: { type: String, default: '' },
  totalSeconds: { type: Number, default: 0 },
  linkedAt: { type: Number, default: null },
  updatedAt: { type: Date, default: Date.now },
});

const StreamUser = mongoose.models.StreamUser || mongoose.model('StreamUser', userSchema);

// In-memory cache to keep synchronous command calls working instantly
const userCache = new Map();

/**
 * Sync all users from MongoDB into memory cache on startup.
 */
async function syncDatabaseToMemory() {
  try {
    const docs = await StreamUser.find({});
    for (const doc of docs) {
      userCache.set(doc.userId, {
        mainTokenEnc: doc.mainTokenEnc || '',
        altTokenEnc: doc.altTokenEnc || '',
        roomInput: doc.roomInput || '',
        guildId: doc.guildId || null,
        channelId: doc.channelId || null,
        channelName: doc.channelName || '',
        totalSeconds: doc.totalSeconds || 0,
        linkedAt: doc.linkedAt || null,
      });
    }
    console.log(`[DataStore] Synced ${docs.length} users from MongoDB into memory.`);
  } catch (err) {
    console.error('[DataStore] MongoDB sync error:', err.message);
  }
}

/* -------------------- Config -------------------- */
function loadConfig() {
  return readJson(CONFIG_FILE, {
    stickyChannelId: null,
    stickyMessageId: null,
    stickyLine: 'Put Server Vanity In Status to Get access',
    defaultVcId: null,
    streamerRoleId: null,
    allowedCommandChannels: [],
  });
}

function saveConfig(cfg) {
  writeJson(CONFIG_FILE, cfg);
}

/* -------------------- Users (MongoDB + Cache) -------------------- */
function loadUsers() {
  const obj = {};
  for (const [userId, data] of userCache.entries()) {
    obj[userId] = data;
  }
  return obj;
}

function saveUsers(users) {
  for (const [userId, data] of Object.entries(users)) {
    userCache.set(userId, data);
    StreamUser.findOneAndUpdate(
      { userId },
      { $set: { ...data, updatedAt: new Date() } },
      { upsert: true, new: true }
    ).catch(err => console.error(`[DataStore] Failed to save user ${userId}:`, err.message));
  }
}

/**
 * Get user record. Tokens are stored encrypted.
 */
function getUser(userId) {
  if (!userCache.has(userId)) {
    userCache.set(userId, {
      mainTokenEnc: '',
      altTokenEnc: '',
      roomInput: '',
      guildId: null,
      channelId: null,
      channelName: '',
      totalSeconds: 0,
      linkedAt: null,
    });
  }
  return userCache.get(userId);
}

function setUser(userId, partial) {
  const current = getUser(userId);
  const updated = { ...current, ...partial };
  userCache.set(userId, updated);

  // Push updates to MongoDB asynchronously
  StreamUser.findOneAndUpdate(
    { userId },
    { $set: { ...updated, updatedAt: new Date() } },
    { upsert: true, new: true }
  ).catch(err => console.error(`[DataStore] Failed to update user ${userId}:`, err.message));

  return updated;
}

function deleteUser(userId) {
  userCache.delete(userId);
  StreamUser.deleteOne({ userId }).catch(err => console.error(`[DataStore] Failed to delete user ${userId}:`, err.message));
}

function getDecryptedTokens(userId, secret) {
  const u = getUser(userId);
  return {
    main: decrypt(u.mainTokenEnc, secret),
    alt: decrypt(u.altTokenEnc, secret),
  };
}

function setMainToken(userId, token, secret) {
  setUser(userId, {
    mainTokenEnc: encrypt(token, secret),
    linkedAt: Date.now(),
  });
}

function setAltToken(userId, token, secret) {
  setUser(userId, {
    altTokenEnc: token ? encrypt(token, secret) : '',
  });
}

/* -------------------- Emoji cache -------------------- */
function loadEmojiCache() {
  return readJson(EMOJI_CACHE, {});
}

function saveEmojiCache(map) {
  writeJson(EMOJI_CACHE, map);
}

module.exports = {
  syncDatabaseToMemory,
  loadConfig,
  saveConfig,
  loadUsers,
  saveUsers,
  getUser,
  setUser,
  deleteUser,
  getDecryptedTokens,
  setMainToken,
  setAltToken,
  loadEmojiCache,
  saveEmojiCache,
  DATA_DIR,
};
