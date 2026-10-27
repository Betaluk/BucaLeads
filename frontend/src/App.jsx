import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Building2,
  Columns,
  ListFilter,
  Clock,
  Search as SearchIcon,
  MessageCircle,
  Sparkles,
  RefreshCw,
  Download,
  X
} from 'lucide-react';

import WhatsAppChat from './components/WhatsAppChat';
import StatsRibbon from './components/StatsRibbon';
import FilterBar from './components/FilterBar';
import KanbanView from './components/KanbanView';
import TableView from './components/TableView';
import SearchForm from './components/SearchForm';
import SearchHistory from './components/SearchHistory';
import LeadDetailModal from './components/LeadDetailModal';
import PitchModal from './components/PitchModal';
import DeleteModal from './components/DeleteModal';
import { initTouchDragAndDrop } from './utils/dragDropTouch';

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
  const [initialWaText, setInitialWaText] = useState('');
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
  const [reauditing, setReauditing] = useState(false);
  const retryCountRef = useRef(0);

  // Inicializa suporte a touch para arrasto de cards em mobile/tablets
  useEffect(() => {
    initTouchDragAndDrop();
  }, []);

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

  // Sincronização em tempo real via WebSocket para o Kanban e Contador do WhatsApp
  useEffect(() => {
    const wsUrl = API_BASE.replace(/^http/, 'ws');
    let ws = null;
    let reconnectTimeout = null;

    const connectWs = () => {
      try {
        ws = new WebSocket(`${wsUrl}/api/whatsapp/ws`);

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'new_message') {
              const msg = data.message;
              if (msg.direction === 'incoming') {
                setUnreadTotal((prev) => prev + 1);
                // Se o lead respondeu e estava em 'new' ou 'contacted', avança no Kanban para 'in_conversation'
                setLeads((prevLeads) => {
                  let updated = false;
                  const newLeads = prevLeads.map((l) => {
                    const lDigits = String(l.phone || '').replace(/\D/g, '');
                    const matches =
                      (msg.lead_id && l.id === msg.lead_id) ||
                      (msg.phone && lDigits && (lDigits.endsWith(msg.phone.slice(-8)) || msg.phone.endsWith(lDigits.slice(-8))));
                    if (matches && (l.crm_status === 'new' || l.crm_status === 'contacted')) {
                      updated = true;
                      return { ...l, crm_status: 'in_conversation' };
                    }
                    return l;
                  });
                  if (updated) {
                    fetchStats(selectedSearchId);
                  }
                  return newLeads;
                });
              } else if (msg.direction === 'outgoing') {
                // Se enviou mensagem e estava em 'new', atualiza para 'contacted'
                setLeads((prevLeads) => {
                  let updated = false;
                  const newLeads = prevLeads.map((l) => {
                    const lDigits = String(l.phone || '').replace(/\D/g, '');
                    const matches =
                      (msg.lead_id && l.id === msg.lead_id) ||
                      (msg.phone && lDigits && (lDigits.endsWith(msg.phone.slice(-8)) || msg.phone.endsWith(lDigits.slice(-8))));
                    if (matches && l.crm_status === 'new') {
                      updated = true;
                      return { ...l, crm_status: 'contacted' };
                    }
                    return l;
                  });
                  if (updated) {
                    fetchStats(selectedSearchId);
                  }
                  return newLeads;
                });
              }
            }
          } catch (err) {
            console.error('[App WS] Erro processando evento:', err);
          }
        };

        ws.onclose = () => {
          reconnectTimeout = setTimeout(connectWs, 4000);
        };
      } catch {
        reconnectTimeout = setTimeout(connectWs, 4000);
      }
    };

    connectWs();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [selectedSearchId, fetchStats]);

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

  // Submissão de Nova Busca
  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!niche.trim() || !location.trim()) return;

    setSearchLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche,
          location,
          limit: Number(limit),
          google_api_key: googleApiKey.trim() || null,
          deep_audit: deepAudit,
          skip_existing: skipExisting
        })
      });

      if (res.ok) {
        const data = await res.json();
        showNotification(
          `Busca concluída! ${data.new_count} leads novos minerados (${data.existing_count} já existiam na base).`,
          'success'
        );
        setSelectedSearchId(data.search_id);
        await loadAllData(data.search_id);
        setActiveTab('kanban');
      } else {
        let errDetail = 'Falha ao executar busca de leads.';
        try {
          const err = await res.json();
          errDetail = err.detail || errDetail;
        } catch {
          const text = await res.text();
          if (text) errDetail = `Erro HTTP ${res.status}: ${text.slice(0, 120)}`;
        }
        showNotification(errDetail, 'error');
      }
    } catch (err) {
      console.error('Erro na busca:', err);
      const isNetworkErr = err.name === 'TypeError' || (err.message && err.message.includes('fetch'));
      const msg = isNetworkErr
        ? 'Servidor backend offline ou inacessível na porta 8000. Verifique se o backend está em execução.'
        : `Erro ao executar a busca: ${err.message || 'Falha de conexão'}`;
      showNotification(msg, 'error');
    } finally {
      setSearchLoading(false);
    }
  };

  // Atualizar Status CRM (Kanban)
  const updateLeadStatus = async (leadId, newStatus) => {
    try {
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, crm_status: newStatus } : l))
      );
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead((prev) => (prev ? { ...prev, crm_status: newStatus } : null));
      }

      const res = await fetch(`${API_BASE}/api/leads/${leadId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crm_status: newStatus })
      });

      if (res.ok) {
        await fetchStats(selectedSearchId);
      } else {
        await fetchLeads(selectedSearchId);
      }
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
    }
  };

  // Handlers de Drag and Drop (Kanban)
  const handleDragStart = (e, leadId) => {
    if (e.dataTransfer) {
      e.dataTransfer.setData('text/plain', leadId);
      e.dataTransfer.effectAllowed = 'move';
    }
    setDraggedLeadId(leadId);
  };

  const handleDragEnd = () => {
    setDraggedLeadId(null);
    setDragOverColId(null);
  };

  const handleDragOver = (e, colId) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
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
    const leadId = e.dataTransfer ? (e.dataTransfer.getData('text/plain') || draggedLeadId) : draggedLeadId;
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

  // Reauditar Lead Individualmente
  const handleReauditLead = async (leadId) => {
    try {
      setReauditing(true);
      const res = await fetch(`${API_BASE}/api/leads/${leadId}/re-audit`, { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
        setSelectedLead(updated);
        await fetchStats(selectedSearchId);
        showNotification(
          `Auditoria atualizada! Status: "${updated.website_status}". Score: ${updated.lead_score} pts`,
          'success'
        );
      } else {
        showNotification('Erro ao reauditar lead.', 'error');
      }
    } catch (err) {
      console.error('Erro ao reauditar lead:', err);
      showNotification('Falha de conexão ao reauditar lead.', 'error');
    } finally {
      setReauditing(false);
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

  // Ações em Lote: Mover Status (Atômico no backend)
  const handleBatchMoveStatus = async (newStatus) => {
    if (selectedLeadIds.size === 0 || !newStatus) return;
    setBatchActionLoading(true);
    try {
      const ids = Array.from(selectedLeadIds);
      const res = await fetch(`${API_BASE}/api/leads/batch-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_ids: ids, crm_status: newStatus })
      });

      if (res.ok) {
        setLeads((prev) =>
          prev.map((l) => (selectedLeadIds.has(l.id) ? { ...l, crm_status: newStatus } : l))
        );
        await fetchStats(selectedSearchId);
        showNotification(
          `${ids.length} leads movidos para "${KANBAN_COLUMNS.find((c) => c.id === newStatus)?.label}".`,
          'success'
        );
        setSelectedLeadIds(new Set());
      } else {
        showNotification('Erro ao mover leads em lote.', 'error');
      }
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
              {unreadTotal > 0 && <span className="tab-badge">{unreadTotal}</span>}
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
      <StatsRibbon
        stats={stats}
        totalLeads={leads.length}
        filteredCount={filteredAndSortedLeads.length}
        activeFiltersCount={activeFiltersCount}
        filterTier={filterTier}
        filterSite={filterSite}
        onResetFilters={() => {
          setFilterTier('all');
          setFilterSite('all');
        }}
        onToggleHot={() => setFilterTier((prev) => (prev === 'hot' ? 'all' : 'hot'))}
        onToggleNoSite={() => setFilterSite((prev) => (prev === 'none' ? 'all' : 'none'))}
        onOpenWonLeads={() => {
          setActiveTab('kanban');
          setMobileKanbanCol('won');
        }}
      />

      {/* BARRA DE FILTROS (Compartilhada entre Kanban e Tabela) */}
      {(activeTab === 'kanban' || activeTab === 'table') && (
        <FilterBar
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filterTier={filterTier}
          setFilterTier={setFilterTier}
          filterSite={filterSite}
          setFilterSite={setFilterSite}
          filterPhone={filterPhone}
          setFilterPhone={setFilterPhone}
          filterCity={filterCity}
          setFilterCity={setFilterCity}
          filterSource={filterSource}
          setFilterSource={setFilterSource}
          filterNotes={filterNotes}
          setFilterNotes={setFilterNotes}
          filterRating={filterRating}
          setFilterRating={setFilterRating}
          filterActivity={filterActivity}
          setFilterActivity={setFilterActivity}
          showExtraFilters={showExtraFilters}
          setShowExtraFilters={setShowExtraFilters}
          availableCities={availableCities}
          activeFiltersCount={activeFiltersCount}
          filteredCount={filteredAndSortedLeads.length}
          totalCount={leads.length}
          onClearAll={clearAllFilters}
        />
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
            initialMessageText={initialWaText}
            onClearInitialMessage={() => setInitialWaText('')}
            onUnreadCountChange={(count) => setUnreadTotal(count)}
          />
        </ErrorBoundary>
      )}

      {/* VIEW: KANBAN CRM COM DRAG & DROP */}
      {activeTab === 'kanban' && (
        <KanbanView
          leads={filteredAndSortedLeads}
          columns={KANBAN_COLUMNS}
          mobileCol={mobileKanbanCol}
          setMobileCol={setMobileKanbanCol}
          draggedLeadId={draggedLeadId}
          dragOverColId={dragOverColId}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onOpenPitch={openPitchModal}
          onOpenDetails={openLeadDetailsModal}
          onDeleteLead={openDeleteLeadModal}
          onUpdateStatus={updateLeadStatus}
        />
      )}

      {/* VIEW: TABELA COM ORDENAÇÃO E AÇÕES EM LOTE */}
      {activeTab === 'table' && (
        <TableView
          leads={filteredAndSortedLeads}
          totalCount={leads.length}
          columns={KANBAN_COLUMNS}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
          selectedLeadIds={selectedLeadIds}
          onToggleSelectLead={toggleSelectLead}
          onToggleSelectAll={toggleSelectAllFiltered}
          batchActionLoading={batchActionLoading}
          onBatchMoveStatus={handleBatchMoveStatus}
          onOpenBatchDeleteModal={openBatchDeleteModal}
          onClearSelection={() => setSelectedLeadIds(new Set())}
          onOpenPitch={openPitchModal}
          onOpenDetails={openLeadDetailsModal}
          onDeleteLead={openDeleteLeadModal}
          onUpdateStatus={updateLeadStatus}
          onExportCSV={exportCSV}
        />
      )}

      {/* VIEW: NOVA BUSCA */}
      {activeTab === 'search' && (
        <SearchForm
          niche={niche}
          setNiche={setNiche}
          location={location}
          setLocation={setLocation}
          limit={limit}
          setLimit={setLimit}
          googleApiKey={googleApiKey}
          setGoogleApiKey={setGoogleApiKey}
          deepAudit={deepAudit}
          setDeepAudit={setDeepAudit}
          skipExisting={skipExisting}
          setSkipExisting={setSkipExisting}
          showAdvanced={showAdvanced}
          setShowAdvanced={setShowAdvanced}
          onSubmit={handleSearchSubmit}
          loading={searchLoading}
        />
      )}

      {/* VIEW: HISTÓRICO DE BUSCAS */}
      {activeTab === 'history' && (
        <SearchHistory
          history={searchHistory}
          onOpenInKanban={(id) => {
            setSelectedSearchId(id);
            handleSearchFilterChange(id);
            setActiveTab('kanban');
          }}
          onOpenInTable={(id) => {
            setSelectedSearchId(id);
            handleSearchFilterChange(id);
            setActiveTab('table');
          }}
          onRerun={rerunSearch}
          onDeleteSearch={openDeleteSearchModal}
          onNewSearch={() => setActiveTab('search')}
        />
      )}

      {/* MODAL: PITCH DE VENDAS */}
      <PitchModal
        pitchData={pitchData}
        copiedPitch={copiedPitch}
        onCopyPitch={copyToClipboard}
        onClose={() => setPitchData(null)}
        onOpenWhatsApp={(phone, text) => {
          setInitialWaPhone(phone);
          setInitialWaText(text || '');
          setPitchData(null);
          setActiveTab('whatsapp');
        }}
      />

      {/* MODAL: DETALHES DO LEAD & ANOTAÇÕES */}
      <LeadDetailModal
        lead={selectedLead && !pitchData ? selectedLead : null}
        columns={KANBAN_COLUMNS}
        notes={editNotes}
        setNotes={setEditNotes}
        savingNotes={savingNotes}
        onSaveNotes={saveLeadNotes}
        onUpdateStatus={updateLeadStatus}
        onClose={() => setSelectedLead(null)}
        onOpenPitch={(lead) => {
          setSelectedLead(null);
          openPitchModal(lead);
        }}
        onDeleteLead={(lead) => {
          setSelectedLead(null);
          openDeleteLeadModal(lead);
        }}
        onReauditLead={handleReauditLead}
        reauditing={reauditing}
      />

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      <DeleteModal
        isOpen={deleteModal.isOpen}
        type={deleteModal.type}
        title={deleteModal.title}
        deleteLeadsOption={deleteModal.deleteLeadsOption}
        onToggleDeleteLeadsOption={(checked) =>
          setDeleteModal((prev) => ({ ...prev, deleteLeadsOption: checked }))
        }
        onClose={() => setDeleteModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={executeDelete}
      />
    </div>
  );
}
