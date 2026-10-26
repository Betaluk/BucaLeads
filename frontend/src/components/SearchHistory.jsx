import React from 'react';
import {
  Clock,
  Search as SearchIcon,
  Calendar,
  Trash2,
  Columns,
  ListFilter,
  RotateCcw
} from 'lucide-react';

export default function SearchHistory({
  history,
  onOpenInKanban,
  onOpenInTable,
  onRerun,
  onDeleteSearch,
  onNewSearch
}) {
  return (
    <div className="history-container">
      <div className="history-header">
        <div>
          <h2>
            <Clock size={20} color="var(--accent-primary)" /> Histórico de Buscas & Campanhas
          </h2>
          <p>Gerencie os lotes minerados, filtre o CRM por campanha ou repita buscas antigas.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Total: <strong>{history.length}</strong> campanhas salvas
          </span>
          <button className="btn-secondary" onClick={onNewSearch}>
            <SearchIcon size={14} /> Nova Busca
          </button>
        </div>
      </div>

      <div className="history-grid">
        {history.map((item) => (
          <div key={item.id} className="history-card">
            <div className="history-card-header">
              <div>
                <div className="history-query-title">{item.niche}</div>
                <div style={{ fontSize: '0.82rem', color: '#38bdf8' }}>📍 {item.location}</div>
                <div className="history-date">
                  <Calendar size={11} />
                  {new Date(item.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
              <button
                className="btn-danger-subtle"
                onClick={(e) => onDeleteSearch(item, e)}
                title="Excluir campanha"
              >
                <Trash2 size={14} />
              </button>
            </div>

            <div className="history-metrics-row">
              <div className="history-metric-box">
                <div className="history-metric-value">{item.lead_count ?? item.total_found}</div>
                <div className="history-metric-label">No CRM</div>
              </div>
              <div className="history-metric-box">
                <div className="history-metric-value" style={{ color: '#34d399' }}>
                  {item.new_leads || item.total_found || 0}
                </div>
                <div className="history-metric-label">Novos</div>
              </div>
              <div className="history-metric-box">
                <div className="history-metric-value" style={{ color: '#a78bfa' }}>
                  {item.existing_leads || 0}
                </div>
                <div className="history-metric-label">Na Base</div>
              </div>
            </div>

            <div className="history-actions">
              <button
                className="btn-history-action"
                onClick={() => onOpenInKanban(item.id)}
                title="Abrir no Funil Kanban"
              >
                <Columns size={13} /> Funil
              </button>
              <button
                className="btn-history-action"
                onClick={() => onOpenInTable(item.id)}
                title="Abrir na Tabela"
              >
                <ListFilter size={13} /> Tabela
              </button>
              <button
                className="btn-history-action"
                onClick={() => onRerun(item)}
                title="Refazer esta busca"
              >
                <RotateCcw size={13} /> Refazer
              </button>
            </div>
          </div>
        ))}

        {history.length === 0 && (
          <div
            style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: '48px',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)'
            }}
          >
            <Clock size={36} opacity={0.3} style={{ marginBottom: '10px' }} />
            <h3>Nenhum histórico de busca encontrado</h3>
            <p style={{ marginTop: '4px', fontSize: '0.86rem' }}>
              Faça sua primeira busca para minerar e organizar leads no funil.
            </p>
            <button
              className="btn-primary"
              style={{ marginTop: '16px' }}
              onClick={onNewSearch}
            >
              <SearchIcon size={15} /> Fazer Primeira Busca
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
