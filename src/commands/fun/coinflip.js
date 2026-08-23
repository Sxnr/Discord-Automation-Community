const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../../database/db');
const { brandFooter } = require('../../utils/embeds');
const { t } = require('../../utils/i18n');

function getEco(gid, uid) {
    db.prepare('INSERT OR IGNORE INTO economy (guild_id, user_id) VALUES (?, ?)').run(gid, uid);
    return db.prepare('SELECT * FROM economy WHERE guild_id = ? AND user_id = ?').get(gid, uid);
}

module.exports = {
    category: 'fun',
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('🪙 Apuesta a cara o cruz. ¡50/50 de duplicar tu apuesta!')
        .addIntegerOption(o => o.setName('apuesta').setDescription('Cantidad a apostar').setRequired(true).setMinValue(1))
        .addStringOption(o => o.setName('lado').setDescription('¿Qué eliges?').setRequired(true)
            .addChoices({ name: '🪙 Cara', value: 'cara' }, { name: '🌑 Cruz', value: 'cruz' })),
    async execute(interaction) {
        const gid = interaction.guildId, uid = interaction.user.id;
        const bet = interaction.options.getInteger('apuesta');
        const pick = interaction.options.getString('lado');
        const eco = getEco(gid, uid);
        if (bet > eco.wallet) return interaction.reply({ content: t(gid, 'game.noMoney'), flags: [MessageFlags.Ephemeral] });

        const result = Math.random() < 0.5 ? 'cara' : 'cruz';
        const win = result === pick;
        const delta = win ? bet : -bet;
        db.prepare('UPDATE economy SET wallet = wallet + ?, total_earned = total_earned + ? WHERE guild_id = ? AND user_id = ?')
            .run(delta, win ? bet : 0, gid, uid);

        const embed = new EmbedBuilder()
            .setColor(win ? '#2ECC71' : '#E74C3C')
            .setTitle(win ? '🎉 ¡Ganaste!' : '💸 Perdiste')
            .setDescription(`La moneda cayó en **${result}**.\n${win ? t(gid, 'game.win', { amount: bet }) : t(gid, 'game.lose', { amount: bet })}`)
            .setFooter(brandFooter(interaction.client));
        await interaction.reply({ embeds: [embed] });
    }
};
