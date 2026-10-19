const http = require('http');
const { WebcastPushConnection } = require('tiktok-live-connector');
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

                tiktokConnection = new WebcastPushConnection(username, {
                    processInitialData: false,
                    enableExtendedOption: true
                });

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

                // Menangkap data chat dengan fallback properti yang aman
                tiktokConnection.on('chat', (msg) => {
                    const nickname = msg.nickname || msg.user?.nickname || msg.uniqueId || 'Penonton';
                    const comment = msg.comment || msg.content || '';
                    
                    console.log(`💬 [Koyeb Chat] ${nickname}: ${comment}`);
                    if (ws.readyState === ws.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'chat',
                            nickname: nickname,
                            comment: comment
                        }));
                    }
                });

                // Menangkap data member join dengan fallback aman
                tiktokConnection.on('member', (msg) => {
                    const nickname = msg.nickname || msg.user?.nickname || msg.uniqueId || 'Seseorang';
                    
                    console.log(`👤 [Koyeb Join] ${nickname} bergabung.`);
                    if (ws.readyState === ws.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'member',
                            nickname: nickname
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
