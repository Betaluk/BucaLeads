import React, { useState, useEffect } from 'react';
import {
  MessageCircle,
  X,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Sliders,
  AlertCircle,
  RotateCcw,
  Key
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const STYLES = [
  { id: 'direct', label: '🎯 Curto & Direto', description: 'Quebra-gelo objetivo, 2 a 3 frases' },
  { id: 'consultative', label: '🔍 Consultivo', description: 'Diagnóstico técnico da auditoria' },
  { id: 'authority', label: '🏆 Autoridade', description: 'Foco na reputação e avaliações' }
];

export default function PitchModal({
  pitchData,
  onClose,
  onCopyPitch,
  copiedPitch,
  onOpenWhatsApp
}) {
  if (!pitchData) return null;

  // Estado do Estilo Selecionado
  const [currentStyle, setCurrentStyle] = useState(pitchData.style || 'direct');
  const [editedText, setEditedText] = useState(pitchData.pitch_text || '');
  const [isAiGenerated, setIsAiGenerated] = useState(pitchData.is_ai_generated || false);
  const [aiError, setAiError] = useState(pitchData.ai_error || null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Configurações de IA (Chave e Instruções Customizadas salvas no localStorage)
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('bucaleads_gemini_key') || '');
  const [customInstructions, setCustomInstructions] = useState(() => localStorage.getItem('bucaleads_pitch_instructions') || '');
  const [keySavedNotification, setKeySavedNotification] = useState(false);

  // Sincronizar ao abrir lead diferente
  useEffect(() => {
    setCurrentStyle(pitchData.style || 'direct');
    setEditedText(pitchData.pitch_text || '');
    setIsAiGenerated(pitchData.is_ai_generated || false);
    setAiError(pitchData.ai_error || null);
  }, [pitchData]);

  // Troca de Estilos (Instantânea via cache local se disponível)
  const handleStyleChange = (styleId) => {
    setCurrentStyle(styleId);
    if (pitchData.styles_available && pitchData.styles_available[styleId]) {
      setEditedText(pitchData.styles_available[styleId]);
      setIsAiGenerated(false);
      setAiError(null);
    }
  };

  // Salvar Chave Gemini no localStorage
  const handleSaveGeminiKey = (keyVal) => {
    setGeminiKey(keyVal);
    localStorage.setItem('bucaleads_gemini_key', keyVal.trim());
    setKeySavedNotification(true);
    setTimeout(() => setKeySavedNotification(false), 2500);
  };

  // Salvar Instruções no localStorage
  const handleSaveInstructions = (val) => {
    setCustomInstructions(val);
    localStorage.setItem('bucaleads_pitch_instructions', val);
  };

  // Gerar com IA (Google Gemini)
  const handleGenerateAI = async () => {
    if (loadingAi) return;
    setLoadingAi(true);
    setAiError(null);

    try {
      const res = await fetch(`${API_BASE}/api/leads/${pitchData.lead_id}/pitch/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          style: currentStyle,
          custom_instructions: customInstructions.trim() || null,
          api_key: geminiKey.trim() || null
        })
      });

      if (res.ok) {
        const data = await res.json();
        setEditedText(data.pitch_text);
        setIsAiGenerated(data.is_ai_generated);
        setAiError(data.ai_error);
      } else {
        const err = await res.json().catch(() => ({}));
        setAiError(err.detail || 'Falha ao conectar com o serviço de IA.');
      }
    } catch (e) {
      setAiError('Erro de conexão ao gerar pitch com IA.');
    } finally {
      setLoadingAi(false);
    }
  };

  // Restaurar Texto Original do Template
  const handleResetToTemplate = () => {
    if (pitchData.styles_available && pitchData.styles_available[currentStyle]) {
      setEditedText(pitchData.styles_available[currentStyle]);
      setIsAiGenerated(false);
      setAiError(null);
    } else {
      setEditedText(pitchData.pitch_text);
    }
  };

  const displayName = pitchData.clean_business_name || pitchData.business_name;
  const rawCleanPhone = pitchData.phone ? String(pitchData.phone).replace(/\D/g, '') : '';
  const cleanPhone = rawCleanPhone.length in [10, 11] && !rawCleanPhone.startsWith('55')
    ? `55${rawCleanPhone}`
    : rawCleanPhone;
  const waExternalUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(editedText)}`
    : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content pitch-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho do Modal */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="pitch-header-icon">
              <MessageCircle size={20} color="#10b981" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#fff' }}>Pitch de Vendas Personalizado</h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Abordagem estratégica via WhatsApp & E-mail
              </span>
            </div>
          </div>
          <button className="btn-icon-subtle" onClick={onClose} title="Fechar (Esc)">
            <X size={16} />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="modal-body" style={{ gap: '14px' }}>
          {/* Identificação do Lead */}
          <div className="pitch-lead-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong style={{ color: '#fff', fontSize: '1rem' }}>{displayName}</strong>
                {pitchData.clean_business_name && pitchData.clean_business_name !== pitchData.business_name && (
                  <span className="badge-tag-clean" title={`Nome completo: ${pitchData.business_name}`}>
                    Higienizado
                  </span>
                )}
              </div>
              {pitchData.phone && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Telefone: <strong style={{ color: '#e2e8f0' }}>{pitchData.phone}</strong>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={`badge-site ${pitchData.scenario}`}>
                Diagnóstico: {pitchData.scenario}
              </span>
            </div>
          </div>

          {/* Abas de Estilo */}
          <div className="pitch-style-selector">
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Estilo da Abordagem:
            </span>
            <div className="pitch-style-tabs">
              {STYLES.map((st) => (
                <button
                  key={st.id}
                  className={`pitch-tab-btn ${currentStyle === st.id ? 'active' : ''}`}
                  onClick={() => handleStyleChange(st.id)}
                  title={st.description}
                  type="button"
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Barra de Ações de IA */}
          <div className="pitch-ai-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className={`btn-ai-generate ${loadingAi ? 'loading' : ''}`}
                onClick={handleGenerateAI}
                disabled={loadingAi}
                title="Gera uma mensagem natural e personalizada usando inteligência artificial"
              >
                {loadingAi ? <RefreshCw size={14} className="spin-icon" /> : <Sparkles size={14} />}
                {loadingAi ? 'Criando com IA...' : '✨ Gerar com IA'}
              </button>

              <button
                type="button"
                className={`btn-ai-config-toggle ${showAiSettings ? 'active' : ''}`}
                onClick={() => setShowAiSettings(!showAiSettings)}
                title="Configurações de IA (Chave API & Instruções)"
              >
                <Sliders size={14} /> Opções de IA
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {isAiGenerated ? (
                <span className="badge-ai-active">
                  <Sparkles size={12} /> Gerado com IA Gemini
                </span>
              ) : (
                <span className="badge-template-active">
                  Template Inteligente
                </span>
              )}
            </div>
          </div>

          {/* Painel Expansível de Configurações de IA */}
          {showAiSettings && (
            <div className="pitch-ai-config-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Key size={14} color="#a855f7" /> Configurações do Google Gemini AI
                </span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '0.75rem', color: '#a855f7', textDecoration: 'underline' }}
                >
                  Obter chave gratuita no Google AI Studio ↗
                </a>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="password"
                  className="input-field-subtle"
                  placeholder="Cole sua GEMINI_API_KEY aqui (ou configure no arquivo .env)"
                  value={geminiKey}
                  onChange={(e) => handleSaveGeminiKey(e.target.value)}
                  style={{ flex: 1, fontSize: '0.82rem' }}
                />
              </div>

              {keySavedNotification && (
                <div style={{ fontSize: '0.75rem', color: '#10b981', marginBottom: '8px' }}>
                  ✓ Chave salva no seu navegador!
                </div>
              )}

              <div>
                <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Instruções extras para a IA (Opcional - ex: "Meu nome é Lucas, focar em agendamento online"):
                </label>
                <input
                  type="text"
                  className="input-field-subtle"
                  placeholder="Ex: Focar em landing page rápida para mobile e destacar o nome Lucas"
                  value={customInstructions}
                  onChange={(e) => handleSaveInstructions(e.target.value)}
                  style={{ width: '100%', fontSize: '0.82rem' }}
                />
              </div>
            </div>
          )}

          {/* Alerta de fallback ou erro da IA */}
          {aiError && (
            <div className="pitch-ai-warning">
              <AlertCircle size={14} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.78rem', color: '#fcd34d' }}>
                {aiError}
              </div>
            </div>
          )}

          {/* Área de Edição do Pitch */}
          <div className="pitch-editor-wrapper">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Mensagem pronta (você pode editar antes de enviar):
              </span>
              <button
                type="button"
                className="btn-text-subtle"
                onClick={handleResetToTemplate}
                title="Restaurar texto do template original"
              >
                <RotateCcw size={12} /> Restaurar original
              </button>
            </div>

            <textarea
              className="pitch-textarea"
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              rows={8}
              placeholder="Carregando pitch de vendas..."
            />

            <div className="pitch-textarea-footer">
              <span>{editedText.length} caracteres • {editedText.split(/\s+/).filter(Boolean).length} palavras</span>
              <span>Dica: Use <b>*negrito*</b> e <i>_itálico_</i> para destacar termos no WhatsApp</span>
            </div>
          </div>
        </div>

        {/* Rodapé de Ações */}
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onCopyPitch(editedText)}
              title="Copiar texto para área de transferência"
            >
              {copiedPitch ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              {copiedPitch ? 'Copiado!' : 'Copiar Texto'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {pitchData.phone && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => onOpenWhatsApp(pitchData.phone, editedText)}
                style={{ background: '#059669', borderColor: '#059669' }}
                title="Abre o WhatsApp integrado já com este texto preenchido"
              >
                <MessageCircle size={15} /> Abrir no WhatsApp
              </button>
            )}

            {waExternalUrl && (
              <a
                href={waExternalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
                style={{ textDecoration: 'none' }}
                title="Abrir no WhatsApp Web externo em nova aba"
              >
                <ExternalLink size={14} /> Web
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
