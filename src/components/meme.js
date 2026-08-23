module.exports = async function (interaction) {
    if (!interaction.isButton()) return false;
    if (interaction.customId.startsWith('meme_otro_')) {
        const memeCmd = interaction.client.commands.get('meme');
        if (memeCmd?.handleButton) {
            await memeCmd.handleButton(interaction);
            return true;
        }
    }
    return false;
};
