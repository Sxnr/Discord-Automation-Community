const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { brandFooter } = require('../../utils/embeds');

module.exports = {
    category: 'admin',
    data: new SlashCommandBuilder()
        .setName('rules')
        .setDescription('📜 Envía el mensaje de reglas con un botón de aceptación (onboarding).')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(o => o.setName('titulo').setDescription('Título del embed').setRequired(false))
        .addStringOption(o => o.setName('texto').setDescription('Texto de las reglas').setRequired(false)),
    async execute(interaction) {
        const title = interaction.options.getString('titulo') || '📜 Reglas del servidor';
        const text = interaction.options.getString('texto') || 'Al hacer clic en **Acepto**, te unes oficialmente a la comunidad y aceptas seguir las normas.';
        const cfg = db.prepare('SELECT verify_role FROM guild_settings WHERE guild_id = ?').get(interaction.guildId);

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setColor('#5865F2')
            .setDescription(text)
            .setFooter(brandFooter(interaction.client));

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rules_accept').setLabel('✅ Acepto las reglas').setStyle(ButtonStyle.Success)
        );

        const note = cfg && cfg.verify_role
            ? ''
            : '\n⚠️ No hay un rol de verificación configurado (`/setup-verify`). El botón igual registrará la aceptación.';
        await interaction.reply({ embeds: [embed], components: [row], content: note || null });
    }
};
