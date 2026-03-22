const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
    category: 'utility',
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('📂 Despliega el panel de asistencia interactivo.'),
    async execute(interaction) {
        const helpMainEmbed = new EmbedBuilder()
            .setTitle('📚 Panel de Asistencia | Global System')
            .setDescription('>>> **Bienvenido al centro de comandos.**\nSelecciona una categoría en el menú inferior para explorar las funciones disponibles.')
            .addFields(
                { name: '🛡️ Administración', value: 'Configuración y gestión de servidores.', inline: true },
                { name: '🛠️ Utilidad', value: 'Herramientas de diagnóstico y estado.', inline: true }
            )
            .setColor('#5865F2')
            .setThumbnail(interaction.client.user.displayAvatarURL())
            .setFooter({ text: 'Sistema Multi-Servidor Activo', iconURL: interaction.guild.iconURL() });

        const menu = new StringSelectMenuBuilder()
            .setCustomId('help_menu')
            .setPlaceholder('📂 Selecciona una categoría para explorar...')
            .addOptions([
                {
                    label: 'Administración',
                    description: 'Configuración de tickets, logs y staff.',
                    value: 'admin',
                    emoji: '🛡️',
                },
                {
                    label: 'Utilidad',
                    description: 'Comandos de estado, ping y ayuda.',
                    value: 'utility',
                    emoji: '🛠️',
                },
            ]);

        const row = new ActionRowBuilder().addComponents(menu);

        await interaction.reply({ embeds: [helpMainEmbed], components: [row] });
    },
};