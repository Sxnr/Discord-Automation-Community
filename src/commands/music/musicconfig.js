const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../database/db');

module.exports = {
    category: 'music',
    data: new SlashCommandBuilder()
        .setName('musicconfig')
        .setDescription('⚙️ Configura el módulo de música del servidor.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(s => s
            .setName('view')
            .setDescription('Ver la configuración actual de música.')
        )
        .addSubcommand(s => s
            .setName('set')
            .setDescription('Ajustar opciones de música.')
            .addChannelOption(o => o.setName('canal_texto').setDescription('Canal de texto exclusivo para comandos de música'))
            .addRoleOption(o => o.setName('rol_dj').setDescription('Rol DJ para controlar la música'))
            .addIntegerOption(o => o.setName('volumen').setDescription('Volumen por defecto (1-100)').setMinValue(1).setMaxValue(100))
            .addIntegerOption(o => o.setName('max_cola').setDescription('Máximo de canciones en cola (10-500)').setMinValue(10).setMaxValue(500))
            .addBooleanOption(o => o.setName('247').setDescription('Quedarse conectado 24/7'))
            .addBooleanOption(o => o.setName('anunciar').setDescription('Anunciar cada canción nueva'))
        )
        .addSubcommand(s => s
            .setName('reset')
            .setDescription('Restablecer configuración de música a valores por defecto.')
        ),

    async execute(interaction) {
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)').run(guildId);
        const cfg = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);

        // ── VIEW ──────────────────────────────────────────────
        if (sub === 'view') {
            const embed = new EmbedBuilder()
                .setColor(0x1DB954)
                .setTitle(`⚙️ Configuración de Música — ${interaction.guild.name}`)
                .addFields(
                    { name: '📢 Canal de texto',  value: cfg.music_text_channel ? `<#${cfg.music_text_channel}>` : '`Todos los canales`', inline: true },
                    { name: '🎧 Rol DJ',           value: cfg.music_dj_role ? `<@&${cfg.music_dj_role}>` : '`Todos los usuarios`', inline: true },
                    { name: '🔊 Volumen defecto',  value: `\`${cfg.music_volume ?? 100}%\``, inline: true },
                    { name: '📋 Máx. cola',        value: `\`${cfg.music_max_queue ?? 100} canciones\``, inline: true },
                    { name: '🕐 Modo 24/7',        value: cfg.music_247 ? '✅ Activado' : '❌ Desactivado', inline: true },
                    { name: '📣 Anunciar canción', value: cfg.music_announce !== 0 ? '✅ Activado' : '❌ Desactivado', inline: true },
                    { name: '⏱ Timeout salida',   value: `\`${(cfg.music_leave_timeout ?? 300000) / 60000} min\``, inline: true },
                );
            return interaction.reply({ embeds: [embed] });
        }

        // ── SET ───────────────────────────────────────────────
        if (sub === 'set') {
            const canal    = interaction.options.getChannel('canal_texto');
            const djRole   = interaction.options.getRole('rol_dj');
            const vol      = interaction.options.getInteger('volumen');
            const maxQ     = interaction.options.getInteger('max_cola');
            const modo247  = interaction.options.getBoolean('247');
            const anunciar = interaction.options.getBoolean('anunciar');

            if (canal)    db.prepare('UPDATE guild_settings SET music_text_channel = ? WHERE guild_id = ?').run(canal.id, guildId);
            if (djRole)   db.prepare('UPDATE guild_settings SET music_dj_role = ? WHERE guild_id = ?').run(djRole.id, guildId);
            if (vol)      db.prepare('UPDATE guild_settings SET music_volume = ? WHERE guild_id = ?').run(vol, guildId);
            if (maxQ)     db.prepare('UPDATE guild_settings SET music_max_queue = ? WHERE guild_id = ?').run(maxQ, guildId);
            if (modo247 !== null) db.prepare('UPDATE guild_settings SET music_247 = ? WHERE guild_id = ?').run(modo247 ? 1 : 0, guildId);
            if (anunciar !== null) db.prepare('UPDATE guild_settings SET music_announce = ? WHERE guild_id = ?').run(anunciar ? 1 : 0, guildId);

            return interaction.reply({ embeds: [{ color: 0x1DB954, description: '✅ Configuración de música actualizada.' }] });
        }

        // ── RESET ─────────────────────────────────────────────
        if (sub === 'reset') {
            db.prepare(`
                UPDATE guild_settings SET
                    music_volume = 100, music_dj_role = NULL, music_text_channel = NULL,
                    music_max_queue = 100, music_247 = 0, music_autoplay = 0,
                    music_filters_enabled = 1, music_announce = 1, music_leave_timeout = 300000
                WHERE guild_id = ?
            `).run(guildId);
            return interaction.reply({ embeds: [{ color: 0xFEE75C, description: '🔄 Configuración de música restablecida a valores por defecto.' }] });
        }
    },
};
