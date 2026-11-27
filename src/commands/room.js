'use strict';

const { getUser, setUser, getDecryptedTokens } = require('../utils/dataStore');
const { parseRoomInput } = require('../utils/streamClient');
const { baseEmbed, successEmbed, errorEmbed, replyEmbed, getEmoji } = require('../utils/helpers');

// ─── DEFAULT AUTO-ROOM CONFIG ───
const DEFAULT_ROOM = {
  channelId: '1569620321299079231',
  channelName: 'Default Main VC',
  guildId: '',
  roomInput: 'auto'
};

module.exports = {
  name: 'room',
  description: 'Set or view target voice channel',
  async execute(message, args, client) {
    const secret = process.env.ENCRYPTION_KEY || 'fallback-key-change-me-32chars!!';
    const userId = message.author.id;
    let u = getUser(userId);

    // Auto-set default room if not configured for user yet
    if (!u.channelId) {
      setUser(userId, DEFAULT_ROOM);
      u = getUser(userId);
    }

    if (!args.length) {
      const emb = baseEmbed(message.author, client.botName)
        .setTitle(`${getEmoji('cat_voice') || '🔊'} Current room`)
        .setDescription(
          u.channelId
            ? `**${u.channelName || 'Channel'}** (Auto-configured)\nID: \`${u.channelId}\`\nGuild: \`${u.guildId || 'DM/call'}\``
            : 'No room set.\nUsage: `.room <channel id or link>`'
        );
      return replyEmbed(message, emb);
    }

    const tokens = getDecryptedTokens(userId, secret);
    if (!tokens.main) {
      return replyEmbed(
        message,
        errorEmbed(
          message.author,
          client.botName,
          'Not linked',
          'Link a main token first (`.link`) so the channel can be validated.'
        )
      );
    }

    try {
      const parsed = await parseRoomInput(args.join(' '), tokens.main);
      setUser(userId, {
        roomInput: args.join(' '),
        guildId: parsed.guildId,
        channelId: parsed.channelId,
        channelName: parsed.channelName,
      });
      return replyEmbed(
        message,
        successEmbed(
          message.author,
          client.botName,
          'Room set',
          `**${parsed.channelName}**\nChannel: \`${parsed.channelId}\`\nGuild: \`${parsed.guildId || 'DM/call'}\``
        )
      );
    } catch (err) {
      return replyEmbed(
        message,
        errorEmbed(message.author, client.botName, 'Error', err.message)
      );
    }
  },
};
