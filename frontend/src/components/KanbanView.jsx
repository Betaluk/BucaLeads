import React from 'react';
import {
  Flame,
  Star,
  Phone,
  MessageCircle,
  Info,
  Trash2,
  Edit3
} from 'lucide-react';

export default function KanbanView({
  leads,
  columns,
  mobileCol,
  setMobileCol,
  draggedLeadId,
  dragOverColId,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onOpenPitch,
  onOpenDetails,
  onDeleteLead,
  onUpdateStatus
}) {
  return (
    <div>
      {/* Seletor Mobile de Colunas */}
      <div className="kanban-mobile-tabs">
        {columns.map((col) => {
          const count = leads.filter((l) => l.crm_status === col.id).length;
          return (
            <button
              key={col.id}
              className={`kanban-mobile-tab-btn ${mobileCol === col.id ? 'active' : ''}`}
              onClick={() => setMobileCol(col.id)}
            >
              <span style={{ color: col.color }}>●</span>
              {col.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="kanban-board">
        {columns.map((col) => {
          const colLeads = leads.filter((l) => l.crm_status === col.id);
          const isOver = dragOverColId === col.id;
          const isMobileActive = mobileCol === col.id;

          return (
            <div
              key={col.id}
              className={`kanban-column ${isOver ? 'drag-over' : ''} ${isMobileActive ? 'mobile-active' : ''}`}
              onDragOver={(e) => onDragOver(e, col.id)}
              onDragLeave={(e) => onDragLeave(e, col.id)}
              onDrop={(e) => onDrop(e, col.id)}
            >
              <div className="kanban-column-header">
                <div className="kanban-column-title">
                  <span style={{ color: col.color }}>●</span>
                  {col.label}
                </div>
                <span className="badge-count">{colLeads.length}</span>
              </div>

              <div className="kanban-cards-list">
                {colLeads.map((lead) => {
                  const isBeingDragged = draggedLeadId === lead.id;

                  return (
                    <div
                      key={lead.id}
                      className={`lead-card ${isBeingDragged ? 'is-dragging' : ''}`}
                      draggable="true"
                      onDragStart={(e) => onDragStart(e, lead.id)}
                      onDragEnd={onDragEnd}
                    >
                      <div className="lead-card-header">
                        <div className="lead-card-title">{lead.business_name}</div>
                        <span className={`badge-score ${lead.score_tier}`}>
                          <Flame size={11} /> {lead.lead_score} pts
                        </span>
                      </div>

                      <div className="badges-row">
                        <span className={`badge-site ${lead.website_status}`}>
                          {lead.website_status === 'none' && 'Sem Site'}
                          {lead.website_status === 'social_media' && 'Rede Social'}
                          {lead.website_status === 'insecure' && 'Sem HTTPS'}
                          {lead.website_status === 'outdated' && 'Lento/Mobile'}
                          {lead.website_status === 'healthy' && 'Site Ativo'}
                        </span>
                        <span className={`badge-source ${lead.source === 'google_places_api' ? 'api' : 'scraper'}`}>
                          {lead.source === 'google_places_api' ? 'API' : 'Scraper'}
                        </span>
                        {lead.notes && (
                          <span className="badge-notes" title={lead.notes}>
                            <Edit3 size={10} /> Notas
                          </span>
                        )}
                      </div>

                      <div className="lead-card-metrics">
                        <div className="rating-stars">
                          <Star size={12} fill="#fbbf24" /> {lead.rating?.toFixed(1) || '0.0'}
                        </div>
                        <div>({lead.review_count} avaliações)</div>
                        {lead.city && <div>• {lead.city}</div>}
                      </div>

                      {lead.phone && (
                        <div className="lead-card-phone">
                          <Phone size={11} /> {lead.phone}
                        </div>
                      )}

                      <div className="lead-card-actions">
                        <button
                          className="btn-pitch"
                          onClick={() => onOpenPitch(lead)}
                          title="Gerar Pitch e Abordar no WhatsApp"
                        >
                          <MessageCircle size={13} /> Abordar
                        </button>
                        <button
                          className="btn-card-action"
                          onClick={() => onOpenDetails(lead)}
                          title="Ver Ficha e Anotações"
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

                      {/* Seletor Rápido de Mudança de Etapa */}
                      <div className="lead-stage-selector">
                        <span className="stage-selector-label">Mover:</span>
                        <select
                          className="stage-selector-select"
                          value={lead.crm_status}
                          onChange={(e) => onUpdateStatus(lead.id, e.target.value)}
                          title="Mover de etapa no funil"
                        >
                          {columns.map((c) => (
                            <option key={c.id} value={c.id}>
                              ➔ {c.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}

                {colLeads.length === 0 && (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    Nenhum lead nesta coluna
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
