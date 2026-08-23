const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const db = require('../../database/db');
const { brandFooter } = require('../../utils/embeds');
const { t } = require('../../utils/i18n');

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const card = () => RANKS[Math.floor(Math.random() * RANKS.length)];
const v = c => (['J', 'Q', 'K'].includes(c) ? 10 : c === 'A' ? 11 : Number(c));
function handVal(cards) {
    let s = cards.reduce((a, c) => a + v(c), 0);
    let aces = cards.filter(c => c === 'A').length;
    while (s > 21 && aces > 0) { s -= 10; aces--; }
    return s;
}

function getEco(gid, uid) {
    db.prepare('INSERT OR IGNORE INTO economy (guild_id, user_id) VALUES (?, ?)').run(gid, uid);
    return db.prepare('SELECT wallet FROM economy WHERE guild_id = ? AND user_id = ?').get(gid, uid);
}

module.exports = {
    category: 'fun',
    data: new SlashCommandBuilder()
        .setName('blackjack')
        .setDescription('🃏 Blackjack contra el bot. Llega a 21 sin pasarte.')
        .addIntegerOption(o => o.setName('apuesta').setDescription('Cantidad a apostar').setRequired(true).setMinValue(1)),
    async execute(interaction) {
        const gid = interaction.guildId, uid = interaction.user.id;
        const bet = interaction.options.getInteger('apuesta');
        const eco = getEco(gid, uid);
        if (bet > eco.wallet) return interaction.reply({ content: t(gid, 'game.noMoney'), flags: [MessageFlags.Ephemeral] });

        let player = [card(), card()];
        let dealer = [card(), card()];
        const render = (hide) => `**Tú:** ${player.join(', ')} \`(${handVal(player)})\`\n**Bot:** ${dealer[0]}, ${hide ? '❓' : dealer.slice(1).join(', ') + ` \`(${handVal(dealer)})\``}`;
        const embed = new EmbedBuilder().setTitle('🃏 Blackjack').setColor('#5865F2');

        const row = () => new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bj_hit').setLabel('Pedir').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('bj_stand').setLabel('Plantarse').setStyle(ButtonStyle.Success),
        );

        const msg = await interaction.reply({
            embeds: [embed.setDescription(render(true)).setFooter(brandFooter(interaction.client))],
            components: [row()], fetchReply: true,
        });

        const finish = async (win, reason) => {
            const delta = win ? bet : -bet;
            db.prepare('UPDATE economy SET wallet = wallet + ?, total_earned = total_earned + ? WHERE guild_id = ? AND user_id = ?')
                .run(delta, win ? bet : 0, gid, uid);
            embed.setColor(win ? '#2ECC71' : '#E74C3C').setDescription(`${reason}\n\n${render(false)}`)
                .setFooter(brandFooter(interaction.client));
            await msg.edit({ embeds: [embed], components: [] });
        };

        const pv = handVal(player);
        if (pv === 21) return finish(true, `🎉 ¡Blackjack! ${t(gid, 'game.win', { amount: bet })}`);

        const collector = msg.createMessageComponentCollector({ time: 30000, filter: i => i.user.id === uid });
        collector.on('collect', async (i) => {
            if (i.customId === 'bj_hit') {
                player.push(card());
                if (handVal(player) > 21) { await i.deferUpdate(); return finish(false, `💥 Te pasaste. ${t(gid, 'game.lose', { amount: bet })}`); }
                if (handVal(player) === 21) { await i.deferUpdate(); return finish(true, `🎉 ¡21! ${t(gid, 'game.win', { amount: bet })}`); }
                await i.update({ embeds: [embed.setDescription(render(true)).setFooter(brandFooter(interaction.client))], components: [row()] });
            } else {
                let dv = handVal(dealer);
                while (dv < 17) { dealer.push(card()); dv = handVal(dealer); }
                await i.deferUpdate();
                if (dv > 21) return finish(true, `🤖 El bot se pasó. ${t(gid, 'game.win', { amount: bet })}`);
                if (dv > pv) return finish(false, `🤖 El bot gana (${dv} vs ${pv}). ${t(gid, 'game.lose', { amount: bet })}`);
                if (dv === pv) return finish(false, `🤝 Empate (${dv}). Se devuelve tu apuesta.`).then(() =>
                    db.prepare('UPDATE economy SET wallet = wallet + ? WHERE guild_id = ? AND user_id = ?').run(bet, gid, uid));
                return finish(true, `🎉 Ganaste (${pv} vs ${dv}). ${t(gid, 'game.win', { amount: bet })}`);
            }
        });
        collector.on('end', (_, reason) => { if (reason === 'time') msg.edit({ components: [] }).catch(() => { }); });
    }
};
