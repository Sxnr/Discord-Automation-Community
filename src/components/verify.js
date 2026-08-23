const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags
} = require('discord.js');
const db = require('../database/db');

module.exports = async function (interaction) {
    const { customId } = interaction;

    // ── Verify captcha modal submit (CORREGIDO: antes estaba dentro de isButton y nunca se ejecutaba) ──
    if (interaction.isModalSubmit() && customId.startsWith('verify_modal_')) {
        const parts = customId.split('_');
        const guildId = parts[2];
        const userId = parts[3];
        const input = interaction.fields.getTextInputValue('captcha_input');

        const record = db.prepare('SELECT * FROM verifications WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
        if (!record) { await interaction.reply({ content: '❌ Sesión expirada.', flags: [MessageFlags.Ephemeral] }); return true; }

        if (record.attempts >= 3) {
            await interaction.reply({ content: '❌ Demasiados intentos fallidos. Usa el botón de verificación de nuevo.', flags: [MessageFlags.Ephemeral] });
            return true;
        }

        if (input.trim() !== record.code) {
            db.prepare('UPDATE verifications SET attempts = attempts + 1 WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
            const left = 3 - (record.attempts + 1);
            await interaction.reply({
                content: `❌ Código incorrecto. Te quedan **${left}** intento(s).`,
                flags: [MessageFlags.Ephemeral]
            });
            return true;
        }

        const cfg = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (cfg?.verify_role) await member?.roles.add(cfg.verify_role).catch(() => null);

        db.prepare(`
            UPDATE verifications SET status = 'verified', verified_at = ? WHERE guild_id = ? AND user_id = ?
        `).run(Date.now(), guildId, userId);

        await interaction.reply({
            embeds: [new EmbedBuilder().setColor('#57F287')
                .setTitle('✅ ¡Código correcto!')
                .setDescription('Has sido verificado. ¡Bienvenido al servidor!')
            ],
            flags: [MessageFlags.Ephemeral]
        });
        return true;
    }

    if (!interaction.isButton()) return false;

    // ── Verify button ──
    if (customId.startsWith('verify_start_')) {
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)').run(guildId);
        const cfg = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);

        if (!cfg.verify_enabled) {
            await interaction.reply({ content: '❌ La verificación está desactivada.', flags: [MessageFlags.Ephemeral] });
            return true;
        }

        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (cfg.verify_role && member?.roles.cache.has(cfg.verify_role)) {
            await interaction.reply({ content: '✅ Ya estás verificado.', flags: [MessageFlags.Ephemeral] });
            return true;
        }

        // Método: botón simple
        if (cfg.verify_method === 'button') {
            if (cfg.verify_role) await member?.roles.add(cfg.verify_role).catch(() => null);

            db.prepare(`
            INSERT INTO verifications (guild_id, user_id, status, method, verified_at, timestamp)
            VALUES (?, ?, 'verified', 'button', ?, ?)
            ON CONFLICT(guild_id, user_id) DO UPDATE SET status = 'verified', method = 'button', verified_at = ?
        `).run(guildId, userId, Date.now(), Date.now(), Date.now());

            // Log
            if (cfg.verify_log_channel) {
                const logCh = interaction.client.channels.cache.get(cfg.verify_log_channel);
                logCh?.send({
                    embeds: [new EmbedBuilder()
                        .setColor('#57F287')
                        .setTitle('✅ Usuario Verificado')
                        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                        .addFields(
                            { name: '👤 Usuario', value: `${interaction.user.tag} (${userId})`, inline: true },
                            { name: '🔧 Método', value: 'Botón', inline: true },
                            { name: '📅 Fecha', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
                        )
                        .setTimestamp()
                    ]
                }).catch(() => null);
            }

            await interaction.reply({
                embeds: [new EmbedBuilder().setColor('#57F287')
                    .setTitle('✅ ¡Verificado!')
                    .setDescription('Bienvenido al servidor. Ya tienes acceso completo.')
                ],
                flags: [MessageFlags.Ephemeral]
            });
            return true;
        }

        // Método: captcha
        if (cfg.verify_method === 'captcha') {
            const code = Math.floor(1000 + Math.random() * 9000).toString();

            db.prepare(`
            INSERT INTO verifications (guild_id, user_id, status, method, code, attempts, timestamp)
            VALUES (?, ?, 'pending', 'captcha', ?, 0, ?)
            ON CONFLICT(guild_id, user_id) DO UPDATE SET status = 'pending', code = ?, attempts = 0
        `).run(guildId, userId, code, Date.now(), code);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`verify_captcha_${guildId}_${userId}`)
                    .setLabel('🔢 Ingresar código')
                    .setStyle(ButtonStyle.Primary)
            );

            await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#FEE75C')
                    .setTitle('🔐 Captcha de verificación')
                    .setDescription(
                        `Tu código de verificación es:\n\n` +
                        `## \`${code.split('').join(' ')}\`\n\n` +
                        `Haz clic en el botón e ingresa el código exacto.`
                    )
                    .setFooter({ text: 'Tienes 3 intentos.' })
                ],
                components: [row],
                flags: [MessageFlags.Ephemeral]
            });
            return true;
        }
    }

    // ── Verify captcha modal trigger ──
    if (customId.startsWith('verify_captcha_')) {
        const parts = customId.split('_');
        const guildId = parts[2];
        const userId = parts[3];

        const modal = new ModalBuilder()
            .setCustomId(`verify_modal_${guildId}_${userId}`)
            .setTitle('Verificación Captcha');

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('captcha_input')
                    .setLabel('Ingresa el código de 4 dígitos')
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(4)
                    .setMaxLength(4)
                    .setRequired(true)
            )
        );

        await interaction.showModal(modal);
        return true;
    }

    return false;
};
