const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const { brandFooter } = require('../../utils/embeds');

module.exports = {
    category: 'utility',
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('📈 Estadísticas de uso del bot y del servidor.'),
    async execute(interaction) {
        const client = interaction.client;
        const guild = interaction.guild;

        const botGuilds = client.guilds.cache.size;
        const botUsers = client.guilds.cache.reduce((a, g) => a + (g.memberCount || 0), 0);
        const totalCmds = db.prepare('SELECT COUNT(*) c FROM command_stats').get().c;
        const guildCmds = db.prepare('SELECT COUNT(*) c FROM command_stats WHERE guild_id = ?').get(interaction.guildId).c;
        const topCmd = db.prepare('SELECT command, COUNT(*) c FROM command_stats GROUP BY command ORDER BY c DESC LIMIT 1').get();
        const totalVotes = db.prepare('SELECT COALESCE(SUM(total), 0) v FROM votes').get().v;

        const embed = new EmbedBuilder()
            .setTitle('📈 Estadísticas')
            .setColor('#5865F2')
            .addFields(
                { name: '🌐 Bot', value: `Servidores: **${botGuilds}**\nUsuarios: **${botUsers.toLocaleString('es')}**\nComandos usados: **${totalCmds.toLocaleString('es')}**`, inline: true },
                { name: '🏠 Este servidor', value: `Miembros: **${guild.memberCount}**\nComandos usados: **${guildCmds.toLocaleString('es')}**`, inline: true },
                { name: '🏆 Comando top', value: topCmd ? `**/${topCmd.command}** (${topCmd.c})` : '—', inline: true },
                { name: '🗳️ Votos totales', value: `**${totalVotes}**`, inline: true },
            )
            .setFooter(brandFooter(interaction.client))
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
