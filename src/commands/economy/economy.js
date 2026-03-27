const {
    SlashCommandBuilder, EmbedBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    PermissionFlagsBits, MessageFlags
} = require('discord.js');
const db = require('../../database/db');
const { checkAndUnlock } = require('./achievements');

// ── Helpers ────────────────────────────────────────────────────────────────
function getEconomy(guildId, userId) {
    db.prepare(`
        INSERT OR IGNORE INTO economy (guild_id, user_id) VALUES (?, ?)
    `).run(guildId, userId);
    return db.prepare('SELECT * FROM economy WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
}

function getSettings(guildId) {
    db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)').run(guildId);
    return db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
}

function addCoins(guildId, userId, amount, type = 'wallet') {
    getEconomy(guildId, userId);
    db.prepare(`UPDATE economy SET ${type} = ${type} + ?, total_earned = total_earned + ? WHERE guild_id = ? AND user_id = ?`)
        .run(amount, amount > 0 ? amount : 0, guildId, userId);
}

function logTransaction(guildId, userId, type, amount, detail = null) {
    db.prepare(`
        INSERT INTO transactions (guild_id, user_id, type, amount, detail, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(guildId, userId, type, amount, detail, Date.now());
}

function fmt(guildId, amount) {
    const s = getSettings(guildId);
    const emoji = s?.economy_currency_emoji || '💰';
    const name = s?.economy_currency || 'coins';
    return `${emoji} **${amount.toLocaleString('es-CL')}** ${name}`;
}

function msToTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
}

function random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

const WORK_PHRASES = [
    'Repartiste pizzas', 'Limpiaste ventanas', 'Hiciste delivery',
    'Programaste una web', 'Vendiste empanadas', 'Cuidaste mascotas',
    'Diste clases de inglés', 'Manejaste un taxi', 'Arreglaste computadores',
    'Diseñaste un logo', 'Fotografiaste un evento', 'Tocaste guitarra en la plaza',
];

const CRIME_SUCCESS = [
    'Hackeaste un cajero automático', 'Vendiste objetos "sin factura"',
    'Ganaste en una apuesta ilegal', 'Robaste señales de WiFi ajenas',
    'Falsificaste un boleto de metro', 'Revendiste entradas a precio inflado',
];

const CRIME_FAIL = [
    'Te cacharon robando papas fritas', 'Resbalaste huyendo de la guardia',
    'Tu cómplice te delató', 'Dejaste la billetera en la escena del crimen',
    'El policía era tu vecino', 'Tu captura salió en el noticiero local',
];

// ══════════════════════════════════════════════════════════════════════════════
module.exports = {
    category: 'economy',
    data: new SlashCommandBuilder()
        .setName('economy')
        .setDescription('💰 Sistema de economía del servidor.')

        // balance
        .addSubcommand(s => s
            .setName('balance')
            .setDescription('Ver tu saldo o el de otro usuario.')
            .addUserOption(o => o.setName('usuario').setDescription('Usuario a consultar'))
        )
        // daily
        .addSubcommand(s => s
            .setName('daily')
            .setDescription('Reclama tu recompensa diaria.')
        )
        // work
        .addSubcommand(s => s
            .setName('work')
            .setDescription('Trabaja para ganar coins.')
        )
        // crime
        .addSubcommand(s => s
            .setName('crime')
            .setDescription('Intenta algo ilegal. Puede salir bien... o no.')
        )
        // rob
        .addSubcommand(s => s
            .setName('rob')
            .setDescription('Intenta robarle coins a otro usuario.')
            .addUserOption(o => o.setName('usuario').setDescription('Usuario a robar').setRequired(true))
        )
        // pay
        .addSubcommand(s => s
            .setName('pay')
            .setDescription('Transfiere coins a otro usuario.')
            .addUserOption(o => o.setName('usuario').setDescription('Destinatario').setRequired(true))
            .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad a transferir').setRequired(true).setMinValue(1))
        )
        // deposit
        .addSubcommand(s => s
            .setName('deposit')
            .setDescription('Deposita coins en el banco.')
            .addStringOption(o => o.setName('cantidad').setDescription('Cantidad o "all"').setRequired(true))
        )
        // withdraw
        .addSubcommand(s => s
            .setName('withdraw')
            .setDescription('Retira coins del banco.')
            .addStringOption(o => o.setName('cantidad').setDescription('Cantidad o "all"').setRequired(true))
        )
        // leaderboard
        .addSubcommand(s => s
            .setName('leaderboard')
            .setDescription('Ranking de coins del servidor.')
        )
        // shop
        .addSubcommand(s => s
            .setName('shop')
            .setDescription('Ver los ítems disponibles en la tienda.')
            .addIntegerOption(o => o.setName('pagina').setDescription('Página').setMinValue(1))
        )
        // buy
        .addSubcommand(s => s
            .setName('buy')
            .setDescription('Comprar un ítem de la tienda.')
            .addIntegerOption(o => o.setName('id').setDescription('ID del ítem').setRequired(true))
            .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad').setMinValue(1))
        )
        // inventory
        .addSubcommand(s => s
            .setName('inventory')
            .setDescription('Ver tu inventario.')
            .addUserOption(o => o.setName('usuario').setDescription('Usuario a consultar'))
        )
        // transactions
        .addSubcommand(s => s
            .setName('transactions')
            .setDescription('Ver tu historial de transacciones recientes.')
        )
        // shop-add
        .addSubcommand(s => s
            .setName('shop-add')
            .setDescription('[Admin] Agrega un ítem a la tienda.')
            .addStringOption(o => o.setName('nombre').setDescription('Nombre del ítem').setRequired(true).setMaxLength(50))
            .addIntegerOption(o => o.setName('precio').setDescription('Precio en coins').setRequired(true).setMinValue(1))
            .addStringOption(o => o.setName('descripcion').setDescription('Descripción').setMaxLength(200))
            .addStringOption(o => o.setName('emoji').setDescription('Emoji del ítem'))
            .addRoleOption(o => o.setName('rol').setDescription('Rol que entrega al comprar'))
            .addIntegerOption(o => o.setName('stock').setDescription('Stock (-1 = ilimitado)'))
        )
        // shop-remove
        .addSubcommand(s => s
            .setName('shop-remove')
            .setDescription('[Admin] Elimina un ítem de la tienda.')
            .addIntegerOption(o => o.setName('id').setDescription('ID del ítem').setRequired(true))
        )
        // config
        .addSubcommand(s => s
            .setName('config')
            .setDescription('[Admin] Configura la economía del servidor.')
            .addStringOption(o => o
                .setName('ajuste')
                .setDescription('Qué configurar')
                .setRequired(true)
                .addChoices(
                    { name: '💰 Nombre moneda', value: 'currency' },
                    { name: '🎨 Emoji moneda', value: 'emoji' },
                    { name: '📅 Daily amount', value: 'daily_amount' },
                    { name: '💼 Work cooldown (min)', value: 'work_cooldown' },
                    { name: '🔫 Crime cooldown (min)', value: 'crime_cooldown' },
                    { name: '🎰 Habilitar/deshabilitar', value: 'toggle' },
                    { name: '📢 Canal de logs', value: 'log_channel' },
                )
            )
            .addStringOption(o => o.setName('valor').setDescription('Valor a asignar').setRequired(true))
        )
        // give (admin)
        .addSubcommand(s => s
            .setName('give')
            .setDescription('[Admin] Dar coins a un usuario.')
            .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true))
            .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad').setRequired(true))
        )
        // take (admin)
        .addSubcommand(s => s
            .setName('take')
            .setDescription('[Admin] Quitar coins a un usuario.')
            .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true))
            .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad').setRequired(true))
        )
        // reset (admin)
        .addSubcommand(s => s
            .setName('reset')
            .setDescription('[Admin] Resetear la economía de un usuario.')
            .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true))
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;
        const cfg = getSettings(guildId);

        if (cfg.economy_enabled === 0 && !['config'].includes(sub)) {
            return interaction.reply({ content: '❌ La economía está desactivada en este servidor.', flags: [MessageFlags.Ephemeral] });
        }

        // ══════════════════════════════════════════════════════════════════
        // BALANCE
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'balance') {
            const target = interaction.options.getUser('usuario') || interaction.user;
            const eco = getEconomy(guildId, target.id);
            const total = eco.wallet + eco.bank;

            const rank = db.prepare(`
                SELECT COUNT(*) as r FROM economy
                WHERE guild_id = ? AND (wallet + bank) > ?
            `).get(guildId, total).r + 1;

            const embed = new EmbedBuilder()
                .setTitle(`💰 Balance de ${target.username}`)
                .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                .setColor(cfg.welcome_color || '#5865F2')
                .addFields(
                    { name: '👜 Cartera', value: fmt(guildId, eco.wallet), inline: true },
                    { name: '🏦 Banco', value: fmt(guildId, eco.bank), inline: true },
                    { name: '💎 Total', value: fmt(guildId, total), inline: true },
                    { name: '📈 Total ganado', value: fmt(guildId, eco.total_earned), inline: true },
                    { name: '🏆 Posición global', value: `#${rank}`, inline: true },
                )
                .setFooter({ text: `Solicitado por ${interaction.user.tag}` })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // ══════════════════════════════════════════════════════════════════
        // DAILY
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'daily') {
            const eco = getEconomy(guildId, userId);
            const now = Date.now();
            const cooldown = 86400000; // 24h
            const elapsed = now - eco.last_daily;

            if (elapsed < cooldown) {
                const left = msToTime(cooldown - elapsed);
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#ED4245')
                        .setDescription(`⏳ Ya reclamaste tu daily.\nVuelve en **${left}**.`)],
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // Calcular streak
            const withinStreak = elapsed < cooldown * 2;
            const streak = withinStreak ? eco.daily_streak + 1 : 1;
            const base = cfg.economy_daily_amount || 200;
            const bonus = (cfg.economy_daily_streak_bonus || 50) * (streak - 1);
            const total = base + bonus;

            db.prepare(`
                UPDATE economy SET wallet = wallet + ?, total_earned = total_earned + ?,
                daily_streak = ?, last_daily = ? WHERE guild_id = ? AND user_id = ?
            `).run(total, total, streak, now, guildId, userId);

            logTransaction(guildId, userId, 'daily', total, `Streak x${streak}`);

            const ecoAfterDaily = getEconomy(guildId, userId);
            checkAndUnlock(guildId, userId, 'daily_streak', streak, interaction.client);
            checkAndUnlock(guildId, userId, 'total_earned', ecoAfterDaily.total_earned, interaction.client);

            const streakBar = '🔥'.repeat(Math.min(streak, 10));

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#57F287')
                    .setTitle('📅 Daily reclamado')
                    .setDescription(`Recibiste ${fmt(guildId, total)}`)
                    .addFields(
                        { name: '💰 Base', value: fmt(guildId, base), inline: true },
                        { name: '🎁 Bonus', value: fmt(guildId, bonus), inline: true },
                        { name: `🔥 Racha ${streak}`, value: streakBar || '—', inline: false },
                    )
                    .setFooter({ text: 'Vuelve mañana para mantener tu racha.' })
                    .setTimestamp()
                ]
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // WORK
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'work') {
            const eco = getEconomy(guildId, userId);
            const cooldown = cfg.economy_work_cooldown || 3600000;
            const elapsed = Date.now() - eco.last_work;

            if (elapsed < cooldown) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#ED4245')
                        .setDescription(`⏳ Ya trabajaste recientemente. Descansa **${msToTime(cooldown - elapsed)}** más.`)],
                    flags: [MessageFlags.Ephemeral]
                });
            }

            const earned = random(cfg.economy_work_min || 50, cfg.economy_work_max || 200);
            const phrase = WORK_PHRASES[Math.floor(Math.random() * WORK_PHRASES.length)];

            db.prepare(`
                UPDATE economy SET wallet = wallet + ?, total_earned = total_earned + ?,
                last_work = ? WHERE guild_id = ? AND user_id = ?
            `).run(earned, earned, Date.now(), guildId, userId);

            logTransaction(guildId, userId, 'work', earned, phrase);

            const workCount = db.prepare(`SELECT COUNT(*) as c FROM transactions WHERE guild_id = ? AND user_id = ? AND type = 'work'`).get(guildId, userId).c;
            checkAndUnlock(guildId, userId, 'work_count', workCount, interaction.client);
            checkAndUnlock(guildId, userId, 'total_earned', getEconomy(guildId, userId).total_earned, interaction.client);

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#57F287')
                    .setTitle('💼 ¡Bien trabajado!')
                    .setDescription(`**${phrase}** y ganaste ${fmt(guildId, earned)}.`)
                    .setFooter({ text: `Próximo trabajo en ${msToTime(cooldown)}` })
                    .setTimestamp()
                ]
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // CRIME
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'crime') {
            const eco = getEconomy(guildId, userId);
            const cooldown = cfg.economy_crime_cooldown || 7200000;
            const elapsed = Date.now() - eco.last_crime;

            if (elapsed < cooldown) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#ED4245')
                        .setDescription(`⏳ La policía te tiene vigilado. Espera **${msToTime(cooldown - elapsed)}**.`)],
                    flags: [MessageFlags.Ephemeral]
                });
            }

            const failChance = cfg.economy_crime_fail_pct || 35;
            const success = Math.random() * 100 > failChance;
            const amount = random(cfg.economy_crime_min || 100, cfg.economy_crime_max || 500);

            db.prepare('UPDATE economy SET last_crime = ? WHERE guild_id = ? AND user_id = ?')
                .run(Date.now(), guildId, userId);

            if (success) {
                const phrase = CRIME_SUCCESS[Math.floor(Math.random() * CRIME_SUCCESS.length)];
                db.prepare(`
                    UPDATE economy SET wallet = wallet + ?, total_earned = total_earned + ?
                    WHERE guild_id = ? AND user_id = ?
                `).run(amount, amount, guildId, userId);
                logTransaction(guildId, userId, 'crime_win', amount, phrase);

                const crimeCount = db.prepare(`SELECT COUNT(*) as c FROM transactions WHERE guild_id = ? AND user_id = ? AND type = 'crime_win'`).get(guildId, userId).c;
                checkAndUnlock(guildId, userId, 'crime_count', crimeCount, interaction.client);
                checkAndUnlock(guildId, userId, 'total_earned', getEconomy(guildId, userId).total_earned, interaction.client);

                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#57F287')
                        .setTitle('🔫 ¡Éxito!')
                        .setDescription(`**${phrase}** y escapaste con ${fmt(guildId, amount)}.`)
                        .setTimestamp()
                    ]
                });
            } else {
                const fine = Math.floor(amount * 0.5);
                const phrase = CRIME_FAIL[Math.floor(Math.random() * CRIME_FAIL.length)];
                const actual = Math.min(eco.wallet, fine);
                db.prepare(`
                    UPDATE economy SET wallet = MAX(0, wallet - ?), total_spent = total_spent + ?
                    WHERE guild_id = ? AND user_id = ?
                `).run(actual, actual, guildId, userId);
                logTransaction(guildId, userId, 'crime_fail', -actual, phrase);

                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#ED4245')
                        .setTitle('🚔 ¡Te atraparon!')
                        .setDescription(`**${phrase}.**\nPagaste ${fmt(guildId, actual)} de multa.`)
                        .setTimestamp()
                    ]
                });
            }
        }

        // ══════════════════════════════════════════════════════════════════
        // ROB
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'rob') {
            if (cfg.economy_rob_enabled === 0) {
                return interaction.reply({ content: '❌ El robo está desactivado en este servidor.', flags: [MessageFlags.Ephemeral] });
            }

            const target = interaction.options.getUser('usuario');
            if (target.id === userId) return interaction.reply({ content: '❌ No puedes robarte a ti mismo.', flags: [MessageFlags.Ephemeral] });
            if (target.bot) return interaction.reply({ content: '❌ No puedes robar a un bot.', flags: [MessageFlags.Ephemeral] });

            const robberEco = getEconomy(guildId, userId);
            const victimEco = getEconomy(guildId, target.id);

            if (victimEco.wallet < 100) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#ED4245')
                        .setDescription(`❌ **${target.username}** no tiene suficiente en cartera para robar (mínimo 100).`)],
                    flags: [MessageFlags.Ephemeral]
                });
            }

            const success = Math.random() > 0.45;

            if (success) {
                const stolen = Math.floor(victimEco.wallet * random(10, 40) / 100);
                db.prepare('UPDATE economy SET wallet = wallet - ? WHERE guild_id = ? AND user_id = ?').run(stolen, guildId, target.id);
                db.prepare('UPDATE economy SET wallet = wallet + ?, total_earned = total_earned + ? WHERE guild_id = ? AND user_id = ?').run(stolen, stolen, guildId, userId);
                logTransaction(guildId, userId, 'rob_win', stolen, `Robó a ${target.username}`);

                const robCount = db.prepare(`SELECT COUNT(*) as c FROM transactions WHERE guild_id = ? AND user_id = ? AND type = 'rob_win'`).get(guildId, userId).c;
                checkAndUnlock(guildId, userId, 'rob_win_count', robCount, interaction.client);

                logTransaction(guildId, target.id, 'rob_loss', -stolen, `Robado por ${interaction.user.username}`);

                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#57F287')
                        .setTitle('🦹 ¡Robo exitoso!')
                        .setDescription(`Le robaste ${fmt(guildId, stolen)} a **${target.username}**.`)
                        .setTimestamp()
                    ]
                });
            } else {
                const fine = Math.floor(robberEco.wallet * random(5, 20) / 100);
                const actual = Math.min(robberEco.wallet, fine);
                db.prepare('UPDATE economy SET wallet = MAX(0, wallet - ?), total_spent = total_spent + ? WHERE guild_id = ? AND user_id = ?').run(actual, actual, guildId, userId);
                db.prepare('UPDATE economy SET wallet = wallet + ? WHERE guild_id = ? AND user_id = ?').run(actual, guildId, target.id);
                logTransaction(guildId, userId, 'rob_fail', -actual, `Intento fallido contra ${target.username}`);

                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#ED4245')
                        .setTitle('🚔 ¡Te cacharon!')
                        .setDescription(`Fallaste al robar a **${target.username}** y pagaste ${fmt(guildId, actual)} de multa que fue a la víctima.`)
                        .setTimestamp()
                    ]
                });
            }
        }

        // ══════════════════════════════════════════════════════════════════
        // PAY
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'pay') {
            const target = interaction.options.getUser('usuario');
            const amount = interaction.options.getInteger('cantidad');

            if (target.id === userId) return interaction.reply({ content: '❌ No puedes transferirte a ti mismo.', flags: [MessageFlags.Ephemeral] });
            if (target.bot) return interaction.reply({ content: '❌ No puedes pagar a un bot.', flags: [MessageFlags.Ephemeral] });

            const senderEco = getEconomy(guildId, userId);
            if (senderEco.wallet < amount) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#ED4245')
                        .setDescription(`❌ No tienes suficiente en cartera.\nTienes ${fmt(guildId, senderEco.wallet)}.`)],
                    flags: [MessageFlags.Ephemeral]
                });
            }

            db.prepare('UPDATE economy SET wallet = wallet - ?, total_spent = total_spent + ? WHERE guild_id = ? AND user_id = ?').run(amount, amount, guildId, userId);
            db.prepare('UPDATE economy SET wallet = wallet + ?, total_earned = total_earned + ? WHERE guild_id = ? AND user_id = ?').run(amount, amount, guildId, target.id);
            logTransaction(guildId, userId, 'pay_out', -amount, `Pagó a ${target.username}`);
            logTransaction(guildId, target.id, 'pay_in', amount, `Recibió de ${interaction.user.username}`);

            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#57F287')
                    .setTitle('💸 Transferencia exitosa')
                    .setDescription(`Enviaste ${fmt(guildId, amount)} a **${target.username}**.`)
                    .setTimestamp()
                ]
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // DEPOSIT / WITHDRAW
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'deposit' || sub === 'withdraw') {
            const eco = getEconomy(guildId, userId);
            const rawAmt = interaction.options.getString('cantidad');
            const isAll = rawAmt.toLowerCase() === 'all';
            const source = sub === 'deposit' ? 'wallet' : 'bank';
            const dest = sub === 'deposit' ? 'bank' : 'wallet';
            const amount = isAll ? eco[source] : parseInt(rawAmt);

            if (isNaN(amount) || amount <= 0) {
                return interaction.reply({ content: '❌ Cantidad inválida.', flags: [MessageFlags.Ephemeral] });
            }
            if (eco[source] < amount) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#ED4245')
                        .setDescription(`❌ No tienes suficiente en ${source === 'wallet' ? 'cartera' : 'banco'}.\nDisponible: ${fmt(guildId, eco[source])}`)],
                    flags: [MessageFlags.Ephemeral]
                });
            }

            db.prepare(`
                UPDATE economy SET ${source} = ${source} - ?, ${dest} = ${dest} + ?
                WHERE guild_id = ? AND user_id = ?
            `).run(amount, amount, guildId, userId);
            logTransaction(guildId, userId, sub, amount, null);

            const icon = sub === 'deposit' ? '🏦' : '👜';
            const action = sub === 'deposit' ? 'depositados en el banco' : 'retirados a cartera';

            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#57F287')
                    .setTitle(`${icon} ${sub === 'deposit' ? 'Depósito' : 'Retiro'} exitoso`)
                    .setDescription(`${fmt(guildId, amount)} ${action}.`)
                    .setTimestamp()
                ]
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // LEADERBOARD
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'leaderboard') {
            await interaction.deferReply();
            const top = db.prepare(`
                SELECT user_id, wallet + bank AS total, wallet, bank
                FROM economy WHERE guild_id = ?
                ORDER BY total DESC LIMIT 10
            `).all(guildId);

            if (!top.length) {
                return interaction.editReply({ content: '❌ No hay datos de economía aún.' });
            }

            const medals = ['🥇', '🥈', '🥉'];
            const lines = await Promise.all(top.map(async (row, i) => {
                const user = await interaction.client.users.fetch(row.user_id).catch(() => null);
                const name = user?.username || `Usuario (${row.user_id.slice(0, 6)})`;
                const icon = medals[i] || `**${i + 1}.**`;
                return `${icon} **${name}** — ${fmt(guildId, row.total)}`;
            }));

            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('🏆 Ranking de Economía')
                    .setColor(cfg.welcome_color || '#5865F2')
                    .setDescription(lines.join('\n'))
                    .setTimestamp()
                ]
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // SHOP
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'shop') {
            const page = (interaction.options.getInteger('pagina') || 1) - 1;
            const pageSize = 6;
            const items = db.prepare(`
                SELECT * FROM shop_items WHERE guild_id = ? AND available = 1
                LIMIT ? OFFSET ?
            `).all(guildId, pageSize, page * pageSize);
            const total = db.prepare('SELECT COUNT(*) as c FROM shop_items WHERE guild_id = ? AND available = 1').get(guildId).c;

            if (!items.length) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#ED4245')
                        .setDescription('❌ La tienda está vacía. Un admin puede agregar ítems con `/economy shop-add`.')],
                    flags: [MessageFlags.Ephemeral]
                });
            }

            const lines = items.map(item =>
                `${item.emoji} **${item.name}** · ID: \`${item.id}\`\n` +
                `${item.description || '_Sin descripción_'}\n` +
                `💰 Precio: **${item.price.toLocaleString('es-CL')}** · Stock: ${item.stock === -1 ? '∞' : item.stock}`
            );

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('🛍️ Tienda del Servidor')
                    .setColor(cfg.welcome_color || '#5865F2')
                    .setDescription(lines.join('\n\n'))
                    .setFooter({ text: `Página ${page + 1} · ${total} ítem(s) · /economy buy <id>` })
                    .setTimestamp()
                ]
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // BUY
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'buy') {
            const itemId = interaction.options.getInteger('id');
            const qty = interaction.options.getInteger('cantidad') || 1;
            const item = db.prepare('SELECT * FROM shop_items WHERE id = ? AND guild_id = ? AND available = 1').get(itemId, guildId);

            if (!item) return interaction.reply({ content: `❌ Ítem **#${itemId}** no encontrado.`, flags: [MessageFlags.Ephemeral] });
            if (item.stock !== -1 && item.stock < qty) {
                return interaction.reply({ content: `❌ Stock insuficiente. Solo quedan **${item.stock}**.`, flags: [MessageFlags.Ephemeral] });
            }

            const total = item.price * qty;
            const eco = getEconomy(guildId, userId);

            if (eco.wallet < total) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#ED4245')
                        .setDescription(`❌ No tienes suficiente en cartera.\nNecesitas ${fmt(guildId, total)}, tienes ${fmt(guildId, eco.wallet)}.`)],
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // Cobrar
            db.prepare('UPDATE economy SET wallet = wallet - ?, total_spent = total_spent + ? WHERE guild_id = ? AND user_id = ?')
                .run(total, total, guildId, userId);

            // Stock
            if (item.stock !== -1) {
                db.prepare('UPDATE shop_items SET stock = stock - ? WHERE id = ?').run(qty, itemId);
            }

            // Inventario
            db.prepare(`
                INSERT INTO inventory (guild_id, user_id, item_id, quantity) VALUES (?, ?, ?, ?)
                ON CONFLICT(guild_id, user_id, item_id) DO UPDATE SET quantity = quantity + ?
            `).run(guildId, userId, itemId, qty, qty);

            // Rol automático
            if (item.role_id && item.type === 'role') {
                const member = await interaction.guild.members.fetch(userId).catch(() => null);
                await member?.roles.add(item.role_id).catch(() => null);
            }

            logTransaction(guildId, userId, 'buy', -total, `Compró x${qty} ${item.name}`);

            const buyCount = db.prepare(`SELECT COUNT(*) as c FROM transactions WHERE guild_id = ? AND user_id = ? AND type = 'buy'`).get(guildId, userId).c;
            checkAndUnlock(guildId, userId, 'buy_count', buyCount, interaction.client);
            checkAndUnlock(guildId, userId, 'total_spent', getEconomy(guildId, userId).total_spent, interaction.client);

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#57F287')
                    .setTitle('🛒 ¡Compra exitosa!')
                    .setDescription(`Compraste **x${qty} ${item.emoji} ${item.name}** por ${fmt(guildId, total)}.`)
                    .setTimestamp()
                ]
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // INVENTORY
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'inventory') {
            const target = interaction.options.getUser('usuario') || interaction.user;
            const items = db.prepare(`
                SELECT i.quantity, s.name, s.emoji, s.description, s.id
                FROM inventory i JOIN shop_items s ON i.item_id = s.id
                WHERE i.guild_id = ? AND i.user_id = ?
            `).all(guildId, target.id);

            if (!items.length) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#ED4245')
                        .setDescription(`❌ **${target.username}** no tiene ítems en su inventario.`)],
                    flags: [MessageFlags.Ephemeral]
                });
            }

            const lines = items.map(i => `${i.emoji} **x${i.quantity} ${i.name}**\n> ${i.description || '_Sin descripción_'}`);

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle(`🎒 Inventario de ${target.username}`)
                    .setColor(cfg.welcome_color || '#5865F2')
                    .setDescription(lines.join('\n\n'))
                    .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                    .setTimestamp()
                ]
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // TRANSACTIONS
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'transactions') {
            const txs = db.prepare(`
                SELECT * FROM transactions WHERE guild_id = ? AND user_id = ?
                ORDER BY timestamp DESC LIMIT 10
            `).all(guildId, userId);

            if (!txs.length) return interaction.reply({ content: '❌ Sin transacciones aún.', flags: [MessageFlags.Ephemeral] });

            const typeLabel = {
                daily: '📅 Daily', work: '💼 Trabajo', crime_win: '🔫 Crimen ✓',
                crime_fail: '🔫 Crimen ✗', rob_win: '🦹 Robo ✓', rob_fail: '🦹 Robo ✗',
                rob_loss: '🚨 Robado', pay_in: '💸 Recibido', pay_out: '💸 Enviado',
                buy: '🛒 Compra', deposit: '🏦 Depósito', withdraw: '👜 Retiro',
                admin_give: '🛡️ Admin +', admin_take: '🛡️ Admin -',
            };

            const lines = txs.map(tx => {
                const sign = tx.amount >= 0 ? '+' : '';
                const label = typeLabel[tx.type] || tx.type;
                const time = `<t:${Math.floor(tx.timestamp / 1000)}:R>`;
                return `${label} · **${sign}${tx.amount.toLocaleString('es-CL')}** · ${time}${tx.detail ? `\n> ${tx.detail}` : ''}`;
            });

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('📜 Últimas Transacciones')
                    .setColor(cfg.welcome_color || '#5865F2')
                    .setDescription(lines.join('\n\n'))
                    .setTimestamp()
                ],
                flags: [MessageFlags.Ephemeral]
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // SHOP-ADD
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'shop-add') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Necesitas **Gestionar Servidor**.', flags: [MessageFlags.Ephemeral] });
            }

            const name = interaction.options.getString('nombre');
            const price = interaction.options.getInteger('precio');
            const desc = interaction.options.getString('descripcion') || null;
            const emoji = interaction.options.getString('emoji') || '🛍️';
            const role = interaction.options.getRole('rol');
            const stock = interaction.options.getInteger('stock') ?? -1;
            const type = role ? 'role' : 'item';

            const info = db.prepare(`
                INSERT INTO shop_items (guild_id, name, description, price, emoji, role_id, type, stock, available, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            `).run(guildId, name, desc, price, emoji, role?.id || null, type, stock, Date.now());

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#57F287')
                    .setTitle('✅ Ítem agregado a la tienda')
                    .addFields(
                        { name: '🆔 ID', value: `\`${info.lastInsertRowid}\``, inline: true },
                        { name: '📦 Nombre', value: name, inline: true },
                        { name: '💰 Precio', value: price.toLocaleString('es-CL'), inline: true },
                        { name: '📦 Stock', value: stock === -1 ? '∞' : `${stock}`, inline: true },
                        { name: '🎭 Tipo', value: type, inline: true },
                        ...(role ? [{ name: '🎭 Rol', value: `<@&${role.id}>`, inline: true }] : [])
                    )
                ],
                flags: [MessageFlags.Ephemeral]
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // SHOP-REMOVE
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'shop-remove') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Necesitas **Gestionar Servidor**.', flags: [MessageFlags.Ephemeral] });
            }

            const id = interaction.options.getInteger('id');
            const item = db.prepare('SELECT * FROM shop_items WHERE id = ? AND guild_id = ?').get(id, guildId);
            if (!item) return interaction.reply({ content: `❌ Ítem #${id} no encontrado.`, flags: [MessageFlags.Ephemeral] });

            db.prepare('DELETE FROM shop_items WHERE id = ?').run(id);
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#57F287')
                    .setDescription(`🗑️ **${item.emoji} ${item.name}** eliminado de la tienda.`)],
                flags: [MessageFlags.Ephemeral]
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // GIVE / TAKE / RESET (Admin)
        // ══════════════════════════════════════════════════════════════════
        if (['give', 'take', 'reset'].includes(sub)) {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Necesitas **Gestionar Servidor**.', flags: [MessageFlags.Ephemeral] });
            }

            const target = interaction.options.getUser('usuario');

            if (sub === 'give') {
                const amount = interaction.options.getInteger('cantidad');
                db.prepare('UPDATE economy SET wallet = wallet + ?, total_earned = total_earned + ? WHERE guild_id = ? AND user_id = ?')
                    .run(amount, amount, guildId, target.id);
                logTransaction(guildId, target.id, 'admin_give', amount, `Por ${interaction.user.username}`);
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#57F287')
                        .setDescription(`✅ Se dieron ${fmt(guildId, amount)} a **${target.username}**.`)],
                    flags: [MessageFlags.Ephemeral]
                });
            }

            if (sub === 'take') {
                const amount = interaction.options.getInteger('cantidad');
                const eco = getEconomy(guildId, target.id);
                const actual = Math.min(eco.wallet, amount);
                db.prepare('UPDATE economy SET wallet = MAX(0, wallet - ?) WHERE guild_id = ? AND user_id = ?')
                    .run(actual, guildId, target.id);
                logTransaction(guildId, target.id, 'admin_take', -actual, `Por ${interaction.user.username}`);
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#FEE75C')
                        .setDescription(`✅ Se quitaron ${fmt(guildId, actual)} a **${target.username}**.`)],
                    flags: [MessageFlags.Ephemeral]
                });
            }

            if (sub === 'reset') {
                db.prepare(`
                    UPDATE economy SET wallet = 0, bank = 0, daily_streak = 0,
                    last_daily = 0, last_work = 0, last_crime = 0,
                    total_earned = 0, total_spent = 0
                    WHERE guild_id = ? AND user_id = ?
                `).run(guildId, target.id);
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#ED4245')
                        .setDescription(`🔄 Economía de **${target.username}** reseteada.`)],
                    flags: [MessageFlags.Ephemeral]
                });
            }
        }

        // ══════════════════════════════════════════════════════════════════
        // CONFIG
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'config') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Necesitas **Gestionar Servidor**.', flags: [MessageFlags.Ephemeral] });
            }

            const ajuste = interaction.options.getString('ajuste');
            const valor = interaction.options.getString('valor');

            const map = {
                currency: { col: 'economy_currency', parse: v => v.slice(0, 20) },
                emoji: { col: 'economy_currency_emoji', parse: v => v.slice(0, 10) },
                daily_amount: { col: 'economy_daily_amount', parse: v => parseInt(v) || 200 },
                work_cooldown: { col: 'economy_work_cooldown', parse: v => (parseInt(v) || 60) * 60000 },
                crime_cooldown: { col: 'economy_crime_cooldown', parse: v => (parseInt(v) || 120) * 60000 },
                toggle: { col: 'economy_enabled', parse: v => ['on', '1', 'true', 'activar'].includes(v.toLowerCase()) ? 1 : 0 },
                log_channel: { col: 'economy_log_channel', parse: v => v.replace(/[<#>]/g, '') },
            };

            const target = map[ajuste];
            if (!target) return interaction.reply({ content: '❌ Ajuste inválido.', flags: [MessageFlags.Ephemeral] });

            const parsed = target.parse(valor);
            db.prepare(`UPDATE guild_settings SET ${target.col} = ? WHERE guild_id = ?`).run(parsed, guildId);

            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#57F287')
                    .setDescription(`✅ **${ajuste}** actualizado a \`${parsed}\`.`)],
                flags: [MessageFlags.Ephemeral]
            });
        }
    }
};