import React from 'react';
import { Search as SearchIcon, Database } from 'lucide-react';

export default function SearchForm({
  niche,
  setNiche,
  location,
  setLocation,
  limit,
  setLimit,
  googleApiKey,
  setGoogleApiKey,
  deepAudit,
  setDeepAudit,
  skipExisting,
  setSkipExisting,
  showAdvanced,
  setShowAdvanced,
  onSubmit,
  loading
}) {
  return (
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

      <form onSubmit={onSubmit}>
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
              onChange={(e) => setLimit(Number(e.target.value))}
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
            disabled={loading}
          >
            {loading ? (
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
  );
}
