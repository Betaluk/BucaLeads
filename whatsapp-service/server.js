import express from 'express';
import cors from 'cors';
import qrcode from 'qrcode';
import pino from 'pino';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_DIR = path.join(__dirname, 'auth_info_baileys');

// Configurações
const PORT = process.env.WHATSAPP_PORT || 3001;
const FASTAPI_WEBHOOK_URL = process.env.FASTAPI_WEBHOOK_URL || 'http://127.0.0.1:8000/api/whatsapp/webhook';

const app = express();
app.use(cors());
app.use(express.json());

// Estado global da sessão WhatsApp
let sock = null;
let connectionStatus = 'disconnected'; // 'disconnected' | 'connecting' | 'qr_ready' | 'connected'
let currentQrDataUrl = null;
let connectedUser = null;
let reconnectAttempts = 0;

const logger = pino({ level: 'silent' });

async function initWhatsApp(forceNew = false) {
  if (connectionStatus === 'connected' && sock && !forceNew) {
    return;
  }

  connectionStatus = 'connecting';
  currentQrDataUrl = null;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`[*] Baileys WhatsApp Engine v${version.join('.')} (Latest: ${isLatest})`);

    sock = makeWASocket({
      version,
      logger,
      printQRInTerminal: false,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger)
      },
      browser: ['BucaLeads CRM', 'Chrome', '120.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        connectionStatus = 'qr_ready';
        try {
          currentQrDataUrl = await qrcode.toDataURL(qr, {
            scale: 6,
            margin: 2,
            color: { dark: '#000000', light: '#ffffff' }
          });
          console.log('[*] Novo QR Code do WhatsApp gerado para leitura!');
        } catch (qrErr) {
          console.error('[!] Erro gerando DataURL do QR Code:', qrErr);
        }
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`[!] Conexao WhatsApp fechada (motivo: ${statusCode}). Reconectar: ${shouldReconnect}`);

        currentQrDataUrl = null;
        connectedUser = null;

        if (statusCode === DisconnectReason.loggedOut) {
          connectionStatus = 'disconnected';
          console.log('[*] Sessao desconectada pelo usuario. Limpando credenciais...');
          try {
            if (fs.existsSync(AUTH_DIR)) {
              fs.rmSync(AUTH_DIR, { recursive: true, force: true });
            }
          } catch (e) {
            console.error('[!] Erro ao limpar AUTH_DIR:', e);
          }
        } else {
          connectionStatus = 'disconnected';
          if (reconnectAttempts < 5) {
            reconnectAttempts++;
            const delay = Math.min(reconnectAttempts * 2000, 10000);
            console.log(`[*] Tentando reconectar WhatsApp em ${delay / 1000}s (Tentativa ${reconnectAttempts}/5)...`);
            setTimeout(() => initWhatsApp(), delay);
          }
        }
      } else if (connection === 'open') {
        connectionStatus = 'connected';
        reconnectAttempts = 0;
        currentQrDataUrl = null;
        connectedUser = {
          id: sock.user?.id?.split(':')[0] || sock.user?.id,
          name: sock.user?.name || 'BucaLeads Operator'
        };
        console.log(`[OK] WhatsApp Conectado com sucesso! Usuario: ${connectedUser.id} (${connectedUser.name})`);
      }
    });

    // Escuta de mensagens recebidas
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (!msg.message) continue;
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid || remoteJid.includes('@broadcast') || remoteJid.includes('@g.us')) {
          continue; // Ignora grupos e status por enquanto
        }

        const phone = remoteJid.replace('@s.whatsapp.net', '');
        const fromMe = Boolean(msg.key.fromMe);

        // Extrai texto da mensagem
        const text =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption ||
          msg.message.videoMessage?.caption ||
          '';

        if (!text && !msg.message.imageMessage && !msg.message.documentMessage) {
          continue;
        }

        const payload = {
          whatsapp_message_id: msg.key.id,
          phone: phone,
          direction: fromMe ? 'outgoing' : 'incoming',
          sender_name: msg.pushName || (fromMe ? 'Eu' : 'Lead'),
          content: text || '[Midia/Anexo]',
          status: fromMe ? 'sent' : 'received',
          timestamp: new Date((msg.messageTimestamp || Date.now() / 1000) * 1000).toISOString()
        };

        try {
          await axios.post(FASTAPI_WEBHOOK_URL, payload, { timeout: 3000 });
        } catch (webhookErr) {
          // Nao derruba o servico se o FastAPI estiver reiniciando
          // console.warn('[!] Erro enviando mensagem recebida para webhook FastAPI:', webhookErr.message);
        }
      }
    });

  } catch (err) {
    console.error('[!] Erro iniciando WhatsApp Baileys:', err);
    connectionStatus = 'disconnected';
  }
}

// ==========================================
// Rotas da API REST do Servico WhatsApp
// ==========================================

// Status da conexao e QR Code
app.get('/status', (req, res) => {
  res.json({
    status: connectionStatus,
    qrCode: currentQrDataUrl,
    user: connectedUser
  });
});

// Forcar inicio da conexao / geracao de QR
app.post('/connect', async (req, res) => {
  if (connectionStatus === 'connected') {
    return res.json({ status: connectionStatus, message: 'Ja conectado.', user: connectedUser });
  }
  reconnectAttempts = 0;
  await initWhatsApp();
  res.json({ status: connectionStatus, qrCode: currentQrDataUrl });
});

// Desconectar sessao (logout)
app.post('/disconnect', async (req, res) => {
  try {
    if (sock) {
      await sock.logout();
    }
  } catch (e) {
    // Silencia erro se ja estiver fechado
  }
  try {
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    }
  } catch (e) {}

  connectionStatus = 'disconnected';
  currentQrDataUrl = null;
  connectedUser = null;
  sock = null;

  res.json({ success: true, message: 'WhatsApp desconectado com sucesso.' });
});

// Envio de Mensagem de Texto
app.post('/send', async (req, res) => {
  const { phone, text } = req.body;

  if (connectionStatus !== 'connected' || !sock) {
    return res.status(400).json({
      error: 'WhatsApp nao esta conectado. Por favor, escaneie o QR Code primeiro.'
    });
  }

  if (!phone || !text) {
    return res.status(400).json({ error: 'Campos phone e text sao obrigatorios.' });
  }

  // Normaliza o numero para formato WhatsApp internacional (ex: 5511999999999)
  let cleanNumber = phone.replace(/\D/g, '');
  if (!cleanNumber.startsWith('55') && cleanNumber.length <= 11) {
    cleanNumber = '55' + cleanNumber;
  }
  const jid = `${cleanNumber}@s.whatsapp.net`;

  try {
    const result = await sock.sendMessage(jid, { text });
    res.json({
      success: true,
      messageId: result?.key?.id,
      phone: cleanNumber,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error(`[!] Erro ao enviar mensagem para ${cleanNumber}:`, err);
    res.status(500).json({ error: `Falha ao enviar mensagem: ${err.message}` });
  }
});

// Iniciar servidor HTTP
app.listen(PORT, () => {
  console.log(`[OK] BucaLeads WhatsApp Service rodando na porta ${PORT}`);
  // Iniciar conexao inicial automaticamente
  initWhatsApp();
});
