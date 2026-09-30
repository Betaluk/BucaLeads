import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Edit3,
  RefreshCw,
  Sparkles,
  Database,
  ArrowRight,
  AlertTriangle,
  RotateCcw,
  Layers,
  Calendar,
  CheckCircle2,
  Save
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
  const [activeTab, setActiveTab] = useState('kanban'); // 'kanban', 'table', 'history', 'search'
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [searchHistory, setSearchHistory] = useState([]);
  const [selectedSearchId, setSelectedSearchId] = useState('all');

  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);

  // Formulário de busca
  const [niche, setNiche] = useState('Clínica Odontológica');
  const [location, setLocation] = useState('Curitiba, PR');
  const [limit, setLimit] = useState(15);
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [deepAudit, setDeepAudit] = useState(true);
  const [skipExisting, setSkipExisting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Filtros Avançados Compartilhados (Kanban & Tabela)
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSite, setFilterSite] = useState('all');
  const [filterPhone, setFilterPhone] = useState('all');
  const [filterCity, setFilterCity] = useState('all');
  const [filterTier, setFilterTier] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [filterNotes, setFilterNotes] = useState('all');
  const [filterRating, setFilterRating] = useState('all');
  const [filterActivity, setFilterActivity] = useState('all');
  const [showExtraFilters, setShowExtraFilters] = useState(false);


  // Modais
  const [selectedLead, setSelectedLead] = useState(null);
  const [editNotes, setEditNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [pitchData, setPitchData] = useState(null);
  const [pitchLoading, setPitchLoading] = useState(false);
  const [copiedPitch, setCopiedPitch] = useState(false);

  // Modal de Confirmação de Exclusão
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    type: 'lead', // 'lead' | 'search'
    id: null,
    title: '',
    deleteLeadsOption: false
  });

  const [notification, setNotification] = useState(null);
  const retryCountRef = useRef(0);

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 6000);
  };

  // Carregar dados iniciais e histórico
  useEffect(() => {
    loadAllData('all');
  }, []);

  const loadAllData = async (searchId = selectedSearchId) => {
    setSyncing(true);
    await Promise.all([
      fetchLeads(searchId),
      fetchStats(searchId),
      fetchHistory()
    ]);
    setSyncing(false);
  };

  const fetchLeads = async (searchId = selectedSearchId) => {
    try {
      setLoading(true);
      const url =
        searchId && searchId !== 'all'
          ? `${API_BASE}/api/leads?search_id=${searchId}`
          : `${API_BASE}/api/leads`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLeads(data);
        retryCountRef.current = 0;
      } else {
        throw new Error('Falha na resposta do servidor');
      }
    } catch (err) {
      console.warn('Backend iniciando ou indisponível:', err);
      // Tentativa de reconexão automática se for na inicialização
      if (retryCountRef.current < 4) {
        retryCountRef.current += 1;
        setTimeout(() => fetchLeads(searchId), 2000 * retryCountRef.current);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async (searchId = selectedSearchId) => {
    try {
      const url =
        searchId && searchId !== 'all'
          ? `${API_BASE}/api/leads/stats?search_id=${searchId}`
          : `${API_BASE}/api/leads/stats`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Erro ao buscar stats:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/search/history`);
      if (res.ok) {
        const data = await res.json();
        setSearchHistory(data);
      }
    } catch (err) {
      console.error('Erro ao buscar histórico:', err);
    }
  };

  const handleSearchFilterChange = async (searchId) => {
    setSelectedSearchId(searchId);
    await Promise.all([fetchLeads(searchId), fetchStats(searchId)]);
  };

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!niche || !location) return;

    try {
      setSearchLoading(true);
      const payload = {
        niche: niche.trim(),
        location: location.trim(),
        limit: Number(limit),
        google_api_key: googleApiKey.trim() || null,
        deep_audit: deepAudit,
        skip_existing: skipExisting
      };

      const res = await fetch(`${API_BASE}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const result = await res.json();
        const total = result.total_found ?? (result.leads ? result.leads.length : 0);
        const newCount = result.new_count ?? total;
        const existingCount = result.existing_count ?? 0;

        setSelectedSearchId('all');
        await loadAllData('all');
        setActiveTab('kanban');

        if (total > 0) {
          if (existingCount > 0) {
            showNotification(
              `Busca concluída! ${total} empresas mineradas: ${newCount} novos leads adicionados e ${existingCount} já cadastrados na sua base (status e notas comerciais preservados).`,
              'success'
            );
          } else {
            showNotification(
              `Sucesso! ${newCount} novos leads minerados e organizados pelo Lead Score.`,
              'success'
            );
          }
        } else {
          showNotification('A busca não encontrou novas empresas nessa localidade.', 'info');
        }
      } else {
        showNotification('Erro ao realizar a busca no Google. Verifique os logs do servidor.', 'error');
      }
    } catch (err) {
      console.error('Erro na requisição de busca:', err);
      showNotification('Falha de conexão com o backend local (porta 8000).', 'error');
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
        fetchStats(selectedSearchId);
      }
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
    }
  };

  const openDeleteLeadModal = (lead, e) => {
    if (e) e.stopPropagation();
    setDeleteModal({
      isOpen: true,
      type: 'lead',
      id: lead.id,
      title: lead.business_name,
      deleteLeadsOption: false
    });
  };

  const openDeleteSearchModal = (search, e) => {
    if (e) e.stopPropagation();
    setDeleteModal({
      isOpen: true,
      type: 'search',
      id: search.id,
      title: `${search.niche} em ${search.location}`,
      deleteLeadsOption: false
    });
  };

  const executeDelete = async () => {
    const { type, id, title, deleteLeadsOption } = deleteModal;
    setDeleteModal({ ...deleteModal, isOpen: false });

    try {
      if (type === 'lead') {
        const res = await fetch(`${API_BASE}/api/leads/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setLeads((prev) => prev.filter((l) => l.id !== id));
          if (selectedLead?.id === id) setSelectedLead(null);
          await fetchStats(selectedSearchId);
          showNotification(`Lead "${title}" removido da sua base.`, 'info');
        } else {
          showNotification('Erro ao excluir o lead.', 'error');
        }
      } else if (type === 'search') {
        const res = await fetch(
          `${API_BASE}/api/search/${id}?delete_leads=${deleteLeadsOption ? 'true' : 'false'}`,
          { method: 'DELETE' }
        );
        if (res.ok) {
          const data = await res.json();
          if (selectedSearchId === id) setSelectedSearchId('all');
          await loadAllData('all');
          showNotification(
            `Busca excluída com sucesso.${data.deleted_leads > 0 ? ` (${data.deleted_leads} leads não contatados removidos)` : ''}`,
            'info'
          );
        } else {
          showNotification('Erro ao excluir registro de busca.', 'error');
        }
      }
    } catch (err) {
      console.error('Erro na exclusão:', err);
      showNotification('Erro ao processar exclusão.', 'error');
    }
  };

  const handleCleanupDuplicates = async () => {
    try {
      setCleanupLoading(true);
      const res = await fetch(`${API_BASE}/api/leads/cleanup-duplicates`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        await loadAllData(selectedSearchId);
        if (data.removed_leads > 0) {
          showNotification(
            `Limpeza concluída! ${data.removed_leads} duplicatas foram consolidadas com sucesso (status do funil e notas preservados). Restam ${data.remaining_leads} leads únicos.`,
            'success'
          );
        } else {
          showNotification('Sua base já está 100% limpa! Nenhuma duplicata encontrada.', 'info');
        }
      } else {
        showNotification('Erro ao executar limpeza de duplicados.', 'error');
      }
    } catch (err) {
      console.error('Erro ao limpar duplicados:', err);
      showNotification('Falha ao comunicar com o servidor.', 'error');
    } finally {
      setCleanupLoading(false);
    }
  };

  const openLeadDetailsModal = (lead) => {
    setSelectedLead(lead);
    setEditNotes(lead.notes || '');
  };

  const saveLeadNotes = async () => {
    if (!selectedLead) return;
    try {
      setSavingNotes(true);
      const res = await fetch(`${API_BASE}/api/leads/${selectedLead.id}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: editNotes })
      });
      if (res.ok) {
        const updated = await res.json();
        setLeads((prev) => prev.map((l) => (l.id === updated.id ? { ...l, notes: updated.notes } : l)));
        setSelectedLead((prev) => (prev ? { ...prev, notes: updated.notes } : null));
        showNotification('Notas comerciais salvas com sucesso!', 'success');
      }
    } catch (err) {
      console.error('Erro ao salvar notas:', err);
      showNotification('Erro ao salvar anotação.', 'error');
    } finally {
      setSavingNotes(false);
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
    const url =
      selectedSearchId && selectedSearchId !== 'all'
        ? `${API_BASE}/api/export/csv?search_id=${selectedSearchId}`
        : `${API_BASE}/api/export/csv`;
    window.open(url, '_blank');
  };

  const rerunSearch = (searchItem) => {
    setNiche(searchItem.niche);
    setLocation(searchItem.location);
    setActiveTab('search');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const viewSearchInKanban = (searchId) => {
    setSelectedSearchId(searchId);
    handleSearchFilterChange(searchId);
    setActiveTab('kanban');
  };

  const viewSearchInTable = (searchId) => {
    setSelectedSearchId(searchId);
    handleSearchFilterChange(searchId);
    setActiveTab('table');
  };

  // Cidades únicas disponíveis nos leads carregados
  const availableCities = useMemo(() => {
    const citySet = new Set();
    leads.forEach((l) => {
      if (l.city && l.city.trim()) {
        citySet.add(l.city.trim());
      }
    });
    return Array.from(citySet).sort();
  }, [leads]);

  // Contagem de filtros ativos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim()) count++;
    if (filterTier !== 'all') count++;
    if (filterSite !== 'all') count++;
    if (filterPhone !== 'all') count++;
    if (filterCity !== 'all') count++;
    if (filterSource !== 'all') count++;
    if (filterNotes !== 'all') count++;
    if (filterRating !== 'all') count++;
    if (filterActivity !== 'all') count++;
    return count;
  }, [
    searchTerm,
    filterTier,
    filterSite,
    filterPhone,
    filterCity,
    filterSource,
    filterNotes,
    filterRating,
    filterActivity
  ]);

  const clearAllFilters = () => {
    setSearchTerm('');
    setFilterTier('all');
    setFilterSite('all');
    setFilterPhone('all');
    setFilterCity('all');
    setFilterSource('all');
    setFilterNotes('all');
    setFilterRating('all');
    setFilterActivity('all');
  };

  // Filtragem Multifatorial de Leads (Compartilhada entre Kanban e Tabela)
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      // 1. Busca textual (nome, nicho, cidade, telefone, endereço)
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesName = l.business_name?.toLowerCase().includes(term);
        const matchesNiche = l.niche?.toLowerCase().includes(term);
        const matchesCity = l.city?.toLowerCase().includes(term);
        const matchesPhone = l.phone?.toLowerCase().includes(term);
        const matchesAddress = l.address?.toLowerCase().includes(term);
        if (!matchesName && !matchesNiche && !matchesCity && !matchesPhone && !matchesAddress) {
          return false;
        }
      }

      // 2. Situação do Site
      if (filterSite !== 'all' && l.website_status !== filterSite) {
        return false;
      }

      // 3. Canal de Telefone / WhatsApp
      if (filterPhone !== 'all') {
        if (filterPhone === 'mobile' && l.phone_type !== 'mobile') return false;
        if (filterPhone === 'landline' && l.phone_type !== 'landline') return false;
        if (filterPhone === 'none' && l.phone && l.phone.trim().length > 0) return false;
      }

      // 4. Cidade
      if (filterCity !== 'all') {
        if (!l.city || l.city.trim().toLowerCase() !== filterCity.toLowerCase()) {
          return false;
        }
      }

      // 5. Tier / Score
      if (filterTier !== 'all' && l.score_tier !== filterTier) {
        return false;
      }

      // 6. Origem
      if (filterSource !== 'all' && l.source !== filterSource) {
        return false;
      }

      // 7. Anotações
      if (filterNotes !== 'all') {
        const hasNotes = l.notes && l.notes.trim().length > 0;
        if (filterNotes === 'has_notes' && !hasNotes) return false;
        if (filterNotes === 'no_notes' && hasNotes) return false;
      }

      // 8. Avaliação Mínima
      if (filterRating !== 'all') {
        const minRating = parseFloat(filterRating);
        if ((l.rating || 0) < minRating) return false;
      }

      // 9. Atividade Recente
      if (filterActivity !== 'all') {
        if (filterActivity === 'active' && !l.has_recent_activity) return false;
        if (filterActivity === 'inactive' && l.has_recent_activity) return false;
      }

      return true;
    });
  }, [
    leads,
    searchTerm,
    filterSite,
    filterPhone,
    filterCity,
    filterTier,
    filterSource,
    filterNotes,
    filterRating,
    filterActivity
  ]);


  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="logo-area">
          <div className="logo-icon">
            <Building2 size={24} color="#ffffff" />
          </div>
          <div className="logo-text">
            <h1>BucaLeads</h1>
            <span>Smart Google Prospector & CRM</span>
          </div>
        </div>

        {/* Navegação Principal */}
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
            id="tab-history"
            className={`nav-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <Clock size={16} /> Histórico de Buscas
            {searchHistory.length > 0 && (
              <span
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontSize: '0.72rem',
                  marginLeft: '4px'
                }}
              >
                {searchHistory.length}
              </span>
            )}
          </button>
          <button
            id="tab-search"
            className={`nav-tab-btn ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            <SearchIcon size={16} /> Nova Busca
          </button>
        </div>

        {/* Ações Rápidas no Header */}
        <div className="header-actions-area">
          {/* Seletor de Busca / Campanha */}
          <select
            className="search-filter-dropdown"
            value={selectedSearchId}
            onChange={(e) => handleSearchFilterChange(e.target.value)}
            title="Filtrar base por busca realizada"
          >
            <option value="all">🌐 Todas as Buscas ({leads.length} leads)</option>
            {searchHistory.map((s) => (
              <option key={s.id} value={s.id}>
                📍 {s.niche} em {s.location} ({s.lead_count ?? s.total_found} leads)
              </option>
            ))}
          </select>

          {/* Botão de Limpeza de Duplicados */}
          <button
            className="btn-tool"
            onClick={handleCleanupDuplicates}
            disabled={cleanupLoading}
            title="Consolidar e limpar possíveis leads duplicados"
          >
            {cleanupLoading ? (
              <div className="pulse-spinner" style={{ width: '14px', height: '14px' }} />
            ) : (
              <Sparkles size={15} />
            )}
            Limpar Duplicados
          </button>

          {/* Botão Sincronizar / Atualizar */}
          <button
            className="btn-icon-subtle"
            onClick={() => loadAllData(selectedSearchId)}
            title="Atualizar dados do banco local"
            disabled={syncing}
          >
            <RefreshCw size={18} className={syncing ? 'pulse-spinner' : ''} />
          </button>

          {/* Botão Exportar CSV */}
          <button className="btn-icon-subtle" onClick={exportCSV} title="Exportar CSV para Excel">
            <Download size={18} />
          </button>
        </div>
      </header>

      {/* Notificação Toast */}
      {notification && (
        <div
          style={{
            padding: '14px 20px',
            borderRadius: '12px',
            fontSize: '0.92rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background:
              notification.type === 'error'
                ? 'rgba(239, 68, 68, 0.2)'
                : notification.type === 'info'
                ? 'rgba(59, 130, 246, 0.2)'
                : 'rgba(16, 185, 129, 0.2)',
            border: `1px solid ${
              notification.type === 'error'
                ? 'rgba(239, 68, 68, 0.4)'
                : notification.type === 'info'
                ? 'rgba(59, 130, 246, 0.4)'
                : 'rgba(16, 185, 129, 0.4)'
            }`,
            color:
              notification.type === 'error'
                ? '#f87171'
                : notification.type === 'info'
                ? '#60a5fa'
                : '#34d399',
            animation: 'fadeIn 0.3s ease'
          }}
        >
          <span>{notification.msg}</span>
          <button
            onClick={() => setNotification(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontWeight: 'bold',
              padding: '0 8px'
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Stats Ribbon */}
      <div className="stats-ribbon">
        <div className="stat-card">
          <div className="stat-icon total">
            <BarChart3 size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">
              {activeFiltersCount > 0 ? filteredLeads.length : stats ? stats.total : leads.length}
            </div>
            <div className="stat-label">
              {activeFiltersCount > 0 ? 'Leads Filtrados' : 'Total de Leads'}
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon hot">
            <Flame size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">
              {activeFiltersCount > 0
                ? filteredLeads.filter((l) => l.score_tier === 'hot').length
                : stats
                ? stats.hot
                : 0}
            </div>
            <div className="stat-label">Leads Quentes (85+ pts)</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon nosite">
            <Globe size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">
              {activeFiltersCount > 0
                ? filteredLeads.filter((l) => l.website_status === 'none').length
                : stats
                ? stats.no_site
                : 0}
            </div>
            <div className="stat-label">Sem Site Cadastrado</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon won">
            <Trophy size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">
              {activeFiltersCount > 0
                ? filteredLeads.filter((l) => l.crm_status === 'won').length
                : stats
                ? stats.by_status?.won || 0
                : 0}
            </div>
            <div className="stat-label">Contratos Fechados</div>
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS INTELIGENTES (Compartilhada entre Kanban e Tabela) */}
      {(activeTab === 'kanban' || activeTab === 'table') && (
        <div className="filter-panel">
          <div className="filter-panel-main">
            {/* Busca Textual */}
            <div className="search-input-wrapper">
              <SearchIcon size={16} className="search-icon-inside" />
              <input
                type="text"
                className="search-filter-input"
                placeholder="Buscar por nome, nicho, cidade ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  className="btn-clear-search"
                  onClick={() => setSearchTerm('')}
                  title="Limpar busca textual"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filtro: Situação do Site */}
            <select
              className="filter-select"
              value={filterSite}
              onChange={(e) => setFilterSite(e.target.value)}
              title="Filtrar por situação do website"
            >
              <option value="all">🌐 Todos os Sites</option>
              <option value="none">❌ Sem Site Cadastrado</option>
              <option value="social_media">📱 Usa Rede Social (Instagram/FB)</option>
              <option value="insecure">⚠️ Inseguro / Sem HTTPS</option>
              <option value="outdated">⏱️ Lento / Não Mobile</option>
              <option value="healthy">✅ Site Ativo e Seguro</option>
            </select>

            {/* Filtro: Canal de Telefone / WhatsApp */}
            <select
              className="filter-select"
              value={filterPhone}
              onChange={(e) => setFilterPhone(e.target.value)}
              title="Filtrar por tipo de contato telefônico"
            >
              <option value="all">📞 Todos os Telefones</option>
              <option value="mobile">📱 Somente Celular / WhatsApp</option>
              <option value="landline">☎️ Somente Fixo</option>
              <option value="none">🚫 Sem Telefone</option>
            </select>

            {/* Filtro: Cidade */}
            <select
              className="filter-select"
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              title="Filtrar por cidade cadastrada"
            >
              <option value="all">📍 Todas as Cidades ({availableCities.length})</option>
              {availableCities.map((city) => (
                <option key={city} value={city}>
                  📍 {city}
                </option>
              ))}
            </select>

            {/* Filtro: Score / Tier */}
            <select
              className="filter-select"
              value={filterTier}
              onChange={(e) => setFilterTier(e.target.value)}
              title="Filtrar por qualificação de Lead Score"
            >
              <option value="all">🔥 Todos os Scores</option>
              <option value="hot">🔥 Quentes (85+ pts)</option>
              <option value="warm">⚡ Promissores (60-84 pts)</option>
              <option value="cold">❄️ Frios (&lt;60 pts)</option>
            </select>

            {/* Botão de Toggle para Filtros Extras */}
            <button
              className={`btn-toggle-filters ${showExtraFilters ? 'active' : ''}`}
              onClick={() => setShowExtraFilters(!showExtraFilters)}
              title="Exibir mais opções de filtros avançados"
            >
              <Filter size={15} /> Mais Filtros
            </button>

            {/* Botão Limpar Filtros */}
            {activeFiltersCount > 0 && (
              <button
                className="btn-clear-all"
                onClick={clearAllFilters}
                title="Limpar todos os filtros ativos"
              >
                <RotateCcw size={13} /> Limpar ({activeFiltersCount})
              </button>
            )}
          </div>

          {/* Painel Expansível de Filtros Avançados */}
          {showExtraFilters && (
            <div className="filter-panel-extra">
              {/* Origem da Coleta */}
              <div className="filter-extra-item">
                <label>Origem:</label>
                <select
                  className="filter-select-sm"
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value)}
                >
                  <option value="all">Todas as Origens</option>
                  <option value="local_scraper">Scraper Playwright</option>
                  <option value="google_places_api">Google Places API</option>
                </select>
              </div>

              {/* Anotações Comerciais */}
              <div className="filter-extra-item">
                <label>Anotações:</label>
                <select
                  className="filter-select-sm"
                  value={filterNotes}
                  onChange={(e) => setFilterNotes(e.target.value)}
                >
                  <option value="all">Todos os Leads</option>
                  <option value="has_notes">📝 Com Anotações Salvas</option>
                  <option value="no_notes">Sem Anotações</option>
                </select>
              </div>

              {/* Avaliação Mínima */}
              <div className="filter-extra-item">
                <label>Estrelas:</label>
                <select
                  className="filter-select-sm"
                  value={filterRating}
                  onChange={(e) => setFilterRating(e.target.value)}
                >
                  <option value="all">Todas as Avaliações</option>
                  <option value="4.5">⭐ 4.5 ou mais</option>
                  <option value="4.0">⭐ 4.0 ou mais</option>
                  <option value="3.5">⭐ 3.5 ou mais</option>
                </select>
              </div>

              {/* Atividade Recente */}
              <div className="filter-extra-item">
                <label>Atividade:</label>
                <select
                  className="filter-select-sm"
                  value={filterActivity}
                  onChange={(e) => setFilterActivity(e.target.value)}
                >
                  <option value="all">Todos os Perfis</option>
                  <option value="active">🟢 Perfil Ativo (Responde Clientes)</option>
                  <option value="inactive">Sem Resposta Recente</option>
                </select>
              </div>
            </div>
          )}

          {/* Barra de Status dos Filtros */}
          <div className="filter-status-bar">
            <div>
              Exibindo <strong>{filteredLeads.length}</strong> de <strong>{leads.length}</strong> leads
              {activeFiltersCount > 0 && (
                <span className="filter-applied-badge">
                  {activeFiltersCount} {activeFiltersCount === 1 ? 'filtro ativo' : 'filtros ativos'}
                </span>
              )}
            </div>
            {filteredLeads.length === 0 && leads.length > 0 && (
              <span style={{ color: '#f87171', fontWeight: '600' }}>
                Nenhum lead encontrado com a combinação atual de filtros.
              </span>
            )}
          </div>
        </div>
      )}


      {/* VIEW: NOVA BUSCA */}
      {activeTab === 'search' && (
        <div className="search-card">
          <div className="search-header">
            <h2>
              <SearchIcon size={22} className="text-cyan" /> Minerar Empresas no Google
            </h2>
            <p>
              Defina o segmento e localidade. O motor pesquisará no Google Maps, verificará se a empresa
              já existe na sua base para não duplicar dados, auditará o site e calculará a pontuação automaticamente.
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
                  placeholder="Ex: Clínica Odontológica, Academia, Advogado..."
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

            {/* Configurações de Inteligência de Base */}
            <div
              style={{
                marginTop: '16px',
                padding: '14px 18px',
                background: 'rgba(15, 23, 42, 0.6)',
                borderRadius: '12px',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontSize: '0.86rem', fontWeight: '700' }}>
                <Database size={16} /> Inteligência de Base e Deduplicação Ativa
              </div>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>
                O sistema identifica automaticamente se uma empresa já foi cadastrada anteriormente por telefone, domínio ou nome.
                O status atual no seu funil e suas anotações nunca serão perdidos.
              </p>
              <label className="checkbox-label" style={{ marginTop: '4px' }}>
                <input
                  type="checkbox"
                  checked={skipExisting}
                  onChange={(e) => setSkipExisting(e.target.checked)}
                />
                <span>Pular leads já existentes na base (trazer somente empresas novas)</span>
              </label>
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

      {/* VIEW: HISTÓRICO DE BUSCAS */}
      {activeTab === 'history' && (
        <div className="history-container">
          <div className="history-header">
            <div>
              <h2>
                <Clock size={22} className="text-cyan" /> Histórico de Buscas & Campanhas
              </h2>
              <p>
                Acesse todas as buscas realizadas. Filtre o funil por campanha, repita buscas antigas
                ou remova buscas obsoletas.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                Total: <strong>{searchHistory.length}</strong> buscas salvas
              </span>
              <button className="btn-secondary" onClick={() => setActiveTab('search')}>
                <SearchIcon size={16} /> Nova Busca
              </button>
            </div>
          </div>

          <div className="history-grid">
            {searchHistory.map((item) => (
              <div key={item.id} className="history-card">
                <div className="history-card-header">
                  <div>
                    <div className="history-query-title">{item.niche}</div>
                    <div style={{ fontSize: '0.88rem', color: '#38bdf8' }}>📍 {item.location}</div>
                    <div className="history-date">
                      <Calendar size={12} />
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
                    onClick={(e) => openDeleteSearchModal(item, e)}
                    title="Excluir do Histórico"
                  >
                    <Trash2 size={15} />
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
                    onClick={() => viewSearchInKanban(item.id)}
                    title="Filtrar e abrir este lote no Funil Kanban"
                  >
                    <Columns size={14} /> Ver no Funil
                  </button>
                  <button
                    className="btn-history-action"
                    onClick={() => viewSearchInTable(item.id)}
                    title="Ver este lote na Tabela"
                  >
                    <ListFilter size={14} /> Ver na Tabela
                  </button>
                  <button
                    className="btn-history-action"
                    onClick={() => rerunSearch(item)}
                    title="Refazer esta busca"
                  >
                    <RotateCcw size={14} /> Refazer
                  </button>
                </div>
              </div>
            ))}

            {searchHistory.length === 0 && (
              <div
                style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  padding: '48px',
                  background: 'var(--bg-card)',
                  borderRadius: '16px',
                  border: '1px solid var(--border-subtle)',
                  color: '#64748b'
                }}
              >
                <Clock size={36} style={{ marginBottom: '12px', opacity: 0.5 }} />
                <h3>Nenhum histórico de busca encontrado</h3>
                <p style={{ marginTop: '6px' }}>Faça sua primeira busca para minerar e organizar leads no funil.</p>
                <button
                  className="btn-primary"
                  style={{ marginTop: '16px', display: 'inline-flex' }}
                  onClick={() => setActiveTab('search')}
                >
                  <SearchIcon size={16} /> Fazer Primeira Busca
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW: KANBAN CRM */}
      {activeTab === 'kanban' && (
        <div>
          {/* Banner informativo quando filtrado por busca */}
          {selectedSearchId !== 'all' && (
            <div
              style={{
                marginBottom: '16px',
                padding: '10px 16px',
                background: 'rgba(59, 130, 246, 0.12)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.86rem'
              }}
            >
              <span>
                Filtrando pelo lote:{' '}
                <strong>
                  {searchHistory.find((s) => s.id === selectedSearchId)?.niche || 'Busca selecionada'}
                </strong>
              </span>
              <button
                className="btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                onClick={() => handleSearchFilterChange('all')}
              >
                Limpar Filtro (Mostrar Todos)
              </button>
            </div>
          )}

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

                        {/* Badges de Situação, Origem e Base */}
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
                          {lead.notes && (
                            <span className="badge-tag new" title={lead.notes}>
                              <Edit3 size={10} /> Notas
                            </span>
                          )}
                        </div>

                        <div className="lead-card-metrics">
                          <div className="rating-stars">
                            <Star size={13} fill="#fbbf24" /> {lead.rating?.toFixed(1) || '0.0'}
                          </div>
                          <div>({lead.review_count} avaliações)</div>
                          {lead.city && <div>• {lead.city}</div>}
                        </div>

                        {lead.phone && (
                          <div
                            style={{
                              fontSize: '0.8rem',
                              color: '#94a3b8',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
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
                            onClick={() => openLeadDetailsModal(lead)}
                            title="Ver Detalhes, Auditoria e Anotações"
                          >
                            <Info size={14} />
                          </button>
                          <button
                            className="btn-danger-subtle"
                            onClick={(e) => openDeleteLeadModal(lead, e)}
                            title="Excluir Lead da Base"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {/* Seletor Dedicado de Movimentação no Funil (100% contido no card) */}
                        <div className="lead-stage-selector">
                          <span className="stage-selector-label">Mover:</span>
                          <select
                            className="stage-selector-select"
                            value={lead.crm_status}
                            onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                            title="Mover lead de etapa no funil"
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
                      <div
                        style={{
                          padding: '24px',
                          textAlign: 'center',
                          color: '#64748b',
                          fontSize: '0.84rem'
                        }}
                      >
                        Nenhum lead nesta coluna
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW: TABELA COMPLETA */}
      {activeTab === 'table' && (
        <div className="table-container">
          <div className="table-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.92rem', color: '#fff', fontWeight: '700' }}>
                Tabela de Leads
              </span>
              <span className="badge-count">{filteredLeads.length}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '0.84rem', color: '#94a3b8' }}>
                Mostrando <strong>{filteredLeads.length}</strong> de <strong>{leads.length}</strong> empresas
              </div>
              <button
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={exportCSV}
                title="Exportar dados filtrados para Excel/CSV"
              >
                <Download size={14} /> Exportar CSV
              </button>
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
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Origem: {lead.source} {lead.notes ? '• 📝 Possui notas' : ''}
                    </div>
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
                        onClick={() => openLeadDetailsModal(lead)}
                        title="Ver Detalhes e Notas"
                      >
                        <Info size={14} />
                      </button>
                      <button
                        className="btn-danger-subtle"
                        onClick={(e) => openDeleteLeadModal(lead, e)}
                        title="Excluir Lead"
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

      {/* MODAL: DETALHES DO LEAD & ANOTAÇÕES */}
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
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                  Cadastrado em:{' '}
                  {new Date(selectedLead.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
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
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                    Website Cadastrado
                  </div>
                  <a
                    href={selectedLead.website}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: '#38bdf8',
                      wordBreak: 'break-all',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {selectedLead.website} <ExternalLink size={14} />
                  </a>
                </div>
              )}

              {/* Anotações Comerciais (Mini-CRM) */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px'
                  }}
                >
                  <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#f1f5f9' }}>
                    📝 Anotações Comerciais do Lead:
                  </label>
                  <button
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={saveLeadNotes}
                    disabled={savingNotes}
                  >
                    <Save size={12} /> {savingNotes ? 'Salvando...' : 'Salvar Anotação'}
                  </button>
                </div>
                <textarea
                  className="form-input"
                  style={{ width: '100%', minHeight: '80px', resize: 'vertical', fontSize: '0.86rem' }}
                  placeholder="Ex: Falei com o proprietário Dr. Carlos. Solicitou orçamento de redesign e contato na próxima terça..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>

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

            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <button
                className="btn-danger-subtle"
                style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => {
                  const leadToDelete = selectedLead;
                  setSelectedLead(null);
                  openDeleteLeadModal(leadToDelete);
                }}
              >
                <Trash2 size={16} /> Excluir Lead
              </button>

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

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (Lead ou Busca) */}
      {deleteModal.isOpen && (
        <div className="modal-overlay" onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}>
          <div className="modal-content" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f43f5e' }}>
                <AlertTriangle size={20} />
                {deleteModal.type === 'lead' ? 'Excluir Lead' : 'Excluir Busca do Histórico'}
              </h3>
              <button
                className="btn-icon-subtle"
                onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ gap: '14px' }}>
              <p style={{ fontSize: '0.92rem', color: '#e2e8f0', lineHeight: 1.5 }}>
                Tem certeza que deseja excluir{' '}
                <strong>"{deleteModal.title}"</strong>?
              </p>

              {deleteModal.type === 'lead' ? (
                <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                  Esta ação removerá este lead, suas auditorias de site e suas anotações comerciais
                  permanentemente do banco de dados local.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                    O registro desta busca será removido do seu histórico de campanhas.
                  </p>
                  <label className="checkbox-label" style={{ marginTop: '4px' }}>
                    <input
                      type="checkbox"
                      checked={deleteModal.deleteLeadsOption}
                      onChange={(e) =>
                        setDeleteModal({ ...deleteModal, deleteLeadsOption: e.target.checked })
                      }
                    />
                    <span style={{ fontSize: '0.82rem' }}>
                      Remover também os leads desta busca que ainda estão em "Novos Leads" e sem notas
                    </span>
                  </label>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}
              >
                Cancelar
              </button>
              <button className="btn-danger" onClick={executeDelete}>
                <Trash2 size={16} /> Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
