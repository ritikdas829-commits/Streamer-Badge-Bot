'use strict';

const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { getRecord, setRecord } = require('../utils/dataStore');
const { generateFingerprint } = require('../utils/fingerprint');

const GAMES_PATH = path.join(__dirname, '../../games.json');

function loadGames() {
    try {
        if (!fs.existsSync(GAMES_PATH)) return [];
        const data = fs.readFileSync(GAMES_PATH, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error('[LeakX] Failed to load games.json:', e);
        return [];
    }
}

module.exports = {
    name: 'get-badge',
    description: 'Spoof game badges for your linked account',
    data: new SlashCommandBuilder()
        .setName('get-badge')
        .setDescription('Spoof game badges for your linked account'),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const userId = interaction.user.id;
        const record = getRecord(userId);

        if (!record || !record.token) {
            return interaction.editReply({
                content: '❌ **No Linked Token Found!**\nPlease link your token first using the link command.',
            });
        }

        const games = loadGames();
        if (!games.length) {
            return interaction.editReply({
                content: '❌ Failed to load games database.',
            });
        }

        const row1 = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('spoof_count')
                .setPlaceholder('How many games?')
                .addOptions([
                    { label: `All games (${games.length.toLocaleString()})`, value: 'all', default: true },
                    { label: '100 games', value: '100' },
                    { label: '500 games', value: '500' },
                    { label: '1 000 games', value: '1000' },
                ])
        );

        const row2 = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('spoof_hours')
                .setPlaceholder('Hours per game?')
                .addOptions([
                    { label: '1 hour (default)', value: '1', default: true },
                    { label: '2 hours', value: '2' },
                    { label: '5 hours', value: '5' },
                    { label: '10 hours', value: '10' },
                ])
        );

        const row3 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('spoof_start')
                .setLabel('Start Spoofing')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('spoof_cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
        );

        const embed = new EmbedBuilder()
            .setTitle(`⚡ LeakX Badge Spoofer — ${games.length.toLocaleString()} games loaded`)
            .setDescription('Pick how many games to spoof and how many hours per game.\nLeave both at default for the **one-click spoof everything** preset.')
            .setColor(0x000000)
            .setFooter({ text: 'Bot by https://discord.gg/xaQgEuvdDd • Dev: jeneyx' });

        const response = await interaction.editReply({
            embeds: [embed],
            components: [row1, row2, row3],
        });

        let selectedCount = 'all';
        let selectedHours = 1.0;

        const collector = response.createMessageComponentCollector({ time: 120000 });

        collector.on('collect', async i => {
            if (i.user.id !== userId) {
                return i.reply({ content: 'This menu is not for you!', ephemeral: true });
            }

            if (i.customId === 'spoof_count') {
                selectedCount = i.values[0];
                await i.deferUpdate();
            } else if (i.customId === 'spoof_hours') {
                selectedHours = parseFloat(i.values[0]);
                await i.deferUpdate();
            } else if (i.customId === 'spoof_cancel') {
                collector.stop();
                await i.update({ content: '❌ Cancelled.', embeds: [], components: [] });
            } else if (i.customId === 'spoof_start') {
                collector.stop();
                await i.update({ content: '⏳ Preparing and validating token...', embeds: [], components: [] });

                try {
                    const dmChannel = await interaction.user.createDM();
                    await dmChannel.send({ content: '⚡ **Spoofing started!** Live logs will appear here.' });

                    // यहाँ पर तुम्हारा आगे का स्पूफिंग/हार्टबीट लॉजिक रन होगा
                    await interaction.editReply({ content: '✅ Spoofing started successfully! Check your DMs for live logs.', components: [] });
                } catch (err) {
                    await interaction.editReply({ content: '❌ **Your DMs are closed!** Please open DMs and try again.', components: [] });
                }
            }
        });
    },
};
