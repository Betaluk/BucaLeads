import React, { useState, useEffect } from 'react';
import {
  Search as SearchIcon,
  Flame,
  Globe,
  Phone,
  Star,
  Download,
  ExternalLink,
  MessageCircle,
  Copy,
  Check,
  Building2,
  Trophy,
  Filter,
  BarChart3,
  Columns,
  ListFilter,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Info,
  Clock,
  Trash2,
  Edit3
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const KANBAN_COLUMNS = [
  { id: 'new', label: 'Novos Leads', color: '#3b82f6' },
  { id: 'contacted', label: 'Contatados', color: '#8b5cf6' },
  { id: 'in_conversation', label: 'Em Conversa', color: '#f59e0b' },
  { id: 'proposal_sent', label: 'Proposta Enviada', color: '#06b6d4' },
  { id: 'won', label: 'Fechados / Ganhos', color: '#10b981' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('kanban'); // 'kanban', 'table', 'search'
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // Formulário de busca
  const [niche, setNiche] = useState('Clínica Odontológica');
  const [location, setLocation] = useState('Curitiba, PR');
  const [limit, setLimit] = useState(15);
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [deepAudit, setDeepAudit] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Filtros de Tabela
  const [filterTier, setFilterTier] = useState('all');
  const [filterSite, setFilterSite] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modais
  const [selectedLead, setSelectedLead] = useState(null);
  const [pitchData, setPitchData] = useState(null);
  const [pitchLoading, setPitchLoading] = useState(false);
  const [copiedPitch, setCopiedPitch] = useState(false);

  // Carregar dados iniciais
  useEffect(() => {
    fetchLeads();
    fetchStats();
  }, []);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/leads`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data);
      }
    } catch (err) {
      console.error('Erro ao buscar leads:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/leads/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Erro ao buscar stats:', err);
    }
  };

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!niche || !location) return;

    try {
      setSearchLoading(true);
      const payload = {
        niche,
        location,
        limit: Number(limit),
        google_api_key: googleApiKey.trim() || null,
        deep_audit: deepAudit
      };

      const res = await fetch(`${API_BASE}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        await fetchLeads();
        await fetchStats();
        setActiveTab('kanban');
      } else {
        alert('Erro ao realizar a busca no Google. Verifique os logs.');
      }
    } catch (err) {
      console.error('Erro na requisição de busca:', err);
      alert('Falha na comunicação com o backend local.');
    } finally {
      setSearchLoading(false);
    }
  };

  const updateLeadStatus = async (leadId, newStatus) => {
    try {
      const res = await fetch(`${API_BASE}/api/leads/${leadId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crm_status: newStatus })
      });
      if (res.ok) {
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, crm_status: newStatus } : l))
        );
        fetchStats();
      }
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
    }
  };

  const deleteLead = async (leadId) => {
    if (!confirm('Deseja realmente remover este lead?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/leads/${leadId}`, { method: 'DELETE' });
      if (res.ok) {
        setLeads((prev) => prev.filter((l) => l.id !== leadId));
        if (selectedLead?.id === leadId) setSelectedLead(null);
        fetchStats();
      }
    } catch (err) {
      console.error('Erro ao deletar lead:', err);
    }
  };

  const openPitchModal = async (lead) => {
    setSelectedLead(lead);
    setPitchLoading(true);
    setCopiedPitch(false);
    try {
      const res = await fetch(`${API_BASE}/api/leads/${lead.id}/pitch`);
      if (res.ok) {
        const data = await res.json();
        setPitchData(data);
      }
    } catch (err) {
      console.error('Erro ao gerar pitch:', err);
    } finally {
      setPitchLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedPitch(true);
    setTimeout(() => setCopiedPitch(false), 2500);
  };

  const exportCSV = () => {
    window.open(`${API_BASE}/api/export/csv`, '_blank');
  };

  // Filtragem de Leads
  const filteredLeads = leads.filter((l) => {
    const matchesSearch =
      l.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.niche.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.city && l.city.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesTier = filterTier === 'all' || l.score_tier === filterTier;
    const matchesSite = filterSite === 'all' || l.website_status === filterSite;

    return matchesSearch && matchesTier && matchesSite;
  });

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="logo-area">
          <div className="logo-icon">
            <Building2 size={24} />
          </div>
          <div className="logo-text">
            <h1>BucaLeads</h1>
            <span>Smart Google Prospector</span>
          </div>
        </div>

        {/* Navegação */}
        <div className="nav-tabs">
          <button
            id="tab-kanban"
            className={`nav-tab-btn ${activeTab === 'kanban' ? 'active' : ''}`}
            onClick={() => setActiveTab('kanban')}
          >
            <Columns size={16} /> Funil Kanban
          </button>
          <button
            id="tab-table"
            className={`nav-tab-btn ${activeTab === 'table' ? 'active' : ''}`}
            onClick={() => setActiveTab('table')}
          >
            <ListFilter size={16} /> Tabela de Leads
          </button>
          <button
            id="tab-search"
            className={`nav-tab-btn ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            <SearchIcon size={16} /> Nova Busca
          </button>
        </div>

        <button className="btn-icon-subtle" onClick={exportCSV} title="Exportar CSV para Excel">
          <Download size={18} />
        </button>
      </header>

      {/* Stats Ribbon */}
      <div className="stats-ribbon">
        <div className="stat-card">
          <div className="stat-icon total">
            <BarChart3 size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats ? stats.total : leads.length}</div>
            <div className="stat-label">Total de Leads</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon hot">
            <Flame size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats ? stats.hot : 0}</div>
            <div className="stat-label">Leads Quentes (85+ pts)</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon nosite">
            <Globe size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats ? stats.no_site : 0}</div>
            <div className="stat-label">Sem Site Cadastrado</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon won">
            <Trophy size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats ? stats.by_status?.won || 0 : 0}</div>
            <div className="stat-label">Contratos Fechados</div>
          </div>
        </div>
      </div>

      {/* VIEW: NOVA BUSCA */}
      {activeTab === 'search' && (
        <div className="search-card">
          <div className="search-header">
            <h2>
              <SearchIcon size={22} className="text-cyan" /> Minerar Empresas no Google
            </h2>
            <p>
              Defina o segmento e localidade. O motor pesquisará no Google, auditará a presença
              digital de cada empresa e calculará a pontuação automaticamente.
            </p>
          </div>

          <form onSubmit={handleSearchSubmit}>
            <div className="search-grid">
              <div className="form-group">
                <label>Segmento / Nicho</label>
                <input
                  id="input-niche"
                  type="text"
                  className="form-input"
                  placeholder="Ex: Clínica Odontológica, Academia..."
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Cidade / Bairro</label>
                <input
                  id="input-location"
                  type="text"
                  className="form-input"
                  placeholder="Ex: Curitiba, PR ou Moema, SP..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Qtd. Leads</label>
                <select
                  id="select-limit"
                  className="form-select"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                >
                  <option value={10}>10 leads</option>
                  <option value={20}>20 leads</option>
                  <option value={30}>30 leads</option>
                  <option value={50}>50 leads</option>
                </select>
              </div>

              <button
                id="btn-start-search"
                type="submit"
                className="btn-primary"
                disabled={searchLoading}
              >
                {searchLoading ? (
                  <>
                    <div className="pulse-spinner" /> Minerando Google...
                  </>
                ) : (
                  <>
                    <SearchIcon size={18} /> Iniciar Busca
                  </>
                )}
              </button>
            </div>

            <div className="advanced-toggle">
              <span
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{ cursor: 'pointer', textDecoration: 'underline' }}
              >
                {showAdvanced ? '▲ Ocultar Opções Avançadas' : '▼ Opções Avançadas (API Key & Auditoria)'}
              </span>
            </div>

            {showAdvanced && (
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group">
                  <label>Google Places API Key (Opcional - se vazio, usará Scraper Playwright Gratuito)</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="AIzaSy..."
                    value={googleApiKey}
                    onChange={(e) => setGoogleApiKey(e.target.value)}
                  />
                </div>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={deepAudit}
                    onChange={(e) => setDeepAudit(e.target.checked)}
                  />
                  <span>Executar auditoria profunda de sites (verificar SSL, mobile e redes sociais)</span>
                </label>
              </div>
            )}
          </form>
        </div>
      )}

      {/* VIEW: KANBAN CRM */}
      {activeTab === 'kanban' && (
        <div className="kanban-board">
          {KANBAN_COLUMNS.map((col) => {
            const colLeads = filteredLeads.filter((l) => l.crm_status === col.id);
            return (
              <div key={col.id} className="kanban-column">
                <div className="kanban-column-header">
                  <div className="kanban-column-title">
                    <span style={{ color: col.color }}>●</span>
                    {col.label}
                  </div>
                  <span className="badge-count">{colLeads.length}</span>
                </div>

                <div className="kanban-cards-list">
                  {colLeads.map((lead) => (
                    <div key={lead.id} className="lead-card">
                      <div className="lead-card-header">
                        <div className="lead-card-title">{lead.business_name}</div>
                        <span className={`badge-score ${lead.score_tier}`}>
                          <Flame size={12} /> {lead.lead_score} pts
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <span className={`badge-site ${lead.website_status}`}>
                          {lead.website_status === 'none' && 'Sem Site'}
                          {lead.website_status === 'social_media' && 'Rede Social'}
                          {lead.website_status === 'insecure' && 'Sem HTTPS / Falha'}
                          {lead.website_status === 'outdated' && 'Lento / Não Mobile'}
                          {lead.website_status === 'healthy' && 'Site Ativo'}
                        </span>
                        <span className={`badge-source ${lead.source === 'google_places_api' ? 'api' : 'scraper'}`}>
                          {lead.source === 'google_places_api' ? 'API' : 'Scraper'}
                        </span>
                      </div>

                      <div className="lead-card-metrics">
                        <div className="rating-stars">
                          <Star size={13} fill="#fbbf24" /> {lead.rating?.toFixed(1) || '0.0'}
                        </div>
                        <div>({lead.review_count} avaliações)</div>
                      </div>

                      {lead.phone && (
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Phone size={12} /> {lead.phone}
                        </div>
                      )}

                      <div className="lead-card-actions">
                        <button
                          className="btn-pitch"
                          onClick={() => openPitchModal(lead)}
                          title="Gerar Pitch e Enviar WhatsApp"
                        >
                          <MessageCircle size={14} /> Abordar
                        </button>
                        <button
                          className="btn-icon-subtle"
                          onClick={() => setSelectedLead(lead)}
                          title="Ver Detalhes e Auditoria"
                        >
                          <Info size={14} />
                        </button>
                        <select
                          className="form-select"
                          style={{ padding: '6px', fontSize: '0.75rem', width: 'auto' }}
                          value={lead.crm_status}
                          onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                        >
                          {KANBAN_COLUMNS.map((c) => (
                            <option key={c.id} value={c.id}>
                              ➔ {c.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                  {colLeads.length === 0 && (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>
                      Nenhum lead nesta coluna
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW: TABELA COMPLETA */}
      {activeTab === 'table' && (
        <div className="table-container">
          <div className="table-toolbar">
            <div className="table-filters">
              <input
                type="text"
                className="form-input"
                placeholder="Buscar por nome, nicho ou cidade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '280px' }}
              />

              <select
                className="form-select"
                value={filterTier}
                onChange={(e) => setFilterTier(e.target.value)}
              >
                <option value="all">Todos os Scores</option>
                <option value="hot">🔥 Quentes (85+)</option>
                <option value="warm">⚡ Promissores (60-84)</option>
                <option value="cold">❄️ Frios (&lt;60)</option>
              </select>

              <select
                className="form-select"
                value={filterSite}
                onChange={(e) => setFilterSite(e.target.value)}
              >
                <option value="all">Todos os Sites</option>
                <option value="none">Sem Site</option>
                <option value="social_media">Usa Rede Social</option>
                <option value="insecure">Inseguro / Sem HTTPS</option>
                <option value="outdated">Desatualizado / Lento</option>
              </select>
            </div>

            <div style={{ fontSize: '0.84rem', color: '#94a3b8' }}>
              Mostrando <strong>{filteredLeads.length}</strong> empresas
            </div>
          </div>

          <table className="leads-table">
            <thead>
              <tr>
                <th>Score</th>
                <th>Empresa</th>
                <th>Nicho / Cidade</th>
                <th>Situação do Site</th>
                <th>Avaliações</th>
                <th>Contato</th>
                <th>Status Funil</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <span className={`badge-score ${lead.score_tier}`}>
                      <Flame size={12} /> {lead.lead_score} pts
                    </span>
                  </td>
                  <td>
                    <strong style={{ color: '#fff', fontSize: '0.92rem' }}>{lead.business_name}</strong>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Origem: {lead.source}</div>
                  </td>
                  <td>
                    <div>{lead.niche}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{lead.city}</div>
                  </td>
                  <td>
                    <span className={`badge-site ${lead.website_status}`}>
                      {lead.website_status === 'none' && 'Sem Site'}
                      {lead.website_status === 'social_media' && 'Rede Social'}
                      {lead.website_status === 'insecure' && 'Inseguro'}
                      {lead.website_status === 'outdated' && 'Lento/Mobile Ruim'}
                      {lead.website_status === 'healthy' && 'Site Ativo'}
                    </span>
                  </td>
                  <td>
                    <div className="rating-stars">
                      <Star size={13} fill="#fbbf24" /> {lead.rating?.toFixed(1) || '0.0'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{lead.review_count} avaliações</div>
                  </td>
                  <td>
                    <div>{lead.phone || 'Não informado'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {lead.phone_type === 'mobile' ? '📱 Celular/WhatsApp' : '☎️ Fixo'}
                    </div>
                  </td>
                  <td>
                    <select
                      className="form-select"
                      style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                      value={lead.crm_status}
                      onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                    >
                      {KANBAN_COLUMNS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="btn-pitch"
                        style={{ padding: '6px 10px' }}
                        onClick={() => openPitchModal(lead)}
                        title="Abordar no WhatsApp"
                      >
                        <MessageCircle size={14} />
                      </button>
                      <button
                        className="btn-icon-subtle"
                        onClick={() => setSelectedLead(lead)}
                        title="Ver Detalhes"
                      >
                        <Info size={14} />
                      </button>
                      <button
                        className="btn-icon-subtle"
                        style={{ color: '#f43f5e' }}
                        onClick={() => deleteLead(lead.id)}
                        title="Remover"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                    Nenhum lead encontrado com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: PITCH DE VENDAS */}
      {pitchData && (
        <div className="modal-overlay" onClick={() => setPitchData(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <MessageCircle size={20} className="text-emerald" /> Pitch de Vendas Personalizado
              </h3>
              <button className="btn-icon-subtle" onClick={() => setPitchData(null)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Empresa: {pitchData.business_name}</strong>
                <span className="badge-site social">Cenário: {pitchData.scenario}</span>
              </div>

              <div className="pitch-textbox">{pitchData.pitch_text}</div>

              {pitchData.phone && (
                <div style={{ fontSize: '0.84rem', color: '#94a3b8' }}>
                  Telefone identificado: <strong>{pitchData.phone}</strong>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn-icon-subtle"
                style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => copyToClipboard(pitchData.pitch_text)}
              >
                {copiedPitch ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                {copiedPitch ? 'Copiado!' : 'Copiar Texto'}
              </button>

              {pitchData.whatsapp_url && (
                <a
                  href={pitchData.whatsapp_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-pitch"
                  style={{ textDecoration: 'none', padding: '10px 20px', borderRadius: '10px' }}
                >
                  <MessageCircle size={18} /> Abrir no WhatsApp Web
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DETALHES DO LEAD & AUDITORIA */}
      {selectedLead && !pitchData && (
        <div className="modal-overlay" onClick={() => setSelectedLead(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Detalhes & Auditoria do Lead</h3>
              <button className="btn-icon-subtle" onClick={() => setSelectedLead(null)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem' }}>
                  {selectedLead.business_name}
                </h2>
                <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>
                  {selectedLead.niche} • {selectedLead.address || selectedLead.city}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="stat-card" style={{ padding: '12px' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Lead Score Total</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#fb7185' }}>
                      {selectedLead.lead_score} / 100 pts
                    </div>
                  </div>
                </div>

                <div className="stat-card" style={{ padding: '12px' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Status do Site</div>
                    <div style={{ fontSize: '1rem', fontWeight: '700', textTransform: 'capitalize' }}>
                      {selectedLead.website_status}
                    </div>
                  </div>
                </div>
              </div>

              {selectedLead.website && (
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>Website Cadastrado</div>
                  <a
                    href={selectedLead.website}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#38bdf8', wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {selectedLead.website} <ExternalLink size={14} />
                  </a>
                </div>
              )}

              {selectedLead.score_breakdown && (
                <div>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '8px', color: '#f1f5f9' }}>
                    Composição do Score (Por que essa nota?):
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {Object.entries(selectedLead.score_breakdown).map(([key, val]) => (
                      <div
                        key={key}
                        style={{
                          background: 'rgba(15, 23, 42, 0.6)',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.84rem'
                        }}
                      >
                        <span style={{ color: '#cbd5e1' }}>{val.reason}</span>
                        <strong style={{ color: '#38bdf8' }}>+{val.points} pts</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn-pitch"
                onClick={() => {
                  const leadToOpen = selectedLead;
                  setSelectedLead(null);
                  openPitchModal(leadToOpen);
                }}
              >
                <MessageCircle size={16} /> Gerar Pitch WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
