import React from 'react';
import { BarChart3, Flame, Globe, Trophy } from 'lucide-react';

export default function StatsRibbon({
  stats,
  totalLeads,
  filteredCount,
  activeFiltersCount,
  filterTier,
  filterSite,
  onResetFilters,
  onToggleHot,
  onToggleNoSite,
  onOpenWonLeads
}) {
  return (
    <div className="stats-ribbon">
      {/* Card: Total */}
      <div
        className={`stat-card ${filterTier === 'all' && filterSite === 'all' && activeFiltersCount === 0 ? 'active-filter' : ''}`}
        onClick={onResetFilters}
        title="Clique para ver todos os leads"
      >
        <div className="stat-icon total">
          <BarChart3 size={22} />
        </div>
        <div className="stat-info">
          <div className="stat-value">
            {activeFiltersCount > 0 ? filteredCount : stats ? stats.total : totalLeads}
          </div>
          <div className="stat-label">
            {activeFiltersCount > 0 ? 'Leads Filtrados' : 'Total de Leads'}
          </div>
        </div>
      </div>

      {/* Card: Leads Quentes */}
      <div
        className={`stat-card ${filterTier === 'hot' ? 'active-filter' : ''}`}
        onClick={onToggleHot}
        title="Clique para filtrar apenas leads quentes (85+ pts)"
      >
        <div className="stat-icon hot">
          <Flame size={22} />
        </div>
        <div className="stat-info">
          <div className="stat-value">{stats ? stats.hot : 0}</div>
          <div className="stat-label">Leads Quentes (85+ pts)</div>
        </div>
        {filterTier === 'hot' && <span className="stat-filter-indicator">Ativo</span>}
      </div>

      {/* Card: Sem Site */}
      <div
        className={`stat-card ${filterSite === 'none' ? 'active-filter' : ''}`}
        onClick={onToggleNoSite}
        title="Clique para filtrar apenas empresas sem site oficial"
      >
        <div className="stat-icon nosite">
          <Globe size={22} />
        </div>
        <div className="stat-info">
          <div className="stat-value">{stats ? stats.no_site : 0}</div>
          <div className="stat-label">Sem Site Cadastrado</div>
        </div>
        {filterSite === 'none' && <span className="stat-filter-indicator">Ativo</span>}
      </div>

      {/* Card: Fechados */}
      <div
        className="stat-card"
        onClick={onOpenWonLeads}
        title="Ver leads fechados no Funil Kanban"
      >
        <div className="stat-icon won">
          <Trophy size={22} />
        </div>
        <div className="stat-info">
          <div className="stat-value">{stats?.by_status?.won || 0}</div>
          <div className="stat-label">Contratos Fechados</div>
        </div>
      </div>
    </div>
  );
}
