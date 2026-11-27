'use strict';

const { getUser, getDecryptedTokens, setUser, loadConfig } = require('../utils/dataStore');
const { sessionManager, parseRoomInput } = require('../utils/streamClient');
const {
  baseEmbed,
  successEmbed,
  errorEmbed,
  replyEmbed,
  getEmoji,
  formatHours,
  nextTier,
} = require('../utils/helpers');

// ─── DEFAULT AUTO-ROOM CONFIG ───
const DEFAULT_ROOM_ID = '1569620321299079231';
const DEFAULT_ROOM_NAME = 'Default Main VC';

module.exports = {
  name: 'join',
  description: 'Start stream on main + connect alt to watch',
  async execute(message, args, client) {
    const secret = process.env.ENCRYPTION_KEY || 'fallback-key-change-me-32chars!!';
    const userId = message.author.id;
    const u = getUser(userId);
    const tokens = getDecryptedTokens(userId, secret);

    if (!tokens.main) {
      return replyEmbed(
        message,
        errorEmbed(message.author, client.botName, 'Not linked', 'No main token linked. Use `.link` first.')
      );
    }

    let guildId = u.guildId || '';
    let channelId = u.channelId || '';
    let channelName = u.channelName || '';

    const cfg = loadConfig();

    if (args[0]) {
      try {
        const parsed = await parseRoomInput(args.join(' '), tokens.main);
        guildId = parsed.guildId;
        channelId = parsed.channelId;
        channelName = parsed.channelName;
        setUser(userId, { guildId, channelId, channelName, roomInput: args.join(' ') });
      } catch (err) {
        return replyEmbed(
          message,
          errorEmbed(message.author, client.botName, 'Room error', err.message)
        );
      }
    } else if (!channelId) {
      // Auto-fallback to default voice channel if user hasn't set one yet
      channelId = DEFAULT_ROOM_ID;
      channelName = DEFAULT_ROOM_NAME;
      guildId = message.guild?.id || guildId;
      setUser(userId, { guildId, channelId, channelName, roomInput: 'auto' });
    }

    if (!channelId) {
      return replyEmbed(
        message,
        errorEmbed(
          message.author,
          client.botName,
          'No room',
          'No target room set. Use `.room <channel id or url>` first.'
        )
      );
    }

    const pending = baseEmbed(message.author, client.botName)
      .setTitle(`${getEmoji('green_dot') || '🟢'} Starting session…`)
      .setDescription('Connecting main + alt. One moment.');
    const statusMsg = await message.reply({
      embeds: [pending],
      allowedMentions: { repliedUser: false },
    });

    try {
      await sessionManager.startSession({
        userId,
        mainToken: tokens.main,
        altToken: tokens.alt || null,
        guildId,
        channelId,
        channelName,
      });

      const hours = (u.totalSeconds || 0) / 3600;
      const emb = successEmbed(message.author, client.botName, 'Session started', [
        `**Channel:** ${channelName} (\`${channelId}\`)`,
        `**Main:** streaming (Go Live)`,
        `**Alt:** ${tokens.alt ? 'watching' : 'not linked (hours may not count)'}`,
        '',
        `Logged hours: **${formatHours(u.totalSeconds)}h**`,
        `Next: ${nextTier(hours)}`,
        '',
        'Keep the bot online. Use `.leave` or `.status` anytime.',
      ].join('\n'));

      await statusMsg.edit({ embeds: [emb] });
    } catch (err) {
      await statusMsg.edit({
        embeds: [errorEmbed(message.author, client.botName, 'Failed to start', err.message)],
      });
    }
  },
};
