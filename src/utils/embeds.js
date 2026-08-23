// ══════════════════════════════════════════════════════════════════
//  UTILIDAD DE EMBEDS — estilo consistente y "premium"
//  Centraliza colores, footers y estructura para que todos los
//  comandos compartan la misma calidad visual.
// ══════════════════════════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');
const config = require('../config');

const BRAND = config?.colors?.main || '#5865F2';
const GREEN = '#2ECC71';
const RED   = '#E74C3C';
const YELLOW= '#FEE75C';
const BLUE  = '#3498DB';

// Embed base con marca y timestamp por defecto
function makeEmbed({
    color = BRAND,
    title,
    description,
    footer,
    thumbnail,
    author,
    image,
    fields,
    timestamp = true,
} = {}) {
    const e = new EmbedBuilder().setColor(color);
    if (title) e.setTitle(title);
    if (description) e.setDescription(description);
    if (thumbnail) e.setThumbnail(thumbnail);
    if (image) e.setImage(image);
    if (author) e.setAuthor(author);
    if (fields) e.addFields(fields);
    if (footer) e.setFooter(footer);
    if (timestamp) e.setTimestamp();
    return e;
}

function brandFooter(client, extra = '') {
    const name = client?.user?.username || 'Bot';
    return {
        text: `${name} • /help${extra ? ' • ' + extra : ''}`,
        iconURL: client?.user?.displayAvatarURL?.(),
    };
}

const success = (title, description, extra = {}) =>
    makeEmbed({ color: GREEN, title: `✅ ${title}`, description, ...extra });

const error = (description, extra = {}) =>
    makeEmbed({ color: RED, title: '❌ Error', description, ...extra });

const info = (title, description, extra = {}) =>
    makeEmbed({ color: BRAND, title, description, ...extra });

const warn = (description, extra = {}) =>
    makeEmbed({ color: YELLOW, title: '⚠️ Atención', description, ...extra });

const loading = (description, extra = {}) =>
    makeEmbed({ color: BLUE, title: '⏳ Procesando…', description, ...extra });

module.exports = {
    BRAND, GREEN, RED, YELLOW, BLUE,
    makeEmbed, brandFooter, success, error, info, warn, loading,
};
