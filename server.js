const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebcastPushConnection } = require('tiktok-live-connector');
const { WebSocketServer } = require('ws');

const PORT = 8080;

const server = http.createServer((req, res) => {
    let filePath = path.join(__dirname, 'index.html');
    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File index.html tidak ditemukan!');
        } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content, 'utf-8');
        }
    });
});

const wss = new WebSocketServer({ server });
let tiktokConnection = null;

wss.on('connection', (ws) => {
    console.log('🔗 [Koneksi Web] Browser terhubung.');

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'CONNECT_TIKTOK') {
                const username = data.username.trim().replace(/^@/, '');
                console.log(`\n========================================`);
                console.log(`🚀 Menghubungkan langsung ke Live: @${username}`);
                console.log(`========================================`);

                if (tiktokConnection) {
                    try { tiktokConnection.disconnect(); } catch (e) {}
                    tiktokConnection = null;
                }

                // Inisialisasi koneksi dengan opsi ekstensi maksimal
                tiktokConnection = new WebcastPushConnection(username, {
                    processInitialData: true,
                    enableExtendedOption: true,
                    requestOptions: {
                        timeout: 15000
                    }
                });

                try {
                    const state = await tiktokConnection.connect();
                    console.log(`✅ Berhasil inisialisasi Room ID: ${state.roomId}`);
                    
                    if (ws.readyState === ws.OPEN) {
                        ws.send(JSON.stringify({ 
                            type: 'STATUS', 
                            message: `Terhubung ke @${username} (Room: ${state.roomId})` 
                        }));
                    }
                } catch (err) {
                    console.error(`❌ Gagal terhubung ke @${username}:`, err.message);
                    if (ws.readyState === ws.OPEN) {
                        ws.send(JSON.stringify({ 
                            type: 'ERROR', 
                            message: `Gagal terhubung. Pastikan @${username} sedang LIVE!` 
                        }));
                    }
                    return;
                }

                // Event Chat Masuk
                tiktokConnection.on('chat', (msg) => {
                    console.log(`\n💬 [KOMENTAR MASUK]`);
                    console.log(`   User   : ${msg.nickname} (@${msg.uniqueId})`);
                    console.log(`   Pesan  : ${msg.comment}`);
                    
                    if (ws.readyState === ws.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'chat',
                            nickname: msg.nickname || msg.uniqueId,
                            uniqueId: msg.uniqueId,
                            comment: msg.comment
                        }));
                    }
                });

                // Event Penonton Bergabung
                tiktokConnection.on('member', (msg) => {
                    console.log(`👤 [JOIN] ${msg.nickname} bergabung.`);
                    if (ws.readyState === ws.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'member',
                            nickname: msg.nickname || msg.uniqueId,
                            uniqueId: msg.uniqueId
                        }));
                    }
                });

                // Event Error Stream
                tiktokConnection.on('error', (err) => {
                    console.error(`⚠️ [Error Stream TikTok]:`, err);
                });

                tiktokConnection.on('disconnected', () => {
                    console.log(`⚠️ [Info] Koneksi ke Live @${username} terputus.`);
                });
            }
        } catch (err) {
            console.error('❌ Kesalahan sistem server:', err);
        }
    });

    ws.on('close', () => {
        console.log('❌ [Koneksi Web] Browser terputus.');
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server Jarvis Live aktif di http://localhost:${PORT}`);
});
