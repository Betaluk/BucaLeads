import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  Info,
  Clock,
  Trash2,
  Edit3,
  RefreshCw,
  Sparkles,
  Database,
  AlertTriangle,
  RotateCcw,
  Calendar,
  Save,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Square
} from 'lucide-react';

import WhatsAppChat from './components/WhatsAppChat';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const KANBAN_COLUMNS = [
  { id: 'new', label: 'Novos Leads', color: '#6366f1' },
  { id: 'contacted', label: 'Contatados', color: '#8b5cf6' },
  { id: 'in_conversation', label: 'Em Conversa', color: '#f59e0b' },
  { id: 'proposal_sent', label: 'Proposta Enviada', color: '#06b6d4' },
  { id: 'won', label: 'Fechados / Ganhos', color: '#10b981' }
];

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('[BucaLeads ErrorBoundary]', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '36px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', margin: '24px auto', maxWidth: '600px' }}>
          <h3 style={{ color: '#f87171', fontSize: '1.1rem', marginBottom: '8px' }}>Erro ao carregar este módulo</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{this.state.error?.message || 'Erro inesperado'}</p>
          <button className="btn-primary" style={{ marginTop: '16px' }} onClick={() => this.setState({ hasError: false })}>
            Tentar Novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState('kanban'); // 'kanban', 'table', 'history', 'search', 'whatsapp'
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [initialWaPhone, setInitialWaPhone] = useState(null);
  const [leads, setLeads] = useState([]);

  const [stats, setStats] = useState(null);
  const [searchHistory, setSearchHistory] = useState([]);
  const [selectedSearchId, setSelectedSearchId] = useState('all');

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

  // Filtros Compartilhados
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

  // Ordenação de Tabela
  const [sortField, setSortField] = useState('lead_score');
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' | 'desc'

  // Seleção em Lote (Tabela)
  const [selectedLeadIds, setSelectedLeadIds] = useState(new Set());
  const [batchActionLoading, setBatchActionLoading] = useState(false);

  // Drag and Drop (Kanban)
  const [draggedLeadId, setDraggedLeadId] = useState(null);
  const [dragOverColId, setDragOverColId] = useState(null);

  // Mobile Kanban Coluna Ativa
  const [mobileKanbanCol, setMobileKanbanCol] = useState('new');

  // Modais
  const [selectedLead, setSelectedLead] = useState(null);
  const [editNotes, setEditNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [pitchData, setPitchData] = useState(null);
  const [copiedPitch, setCopiedPitch] = useState(false);

  // Modal Confirmação de Exclusão
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    type: 'lead', // 'lead' | 'search' | 'batch'
    id: null,
    title: '',
    deleteLeadsOption: false
  });

  const [notification, setNotification] = useState(null);
  const retryCountRef = useRef(0);

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 5000);
  };

  // Funções de busca de dados
  const fetchLeadsRef = useRef(null);

  const fetchLeads = useCallback(async (searchId = selectedSearchId) => {
    try {
      const url =
        searchId && searchId !== 'all'
          ? `${API_BASE}/api/leads?search_id=${searchId}`
          : `${API_BASE}/api/leads`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLeads(data);
        retryCountRef.current = 0;
      }
    } catch (err) {
      console.warn('Backend iniciando ou indisponível:', err);
      if (retryCountRef.current < 3) {
        retryCountRef.current += 1;
        setTimeout(() => {
          if (fetchLeadsRef.current) fetchLeadsRef.current(searchId);
        }, 2000 * retryCountRef.current);
      }
    }
  }, [selectedSearchId]);

  useEffect(() => {
    fetchLeadsRef.current = fetchLeads;
  }, [fetchLeads]);

  const fetchStats = useCallback(async (searchId = selectedSearchId) => {
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
  }, [selectedSearchId]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/search/history`);
      if (res.ok) {
        const data = await res.json();
        setSearchHistory(data);
      }
    } catch (err) {
      console.error('Erro ao buscar histórico:', err);
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/unread-count`);
      if (res.ok) {
        const data = await res.json();
        setUnreadTotal(data.unread_total || 0);
      }
    } catch {
      // Ignora silenciosamente
    }
  }, []);

  const loadAllData = useCallback(async (searchId = selectedSearchId) => {
    setSyncing(true);
    await Promise.all([
      fetchLeads(searchId),
      fetchStats(searchId),
      fetchHistory(),
      fetchUnreadCount()
    ]);
    setSyncing(false);
  }, [selectedSearchId, fetchLeads, fetchStats, fetchHistory, fetchUnreadCount]);

  // Carregar dados na montagem
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      if (mounted) await loadAllData('all');
    };
    init();
    return () => {
      mounted = false;
    };
  }, [loadAllData]);

  // Atalho global: Tecla ESC fecha modais abertos
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (pitchData) setPitchData(null);
        else if (selectedLead) setSelectedLead(null);
        else if (deleteModal.isOpen) setDeleteModal((prev) => ({ ...prev, isOpen: false }));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pitchData, selectedLead, deleteModal.isOpen]);

  const handleSearchFilterChange = async (searchId) => {
    setSelectedSearchId(searchId);
    setSelectedLeadIds(new Set());
    await Promise.all([fetchLeads(searchId), fetchStats(searchId)]);
  };

  // Submissão do Formulário de Mineração
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
              `Busca concluída! ${total} empresas mineradas: ${newCount} novos leads e ${existingCount} já cadastrados na base (status comercial preservado).`,
              'success'
            );
          } else {
            showNotification(
              `Sucesso! ${newCount} novos leads minerados e organizados por Lead Score.`,
              'success'
            );
          }
        } else {
          showNotification('A busca não encontrou novas empresas nessa localidade.', 'info');
        }
      } else {
        showNotification('Erro ao realizar a busca no Google. Verifique o servidor.', 'error');
      }
    } catch (err) {
      console.error('Erro na requisição de busca:', err);
      showNotification('Falha de conexão com o servidor local.', 'error');
    } finally {
      setSearchLoading(false);
    }
  };

  // Atualizar Status do CRM
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
        if (selectedLead?.id === leadId) {
          setSelectedLead((prev) => (prev ? { ...prev, crm_status: newStatus } : null));
        }
        fetchStats(selectedSearchId);
      }
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
    }
  };

  // Handlers de Drag and Drop (Kanban)
  const handleDragStart = (e, leadId) => {
    e.dataTransfer.setData('text/plain', leadId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedLeadId(leadId);
  };

  const handleDragEnd = () => {
    setDraggedLeadId(null);
    setDragOverColId(null);
  };

  const handleDragOver = (e, colId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColId !== colId) {
      setDragOverColId(colId);
    }
  };

  const handleDragLeave = (e, colId) => {
    if (dragOverColId === colId) {
      setDragOverColId(null);
    }
  };

  const handleDrop = async (e, targetColId) => {
    e.preventDefault();
    setDragOverColId(null);
    const leadId = e.dataTransfer.getData('text/plain') || draggedLeadId;
    if (!leadId) return;

    const lead = leads.find((l) => l.id === leadId);
    if (lead && lead.crm_status !== targetColId) {
      await updateLeadStatus(leadId, targetColId);
    }
    setDraggedLeadId(null);
  };

  // Limpeza de Duplicados
  const handleCleanupDuplicates = async () => {
    try {
      setCleanupLoading(true);
      const res = await fetch(`${API_BASE}/api/leads/cleanup-duplicates`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        await loadAllData(selectedSearchId);
        if (data.removed_leads > 0) {
          showNotification(
            `Limpeza concluída! ${data.removed_leads} duplicatas foram consolidadas (status e notas preservados). Restam ${data.remaining_leads} leads únicos.`,
            'success'
          );
        } else {
          showNotification('Sua base já está limpa! Nenhuma duplicata encontrada.', 'info');
        }
      } else {
        showNotification('Erro ao executar limpeza de duplicados.', 'error');
      }
    } catch (err) {
      console.error('Erro ao limpar duplicados:', err);
      showNotification('Falha de conexão com o servidor.', 'error');
    } finally {
      setCleanupLoading(false);
    }
  };

  // Anotações Comerciais
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
        showNotification('Anotações comerciais salvas!', 'success');
      }
    } catch (err) {
      console.error('Erro ao salvar notas:', err);
      showNotification('Erro ao salvar anotação.', 'error');
    } finally {
      setSavingNotes(false);
    }
  };

  // Pitch de Vendas
  const openPitchModal = async (lead) => {
    setSelectedLead(lead);
    setCopiedPitch(false);
    try {
      const res = await fetch(`${API_BASE}/api/leads/${lead.id}/pitch`);
      if (res.ok) {
        const data = await res.json();
        setPitchData(data);
      }
    } catch (err) {
      console.error('Erro ao gerar pitch:', err);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedPitch(true);
    setTimeout(() => setCopiedPitch(false), 2500);
  };

  // Exportação CSV
  const exportCSV = () => {
    const url =
      selectedSearchId && selectedSearchId !== 'all'
        ? `${API_BASE}/api/export/csv?search_id=${selectedSearchId}`
        : `${API_BASE}/api/export/csv`;
    window.open(url, '_blank');
  };

  // Exclusões
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

  const openBatchDeleteModal = () => {
    if (selectedLeadIds.size === 0) return;
    setDeleteModal({
      isOpen: true,
      type: 'batch',
      id: null,
      title: `${selectedLeadIds.size} leads selecionados`,
      deleteLeadsOption: false
    });
  };

  const executeDelete = async () => {
    const { type, id, title, deleteLeadsOption } = deleteModal;
    setDeleteModal((prev) => ({ ...prev, isOpen: false }));

    try {
      if (type === 'lead') {
        const res = await fetch(`${API_BASE}/api/leads/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setLeads((prev) => prev.filter((l) => l.id !== id));
          if (selectedLead?.id === id) setSelectedLead(null);
          await fetchStats(selectedSearchId);
          showNotification(`Lead "${title}" removido com sucesso.`, 'info');
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
            `Busca excluída.${data.deleted_leads > 0 ? ` (${data.deleted_leads} leads não contatados removidos)` : ''}`,
            'info'
          );
        }
      } else if (type === 'batch') {
        setBatchActionLoading(true);
        const res = await fetch(`${API_BASE}/api/leads/batch-delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead_ids: Array.from(selectedLeadIds) })
        });
        if (res.ok) {
          const data = await res.json();
          setLeads((prev) => prev.filter((l) => !selectedLeadIds.has(l.id)));
          setSelectedLeadIds(new Set());
          await fetchStats(selectedSearchId);
          showNotification(`${data.deleted_count} leads excluídos em lote com sucesso!`, 'info');
        }
        setBatchActionLoading(false);
      }
    } catch (err) {
      console.error('Erro na exclusão:', err);
      showNotification('Erro ao processar exclusão.', 'error');
    }
  };

  // Ações em Lote: Mover Status
  const handleBatchMoveStatus = async (newStatus) => {
    if (selectedLeadIds.size === 0 || !newStatus) return;
    setBatchActionLoading(true);
    try {
      const ids = Array.from(selectedLeadIds);
      await Promise.all(
        ids.map((id) =>
          fetch(`${API_BASE}/api/leads/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ crm_status: newStatus })
          })
        )
      );
      setLeads((prev) =>
        prev.map((l) => (selectedLeadIds.has(l.id) ? { ...l, crm_status: newStatus } : l))
      );
      await fetchStats(selectedSearchId);
      showNotification(`${ids.length} leads movidos para "${KANBAN_COLUMNS.find((c) => c.id === newStatus)?.label}".`, 'success');
      setSelectedLeadIds(new Set());
    } catch (err) {
      console.error('Erro na movimentação em lote:', err);
      showNotification('Erro ao mover leads em lote.', 'error');
    } finally {
      setBatchActionLoading(false);
    }
  };

  // Repetir Busca
  const rerunSearch = (searchItem) => {
    setNiche(searchItem.niche);
    setLocation(searchItem.location);
    setActiveTab('search');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Cidades disponíveis
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

  // Filtragem e Ordenação
  const filteredAndSortedLeads = useMemo(() => {
    const filtered = leads.filter((l) => {
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

      if (filterSite !== 'all' && l.website_status !== filterSite) return false;

      if (filterPhone !== 'all') {
        if (filterPhone === 'mobile' && l.phone_type !== 'mobile') return false;
        if (filterPhone === 'landline' && l.phone_type !== 'landline') return false;
        if (filterPhone === 'none' && l.phone && l.phone.trim().length > 0) return false;
      }

      if (filterCity !== 'all') {
        if (!l.city || l.city.trim().toLowerCase() !== filterCity.toLowerCase()) return false;
      }

      if (filterTier !== 'all' && l.score_tier !== filterTier) return false;
      if (filterSource !== 'all' && l.source !== filterSource) return false;

      if (filterNotes !== 'all') {
        const hasNotes = l.notes && l.notes.trim().length > 0;
        if (filterNotes === 'has_notes' && !hasNotes) return false;
        if (filterNotes === 'no_notes' && hasNotes) return false;
      }

      if (filterRating !== 'all') {
        if ((l.rating || 0) < parseFloat(filterRating)) return false;
      }

      if (filterActivity !== 'all') {
        if (filterActivity === 'active' && !l.has_recent_activity) return false;
        if (filterActivity === 'inactive' && l.has_recent_activity) return false;
      }

      return true;
    });

    // Ordenação
    return filtered.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
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
    filterActivity,
    sortField,
    sortDirection
  ]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Seleção de Leads na Tabela
  const toggleSelectLead = (id) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    if (selectedLeadIds.size >= filteredAndSortedLeads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(filteredAndSortedLeads.map((l) => l.id)));
    }
  };

  return (
    <div className="app-container">
      {/* Header Profissional */}
      <header className="app-header">
        <div className="app-header-top">
          {/* Logo e Branding */}
          <div className="logo-area">
            <div className="logo-icon">
              <Building2 size={22} />
            </div>
            <div className="logo-text">
              <h1>BucaLeads</h1>
              <span>Smart Prospector & Mini-CRM</span>
            </div>
          </div>

          {/* Abas Principais de Navegação */}
          <nav className="nav-tabs" aria-label="Navegação da aplicação">
            <button
              id="tab-kanban"
              className={`nav-tab-btn ${activeTab === 'kanban' ? 'active' : ''}`}
              onClick={() => setActiveTab('kanban')}
            >
              <Columns size={15} /> Funil Kanban
            </button>
            <button
              id="tab-table"
              className={`nav-tab-btn ${activeTab === 'table' ? 'active' : ''}`}
              onClick={() => setActiveTab('table')}
            >
              <ListFilter size={15} /> Tabela de Leads
            </button>
            <button
              id="tab-history"
              className={`nav-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <Clock size={15} /> Histórico
              {searchHistory.length > 0 && <span className="nav-counter">{searchHistory.length}</span>}
            </button>
            <button
              id="tab-search"
              className={`nav-tab-btn ${activeTab === 'search' ? 'active' : ''}`}
              onClick={() => setActiveTab('search')}
            >
              <SearchIcon size={15} /> Nova Busca
            </button>
            <button
              id="tab-whatsapp"
              className={`nav-tab-btn ${activeTab === 'whatsapp' ? 'active' : ''}`}
              onClick={() => setActiveTab('whatsapp')}
            >
              <MessageCircle size={15} /> WhatsApp
              {unreadTotal > 0 && <span className="unread-badge-pulse">{unreadTotal}</span>}
            </button>
          </nav>
        </div>

        {/* Toolbar de Ações e Contexto */}
        <div className="app-header-toolbar">
          <div className="toolbar-left">
            {/* Seletor de Busca / Campanha */}
            <div className="campaign-filter-wrapper">
              <select
                className="search-filter-dropdown"
                value={selectedSearchId}
                onChange={(e) => handleSearchFilterChange(e.target.value)}
                title="Filtrar base por campanha de busca"
              >
                <option value="all">Todas as Buscas ({leads.length} leads)</option>
                {searchHistory.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.niche} em {s.location} ({s.lead_count ?? s.total_found} leads)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="toolbar-right">
            {/* Limpar Duplicados */}
            <button
              className="btn-tool"
              onClick={handleCleanupDuplicates}
              disabled={cleanupLoading}
              title="Consolidar e fundir registros duplicados"
            >
              {cleanupLoading ? <span className="pulse-spinner" /> : <Sparkles size={14} />}
              Limpar Duplicados
            </button>

            {/* Sincronizar Dados */}
            <button
              className="btn-icon-subtle"
              onClick={() => loadAllData(selectedSearchId)}
              title="Atualizar dados do banco local"
              disabled={syncing}
            >
              <RefreshCw size={15} className={syncing ? 'pulse-spinner' : ''} />
            </button>

            {/* Exportar CSV */}
            <button
              className="btn-tool"
              onClick={exportCSV}
              title="Exportar base de leads para Excel/CSV"
            >
              <Download size={14} /> Exportar CSV
            </button>
          </div>
        </div>
      </header>

      {/* Notificação Toast */}
      {notification && (
        <div className={`toast-notification ${notification.type}`}>
          <span>{notification.msg}</span>
          <button className="toast-close-btn" onClick={() => setNotification(null)} title="Fechar notificação">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Stats Ribbon (Interactive KPI Cards com Click-to-Filter) */}
      <div className="stats-ribbon">
        {/* Card: Total */}
        <div
          className={`stat-card ${filterTier === 'all' && filterSite === 'all' && activeFiltersCount === 0 ? 'active-filter' : ''}`}
          onClick={() => {
            setFilterTier('all');
            setFilterSite('all');
          }}
          title="Clique para ver todos os leads"
        >
          <div className="stat-icon total">
            <BarChart3 size={22} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{activeFiltersCount > 0 ? filteredAndSortedLeads.length : stats ? stats.total : leads.length}</div>
            <div className="stat-label">{activeFiltersCount > 0 ? 'Leads Filtrados' : 'Total de Leads'}</div>
          </div>
        </div>

        {/* Card: Leads Quentes */}
        <div
          className={`stat-card ${filterTier === 'hot' ? 'active-filter' : ''}`}
          onClick={() => setFilterTier((prev) => (prev === 'hot' ? 'all' : 'hot'))}
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
          onClick={() => setFilterSite((prev) => (prev === 'none' ? 'all' : 'none'))}
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
          onClick={() => {
            setActiveTab('kanban');
            setMobileKanbanCol('won');
          }}
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

      {/* BARRA DE FILTROS (Compartilhada entre Kanban e Tabela) */}
      {(activeTab === 'kanban' || activeTab === 'table') && (
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
                <button className="btn-clear-search" onClick={() => setSearchTerm('')} title="Limpar busca">
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Situação do Site */}
            <select
              className="filter-select"
              value={filterSite}
              onChange={(e) => setFilterSite(e.target.value)}
              title="Filtrar por situação do site"
            >
              <option value="all">Situação do Site (Todos)</option>
              <option value="none">❌ Sem Site Cadastrado</option>
              <option value="social_media">📱 Usa Rede Social (Instagram/FB)</option>
              <option value="insecure">⚠️ Inseguro / Sem HTTPS</option>
              <option value="outdated">⏱️ Lento / Não Mobile</option>
              <option value="healthy">✅ Site Ativo e Seguro</option>
            </select>

            {/* Canal de Telefone */}
            <select
              className="filter-select"
              value={filterPhone}
              onChange={(e) => setFilterPhone(e.target.value)}
              title="Filtrar por canal de contato"
            >
              <option value="all">Telefones (Todos)</option>
              <option value="mobile">📱 Somente Celular / WhatsApp</option>
              <option value="landline">☎️ Somente Fixo</option>
              <option value="none">🚫 Sem Telefone</option>
            </select>

            {/* Cidade */}
            <select
              className="filter-select"
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              title="Filtrar por cidade"
            >
              <option value="all">Cidades ({availableCities.length})</option>
              {availableCities.map((city) => (
                <option key={city} value={city}>
                  📍 {city}
                </option>
              ))}
            </select>

            {/* Lead Score / Tier */}
            <select
              className="filter-select"
              value={filterTier}
              onChange={(e) => setFilterTier(e.target.value)}
              title="Filtrar por classificação de score"
            >
              <option value="all">Lead Score (Todos)</option>
              <option value="hot">🔥 Quentes (85+ pts)</option>
              <option value="warm">⚡ Promissores (60-84 pts)</option>
              <option value="cold">❄️ Frios (&lt;60 pts)</option>
            </select>

            {/* Toggle Filtros Avançados */}
            <button
              className={`btn-toggle-filters ${showExtraFilters ? 'active' : ''}`}
              onClick={() => setShowExtraFilters(!showExtraFilters)}
            >
              <Filter size={13} /> Mais Filtros
            </button>

            {/* Limpar Todos os Filtros */}
            {activeFiltersCount > 0 && (
              <button className="btn-clear-all" onClick={clearAllFilters} title="Limpar todos os filtros">
                <RotateCcw size={12} /> Limpar ({activeFiltersCount})
              </button>
            )}
          </div>

          {/* Filtros Extras Acordeão */}
          {showExtraFilters && (
            <div className="filter-panel-extra">
              <div className="filter-extra-item">
                <label>Origem:</label>
                <select className="filter-select-sm" value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
                  <option value="all">Todas as Origens</option>
                  <option value="local_scraper">Scraper Playwright</option>
                  <option value="google_places_api">Google Places API</option>
                </select>
              </div>

              <div className="filter-extra-item">
                <label>Anotações:</label>
                <select className="filter-select-sm" value={filterNotes} onChange={(e) => setFilterNotes(e.target.value)}>
                  <option value="all">Todos os Leads</option>
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
              Exibindo <strong>{filteredAndSortedLeads.length}</strong> de <strong>{leads.length}</strong> leads
              {activeFiltersCount > 0 && (
                <span className="filter-applied-badge">
                  {activeFiltersCount} {activeFiltersCount === 1 ? 'filtro ativo' : 'filtros ativos'}
                </span>
              )}
            </div>
            {filteredAndSortedLeads.length === 0 && leads.length > 0 && (
              <span style={{ color: '#f87171', fontWeight: 600 }}>
                Nenhum lead encontrado com a combinação atual de filtros.
              </span>
            )}
          </div>
        </div>
      )}

      {/* VIEW: WHATSAPP CHAT */}
      {activeTab === 'whatsapp' && (
        <ErrorBoundary>
          <WhatsAppChat
            leads={leads}
            onOpenLeadDetail={(lead) => {
              setSelectedLead(lead);
              setEditNotes(lead.notes || '');
            }}
            onUpdateLeadStatus={updateLeadStatus}
            initialContactPhone={initialWaPhone}
            onClearInitialContact={() => setInitialWaPhone(null)}
            onUnreadCountChange={(count) => setUnreadTotal(count)}
          />
        </ErrorBoundary>
      )}

      {/* VIEW: KANBAN CRM COM DRAG & DROP */}
      {activeTab === 'kanban' && (
        <div>
          {/* Seletor Mobile de Colunas */}
          <div className="kanban-mobile-tabs">
            {KANBAN_COLUMNS.map((col) => {
              const count = filteredAndSortedLeads.filter((l) => l.crm_status === col.id).length;
              return (
                <button
                  key={col.id}
                  className={`kanban-mobile-tab-btn ${mobileKanbanCol === col.id ? 'active' : ''}`}
                  onClick={() => setMobileKanbanCol(col.id)}
                >
                  <span style={{ color: col.color }}>●</span>
                  {col.label} ({count})
                </button>
              );
            })}
          </div>

          <div className="kanban-board">
            {KANBAN_COLUMNS.map((col) => {
              const colLeads = filteredAndSortedLeads.filter((l) => l.crm_status === col.id);
              const isOver = dragOverColId === col.id;
              const isMobileActive = mobileKanbanCol === col.id;

              return (
                <div
                  key={col.id}
                  className={`kanban-column ${isOver ? 'drag-over' : ''} ${isMobileActive ? 'mobile-active' : ''}`}
                  onDragOver={(e) => handleDragOver(e, col.id)}
                  onDragLeave={(e) => handleDragLeave(e, col.id)}
                  onDrop={(e) => handleDrop(e, col.id)}
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
                          onDragStart={(e) => handleDragStart(e, lead.id)}
                          onDragEnd={handleDragEnd}
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
                              onClick={() => openPitchModal(lead)}
                              title="Gerar Pitch e Abordar no WhatsApp"
                            >
                              <MessageCircle size={13} /> Abordar
                            </button>
                            <button
                              className="btn-card-action"
                              onClick={() => openLeadDetailsModal(lead)}
                              title="Ver Ficha e Anotações"
                            >
                              <Info size={14} />
                            </button>
                            <button
                              className="btn-card-action danger"
                              onClick={(e) => openDeleteLeadModal(lead, e)}
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
                              onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                              title="Mover de etapa no funil"
                            >
                              {KANBAN_COLUMNS.map((c) => (
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
      )}

      {/* VIEW: TABELA COM ORDENAÇÃO E AÇÕES EM LOTE */}
      {activeTab === 'table' && (
        <div className="table-container">
          <div className="table-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 700 }}>Tabela de Leads</span>
              <span className="badge-count">{filteredAndSortedLeads.length}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Mostrando <strong>{filteredAndSortedLeads.length}</strong> de <strong>{leads.length}</strong>
              </span>
              <button
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                onClick={exportCSV}
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
                <span>{selectedLeadIds.size} {selectedLeadIds.size === 1 ? 'lead selecionado' : 'leads selecionados'}</span>
              </div>

              <div className="bulk-actions-right">
                <select
                  className="form-select"
                  style={{ height: '30px', padding: '0 8px', fontSize: '0.78rem' }}
                  onChange={(e) => {
                    if (e.target.value) handleBatchMoveStatus(e.target.value);
                  }}
                  defaultValue=""
                  disabled={batchActionLoading}
                >
                  <option value="" disabled>Mover Selecionados para...</option>
                  {KANBAN_COLUMNS.map((c) => (
                    <option key={c.id} value={c.id}>
                      ➔ {c.label}
                    </option>
                  ))}
                </select>

                <button
                  className="btn-danger"
                  style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                  onClick={openBatchDeleteModal}
                  disabled={batchActionLoading}
                >
                  <Trash2 size={13} /> Excluir ({selectedLeadIds.size})
                </button>

                <button
                  className="btn-secondary"
                  style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                  onClick={() => setSelectedLeadIds(new Set())}
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
                      onClick={toggleSelectAllFiltered}
                      title="Selecionar / Desmarcar todos os visíveis"
                    >
                      {selectedLeadIds.size > 0 && selectedLeadIds.size >= filteredAndSortedLeads.length ? (
                        <CheckSquare size={16} color="var(--accent-primary)" />
                      ) : (
                        <Square size={16} opacity={0.6} />
                      )}
                    </button>
                  </th>
                  <th className="sortable" onClick={() => handleSort('lead_score')}>
                    Score
                    <span className="sort-icon">
                      {sortField === 'lead_score' ? (
                        sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      ) : (
                        <ArrowUpDown size={12} opacity={0.4} />
                      )}
                    </span>
                  </th>
                  <th className="sortable" onClick={() => handleSort('business_name')}>
                    Empresa
                    <span className="sort-icon">
                      {sortField === 'business_name' ? (
                        sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      ) : (
                        <ArrowUpDown size={12} opacity={0.4} />
                      )}
                    </span>
                  </th>
                  <th className="sortable" onClick={() => handleSort('niche')}>
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
                  <th className="sortable" onClick={() => handleSort('rating')}>
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
                {filteredAndSortedLeads.map((lead) => {
                  const isSelected = selectedLeadIds.has(lead.id);

                  return (
                    <tr key={lead.id} className={isSelected ? 'selected' : ''}>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
                          onClick={() => toggleSelectLead(lead.id)}
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
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            className="btn-card-action"
                            style={{ color: '#34d399' }}
                            onClick={() => openPitchModal(lead)}
                            title="Abordar no WhatsApp"
                          >
                            <MessageCircle size={14} />
                          </button>
                          <button
                            className="btn-card-action"
                            onClick={() => openLeadDetailsModal(lead)}
                            title="Ver Detalhes e Notas"
                          >
                            <Info size={14} />
                          </button>
                          <button
                            className="btn-card-action danger"
                            onClick={(e) => openDeleteLeadModal(lead, e)}
                            title="Excluir Lead"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredAndSortedLeads.length === 0 && (
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
      )}

      {/* VIEW: NOVA BUSCA */}
      {activeTab === 'search' && (
        <div className="search-card">
          <div className="search-header">
            <h2>
              <SearchIcon size={20} color="var(--accent-primary)" /> Minerar Empresas no Google
            </h2>
            <p>
              Defina o segmento e localidade. O motor pesquisará no Google Maps, verificará se a empresa
              já existe na base para não duplicar dados, auditará a presença web e calculará o Lead Score preditivo.
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
                <label>Cidade / Região</label>
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
                  <option value={15}>15 leads</option>
                  <option value={20}>20 leads</option>
                  <option value={30}>30 leads</option>
                  <option value={50}>50 leads</option>
                </select>
              </div>

              <button
                id="btn-start-search"
                type="submit"
                className="btn-primary"
                style={{ height: '42px' }}
                disabled={searchLoading}
              >
                {searchLoading ? (
                  <>
                    <span className="pulse-spinner" /> Minerando Google...
                  </>
                ) : (
                  <>
                    <SearchIcon size={16} /> Iniciar Busca
                  </>
                )}
              </button>
            </div>

            {/* Deduplicação Ativa */}
            <div
              style={{
                marginTop: '16px',
                padding: '12px 16px',
                background: 'var(--bg-app)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontSize: '0.84rem', fontWeight: 700 }}>
                <Database size={15} /> Inteligência de Base e Deduplicação Ativa
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                O sistema identifica automaticamente se a empresa já foi cadastrada anteriormente por telefone, domínio ou nome.
                O status no funil e suas anotações comerciais nunca serão perdidos.
              </p>
              <label className="checkbox-label" style={{ marginTop: '2px' }}>
                <input
                  type="checkbox"
                  checked={skipExisting}
                  onChange={(e) => setSkipExisting(e.target.checked)}
                />
                <span>Pular leads já existentes (trazer apenas empresas novas)</span>
              </label>
            </div>

            {/* Opções Avançadas */}
            <div style={{ marginTop: '14px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <span
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{ cursor: 'pointer', textDecoration: 'underline' }}
              >
                {showAdvanced ? '▲ Ocultar Opções Avançadas' : '▼ Opções Avançadas (API Key & Auditoria Profunda)'}
              </span>
            </div>

            {showAdvanced && (
              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group">
                  <label>Google Places API Key (Opcional - se vazio, usará Scraper Playwright gratuito)</label>
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
                  <span>Executar auditoria técnica completa de sites (SSL, mobile responsiveness e latência)</span>
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
                <Clock size={20} color="var(--accent-primary)" /> Histórico de Buscas & Campanhas
              </h2>
              <p>Gerencie os lotes minerados, filtre o CRM por campanha ou repita buscas antigas.</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Total: <strong>{searchHistory.length}</strong> campanhas salvas
              </span>
              <button className="btn-secondary" onClick={() => setActiveTab('search')}>
                <SearchIcon size={14} /> Nova Busca
              </button>
            </div>
          </div>

          <div className="history-grid">
            {searchHistory.map((item) => (
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
                    onClick={(e) => openDeleteSearchModal(item, e)}
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
                    onClick={() => {
                      setSelectedSearchId(item.id);
                      handleSearchFilterChange(item.id);
                      setActiveTab('kanban');
                    }}
                    title="Abrir no Funil Kanban"
                  >
                    <Columns size={13} /> Funil
                  </button>
                  <button
                    className="btn-history-action"
                    onClick={() => {
                      setSelectedSearchId(item.id);
                      handleSearchFilterChange(item.id);
                      setActiveTab('table');
                    }}
                    title="Abrir na Tabela"
                  >
                    <ListFilter size={13} /> Tabela
                  </button>
                  <button
                    className="btn-history-action"
                    onClick={() => rerunSearch(item)}
                    title="Refazer esta busca"
                  >
                    <RotateCcw size={13} /> Refazer
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
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)'
                }}
              >
                <Clock size={36} opacity={0.3} style={{ marginBottom: '10px' }} />
                <h3>Nenhum histórico de busca encontrado</h3>
                <p style={{ marginTop: '4px', fontSize: '0.86rem' }}>Faça sua primeira busca para minerar e organizar leads no funil.</p>
                <button
                  className="btn-primary"
                  style={{ marginTop: '16px' }}
                  onClick={() => setActiveTab('search')}
                >
                  <SearchIcon size={15} /> Fazer Primeira Busca
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: PITCH DE VENDAS */}
      {pitchData && (
        <div className="modal-overlay" onClick={() => setPitchData(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageCircle size={18} color="#10b981" /> Pitch de Vendas Personalizado
              </h3>
              <button className="btn-icon-subtle" onClick={() => setPitchData(null)} title="Fechar (Esc)">
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
              <button className="btn-secondary" onClick={() => copyToClipboard(pitchData.pitch_text)}>
                {copiedPitch ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                {copiedPitch ? 'Copiado!' : 'Copiar Texto'}
              </button>

              {pitchData.phone && (
                <button
                  className="btn-primary"
                  onClick={() => {
                    setInitialWaPhone(pitchData.phone);
                    setPitchData(null);
                    setActiveTab('whatsapp');
                  }}
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
      )}

      {/* MODAL: DETALHES DO LEAD & ANOTAÇÕES (Com Seletor de Etapa no Topo) */}
      {selectedLead && !pitchData && (
        <div className="modal-overlay" onClick={() => setSelectedLead(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3>Ficha do Lead</h3>
                {/* Seletor Rápido de Etapa no Cabeçalho */}
                <select
                  className="form-select"
                  style={{ height: '30px', padding: '0 8px', fontSize: '0.78rem' }}
                  value={selectedLead.crm_status}
                  onChange={(e) => updateLeadStatus(selectedLead.id, e.target.value)}
                >
                  {KANBAN_COLUMNS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <button className="btn-icon-subtle" onClick={() => setSelectedLead(null)} title="Fechar (Esc)">
                <X size={15} />
              </button>
            </div>

            <div className="modal-body">
              <div>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', color: '#fff' }}>
                  {selectedLead.business_name}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                  {selectedLead.niche} • {selectedLead.address || selectedLead.city}
                </p>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
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

              {/* Grid Métricas Rápidas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Lead Score Total</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fb7185', fontFamily: 'var(--font-heading)' }}>
                    {selectedLead.lead_score} / 100 pts
                  </div>
                </div>

                <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Status do Site</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, textTransform: 'capitalize', marginTop: '4px' }}>
                    {selectedLead.website_status}
                  </div>
                </div>
              </div>

              {selectedLead.website && (
                <div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '3px' }}>Website Cadastrado:</div>
                  <a
                    href={selectedLead.website}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#38bdf8', wordBreak: 'break-all', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.86rem' }}
                  >
                    {selectedLead.website} <ExternalLink size={13} />
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
                    onClick={saveLeadNotes}
                    disabled={savingNotes}
                  >
                    <Save size={12} /> {savingNotes ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
                <textarea
                  className="form-input"
                  style={{ width: '100%', minHeight: '75px', resize: 'vertical', fontSize: '0.84rem' }}
                  placeholder="Ex: Falei com o Dr. Carlos. Solicitou orçamento de redesign e contato na próxima terça..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      saveLeadNotes();
                    }
                  }}
                />
              </div>

              {/* Breakdown do Score */}
              {selectedLead.score_breakdown && (
                <div>
                  <h4 style={{ fontSize: '0.84rem', marginBottom: '6px', color: '#fff' }}>
                    Composição do Score (Por que essa pontuação?):
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {Object.entries(selectedLead.score_breakdown).map(([key, val]) => (
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
                onClick={() => {
                  const leadToDelete = selectedLead;
                  setSelectedLead(null);
                  openDeleteLeadModal(leadToDelete);
                }}
              >
                <Trash2 size={14} /> Excluir Lead
              </button>

              <button
                className="btn-primary"
                onClick={() => {
                  const leadToOpen = selectedLead;
                  setSelectedLead(null);
                  openPitchModal(leadToOpen);
                }}
              >
                <MessageCircle size={15} /> Gerar Pitch WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (Lead, Busca ou Lote) */}
      {deleteModal.isOpen && (
        <div className="modal-overlay" onClick={() => setDeleteModal((prev) => ({ ...prev, isOpen: false }))}>
          <div className="modal-content" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f43f5e' }}>
                <AlertTriangle size={18} />
                {deleteModal.type === 'lead'
                  ? 'Excluir Lead'
                  : deleteModal.type === 'batch'
                  ? 'Excluir Leads Selecionados'
                  : 'Excluir Busca'}
              </h3>
              <button className="btn-icon-subtle" onClick={() => setDeleteModal((prev) => ({ ...prev, isOpen: false }))}>
                <X size={15} />
              </button>
            </div>

            <div className="modal-body" style={{ gap: '12px' }}>
              <p style={{ fontSize: '0.9rem', color: '#fff', lineHeight: 1.5 }}>
                Tem certeza que deseja excluir <strong>"{deleteModal.title}"</strong>?
              </p>

              {deleteModal.type === 'lead' ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Esta ação removerá este lead, histórico de auditoria e anotações permanentemente.
                </p>
              ) : deleteModal.type === 'batch' ? (
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
                      checked={deleteModal.deleteLeadsOption}
                      onChange={(e) =>
                        setDeleteModal((prev) => ({ ...prev, deleteLeadsOption: e.target.checked }))
                      }
                    />
                    <span style={{ fontSize: '0.78rem' }}>
                      Remover também os leads desta busca que ainda estão em "Novos Leads" e sem notas
                    </span>
                  </label>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setDeleteModal((prev) => ({ ...prev, isOpen: false }))}>
                Cancelar
              </button>
              <button className="btn-danger" onClick={executeDelete}>
                <Trash2 size={14} /> Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
