const http = require('http');
const TikTokModule = require('tiktok-live-connector');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8000;

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Jarvis TikTok Cloud Bridge on Koyeb is Running!');
});

const wss = new WebSocketServer({ server });
let tiktokConnection = null;

wss.on('connection', (ws) => {
    console.log('🔗 [Koyeb Cloud] Browser Jarvis berhasil terhubung ke Bridge!');

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message.toString());

            if (data.type === 'CONNECT_TIKTOK') {
                const username = data.username.trim().replace(/^@/, '');
                console.log(`⏳ [Koyeb] Menghubungkan ke TikTok Live: @${username}...`);

                if (tiktokConnection) {
                    try { tiktokConnection.disconnect(); } catch (e) {}
                    tiktokConnection = null;
                }

                // Deteksi otomatis berbagai macam format ekspor modul
                const Connector = TikTokModule.WebcastPushConnection || TikTokModule.default || TikTokModule;

                try {
                    tiktokConnection = new Connector(username, {
                        processInitialData: false,
                        enableExtendedOption: true
                    });
                } catch (e) {
                    // Fallback jika terpanggil sebagai fungsi biasa tanpa new
                    tiktokConnection = Connector(username, {
                        processInitialData: false,
                        enableExtendedOption: true
                    });
                }

                try {
                    const state = await tiktokConnection.connect();
                    console.log(`✅ [Koyeb] Terhubung ke Live @${username} (Room ID: ${state.roomId})`);
                    
                    if (ws.readyState === ws.OPEN) {
                        ws.send(JSON.stringify({ 
                            type: 'STATUS', 
                            message: `Terhubung ke Live @${username}` 
                        }));
                    }
                } catch (err) {
                    console.error(`❌ [Koyeb Error] Gagal terhubung ke @${username}:`, err.message);
                    if (ws.readyState === ws.OPEN) {
                        ws.send(JSON.stringify({ 
                            type: 'ERROR', 
                            message: `Gagal terhubung ke @${username}. Pastikan akun sedang LIVE!` 
                        }));
                    }
                    return;
                }

                tiktokConnection.on('chat', (msg) => {
                    console.log(`💬 [Koyeb Chat] ${msg.nickname}: ${msg.comment}`);
                    if (ws.readyState === ws.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'chat',
                            nickname: msg.nickname || msg.uniqueId,
                            uniqueId: msg.uniqueId,
                            comment: msg.comment
                        }));
                    }
                });

                tiktokConnection.on('member', (msg) => {
                    console.log(`👤 [Koyeb Join] ${msg.nickname} bergabung.`);
                    if (ws.readyState === ws.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'member',
                            nickname: msg.nickname || msg.uniqueId,
                            uniqueId: msg.uniqueId
                        }));
                    }
                });
            }
        } catch (err) {
            console.error('❌ Error parsing message:', err.message);
        }
    });

    ws.on('close', () => {
        console.log('❌ [Koyeb] Browser terputus dari Bridge.');
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Jarvis Cloud Bridge aktif di port ${PORT}`);
});
                        
