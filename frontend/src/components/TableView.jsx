import React from 'react';
import {
  Download,
  CheckSquare,
  Square,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Flame,
  Star,
  MessageCircle,
  Info
} from 'lucide-react';

export default function TableView({
  leads,
  totalCount,
  columns,
  sortField,
  sortDirection,
  onSort,
  selectedLeadIds,
  onToggleSelectLead,
  onToggleSelectAll,
  batchActionLoading,
  onBatchMoveStatus,
  onOpenBatchDeleteModal,
  onClearSelection,
  onOpenPitch,
  onOpenDetails,
  onDeleteLead,
  onUpdateStatus,
  onExportCSV
}) {
  return (
    <div className="table-container">
      <div className="table-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 700 }}>Tabela de Leads</span>
          <span className="badge-count">{leads.length}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Mostrando <strong>{leads.length}</strong> de <strong>{totalCount}</strong>
          </span>
          <button
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.78rem' }}
            onClick={onExportCSV}
          >
            <Download size={13} /> Exportar
          </button>
        </div>
      </div>

      {/* Barra de Ações em Lote (Quando há itens selecionados) */}
      {selectedLeadIds.size > 0 && (
        <div className="bulk-actions-bar">
          <div className="bulk-actions-left">
            <CheckSquare size={16} />
            <span>
              {selectedLeadIds.size} {selectedLeadIds.size === 1 ? 'lead selecionado' : 'leads selecionados'}
            </span>
          </div>

          <div className="bulk-actions-right">
            <select
              className="form-select"
              style={{ height: '30px', padding: '0 8px', fontSize: '0.78rem' }}
              onChange={(e) => {
                if (e.target.value) onBatchMoveStatus(e.target.value);
              }}
              defaultValue=""
              disabled={batchActionLoading}
            >
              <option value="" disabled>Mover Selecionados para...</option>
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  ➔ {c.label}
                </option>
              ))}
            </select>

            <button
              className="btn-danger"
              style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              onClick={onOpenBatchDeleteModal}
              disabled={batchActionLoading}
            >
              <Trash2 size={13} /> Excluir ({selectedLeadIds.size})
            </button>

            <button
              className="btn-secondary"
              style={{ padding: '6px 10px', fontSize: '0.78rem' }}
              onClick={onClearSelection}
            >
              Desmarcar
            </button>
          </div>
        </div>
      )}

      <div className="table-wrapper">
        <table className="leads-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>
                <button
                  style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
                  onClick={onToggleSelectAll}
                  title="Selecionar / Desmarcar todos os visíveis"
                >
                  {selectedLeadIds.size > 0 && selectedLeadIds.size >= leads.length ? (
                    <CheckSquare size={16} color="var(--accent-primary)" />
                  ) : (
                    <Square size={16} opacity={0.6} />
                  )}
                </button>
              </th>
              <th className="sortable" onClick={() => onSort('lead_score')}>
                Score
                <span className="sort-icon">
                  {sortField === 'lead_score' ? (
                    sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                  ) : (
                    <ArrowUpDown size={12} opacity={0.4} />
                  )}
                </span>
              </th>
              <th className="sortable" onClick={() => onSort('business_name')}>
                Empresa
                <span className="sort-icon">
                  {sortField === 'business_name' ? (
                    sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                  ) : (
                    <ArrowUpDown size={12} opacity={0.4} />
                  )}
                </span>
              </th>
              <th className="sortable" onClick={() => onSort('niche')}>
                Nicho / Cidade
                <span className="sort-icon">
                  {sortField === 'niche' ? (
                    sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                  ) : (
                    <ArrowUpDown size={12} opacity={0.4} />
                  )}
                </span>
              </th>
              <th>Situação do Site</th>
              <th className="sortable" onClick={() => onSort('rating')}>
                Avaliações
                <span className="sort-icon">
                  {sortField === 'rating' ? (
                    sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                  ) : (
                    <ArrowUpDown size={12} opacity={0.4} />
                  )}
                </span>
              </th>
              <th>Contato</th>
              <th>Status Funil</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const isSelected = selectedLeadIds.has(lead.id);

              return (
                <tr key={lead.id} className={isSelected ? 'selected' : ''}>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
                      onClick={() => onToggleSelectLead(lead.id)}
                    >
                      {isSelected ? (
                        <CheckSquare size={16} color="var(--accent-primary)" />
                      ) : (
                        <Square size={16} opacity={0.4} />
                      )}
                    </button>
                  </td>
                  <td>
                    <span className={`badge-score ${lead.score_tier}`}>
                      <Flame size={11} /> {lead.lead_score} pts
                    </span>
                  </td>
                  <td>
                    <div style={{ color: '#fff', fontWeight: 600 }}>{lead.business_name}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      {lead.source} {lead.notes ? '• 📝 Possui notas' : ''}
                    </div>
                  </td>
                  <td>
                    <div>{lead.niche}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{lead.city}</div>
                  </td>
                  <td>
                    <span className={`badge-site ${lead.website_status}`}>
                      {lead.website_status === 'none' && 'Sem Site'}
                      {lead.website_status === 'social_media' && 'Rede Social'}
                      {lead.website_status === 'insecure' && 'Inseguro'}
                      {lead.website_status === 'outdated' && 'Lento/Mobile'}
                      {lead.website_status === 'healthy' && 'Site Ativo'}
                    </span>
                  </td>
                  <td>
                    <div className="rating-stars">
                      <Star size={12} fill="#fbbf24" /> {lead.rating?.toFixed(1) || '0.0'}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      {lead.review_count} avaliações
                    </div>
                  </td>
                  <td>
                    <div>{lead.phone || 'Não informado'}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      {lead.phone_type === 'mobile' ? '📱 Celular/WA' : '☎️ Fixo'}
                    </div>
                  </td>
                  <td>
                    <select
                      className="form-select"
                      style={{ padding: '4px 8px', fontSize: '0.78rem', height: '30px' }}
                      value={lead.crm_status}
                      onChange={(e) => onUpdateStatus(lead.id, e.target.value)}
                    >
                      {columns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        className="btn-card-action"
                        style={{ color: '#34d399' }}
                        onClick={() => onOpenPitch(lead)}
                        title="Abordar no WhatsApp"
                      >
                        <MessageCircle size={14} />
                      </button>
                      <button
                        className="btn-card-action"
                        onClick={() => onOpenDetails(lead)}
                        title="Ver Detalhes e Notas"
                      >
                        <Info size={14} />
                      </button>
                      <button
                        className="btn-card-action danger"
                        onClick={(e) => onDeleteLead(lead, e)}
                        title="Excluir Lead"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {leads.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  Nenhum lead encontrado com os filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
