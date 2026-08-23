const {
    SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags
} = require('discord.js');
const db = require('../../database/db');
const { brandFooter } = require('../../utils/embeds');

const VOTE_COOLDOWN = 12 * 60 * 60 * 1000; // 12h
const BASE_REWARD   = 200;

function fmt(guildId, amount) {
    const s = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
    const emoji = s?.economy_currency_emoji || '💰';
    const name  = s?.economy_currency || 'coins';
    return `${emoji} **${amount.toLocaleString('es-CL')}** ${name}`;
}

module.exports = {
    category: 'utility',
    data: new SlashCommandBuilder()
        .setName('vote')
        .setDescription('🗳️ Vota por el bot y reclama recompensas.')
        .addSubcommand(s => s
            .setName('link')
            .setDescription('📎 Enlaces para votar por el bot (Top.gg / Disboard).'))
        .addSubcommand(s => s
            .setName('claim')
            .setDescription('🎁 Reclama tu recompensa tras votar (cada 12h).'))
        .addSubcommand(s => s
            .setName('top')
            .setDescription('🏆 Ranking de votantes del servidor.')),

    async execute(interaction) {
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const userId  = interaction.user.id;
        const clientId = process.env.CLIENT_ID || interaction.client.user.id;

        // ── LINK ────────────────────────────────────────────────────────
        if (sub === 'link') {
            const top    = `https://top.gg/bot/${clientId}/vote`;
            const dis    = `https://disboard.org/bot/${clientId}`;
            const invite = `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=bot&permissions=8`;

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('🗳️ Vota por el bot')
                    .setColor('#5865F2')
                    .setDescription(
                        'Apóyanos con tu voto para que más servidores nos conozcan. ' +
                        'Luego usa `/vote claim` para recibir tus coins. 💰'
                    )
                    .addFields(
                        { name: '⭐ Top.gg',  value: `[Votar aquí](${top})`,     inline: true },
                        { name: '🪧 Disboard', value: `[Votar aquí](${dis})`,    inline: true },
                        { name: '➕ Invitar', value: `[Link de invitación](${invite})`, inline: true }
                    )
                    .setFooter(brandFooter(interaction.client))]
            });
        }

        // ── CLAIM ───────────────────────────────────────────────────────
        if (sub === 'claim') {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            let v = db.prepare('SELECT * FROM votes WHERE user_id = ?').get(userId);
            const now = Date.now();
            if (v && now - v.last_vote < VOTE_COOLDOWN) {
                const left = Math.ceil((VOTE_COOLDOWN - (now - v.last_vote)) / 60000);
                return interaction.editReply({
                    embeds: [new EmbedBuilder().setColor('#FEE75C')
                        .setDescription(`⏳ Ya reclamaste tu recompensa. Vuelve en **${left} min**.`)
                        .setFooter(brandFooter(interaction.client))]
                });
            }

            // Recompensa (tiempo cumplido o primer voto)
            const streak = v ? (now - v.last_vote < VOTE_COOLDOWN * 2 ? v.streak + 1 : 1) : 1;
            const reward = BASE_REWARD + (streak - 1) * 25;

            db.prepare('INSERT OR IGNORE INTO economy (guild_id, user_id) VALUES (?, ?)').run(guildId, userId);
            db.prepare('UPDATE economy SET wallet = wallet + ?, total_earned = total_earned + ? WHERE guild_id = ? AND user_id = ?')
                .run(reward, reward, guildId, userId);
            db.prepare(`
                INSERT INTO votes (user_id, guild_id, last_vote, total, streak)
                VALUES (?, ?, ?, 1, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    guild_id = ?, last_vote = ?, total = total + 1, streak = ?
            `).run(userId, guildId, now, streak, guildId, now, streak);

            return interaction.editReply({
                embeds: [new EmbedBuilder().setColor('#57F287')
                    .setTitle('🎁 ¡Recompensa reclamada!')
                    .setDescription(`Recibiste ${fmt(guildId, reward)} por votar. ¡Gracias! 💜`)
                    .addFields(
                        { name: '🔥 Racha', value: `${streak} voto(s)`, inline: true },
                        { name: '📅 Próximo', value: 'En 12h', inline: true }
                    )
                    .setFooter(brandFooter(interaction.client))]
            });
        }

        // ── TOP ─────────────────────────────────────────────────────────
        if (sub === 'top') {
            await interaction.deferReply();
            const top = db.prepare(`
                SELECT user_id, total, streak FROM votes
                WHERE guild_id = ? ORDER BY total DESC LIMIT 10
            `).all(guildId);

            if (!top.length) {
                return interaction.editReply({ content: '❌ Aún no hay votos registrados en este servidor.' });
            }

            const medals = ['🥇', '🥈', '🥉'];
            const lines = await Promise.all(top.map(async (row, i) => {
                const user = await interaction.client.users.fetch(row.user_id).catch(() => null);
                const name = user?.username || `Usuario (${row.user_id.slice(0, 6)})`;
                const icon = medals[i] || `**${i + 1}.**`;
                return `${icon} **${name}** — ${row.total} voto(s) · 🔥${row.streak}`;
            }));

            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('🏆 Top Votantes')
                    .setColor('#5865F2')
                    .setDescription(lines.join('\n'))
                    .setFooter(brandFooter(interaction.client))]
            });
        }
    }
};
