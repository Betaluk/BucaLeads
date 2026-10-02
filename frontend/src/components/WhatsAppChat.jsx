import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageCircle,
  Send,
  Phone,
  QrCode,
  RefreshCw,
  LogOut,
  Sparkles,
  Search,
  ChevronRight,
  Zap,
  Info,
  ShieldCheck,
  ArrowLeft,
  X,
  CheckCheck
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const WS_URL = API_BASE.replace(/^http/, 'ws');

function formatTime(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatDateLabel(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    const now = Date.now();
    const diffDays = Math.floor((now - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    return d.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
  } catch {
    return '';
  }
}

export default function WhatsAppChat({
  leads = [],
  onOpenLeadDetail,
  onUpdateLeadStatus,
  initialContactPhone = null,
  onClearInitialContact,
  onUnreadCountChange
}) {
  // Estado da Conexão WhatsApp
  const [waStatus, setWaStatus] = useState('loading'); // 'loading', 'disconnected', 'connecting', 'qr_ready', 'connected', 'offline'
  const [qrCodeUrl, setQrCodeUrl] = useState(null);
  const [connectedUser, setConnectedUser] = useState(null);
  const [connectingAction, setConnectingAction] = useState(false);

  // Conversas e Mensagens
  const [conversations, setConversations] = useState([]);
  const [activePhone, setActivePhone] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal Nova Conversa
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');

  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // Rolagem suave para o fim das mensagens
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Checar status da conexão
  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/status`);
      if (res.ok) {
        const data = await res.json();
        setWaStatus(data.status);
        setQrCodeUrl(data.qrCode);
        setConnectedUser(data.user);
      } else {
        setWaStatus('offline');
      }
    } catch {
      setWaStatus('offline');
    }
  }, []);

  // Buscar conversas
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/conversations`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
        const totalUnread = data.reduce((acc, c) => acc + (c.unread_count || 0), 0);
        if (onUnreadCountChange) onUnreadCountChange(totalUnread);
      }
    } catch (e) {
      console.error('Erro ao buscar conversas:', e);
    }
  }, [onUnreadCountChange]);

  // Buscar mensagens de um telefone
  const fetchMessages = useCallback(async (phone) => {
    if (!phone) return;
    try {
      setMessagesLoading(true);
      const res = await fetch(`${API_BASE}/api/whatsapp/messages/${phone}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
      // Marcar como lidas
      await fetch(`${API_BASE}/api/whatsapp/mark-read/${phone}`, { method: 'POST' });
      fetchConversations();
    } catch (e) {
      console.error('Erro ao buscar mensagens:', e);
    } finally {
      setMessagesLoading(false);
    }
  }, [fetchConversations]);

  // Inicialização e Polling
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const resStatus = await fetch(`${API_BASE}/api/whatsapp/status`);
        if (resStatus.ok && mounted) {
          const data = await resStatus.json();
          setWaStatus(data.status);
          setQrCodeUrl(data.qrCode);
          setConnectedUser(data.user);
        }
        const resConv = await fetch(`${API_BASE}/api/whatsapp/conversations`);
        if (resConv.ok && mounted) {
          const convData = await resConv.json();
          setConversations(convData);
          const totalUnread = convData.reduce((acc, c) => acc + (c.unread_count || 0), 0);
          if (onUnreadCountChange) onUnreadCountChange(totalUnread);
        }
      } catch {
        if (mounted) setWaStatus('offline');
      }
    };

    init();

    pollIntervalRef.current = setInterval(() => {
      checkStatus();
    }, 4000);

    return () => {
      mounted = false;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [checkStatus, onUnreadCountChange]);

  // Selecionar contato inicial se informado pelo Kanban/Tabela
  useEffect(() => {
    if (initialContactPhone) {
      const clean = initialContactPhone.replace(/\D/g, '');
      const selectContact = async () => {
        setActivePhone(clean);
        await fetchMessages(clean);
        if (onClearInitialContact) onClearInitialContact();
      };
      selectContact();
    }
  }, [initialContactPhone, fetchMessages, onClearInitialContact]);

  // Tecla Escape fecha modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showNewChatModal) {
        setShowNewChatModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showNewChatModal]);

  // WebSocket para sincronização em tempo real
  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;

    const connectWs = () => {
      try {
        ws = new WebSocket(`${WS_URL}/api/whatsapp/ws`);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'new_message') {
              const msg = data.message;
              setActivePhone((currPhone) => {
                if (currPhone && (msg.phone.endsWith(currPhone.slice(-8)) || currPhone.endsWith(msg.phone.slice(-8)))) {
                  setMessages((prev) => {
                    if (prev.some((m) => m.id === msg.id)) return prev;
                    return [...prev, msg];
                  });
                  if (msg.direction === 'incoming') {
                    fetch(`${API_BASE}/api/whatsapp/mark-read/${currPhone}`, { method: 'POST' });
                  }
                }
                return currPhone;
              });
              fetchConversations();
            } else if (data.type === 'read_receipt') {
              fetchConversations();
            }
          } catch (err) {
            console.error('[WS] Erro processando evento:', err);
          }
        };

        ws.onclose = () => {
          reconnectTimeout = setTimeout(connectWs, 3000);
        };
      } catch {
        reconnectTimeout = setTimeout(connectWs, 3000);
      }
    };

    connectWs();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [fetchConversations]);

  // Conectar WhatsApp
  const handleConnect = async () => {
    setConnectingAction(true);
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/connect`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setWaStatus(data.status);
        if (data.qrCode) setQrCodeUrl(data.qrCode);
      }
    } catch (e) {
      console.error('Erro ao conectar WhatsApp:', e);
    } finally {
      setConnectingAction(false);
    }
  };

  // Desconectar WhatsApp
  const handleDisconnect = async () => {
    if (!window.confirm('Deseja realmente desconectar o WhatsApp desta sessão?')) return;
    try {
      await fetch(`${API_BASE}/api/whatsapp/disconnect`, { method: 'POST' });
      setWaStatus('disconnected');
      setQrCodeUrl(null);
      setConnectedUser(null);
    } catch (e) {
      console.error('Erro ao desconectar WhatsApp:', e);
    }
  };

  // Enviar Mensagem
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activePhone || sending) return;

    const textToSend = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: activePhone,
          text: textToSend,
          lead_id: activeConversation?.lead_id || null
        })
      });

      if (res.ok) {
        const newMsg = await res.json();
        setMessages((prev) => [...prev, newMsg]);
        fetchConversations();
      } else {
        const err = await res.json();
        alert(`Erro ao enviar mensagem: ${err.detail || 'Falha no envio'}`);
        setInputText(textToSend);
      }
    } catch (err) {
      console.error('Erro enviando mensagem:', err);
      alert('Erro de conexão ao enviar a mensagem.');
      setInputText(textToSend);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Modelos Rápidos
  const applyPitchTemplate = (templateType) => {
    const leadName = activeConversation?.lead_name || activeLead?.business_name || 'Amigo(a)';
    let templateText = '';

    if (templateType === 'intro') {
      templateText = `Olá, tudo bem? Me chamo Lucas e acompanho o mercado da sua região. Estava pesquisando sobre ${activeConversation?.lead_niche || activeLead?.niche || 'empresas do seu segmento'} e encontrei o perfil da ${leadName}. Reparei em algumas oportunidades excelentes no posicionamento digital de vocês para atrair mais clientes. Podemos bater um papo rápido?`;
    } else if (templateType === 'audit') {
      templateText = `Olá! Fizemos uma análise técnica e de presença online da ${leadName} no Google. Identificamos alguns pontos de melhoria importantes na captação online que podem fazer vocês saírem na frente da concorrência. Posso te enviar esse diagnóstico gratuitamente aqui pelo WhatsApp?`;
    } else if (templateType === 'meeting') {
      templateText = `Olá! Você teria disponibilidade de 10 minutos amanhã para trocarmos uma ideia sobre como aumentar o volume de clientes qualificados entrando em contato com a ${leadName}? Tenho um plano bem direto e prático.`;
    } else if (templateType === 'proposal') {
      templateText = `Olá! Conforme combinamos, estruturei a proposta comercial personalizada para a ${leadName}. Quando tiver um momento, me avise para alinharmos os detalhes e darmos o pontapé inicial!`;
    }

    setInputText(templateText);
  };

  const safeLeads = Array.isArray(leads) ? leads : [];
  const safeConversations = Array.isArray(conversations) ? conversations : [];

  const activeConversation = safeConversations.find(
    (c) => c && (c.phone === activePhone || (activePhone && c.phone && c.phone.endsWith(activePhone.slice(-8))))
  );

  const activeLead = safeLeads.find((l) => {
    if (!l) return false;
    if (activeConversation?.lead_id && l.id === activeConversation.lead_id) return true;
    if (l.phone && activePhone) {
      const lDigits = String(l.phone).replace(/\D/g, '');
      return lDigits.endsWith(activePhone.slice(-8)) || activePhone.endsWith(lDigits.slice(-8));
    }
    return false;
  });

  const filteredConversations = safeConversations.filter((c) => {
    if (!c) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (c.phone && String(c.phone).toLowerCase().includes(term)) ||
      (c.lead_name && String(c.lead_name).toLowerCase().includes(term)) ||
      (c.last_message && String(c.last_message).toLowerCase().includes(term))
    );
  });

  const eligibleLeadsForNewChat = safeLeads.filter((l) => {
    if (!l || !l.phone) return false;
    if (!newChatSearch) return true;
    const term = newChatSearch.toLowerCase();
    return (
      (l.business_name && String(l.business_name).toLowerCase().includes(term)) ||
      (l.phone && String(l.phone).includes(term)) ||
      (l.city && String(l.city).toLowerCase().includes(term))
    );
  });

  return (
    <div className="whatsapp-container">
      {/* Barra de Status Superior */}
      <div className="whatsapp-status-bar">
        <div className="wa-status-left">
          <div className={`wa-status-dot ${waStatus}`} />
          <div className="wa-status-label">
            {waStatus === 'connected' && (
              <>
                <strong>WhatsApp Conectado</strong>
                {connectedUser?.id && (
                  <span className="wa-user-tag">
                    +{connectedUser.id} {connectedUser.name ? `(${connectedUser.name})` : ''}
                  </span>
                )}
              </>
            )}
            {waStatus === 'connecting' && <span>Conectando ao WhatsApp...</span>}
            {waStatus === 'qr_ready' && <span>Aguardando leitura do QR Code...</span>}
            {waStatus === 'disconnected' && <span>WhatsApp Desconectado</span>}
            {waStatus === 'offline' && <span>Serviço WhatsApp Offline (Porta 3001)</span>}
          </div>
        </div>

        <div>
          {waStatus === 'connected' ? (
            <button className="btn-wa-logout" onClick={handleDisconnect} title="Desconectar Sessão">
              <LogOut size={14} /> Desconectar
            </button>
          ) : (
            <button
              className="btn-wa-connect"
              onClick={handleConnect}
              disabled={connectingAction}
            >
              <RefreshCw size={14} className={connectingAction ? 'pulse-spinner' : ''} />
              {waStatus === 'qr_ready' ? 'Atualizar QR Code' : 'Conectar WhatsApp'}
            </button>
          )}
        </div>
      </div>

      {/* TELA 1: Desconectado / QR Code */}
      {waStatus !== 'connected' ? (
        <div className="wa-connection-card">
          <div className="wa-qr-box">
            {waStatus === 'qr_ready' && qrCodeUrl ? (
              <div className="wa-qr-inner">
                <img src={qrCodeUrl} alt="QR Code WhatsApp" className="wa-qr-image" />
                <div style={{ fontSize: '0.82rem', color: '#a7f3d0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={14} color="#10b981" /> Aproxime a câmera do seu WhatsApp
                </div>
              </div>
            ) : waStatus === 'connecting' ? (
              <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                <RefreshCw size={32} className="pulse-spinner" style={{ marginBottom: '12px' }} />
                <p>Gerando QR Code de autenticação...</p>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                <QrCode size={48} opacity={0.3} style={{ marginBottom: '12px' }} />
                <p style={{ marginBottom: '14px' }}>Clique abaixo para conectar seu WhatsApp</p>
                <button className="btn-primary" onClick={handleConnect} disabled={connectingAction}>
                  <RefreshCw size={14} className={connectingAction ? 'pulse-spinner' : ''} /> Iniciar Conexão
                </button>
              </div>
            )}
          </div>

          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', color: '#fff', marginBottom: '8px' }}>
              Conectar ao WhatsApp
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '18px' }}>
              Sincronize o BucaLeads com o seu WhatsApp para gerenciar conversas e abordar leads diretamente pela plataforma.
            </p>

            <ol className="wa-steps-list">
              <li>
                <span className="step-num">1</span>
                Abra o WhatsApp no seu smartphone.
              </li>
              <li>
                <span className="step-num">2</span>
                Toque em <strong>Menu (Android)</strong> ou <strong>Configurações (iPhone)</strong>.
              </li>
              <li>
                <span className="step-num">3</span>
                Selecione <strong>Aparelhos conectados</strong> e toque em <strong>Conectar um aparelho</strong>.
              </li>
              <li>
                <span className="step-num">4</span>
                Aponte a câmera para o QR Code ao lado.
              </li>
            </ol>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'var(--accent-emerald-subtle)', border: '1px solid var(--accent-emerald-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: '#a7f3d0' }}>
              <ShieldCheck size={16} color="#10b981" />
              <span>Conexão direta e segura via protocolo Multi-Device oficial do WhatsApp.</span>
            </div>
          </div>
        </div>
      ) : (
        /* TELA 2: 2 Painéis Messenger */
        <div className={`wa-messenger-layout ${activePhone ? 'mobile-show-chat' : 'mobile-show-sidebar'}`}>
          {/* Painel Esquerdo: Conversas */}
          <div className="wa-sidebar">
            <div className="wa-sidebar-header">
              <div className="search-input-wrapper" style={{ flex: 1 }}>
                <Search size={14} className="search-icon-inside" />
                <input
                  type="text"
                  className="search-filter-input"
                  style={{ height: '32px', fontSize: '0.8rem' }}
                  placeholder="Buscar conversa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button className="btn-clear-search" onClick={() => setSearchTerm('')}>
                    <X size={12} />
                  </button>
                )}
              </div>
              <button
                className="btn-primary"
                style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                onClick={() => setShowNewChatModal(true)}
                title="Iniciar Nova Conversa com um Lead"
              >
                + Novo
              </button>
            </div>

            <div className="wa-conversations-list">
              {filteredConversations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                  <MessageCircle size={32} opacity={0.3} style={{ marginBottom: '8px' }} />
                  <p>Nenhuma conversa ativa.</p>
                  <button
                    className="btn-secondary"
                    style={{ marginTop: '12px', fontSize: '0.76rem', padding: '6px 12px' }}
                    onClick={() => setShowNewChatModal(true)}
                  >
                    Iniciar Primeiro Contato
                  </button>
                </div>
              ) : (
                filteredConversations.map((c) => {
                  const isSelected = activePhone && (c.phone === activePhone || c.phone.endsWith(activePhone.slice(-8)));

                  return (
                    <div
                      key={c.phone}
                      className={`wa-conversation-item ${isSelected ? 'active' : ''}`}
                      onClick={() => {
                        setActivePhone(c.phone);
                        fetchMessages(c.phone);
                      }}
                    >
                      <div className="wa-item-avatar">
                        {String(c.lead_name || c.phone || 'WA').slice(0, 2).toUpperCase()}
                      </div>

                      <div className="wa-item-info">
                        <div className="wa-item-top">
                          <span className="wa-item-name">{c.lead_name || c.phone}</span>
                          <span className="wa-item-time">{formatDateLabel(c.last_message_at)}</span>
                        </div>

                        <div className="wa-item-bottom">
                          <p className="wa-item-last-msg">
                            {c.last_message_direction === 'outgoing' && '✓✓ '}
                            {c.last_message || 'Nenhuma mensagem recente'}
                          </p>
                          {c.unread_count > 0 && (
                            <span className="unread-badge-pulse">{c.unread_count}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Painel Direito: Janela de Chat */}
          <div className="wa-chat-window">
            {activePhone ? (
              <>
                {/* Header do Chat */}
                <div className="wa-chat-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Botão Voltar para Mobile */}
                    <button
                      className="btn-icon-subtle"
                      style={{ padding: '6px' }}
                      onClick={() => setActivePhone(null)}
                      title="Voltar para a lista de conversas"
                    >
                      <ArrowLeft size={16} />
                    </button>

                    <div className="wa-item-avatar" style={{ width: '34px', height: '34px' }}>
                      {String(activeConversation?.lead_name || activeLead?.business_name || activePhone).slice(0, 2).toUpperCase()}
                    </div>

                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>
                        {activeConversation?.lead_name || activeLead?.business_name || activePhone}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Phone size={10} /> {activePhone}
                        {activeLead?.city && <span> • {activeLead.city}</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {activeLead && onUpdateLeadStatus && (
                      <select
                        className="form-select"
                        style={{ height: '30px', padding: '0 8px', fontSize: '0.76rem' }}
                        value={activeLead.crm_status || 'new'}
                        onChange={(e) => onUpdateLeadStatus(activeLead.id, e.target.value)}
                      >
                        <option value="new">🆕 Novo Lead</option>
                        <option value="contacted">📞 Contatado</option>
                        <option value="in_conversation">💬 Em Conversa</option>
                        <option value="proposal_sent">📑 Proposta</option>
                        <option value="won">🏆 Fechado</option>
                        <option value="lost">❌ Perdido</option>
                      </select>
                    )}

                    {activeLead && onOpenLeadDetail && (
                      <button
                        className="btn-icon-subtle"
                        style={{ padding: '6px' }}
                        onClick={() => onOpenLeadDetail(activeLead)}
                        title="Ver ficha completa do lead"
                      >
                        <Info size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Área de Mensagens */}
                <div className="wa-messages-area">
                  {messagesLoading ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                      <RefreshCw size={20} className="pulse-spinner" style={{ marginBottom: '8px' }} />
                      <p>Carregando histórico...</p>
                    </div>
                  ) : messages.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                      <MessageCircle size={36} opacity={0.3} style={{ marginBottom: '10px' }} />
                      <h4 style={{ color: '#fff', fontSize: '1rem', marginBottom: '4px' }}>Inicie o contato com este Lead</h4>
                      <p style={{ fontSize: '0.82rem' }}>Escolha um modelo rápido abaixo para enviar a primeira mensagem.</p>
                    </div>
                  ) : (
                    messages.map((m, idx) => {
                      const isOutgoing = m.direction === 'outgoing';
                      return (
                        <div key={m.id || idx} className={`wa-message-row ${isOutgoing ? 'outgoing' : 'incoming'}`}>
                          <div className={`wa-message-bubble ${isOutgoing ? 'bubble-outgoing' : 'bubble-incoming'}`}>
                            <div>{m.content}</div>
                            <div className="wa-message-meta">
                              <span>{formatTime(m.created_at)}</span>
                              {isOutgoing && (
                                <CheckCheck size={12} color={m.status === 'read' ? '#38bdf8' : 'currentColor'} opacity={m.status === 'read' ? 1 : 0.6} />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Modelos Rápidos */}
                <div className="wa-quick-pitches">
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                    <Zap size={12} color="#f59e0b" /> Modelos:
                  </span>
                  <button className="quick-pitch-pill" onClick={() => applyPitchTemplate('intro')}>
                    👋 Apresentação
                  </button>
                  <button className="quick-pitch-pill" onClick={() => applyPitchTemplate('audit')}>
                    🌐 Diagnóstico Grátis
                  </button>
                  <button className="quick-pitch-pill" onClick={() => applyPitchTemplate('meeting')}>
                    📅 Agendar Reunião
                  </button>
                  <button className="quick-pitch-pill" onClick={() => applyPitchTemplate('proposal')}>
                    💼 Proposta Comercial
                  </button>
                </div>

                {/* Input Bar */}
                <form className="wa-chat-input-bar" onSubmit={handleSendMessage}>
                  <textarea
                    rows={1}
                    className="wa-chat-input"
                    placeholder="Digite sua mensagem... (Enter envia, Shift+Enter pula linha)"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  <button
                    type="submit"
                    className="btn-wa-send"
                    disabled={!inputText.trim() || sending}
                    title="Enviar Mensagem"
                  >
                    <Send size={16} />
                  </button>
                </form>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', padding: '40px', textAlign: 'center' }}>
                <MessageCircle size={48} opacity={0.2} style={{ marginBottom: '12px' }} />
                <h3 style={{ color: '#fff', fontSize: '1.15rem', marginBottom: '6px' }}>Central de Mensagens WhatsApp</h3>
                <p style={{ fontSize: '0.84rem', maxWidth: '360px' }}>
                  Selecione uma conversa na barra lateral ou clique em "+ Novo" para abordar uma empresa minerada.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Novo Chat */}
      {showNewChatModal && (
        <div className="modal-overlay" onClick={() => setShowNewChatModal(false)}>
          <div className="modal-content" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Iniciar Conversa com Lead</h3>
              <button className="btn-icon-subtle" onClick={() => setShowNewChatModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '16px' }}>
              <div className="search-input-wrapper" style={{ width: '100%', maxWidth: 'none', marginBottom: '12px' }}>
                <Search size={14} className="search-icon-inside" />
                <input
                  type="text"
                  className="search-filter-input"
                  placeholder="Pesquisar por empresa, telefone ou cidade..."
                  value={newChatSearch}
                  onChange={(e) => setNewChatSearch(e.target.value)}
                  autoFocus
                />
              </div>

              <div style={{ maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {eligibleLeadsForNewChat.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px', fontSize: '0.84rem' }}>
                    Nenhum lead com telefone encontrado.
                  </p>
                ) : (
                  eligibleLeadsForNewChat.map((l) => (
                    <div
                      key={l.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 12px',
                        background: 'var(--bg-app)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        const cleanPhone = l.phone.replace(/\D/g, '');
                        setActivePhone(cleanPhone);
                        fetchMessages(cleanPhone);
                        setShowNewChatModal(false);
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#fff' }}>{l.business_name}</div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                          {l.phone} {l.city ? `• ${l.city}` : ''} • {l.niche}
                        </div>
                      </div>
                      <ChevronRight size={16} color="var(--text-muted)" />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
