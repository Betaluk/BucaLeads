import React from 'react';
import {
  X,
  ExternalLink,
  Save,
  Trash2,
  MessageCircle,
  RefreshCw
} from 'lucide-react';

export default function LeadDetailModal({
  lead,
  columns,
  notes,
  setNotes,
  savingNotes,
  onSaveNotes,
  onUpdateStatus,
  onClose,
  onOpenPitch,
  onDeleteLead,
  onReauditLead,
  reauditing
}) {
  if (!lead) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3>Ficha do Lead</h3>
            {/* Seletor Rápido de Etapa no Cabeçalho */}
            <select
              className="form-select"
              style={{ height: '30px', padding: '0 8px', fontSize: '0.78rem' }}
              value={lead.crm_status}
              onChange={(e) => onUpdateStatus(lead.id, e.target.value)}
              title="Mudar status do funil"
            >
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <button className="btn-icon-subtle" onClick={onClose} title="Fechar (Esc)">
            <X size={15} />
          </button>
        </div>

        <div className="modal-body">
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', color: '#fff' }}>
              {lead.business_name}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>
              {lead.niche} • {lead.address || lead.city}
            </p>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Cadastrado em:{' '}
              {new Date(lead.created_at).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>

          {/* Grid Métricas Rápidas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Lead Score Total</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fb7185', fontFamily: 'var(--font-heading)' }}>
                {lead.lead_score} / 100 pts
              </div>
            </div>

            <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Status do Site</span>
                {lead.website && (
                  <button
                    className="btn-icon-subtle"
                    style={{ padding: '2px 6px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px', height: '22px' }}
                    onClick={() => onReauditLead && onReauditLead(lead.id)}
                    disabled={reauditing}
                    title="Reauditar site e recalcular pontuação"
                  >
                    <RefreshCw size={11} className={reauditing ? 'pulse-spinner' : ''} />
                    {reauditing ? 'Auditando...' : 'Reauditar'}
                  </button>
                )}
              </div>
              <div style={{ fontSize: '0.90rem', fontWeight: 700, marginTop: '4px' }}>
                {lead.website_status === 'none' && <span style={{ color: '#94a3b8' }}>🚫 Sem Site</span>}
                {lead.website_status === 'social_media' && <span style={{ color: '#a855f7' }}>📱 Só Rede Social</span>}
                {lead.website_status === 'insecure' && <span style={{ color: '#f43f5e' }}>⚠️ Inseguro / Sem HTTPS</span>}
                {lead.website_status === 'outdated' && <span style={{ color: '#f59e0b' }}>⏱️ Lento / Mobile Ruim</span>}
                {lead.website_status === 'healthy' && <span style={{ color: '#10b981' }}>✅ Site Ativo e Seguro</span>}
              </div>
            </div>
          </div>

          {lead.website && (
            <div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Website Cadastrado:</div>
              <a
                href={lead.website}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#38bdf8', wordBreak: 'break-all', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.86rem' }}
              >
                {lead.website} <ExternalLink size={13} />
              </a>
            </div>
          )}

          {/* Mini-CRM: Anotações */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>
                📝 Anotações Comerciais:
              </label>
              <button
                className="btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                onClick={onSaveNotes}
                disabled={savingNotes}
              >
                <Save size={12} /> {savingNotes ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
            <textarea
              className="form-input"
              style={{ width: '100%', minHeight: '75px', resize: 'vertical', fontSize: '0.84rem' }}
              placeholder="Ex: Falei com o Dr. Carlos. Solicitou orçamento de redesign e contato na próxima terça..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  onSaveNotes();
                }
              }}
            />
          </div>

          {/* Breakdown do Score */}
          {lead.score_breakdown && (
            <div>
              <h4 style={{ fontSize: '0.84rem', marginBottom: '6px', color: '#fff' }}>
                Composição do Score (Por que essa pontuação?):
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {Object.entries(lead.score_breakdown).map(([key, val]) => (
                  <div
                    key={key}
                    style={{
                      background: 'var(--bg-app)',
                      padding: '7px 10px',
                      borderRadius: 'var(--radius-xs)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.8rem'
                    }}
                  >
                    <span style={{ color: 'var(--text-secondary)' }}>{val.reason}</span>
                    <strong style={{ color: '#38bdf8' }}>+{val.points} pts</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button
            className="btn-danger-subtle"
            onClick={() => onDeleteLead(lead)}
          >
            <Trash2 size={14} /> Excluir Lead
          </button>

          <button
            className="btn-primary"
            onClick={() => onOpenPitch(lead)}
          >
            <MessageCircle size={15} /> Gerar Pitch WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
