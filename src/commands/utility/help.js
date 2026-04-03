const {
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
    StringSelectMenuBuilder, MessageFlags
} = require('discord.js');

// ── Metadatos por categoría ─────────────────────────────────────────────────
const CATEGORY_META = {
    admin:   { label: 'Administración', emoji: '🛡️', color: 0xED4245, description: 'Tickets, warns, baneos, mutes, automod y configuración del servidor.' },
    utility: { label: 'Utilidad',       emoji: '🛠️', color: 0x5865F2, description: 'Diagnóstico, estado, ping y herramientas generales.' },
    economy: { label: 'Economía',       emoji: '💰', color: 0xF1C40F, description: 'Balance, daily, trabajo, tienda, inventario y transferencias.' },
    fun:     { label: 'Diversión',      emoji: '🎮', color: 0x57F287, description: 'Trivia, mascotas, perfiles y juegos interactivos.' },
    music:   { label: 'Música',         emoji: '🎵', color: 0x1DB954, description: 'Reproducción, cola, filtros de audio y control del player.' },
};

const FALLBACK_META = (cat) => ({
    label: cat.charAt(0).toUpperCase() + cat.slice(1),
    emoji: '📁',
    color: 0x99AAB5,
    description: `Comandos de la categoría ${cat}.`,
});

module.exports = {
    category: 'utility',
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('📂 Despliega el panel de asistencia interactivo con todos los comandos.'),

    async execute(interaction) {
        const { client } = interaction;
        const allCmds = client.commands;

        // ── Construir conteos dinámicos por categoría ───────────────────────
        const categoryCounts = {};
        allCmds.forEach(cmd => {
            const cat = cmd.category ?? 'sin categoría';
            categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
        });

        const totalCommands = allCmds.size;
        const guildIcon     = interaction.guild.iconURL({ dynamic: true });
        const botAvatar     = client.user.displayAvatarURL();

        // ── Orden preferido de categorías ───────────────────────────────────
        const ORDER = ['admin', 'utility', 'economy', 'fun', 'music'];
        const sortedCats = [
            ...ORDER.filter(c => categoryCounts[c] !== undefined),
            ...Object.keys(categoryCounts).filter(c => !ORDER.includes(c)).sort(),
        ];

        // ── Construir campos del embed por categoría ────────────────────────
        const categoryFields = sortedCats.map(cat => {
            const meta  = CATEGORY_META[cat] ?? FALLBACK_META(cat);
            const count = categoryCounts[cat];
            return {
                name: `${meta.emoji} ${meta.label}`,
                value: `${meta.description}\n> \`${count} comando${count !== 1 ? 's' : ''}\``,
                inline: true,
            };
        });

        // ── Estadísticas dinámicas ──────────────────────────────────────────
        const statsLines = sortedCats.map(cat => {
            const meta  = CATEGORY_META[cat] ?? FALLBACK_META(cat);
            const count = String(categoryCounts[cat]).padStart(2);
            return `${meta.emoji} ${meta.label.padEnd(16)} →  ${count}`;
        }).join('\n');

        // ── Embed principal ─────────────────────────────────────────────────
        const helpMainEmbed = new EmbedBuilder()
            .setTitle(`${client.user.username} • Centro de Comandos`)
            .setColor(0x5865F2)
            .setThumbnail(botAvatar)
            .setDescription(
                `**¡Hola, ${interaction.user}!** 👋\n\n` +
                `Bienvenido al panel de asistencia de **${client.user.username}**.\n` +
                `Usa el menú de abajo para explorar los módulos disponibles.\n\n` +
                `> 💡 Selecciona una categoría para ver los comandos detallados.`
            )
            .addFields(
                {
                    name: '📊 Estadísticas del Sistema',
                    value: `\`\`\`\n📦 Comandos totales  →  ${totalCommands}\n${statsLines}\n\`\`\``,
                    inline: false,
                },
                ...categoryFields,
                {
                    name: '⚡ Accesos Rápidos',
                    value:
                        '> `/settings` — Configuración del servidor\n' +
                        '> `/setup-tickets` — Sistema de tickets\n' +
                        '> `/economy balance` — Ver tu saldo\n' +
                        '> `/economy daily` — Recompensa diaria\n' +
                        '> `/trivia play` — Jugar trivia\n' +
                        '> `/pet status` — Ver tu mascota\n' +
                        '> `/profile view` — Tu perfil\n' +
                        '> `/giveaway start` — Iniciar un sorteo\n' +
                        '> `/play` — Reproducir música\n' +
                        '> `/queue` — Ver la cola de música',
                    inline: false,
                }
            )
            .setImage('https://media.discordapp.net/attachments/1380335501776654357/1487156050288312330/Floppa_GIF_-_Floppa_-_Discover__Share_GIFs.gif?ex=69c81d80&is=69c6cc00&hm=3038db4586311e89424f249f06ddc2ed1cf3e1ecb74bb57d20526feefb2a725d&=')
            .setFooter({
                text: `${interaction.guild.name} • ${totalCommands} comandos disponibles`,
                iconURL: guildIcon,
            })
            .setTimestamp();

        // ── Menú dinámico ───────────────────────────────────────────────────
        const menuOptions = sortedCats.map(cat => {
            const meta  = CATEGORY_META[cat] ?? FALLBACK_META(cat);
            const count = categoryCounts[cat];
            return {
                label:       meta.label,
                description: `${count} comando${count !== 1 ? 's' : ''} disponibles.`,
                value:       cat,
                emoji:       meta.emoji,
            };
        });

        const menu = new StringSelectMenuBuilder()
            .setCustomId('help_menu')
            .setPlaceholder('📂 Selecciona una categoría...')
            .addOptions(menuOptions);

        const row = new ActionRowBuilder().addComponents(menu);

        await interaction.reply({
            embeds: [helpMainEmbed],
            components: [row],
            flags: [MessageFlags.Ephemeral],
        });
    },
};