const { Events, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const db = require('../database/db');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        const { guild } = member;

        const settings = db.prepare(`
            SELECT welcome_channel, welcome_message, welcome_background,
                   welcome_color, welcome_role, welcome_enabled
            FROM guild_settings WHERE guild_id = ?
        `).get(guild.id);

        if (!settings?.welcome_channel || settings.welcome_enabled === 0) return;

        const channel = guild.channels.cache.get(settings.welcome_channel);
        if (!channel) return;

        try {
            // ── CANVAS ────────────────────────────────────────────────────
            const canvas = createCanvas(1024, 450);
            const ctx    = canvas.getContext('2d');

            // Fondo
            if (settings.welcome_background?.startsWith('http')) {
                const bg = await loadImage(settings.welcome_background).catch(() => null);
                if (bg) ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
                else     drawDefaultBackground(ctx, canvas);
            } else {
                drawDefaultBackground(ctx, canvas);
            }

            // Overlay de oscurecimiento
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Borde decorativo
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth   = 3;
            ctx.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);

            // Avatar circular con borde
            const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
            const avatar    = await loadImage(avatarUrl);

            ctx.save();
            ctx.beginPath();
            ctx.arc(512, 145, 105, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, 407, 40, 210, 210);
            ctx.restore();

            // Borde del avatar
            ctx.beginPath();
            ctx.arc(512, 145, 107, 0, Math.PI * 2);
            ctx.strokeStyle = settings.welcome_color || '#5865F2';
            ctx.lineWidth   = 5;
            ctx.stroke();

            // Nombre de usuario
            ctx.font        = 'bold 52px sans-serif';
            ctx.fillStyle   = '#FFFFFF';
            ctx.textAlign   = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur  = 10;
            ctx.fillText(member.user.username.toUpperCase(), 512, 305);

            // Servidor
            ctx.font      = '28px sans-serif';
            ctx.fillStyle = '#BDC3C7';
            ctx.shadowBlur = 6;
            ctx.fillText(`BIENVENIDO A ${guild.name.toUpperCase()}`, 512, 355);

            // Contador de miembros
            ctx.font      = '22px sans-serif';
            ctx.fillStyle = settings.welcome_color || '#5865F2';
            ctx.shadowBlur = 4;
            ctx.fillText(`MIEMBRO #${guild.memberCount}`, 512, 400);

            ctx.shadowBlur = 0;

            const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: `welcome-${member.id}.png` });

            // ── EMBED ─────────────────────────────────────────────────────
            const renderedMsg = (settings.welcome_message || '¡Bienvenido {user} a {server}!')
                .replace('{user}',   member.toString())
                .replace('{server}', guild.name)
                .replace('{count}',  guild.memberCount);

            const embed = new EmbedBuilder()
                .setTitle('✨ ¡Nueva Incorporación!')
                .setDescription(`>>> ${renderedMsg}`)
                .setColor(settings.welcome_color || '#5865F2')
                .setImage(`attachment://welcome-${member.id}.png`)
                .setFooter({ text: `${guild.name} • Miembro #${guild.memberCount}` })
                .setTimestamp();

            // Mencionar rol si está configurado
            const content = settings.welcome_role ? `<@&${settings.welcome_role}>` : null;

            await channel.send({ content, embeds: [embed], files: [attachment] });

        } catch (error) {
            console.error('❌ Error en bienvenida:', error);
        }
    }
};

function drawDefaultBackground(ctx, canvas) {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(0.5, '#16213e');
    gradient.addColorStop(1, '#0f3460');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Líneas decorativas
    ctx.strokeStyle = 'rgba(88, 101, 242, 0.15)';
    ctx.lineWidth   = 1;
    for (let i = 0; i < canvas.width; i += 60) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 60) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }
}