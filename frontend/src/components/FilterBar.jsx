import React from 'react';
import { Search as SearchIcon, Filter, X } from 'lucide-react';

export default function FilterBar({
  searchTerm,
  setSearchTerm,
  filterTier,
  setFilterTier,
  filterSite,
  setFilterSite,
  filterPhone,
  setFilterPhone,
  filterCity,
  setFilterCity,
  filterSource,
  setFilterSource,
  filterNotes,
  setFilterNotes,
  filterRating,
  setFilterRating,
  filterActivity,
  setFilterActivity,
  showExtraFilters,
  setShowExtraFilters,
  availableCities,
  activeFiltersCount,
  filteredCount,
  totalCount,
  onClearAll
}) {
  return (
    <div className="filter-panel">
      <div className="filter-panel-main">
        {/* Busca Textual */}
        <div className="search-input-wrapper">
          <SearchIcon size={14} className="search-icon-inside" />
          <input
            type="text"
            className="search-filter-input"
            placeholder="Buscar por empresa, nicho, cidade ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              className="search-clear-btn"
              onClick={() => setSearchTerm('')}
              title="Limpar busca"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filtros em Linha */}
        <div className="filter-group">
          {/* Lead Score Tier */}
          <select
            className="filter-select"
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
            title="Filtrar por faixa de pontuação"
          >
            <option value="all">Score: Todos</option>
            <option value="hot">🔥 Quentes (85+)</option>
            <option value="warm">⚡ Mornos (60-84)</option>
            <option value="cold">❄️ Frios (0-59)</option>
          </select>

          {/* Situação do Site */}
          <select
            className="filter-select"
            value={filterSite}
            onChange={(e) => setFilterSite(e.target.value)}
            title="Filtrar por status do site"
          >
            <option value="all">Site: Todos</option>
            <option value="none">🚫 Sem Site</option>
            <option value="social_media">📱 Só Redes Sociais</option>
            <option value="insecure">⚠️ Sem HTTPS</option>
            <option value="outdated">⏱️ Lento / Mobile Ruim</option>
            <option value="healthy">✅ Site Ativo e Rápido</option>
          </select>

          {/* Tipo de Telefone */}
          <select
            className="filter-select"
            value={filterPhone}
            onChange={(e) => setFilterPhone(e.target.value)}
            title="Filtrar por tipo de contato"
          >
            <option value="all">Telefone: Todos</option>
            <option value="mobile">📱 Celular / WhatsApp</option>
            <option value="landline">☎️ Telefone Fixo</option>
            <option value="none">Sem Telefone</option>
          </select>

          {/* Cidades Encontradas */}
          {availableCities.length > 1 && (
            <select
              className="filter-select"
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              title="Filtrar por cidade"
            >
              <option value="all">Cidades: Todas ({availableCities.length})</option>
              {availableCities.map((city) => (
                <option key={city} value={city}>
                  📍 {city}
                </option>
              ))}
            </select>
          )}

          {/* Botão para Expandir Mais Filtros */}
          <button
            className={`btn-filter-toggle ${showExtraFilters || activeFiltersCount > 0 ? 'has-active' : ''}`}
            onClick={() => setShowExtraFilters(!showExtraFilters)}
            title="Opções avançadas de filtragem"
          >
            <Filter size={13} />
            Mais Filtros
            {activeFiltersCount > 0 && <span className="filter-badge-counter">{activeFiltersCount}</span>}
          </button>

          {/* Botão Limpar Tudo */}
          {activeFiltersCount > 0 && (
            <button
              className="btn-filter-clear"
              onClick={onClearAll}
              title="Restaurar todos os filtros"
            >
              <X size={12} /> Limpar ({activeFiltersCount})
            </button>
          )}
        </div>
      </div>

      {/* Painel de Filtros Avançados Expansível */}
      {showExtraFilters && (
        <div className="filter-panel-extra">
          <div className="filter-extra-item">
            <label>Origem:</label>
            <select className="filter-select-sm" value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
              <option value="all">Todas as Origens</option>
              <option value="google_places_api">Google Places API</option>
              <option value="google_maps_scraper">Scraper Maps</option>
            </select>
          </div>

          <div className="filter-extra-item">
            <label>Anotações:</label>
            <select className="filter-select-sm" value={filterNotes} onChange={(e) => setFilterNotes(e.target.value)}>
              <option value="all">Todos</option>
              <option value="has_notes">📝 Com Anotações</option>
              <option value="no_notes">Sem Anotações</option>
            </select>
          </div>

          <div className="filter-extra-item">
            <label>Avaliação:</label>
            <select className="filter-select-sm" value={filterRating} onChange={(e) => setFilterRating(e.target.value)}>
              <option value="all">Todas as Notas</option>
              <option value="4.5">⭐ 4.5 ou mais</option>
              <option value="4.0">⭐ 4.0 ou mais</option>
              <option value="3.5">⭐ 3.5 ou mais</option>
            </select>
          </div>

          <div className="filter-extra-item">
            <label>Atividade Recente:</label>
            <select className="filter-select-sm" value={filterActivity} onChange={(e) => setFilterActivity(e.target.value)}>
              <option value="all">Todos os Perfis</option>
              <option value="active">🟢 Responde Clientes</option>
              <option value="inactive">Sem Resposta Recente</option>
            </select>
          </div>
        </div>
      )}

      {/* Barra de Status de Resultados */}
      <div className="filter-status-bar">
        <div>
          Exibindo <strong>{filteredCount}</strong> de <strong>{totalCount}</strong> leads
          {activeFiltersCount > 0 && (
            <span className="filter-applied-badge">
              {activeFiltersCount} {activeFiltersCount === 1 ? 'filtro ativo' : 'filtros ativos'}
            </span>
          )}
        </div>
        {filteredCount === 0 && totalCount > 0 && (
          <span style={{ color: '#f87171', fontWeight: 600 }}>
            Nenhum lead encontrado com a combinação atual de filtros.
          </span>
        )}
      </div>
    </div>
  );
}
