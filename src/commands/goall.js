'use strict';

const { loadUsers, getDecryptedTokens, loadConfig } = require('../utils/dataStore');
const { sessionManager } = require('../utils/streamClient');
const { successEmbed, replyEmbed } = require('../utils/helpers');

module.exports = {
  name: 'goall',
  ownerOnly: true,
  description: 'Force start stream for all linked users using the default or set room',
  async execute(message, args, client) {
    const secret = process.env.ENCRYPTION_KEY || 'fallback-key-change-me-32chars!!';
    const users = loadUsers();
    const cfg = loadConfig();
    let started = 0;
    let skipped = 0;

    // वर्तमान सर्वर की आईडी या कॉन्फ़िगरेशन से डिफ़ॉल्ट गिल्ड लें
    const defaultGuildId = message.guild?.id || cfg.defaultGuildId;

    for (const [userId, u] of Object.entries(users)) {
      const tokens = getDecryptedTokens(userId, secret);
      
      // चेक करें कि यूज़र के पास एक्टिव टोकन (main token) है या नहीं
      if (!tokens.main) {
        skipped++;
        continue;
      }

      // अगर यूज़र का खुद का रूम सेट नहीं है, तो आपके द्वारा सेट किया गया डिफ़ॉल्ट रूम ले लेगा
      const channelId = u.channelId || cfg.defaultVcId;
      const guildId = u.guildId || defaultGuildId;

      if (!channelId) {
        skipped++;
        continue;
      }

      // अगर सेशन पहले से चल रहा है तो उसे दोबारा शुरू करने से बचें
      if (sessionManager.has(userId)) {
        skipped++;
        continue;
      }

      try {
        await sessionManager.startSession({
          userId,
          mainToken: tokens.main,
          altToken: tokens.alt || null,
          guildId,
          channelId,
          channelName: u.channelName || 'VC',
        });
        started++;
      } catch (err) {
        console.error(`[GoAll] Failed for user ${userId}:`, err.message);
        skipped++;
      }
    }

    return replyEmbed(
      message,
      successEmbed(
        message.author,
        client.botName,
        'goall',
        `Started: **${started}** · Skipped: **${skipped}**`
      )
    );
  },
};
