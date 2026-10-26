import React from 'react';
import { MessageCircle, X, Copy, Check, ExternalLink } from 'lucide-react';

export default function PitchModal({
  pitchData,
  onClose,
  onCopyPitch,
  copiedPitch,
  onOpenWhatsApp
}) {
  if (!pitchData) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageCircle size={18} color="#10b981" /> Pitch de Vendas Personalizado
          </h3>
          <button className="btn-icon-subtle" onClick={onClose} title="Fechar (Esc)">
            <X size={15} />
          </button>
        </div>

        <div className="modal-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{pitchData.business_name}</strong>
            <span className="badge-site social">Cenário: {pitchData.scenario}</span>
          </div>

          <div className="pitch-textbox">{pitchData.pitch_text}</div>

          {pitchData.phone && (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Telefone identificado: <strong style={{ color: '#fff' }}>{pitchData.phone}</strong>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => onCopyPitch(pitchData.pitch_text)}>
            {copiedPitch ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
            {copiedPitch ? 'Copiado!' : 'Copiar Texto'}
          </button>

          {pitchData.phone && (
            <button
              className="btn-primary"
              onClick={() => onOpenWhatsApp(pitchData.phone)}
            >
              <MessageCircle size={15} /> Abrir no WhatsApp
            </button>
          )}

          {pitchData.whatsapp_url && (
            <a
              href={pitchData.whatsapp_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
              style={{ textDecoration: 'none' }}
              title="Abrir no WhatsApp Web externo"
            >
              <ExternalLink size={14} /> Web
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
