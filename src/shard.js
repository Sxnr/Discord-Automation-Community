require('dotenv').config();
const path = require('node:path');
const { ShardingManager } = require('discord.js');

const token = process.env.TOKEN;
if (!token) {
    console.error('[SHARD] Falta TOKEN en .env. No se pueden iniciar los shards.');
    process.exit(1);
}

const manager = new ShardingManager(path.join(__dirname, 'index.js'), {
    token,
    totalShards: 'auto',
    mode: 'process',
    respawn: true,
    shardArgs: ['--ansi'],
});

manager.on('shardCreate', (shard) => {
    console.log(`[SHARD] Shard ${shard.id} iniciado.`);
    shard.on('ready', () => console.log(`[SHARD] Shard ${shard.id} listo.`));
    shard.on('disconnect', () => console.log(`[SHARD] Shard ${shard.id} desconectado.`));
    shard.on('reconnecting', () => console.log(`[SHARD] Shard ${shard.id} reconectando...`));
    shard.on('error', (err) => console.error(`[SHARD] Error en shard ${shard.id}:`, err));
});

manager.spawn()
    .then(() => console.log(`[SHARD] ${manager.totalShards} shard(s) en ejecución.`))
    .catch((err) => { console.error('[SHARD] Error al iniciar los shards:', err); process.exit(1); });

process.on('SIGINT', () => { console.log('\n[SHARD] Deteniendo shards...'); manager.respawn = false; process.exit(0); });
