import React from 'react';
import { AlertTriangle, X, Trash2 } from 'lucide-react';

export default function DeleteModal({
  isOpen,
  type,
  title,
  deleteLeadsOption,
  onToggleDeleteLeadsOption,
  onClose,
  onConfirm
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f43f5e' }}>
            <AlertTriangle size={18} />
            {type === 'lead'
              ? 'Excluir Lead'
              : type === 'batch'
              ? 'Excluir Leads Selecionados'
              : 'Excluir Busca'}
          </h3>
          <button className="btn-icon-subtle" onClick={onClose} title="Fechar (Esc)">
            <X size={15} />
          </button>
        </div>

        <div className="modal-body" style={{ gap: '12px' }}>
          <p style={{ fontSize: '0.9rem', color: '#fff', lineHeight: 1.5 }}>
            Tem certeza que deseja excluir <strong>"{title}"</strong>?
          </p>

          {type === 'lead' ? (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Esta ação removerá este lead, histórico de auditoria e anotações permanentemente.
            </p>
          ) : type === 'batch' ? (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Todos os leads selecionados serão removidos permanentemente do banco de dados local.
            </p>
          ) : (
            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                O registro desta busca será removido do seu histórico de campanhas.
              </p>
              <label className="checkbox-label" style={{ marginTop: '8px' }}>
                <input
                  type="checkbox"
                  checked={deleteLeadsOption}
                  onChange={(e) => onToggleDeleteLeadsOption(e.target.checked)}
                />
                <span style={{ fontSize: '0.78rem' }}>
                  Remover também os leads desta busca que ainda estão em "Novos Leads" e sem notas
                </span>
              </label>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-danger" onClick={onConfirm}>
            <Trash2 size={14} /> Confirmar Exclusão
          </button>
        </div>
      </div>
    </div>
  );
}
