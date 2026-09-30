import React, { useState, useEffect, useRef } from 'react';
import {
  MessageCircle,
  Send,
  Phone,
  QrCode,
  RefreshCw,
  LogOut,
  User,
  Clock,
  Check,
  CheckCheck,
  Building2,
  Sparkles,
  ExternalLink,
  Search,
  Filter,
  AlertCircle,
  ChevronRight,
  Smile,
  Zap,
  Info,
  ShieldCheck
} from 'lucide-react';


const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const WS_URL = API_BASE.replace(/^http/, 'ws');

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
  const [statusMessage, setStatusMessage] = useState('');
  const [connectingAction, setConnectingAction] = useState(false);

  // Conversas e Mensagens
  const [conversations, setConversations] = useState([]);
  const [activePhone, setActivePhone] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Dropdown Nova Conversa
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

  // 1. Checar status da conexão e carregar conversas
  const checkStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/status`);
      if (res.ok) {
        const data = await res.json();
        setWaStatus(data.status);
        setQrCodeUrl(data.qrCode);
        setConnectedUser(data.user);
        setStatusMessage(data.message || '');
      } else {
        setWaStatus('offline');
      }
    } catch (e) {
      setWaStatus('offline');
    }
  };

  const fetchConversations = async () => {
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
  };

  const fetchMessages = async (phone) => {
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
  };

  // Inicialização e Polling
  useEffect(() => {
    checkStatus();
    fetchConversations();

    // Polling a cada 3s caso esteja conectando ou exibindo QR Code
    pollIntervalRef.current = setInterval(() => {
      checkStatus();
    }, 3000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Selecionar contato inicial se informado pelo Kanban/Tabela
  useEffect(() => {
    if (initialContactPhone) {
      const clean = initialContactPhone.replace(/\D/g, '');
      setActivePhone(clean);
      fetchMessages(clean);
      if (onClearInitialContact) onClearInitialContact();
    }
  }, [initialContactPhone]);

  // WebSocket para sincronização em tempo real sem reload
  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;

    const connectWs = () => {
      try {
        ws = new WebSocket(`${WS_URL}/api/whatsapp/ws`);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('[WS] Conectado ao canal em tempo real do WhatsApp');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'new_message') {
              const msg = data.message;
              // Se a mensagem for da conversa aberta, adiciona na lista
              setActivePhone((currPhone) => {
                if (currPhone && (msg.phone.endsWith(currPhone.slice(-8)) || currPhone.endsWith(msg.phone.slice(-8)))) {
                  setMessages((prev) => {
                    if (prev.some((m) => m.id === msg.id)) return prev;
                    return [...prev, msg];
                  });
                  // Marcar como lida se a janela está aberta
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
            console.error('[WS] Erro processando mensagem:', err);
          }
        };

        ws.onclose = () => {
          reconnectTimeout = setTimeout(connectWs, 3000);
        };
      } catch (err) {
        reconnectTimeout = setTimeout(connectWs, 3000);
      }
    };

    connectWs();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // Ações de Conexão WhatsApp
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
        setInputText(textToSend); // Recupera texto se falhou
      }
    } catch (err) {
      console.error('Erro enviando mensagem:', err);
      alert('Erro de conexão ao despachar a mensagem.');
      setInputText(textToSend);
    } finally {
      setSending(false);
    }
  };

  // Atalho Enter para enviar
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Inserir Template Rápido
  const applyPitchTemplate = (templateType) => {
    const leadName = activeConversation?.lead_name || 'Amigo(a)';
    let templateText = '';

    if (templateType === 'intro') {
      templateText = `Olá, tudo bem? Me chamo Lucas e acompanho o mercado da sua região. Estava pesquisando sobre ${activeConversation?.lead_niche || 'empresas do seu segmento'} e encontrei o perfil da ${leadName}. Reparei em algumas oportunidades excelentes no posicionamento digital de vocês para atrair mais clientes. Podemos bater um papo rápido?`;
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

  // Encontrar lead ativo
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

  // Filtro de conversas
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

  // Leads disponíveis para iniciar nova conversa
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


  // Formatação de data/hora
  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatDateLabel = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      const today = new Date();
      if (d.toDateString() === today.toDateString()) return 'Hoje';
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
      return d.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="whatsapp-container">
      {/* Barra de Status Superior do WhatsApp */}
      <div className="whatsapp-status-bar">
        <div className="wa-status-left">
          <div className={`wa-status-dot ${waStatus}`} />
          <span className="wa-status-label">
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
          </span>
        </div>

        <div className="wa-status-actions">
          {waStatus === 'connected' ? (
            <button className="btn-wa-logout" onClick={handleDisconnect} title="Desconectar Sessão">
              <LogOut size={15} /> Desconectar
            </button>
          ) : (
            <button
              className="btn-wa-connect"
              onClick={handleConnect}
              disabled={connectingAction}
            >
              <RefreshCw size={15} className={connectingAction ? 'spin' : ''} />
              {waStatus === 'qr_ready' ? 'Atualizar QR Code' : 'Conectar WhatsApp'}
            </button>
          )}
        </div>
      </div>

      {/* TELA 1: Se o WhatsApp estiver Desconectado / Exibindo QR Code */}
      {waStatus !== 'connected' ? (
        <div className="wa-connection-card">
          <div className="wa-qr-box">
            {waStatus === 'qr_ready' && qrCodeUrl ? (
              <div className="wa-qr-inner">
                <img src={qrCodeUrl} alt="QR Code WhatsApp" className="wa-qr-image" />
                <div className="wa-qr-overlay-info">
                  <Sparkles size={16} color="#10b981" /> Aproxime a câmera do seu WhatsApp
                </div>
              </div>
            ) : waStatus === 'connecting' ? (
              <div className="wa-loading-qr">
                <RefreshCw size={36} className="spin text-emerald-400" />
                <p>Gerando chave criptográfica e QR Code...</p>
              </div>
            ) : (
              <div className="wa-loading-qr">
                <QrCode size={56} opacity={0.3} />
                <p>Clique abaixo para gerar o QR Code de autenticação</p>
                <button className="btn-primary" onClick={handleConnect} disabled={connectingAction}>
                  <RefreshCw size={16} className={connectingAction ? 'spin' : ''} /> Iniciar Conexão
                </button>
              </div>
            )}
          </div>

          <div className="wa-instructions">
            <h3>Conectar ao WhatsApp</h3>
            <p className="wa-subtitle">
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

            <div className="wa-security-note">
              <ShieldCheck size={18} color="#10b981" />
              <span>Conexão direta e segura via protocolo Multi-Device oficial do WhatsApp. Suas conversas ficam salvas na sua nuvem Cloudflare D1.</span>
            </div>
          </div>
        </div>
      ) : (
        /* TELA 2: Interface de Mensagens / CRM Chat (Dois Painéis) */
        <div className="wa-messenger-layout">
          {/* Painel Esquerdo: Lista de Conversas */}
          <div className="wa-sidebar">
            <div className="wa-sidebar-header">
              <div className="wa-search-box">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Buscar conversa ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button
                className="btn-new-chat"
                onClick={() => setShowNewChatModal(true)}
                title="Iniciar Nova Conversa com um Lead"
              >
                + Novo Chat
              </button>
            </div>

            <div className="wa-conversations-list">
              {filteredConversations.length === 0 ? (
                <div className="wa-empty-conversations">
                  <MessageCircle size={36} opacity={0.3} />
                  <p>Nenhuma conversa ativa ainda.</p>
                  <button className="btn-secondary btn-sm" onClick={() => setShowNewChatModal(true)}>
                    Iniciar Primeiro Contato
                  </button>
                </div>
              ) : (
                filteredConversations.map((c) => {
                  const isSelected =
                    activePhone &&
                    (c.phone === activePhone || c.phone.endsWith(activePhone.slice(-8)));

                  return (
                    <div
                      key={c.phone}
                      className={`wa-conversation-item ${isSelected ? 'active' : ''} ${c.unread_count > 0 ? 'has-unread' : ''}`}
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
                          <span className="wa-item-name" title={c.lead_name || c.phone}>
                            {c.lead_name || c.phone}
                          </span>
                          <span className="wa-item-time">
                            {formatDateLabel(c.last_message_at)}
                          </span>
                        </div>

                        <div className="wa-item-bottom">
                          <p className="wa-item-last-msg" title={c.last_message || 'Sem mensagens'}>
                            {c.last_message_direction === 'outgoing' && (
                              <span className="outgoing-tick">✓✓ </span>
                            )}
                            {c.last_message || 'Nenhuma mensagem recente'}
                          </p>
                          {c.unread_count > 0 && (
                            <span className="wa-unread-badge">{c.unread_count}</span>
                          )}
                        </div>

                        {c.lead_crm_status && (
                          <div className="wa-item-crm-tag">
                            <span className={`crm-pill crm-pill-${c.lead_crm_status}`}>
                              {c.lead_crm_status === 'new' && 'Novo Lead'}
                              {c.lead_crm_status === 'contacted' && 'Contatado'}
                              {c.lead_crm_status === 'in_conversation' && 'Em Conversa'}
                              {c.lead_crm_status === 'proposal_sent' && 'Proposta'}
                              {c.lead_crm_status === 'won' && 'Fechado'}
                              {c.lead_crm_status === 'lost' && 'Perdido'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Painel Direito: Janela de Chat Ativa */}
          <div className="wa-chat-window">
            {activePhone ? (
              <>
                {/* Cabeçalho do Chat */}
                <div className="wa-chat-header">
                  <div className="wa-header-contact">
                    <div className="wa-chat-avatar">
                      {String(activeConversation?.lead_name || activePhone || 'WA').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="wa-chat-title">
                        {activeConversation?.lead_name || activeLead?.business_name || activePhone}
                      </h4>
                      <div className="wa-chat-subtitle">
                        <Phone size={12} /> {activePhone}
                        {activeLead?.city && <span> • {activeLead.city}</span>}
                        {activeLead?.niche && <span> • {activeLead.niche}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="wa-header-actions">
                    {/* Seletor Rápido de Status CRM */}
                    {activeLead && onUpdateLeadStatus && (
                      <select
                        className="lead-stage-selector"
                        value={activeLead.crm_status || 'new'}
                        onChange={(e) => onUpdateLeadStatus(activeLead.id, e.target.value)}
                        style={{ height: '32px', fontSize: '0.8rem' }}
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
                        className="btn-secondary btn-sm"
                        onClick={() => onOpenLeadDetail(activeLead)}
                        title="Ver ficha completa do Lead"
                      >
                        <Info size={14} /> Ficha do Lead
                      </button>
                    )}
                  </div>
                </div>

                {/* Área de Mensagens */}
                <div className="wa-messages-area">
                  {messagesLoading ? (
                    <div className="wa-messages-loading">
                      <RefreshCw size={24} className="spin" />
                      <span>Carregando histórico...</span>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="wa-messages-empty">
                      <MessageCircle size={44} opacity={0.3} />
                      <h4>Inicie o contato com este Lead</h4>
                      <p>Escolha um dos modelos rápidos abaixo para enviar a primeira abordagem pelo WhatsApp.</p>
                    </div>
                  ) : (
                    messages.map((m, idx) => {
                      const isOutgoing = m.direction === 'outgoing';
                      return (
                        <div
                          key={m.id || idx}
                          className={`wa-message-row ${isOutgoing ? 'outgoing' : 'incoming'}`}
                        >
                          <div className={`wa-message-bubble ${isOutgoing ? 'bubble-outgoing' : 'bubble-incoming'}`}>
                            <div className="wa-message-content">{m.content}</div>
                            <div className="wa-message-meta">
                              <span className="wa-message-time">{formatTime(m.created_at)}</span>
                              {isOutgoing && (
                                <span className="wa-message-status">
                                  {m.status === 'read' ? (
                                    <CheckCheck size={14} color="#38bdf8" />
                                  ) : (
                                    <CheckCheck size={14} opacity={0.6} />
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Templates Rápidos de Abordagem */}
                <div className="wa-quick-pitches">
                  <span className="quick-pitch-label">
                    <Zap size={13} color="#f59e0b" /> Modelos Rápidos:
                  </span>
                  <button
                    className="quick-pitch-pill"
                    onClick={() => applyPitchTemplate('intro')}
                    title="Apresentação inicial para o lead"
                  >
                    👋 Apresentação
                  </button>
                  <button
                    className="quick-pitch-pill"
                    onClick={() => applyPitchTemplate('audit')}
                    title="Oferecer diagnóstico do site"
                  >
                    🌐 Diagnóstico Grátis
                  </button>
                  <button
                    className="quick-pitch-pill"
                    onClick={() => applyPitchTemplate('meeting')}
                    title="Propor reunião de 10 minutos"
                  >
                    📅 Agendar Reunião
                  </button>
                  <button
                    className="quick-pitch-pill"
                    onClick={() => applyPitchTemplate('proposal')}
                    title="Enviar proposta comercial"
                  >
                    💼 Proposta Comercial
                  </button>
                </div>

                {/* Barra de Entrada de Texto */}
                <form className="wa-chat-input-bar" onSubmit={handleSendMessage}>
                  <textarea
                    rows={1}
                    className="wa-chat-input"
                    placeholder="Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)"
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
                    <Send size={18} />
                  </button>
                </form>
              </>
            ) : (
              <div className="wa-chat-placeholder">
                <MessageCircle size={64} opacity={0.2} />
                <h3>Central de Conversas WhatsApp</h3>
                <p>Selecione um contato na barra lateral ou clique no botão "+ Novo Chat" para iniciar uma abordagem comercial.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Nova Conversa com Lead do CRM */}
      {showNewChatModal && (
        <div className="modal-backdrop" onClick={() => setShowNewChatModal(false)}>
          <div className="modal-card new-chat-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Iniciar Conversa com Lead do CRM</h3>
              <button className="modal-close" onClick={() => setShowNewChatModal(false)}>
                &times;
              </button>
            </div>

            <div className="modal-body">
              <div className="search-input-wrapper" style={{ marginBottom: '14px' }}>
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Pesquisar por nome da empresa, cidade ou telefone..."
                  value={newChatSearch}
                  onChange={(e) => setNewChatSearch(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="new-chat-leads-list">
                {eligibleLeadsForNewChat.length === 0 ? (
                  <p style={{ textAlign: 'center', opacity: 0.6, padding: '20px' }}>
                    Nenhum lead com telefone encontrado para este filtro.
                  </p>
                ) : (
                  eligibleLeadsForNewChat.map((l) => (
                    <div
                      key={l.id}
                      className="new-chat-lead-item"
                      onClick={() => {
                        const cleanPhone = l.phone.replace(/\D/g, '');
                        setActivePhone(cleanPhone);
                        fetchMessages(cleanPhone);
                        setShowNewChatModal(false);
                      }}
                    >
                      <div className="lead-item-details">
                        <strong>{l.business_name}</strong>
                        <span>
                          {l.phone} {l.city ? `• ${l.city}` : ''} • {l.niche}
                        </span>
                      </div>
                      <ChevronRight size={18} opacity={0.6} />
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
