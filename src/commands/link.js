'use strict';

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { baseEmbed, replyEmbed, getEmoji, buttonEmoji } = require('../utils/helpers');

module.exports = {
  name: 'link',
  aliases: [],
  description: 'Open the Link Your Account menu',
  async execute(message, args, client) {
    const emb = baseEmbed(message.author, client.botName)
      .setTitle(`${getEmoji('link') || '🔗'} Link Your Account`)
      .setDescription(
        [
          'Connect your Discord account to unlock V3XQuest quest features.',
          '',
          `${getEmoji('book') || '📖'} **Choose your setup guide:**`,
          'Select **Link Token** or **Link Alt Token** to connect your accounts, or choose your device guide below.',
          '',
          `${getEmoji('cross') || '❌'} **Security:** Never post account credentials in a server channel or share them with anyone.`,
        ].join('\n')
      );

    // Row 1: मुख्य टोकन लिंकिंग बटन्स (Link Token और Link Alt Token एक साथ)
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('link_main_token')
        .setLabel('Link Token')
        .setStyle(ButtonStyle.Primary)
        .setEmoji(buttonEmoji('link69', '🔗')),
      new ButtonBuilder()
        .setCustomId('link_alt_token')
        .setLabel('Link Alt Token')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(buttonEmoji('join', '👥'))
    );

    // Row 2: डिवाइस-वाइज सेटअप गाइड बटन्स (PC, Mobile, iOS एक अलग बॉक्स/रो में)
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('token_guide_pc')
        .setLabel('Token For PC')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(buttonEmoji('Tools', '💻')),
      new ButtonBuilder()
        .setCustomId('token_guide_mobile')
        .setLabel('Token For Mobile')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(buttonEmoji('ping', '📱')),
      new ButtonBuilder()
        .setCustomId('token_guide_ios')
        .setLabel('Token For iOS')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(buttonEmoji('Star', '🍎'))
    );

    await replyEmbed(message, emb, [row1, row2]);
  },
};
