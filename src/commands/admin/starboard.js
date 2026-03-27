const {
    SlashCommandBuilder, EmbedBuilder,
    PermissionFlagsBits, MessageFlags
} = require('discord.js');
const db = require('../../database/db');

module.exports = {
    category: 'admin',
    data: new SlashCommandBuilder()
        .setName('starboard')
        .setDescription('⭐ Sistema de Starboard.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        // setup
        .addSubcommand(s => s
            .setName('setup')
            .setDescription('Configura el starboard.')
            .addChannelOption(o => o.setName('canal').setDescription('Canal del starboard').setRequired(true))
            .addIntegerOption(o => o.setName('minimo').setDescription('Mínimo de reacciones (default: 3)').setMinValue(1).setMaxValue(50))
            .addStringOption(o => o.setName('emoji').setDescription('Emoji de reacción (default: ⭐)'))
            .addBooleanOption(o => o.setName('self_star').setDescription('¿Permitir que uno se dé estrella a sí mismo?'))
        )
        // disable
        .addSubcommand(s => s
            .setName('disable')
            .setDescription('Desactiva el starboard.')
        )
        // config
        .addSubcommand(s => s
            .setName('config')
            .setDescription('Ver la configuración actual del starboard.')
        )
        // top
        .addSubcommand(s => s
            .setName('top')
            .setDescription('Ver los mensajes más estrellados del servidor.')
        ),

    async execute(interaction) {
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)').run(guildId);

        // ══════════════════════════════════════════════════════════════════
        // SETUP
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'setup') {
            const canal     = interaction.options.getChannel('canal');
            const minimo    = interaction.options.getInteger('minimo') ?? 3;
            const emoji     = interaction.options.getString('emoji') || '⭐';
            const selfStar  = interaction.options.getBoolean('self_star') ? 1 : 0;

            db.prepare(`
                UPDATE guild_settings SET
                    starboard_enabled = 1,
                    starboard_channel = ?,
                    starboard_threshold = ?,
                    starboard_emoji = ?,
                    starboard_self_star = ?
                WHERE guild_id = ?
            `).run(canal.id, minimo, emoji, selfStar, guildId);

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#FFD700')
                    .setTitle('⭐ Starboard configurado')
                    .addFields(
                        { name: '📢 Canal',       value: `${canal}`,                      inline: true },
                        { name: '⭐ Emoji',        value: emoji,                           inline: true },
                        { name: '🔢 Mínimo',      value: `${minimo} reacciones`,          inline: true },
                        { name: '👤 Self-star',   value: selfStar ? 'Permitido' : 'No permitido', inline: true },
                    )
                ],
                flags: [MessageFlags.Ephemeral]
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // DISABLE
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'disable') {
            db.prepare('UPDATE guild_settings SET starboard_enabled = 0 WHERE guild_id = ?').run(guildId);
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#FEE75C').setDescription('⚠️ Starboard desactivado.')],
                flags: [MessageFlags.Ephemeral]
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // CONFIG
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'config') {
            const cfg = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
            const total = db.prepare('SELECT COUNT(*) as c FROM starboard WHERE guild_id = ?').get(guildId).c;

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('⭐ Configuración del Starboard')
                    .setColor('#FFD700')
                    .addFields(
                        { name: '🔌 Estado',     value: cfg.starboard_enabled ? '✅ Activo' : '❌ Inactivo', inline: true },
                        { name: '📢 Canal',      value: cfg.starboard_channel ? `<#${cfg.starboard_channel}>` : '_No configurado_', inline: true },
                        { name: '⭐ Emoji',       value: cfg.starboard_emoji || '⭐', inline: true },
                        { name: '🔢 Mínimo',     value: `${cfg.starboard_threshold || 3}`, inline: true },
                        { name: '👤 Self-star',  value: cfg.starboard_self_star ? 'Sí' : 'No', inline: true },
                        { name: '📊 Mensajes',   value: `${total} en el starboard`, inline: true },
                    )
                ],
                flags: [MessageFlags.Ephemeral]
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // TOP
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'top') {
            const top = db.prepare(`
                SELECT * FROM starboard WHERE guild_id = ?
                ORDER BY stars DESC LIMIT 10
            `).all(guildId);

            if (!top.length) return interaction.reply({ content: '❌ Aún no hay mensajes en el starboard.', flags: [MessageFlags.Ephemeral] });

            const lines = top.map((row, i) => {
                const medals = ['🥇','🥈','🥉'];
                const icon   = medals[i] || `**${i + 1}.**`;
                const link   = `https://discord.com/channels/${guildId}/${row.channel_id}/${row.original_msg_id}`;
                const preview = row.content ? row.content.slice(0, 60) + (row.content.length > 60 ? '...' : '') : '_Sin texto_';
                return `${icon} ⭐ **${row.stars}** · <@${row.author_id}>\n> ${preview}\n> [Ver mensaje](${link})`;
            });

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('🏆 Mensajes más estrellados')
                    .setColor('#FFD700')
                    .setDescription(lines.join('\n\n'))
                    .setTimestamp()
                ]
            });
        }
    }
};