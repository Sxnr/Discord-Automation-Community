require('dotenv').config();

module.exports = {
    token: process.env.TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID,
    colors: {
        success: '#00FF00',
        error: '#FF0000',
        main: '#5865F2'
    }
};