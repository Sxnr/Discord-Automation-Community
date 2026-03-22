const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Muestra la lista de comandos disponibles por categoría.'),
    async execute(interaction) {
        const categories = fs.readdirSync(path.join(__dirname, '../../commands'));
        
        const embed = new EmbedBuilder()
            .setTitle('📚 Panel de Ayuda')
            .setDescription('Selecciona una categoría en el menú de abajo para ver los comandos disponibles.')
            .setColor('#5865F2')
            .setTimestamp();

        const menu = new StringSelectMenuBuilder()
            .setCustomId('help_menu')
            .setPlaceholder('Elige una categoría...')
            .addOptions(
                categories.map(cat => ({
                    label: cat.charAt(0).toUpperCase() + cat.slice(1),
                    value: cat,
                    description: `Comandos de la categoría ${cat}`
                }))
            );

        const row = new ActionRowBuilder().addComponents(menu);

        await interaction.reply({ embeds: [embed], components: [row] });
    },
};