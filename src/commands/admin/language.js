const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { t, setLang } = require('../../utils/i18n');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('language')
        .setDescription('Cambia el idioma de los mensajes del bot en este servidor.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(o => o
            .setName('idioma')
            .setDescription('Idioma a usar')
            .setRequired(true)
            .addChoices(
                { name: '🇪🇸 Español', value: 'es' },
                { name: '🇺🇸 English', value: 'en' }
            )),
    async execute(interaction) {
        const lang = interaction.options.getString('idioma');
        setLang(interaction.guildId, lang);
        await interaction.reply({ content: t(interaction.guildId, 'lang.set', { lang }), ephemeral: true });
    }
};
