const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../../database/db');
const { use } = require('react');

const SYMBOLS = [
    { emoji: '🍒', name: 'Cereza',    weight: 30, mult: 2   },
    { emoji: '🍋', name: 'Limón',     weight: 25, mult: 2.5 },
    { emoji: '🍊', name: 'Naranja',   weight: 20, mult: 3   },
    { emoji: '🍇', name: 'Uva',       weight: 15, mult: 4   },
    { emoji: '🔔', name: 'Campana',   weight: 6,  mult: 6   },
    { emoji: '⭐', name: 'Estrella',  weight: 3,  mult: 10  },
    { emoji: '💎', name: 'Diamante',  weight: 1,  mult: 25  },
];

const COOLDOWNS = new Map();
const COOLDOWN_MS = 15000;

function getEconomy(guildId, userId) {
    db.prepare('INSERT OR IGNORE INTO economy (guild_id, user_id,) VALUES (?, ?)').run(guildId, userId);
    return db.prepare('SELECT * FROM economy WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
}

function logTransaction(guildId, userId, type, amount, detail = null) {
    db.prepare('INSERT INTO transactions (guild_id, user_id, type, amount, detail, timestamp) VALUES (?, ?, ?, ?, ?, ?)').run(guildId, userId, type, amount, detail, Date.now());
}

function getSettings(guildId) {
    db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)').run(guildId);
    return db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
}

function fmt(guildId, amount) {
    const s = getSettings(guildId);
    const emoji = s?.economy_currency_emoji || '💰';
    const name = s?.economy_currency || 'coins';
    return `${emoji} ${amount.toLocaleString('es-CL')} ${name}`;
}

function weightedRandom() {
    const total = SYMBOLS.reduce((a, s) => a + s.weight, 0);
    let rand    = Math.random() * total;
    for (const sym of SYMBOLS) {
        rand -= sym.weight;
        if (rand <= 0) return sym;
    }
    return SYMBOLS[0];
}

function spin() {
    return [weightedRandom(), weightedRandom(), weightedRandom()];
}

function evaluate(reels, bet) {
    const [a, b, c] = reels;

    // Jackpot 💎💎💎
    if (a.emoji === '💎' && b.emoji === '💎' && c.emoji === '💎') {
        return { type: 'JACKPOT', label: '💎 ¡JACKPOT!', mult: 50, color: '#F1C40F' };
    }

    // Tres iguales
    if (a.emoji === b.emoji && b.emoji === c.emoji) {
        return { type: 'three', label: `✨ ¡Tres ${a.name}!`, mult: a.mult * 2, color: '#57F287' };
    }

    // Dos iguales
    if (a.emoji === b.emoji || b.emoji === c.emoji || a.emoji === c.emoji) {
        const match = a.emoji === b.emoji ? a : c;
        return { type: 'two', label: `🎯 Dos ${match.name}`, mult: match.mult * 0.5, color: '#FEE75C' };
    }

    // Nada
    return { type: 'lose', label: '💸 Sin suerte...', mult: 0, color: '#ED4245' };
}

function buildSlotDisplay(reels) {
    return `╔══════════════╗\n║  ${reels.map(r => r.emoji).join('  │  ')}  ║\n╚══════════════╝`;
}

function buildAnimFrame() {
    return [weightedRandom(), weightedRandom(), weightedRandom()].map(r => r.emoji).join('  │  ');
}

module.exports = {
    category: 'fun',
    data: new SlashCommandBuilder()
        .setName('slots')
        .setDescription('🎰 Juega a las tragamonedas.')
        .addIntegerOption(opt => opt
            .setName('apuesta')
            .setDescription('Cantidad de coins a apostar (1-1000)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(1000)
        ),

    async execute(interaction) {
        const userId = interaction.user.id;
        const bet    = interaction.options.getInteger('apuesta');

        const eco = getEconomy(guildId, userId);
        if (eco.wallet < bet) {
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#ED4245')
                    .setTitle('💸 Sin fondos suficientes')
                    .setDescription(
                        `**Tu saldo:** ${fmt(guildId, eco.wallet)}\n` +
                        `**Apuesta:** ${fmt(guildId, bet)}\n\n` +
                        `¡No tienes suficientes coins en cartera!`
                    )
                ],
                flags: [MessageFlags.Ephemeral]
            });
        }
        // Cooldown
        const lastUsed = COOLDOWNS.get(userId);
        if (lastUsed && Date.now() - lastUsed < COOLDOWN_MS) {
            const left = Math.ceil((COOLDOWN_MS - (Date.now() - lastUsed)) / 1000);
            return interaction.reply({
                content: `⏳ Espera **${left}s** antes de volver a girar.`,
                flags: [MessageFlags.Ephemeral]
            });
        }
        COOLDOWNS.set(userId, Date.now());

        await interaction.deferReply();

        // ── Animación de giro ─────────────────────────────────────────────
        const spinningEmbed = new EmbedBuilder()
            .setTitle('🎰 Tragamonedas')
            .setColor('#FEE75C')
            .setDescription(`╔══════════════╗\n║  ${buildAnimFrame()}  ║\n╚══════════════╝\n\n*🎲 Girando...*`);

        await interaction.editReply({ embeds: [spinningEmbed] });
        await new Promise(res => setTimeout(res, 1000));

        await interaction.editReply({ embeds: [new EmbedBuilder()
            .setTitle('🎰 Tragamonedas')
            .setColor('#FEE75C')
            .setDescription(`╔══════════════╗\n║  ${buildAnimFrame()}  ║\n╚══════════════╝\n\n*🎲 Girando...*`)
        ]});
        await new Promise(res => setTimeout(res, 800));

        // ── Resultado final ───────────────────────────────────────────────
        const reels  = spin();
        const result = evaluate(reels, bet);
        const won    = Math.floor(bet * result.mult);
        const profit = won - bet;

        if (result.mult > 0) {
            db.prepare(`UPDATE economy SET wallet = wallet + ?, total_earned = total_earned + ? WHERE guild_id = ? AND user_id = ?`).run(won, won, guildId, userId);
            logTransaction(guildId, userId, 'slots_win', won, '🎰 Slots');
        } else {
            db.prepare(`UPDATE economy SET wallet = wallet - ?, total_spent = + total_spent + ? WHERE guild_id = ? AND user_id = ?`).run(bet, bet, guildId, userId);
            logTransaction(guildId, userId, 'slots_loss', -bet, '🎰 Slots');
        }

        const embed = new EmbedBuilder()
            .setTitle('🎰 Tragamonedas')
            .setColor(result.color)
            .setDescription(buildSlotDisplay(reels))
            .addFields(
                { name: '🎯 Resultado', value: `**${result.label}**`, inline: true },
                { name: '💰 Apuesta',  value: `\`${bet} coins\``,    inline: true },
                ...(result.mult > 0 ? [
                    { name: '✨ Multiplicador', value: `\`x${result.mult}\``, inline: true },
                    { name: result.type === 'JACKPOT' ? '🏆 Premio JACKPOT' : '💵 Ganancia',
                      value: `**+${won} coins** *(+${profit} neto)*`, inline: false }
                ] : [
                    { name: '💸 Pérdida', value: `**-${bet} coins**`, inline: true }
                ])
            )
            .setFooter({ text: `${interaction.user.tag} · Tabla: 🍒x2 🍋x2.5 🍊x3 🍇x4 🔔x6 ⭐x10 💎x25` })
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    }
};