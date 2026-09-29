# 🚀 BucaLeads - Prospecção Inteligente & Auditoria de Empresas no Google

O **BucaLeads** é uma plataforma completa desenvolvida para desenvolvedores e agências prospectarem clientes locais com alta probabilidade de conversão para venda de sites, modernização web e sistemas sob medida.

A ferramenta minera empresas no Google Maps, inspeciona a presença digital de cada uma (se possui site, se é responsivo para celular, certificado SSL HTTPS ou se usa rede social no lugar de site), calcula uma nota de qualificação preditiva (**Lead Scoring de 0 a 100**) e organiza os contatos em um **Funil Kanban (Mini-CRM)** com **gerador de pitch para WhatsApp integrado**.

---

## 🌟 Principais Recursos

1. **Coleta Híbrida Inteligente:**
   * Utiliza a **API Oficial do Google Places** se configurada com chave.
   * Alterna de forma 100% gratuita para o **Scraper Playwright Local** com emulação de navegação humana (sem custos de API).
   * Identificação visual da origem do lead: `[API]` ou `[Scraper]`.

2. **Inspetor Automático de Sites (*Site Inspector*):**
   * Detecta se o link cadastrado no Google é uma rede social (`Instagram`, `Facebook`, `Linktree`).
   * Testa certificado de segurança SSL (`HTTPS`).
   * Mede a velocidade de carregamento e verifica suporte a dispositivos móveis (*viewport*).

3. **Matriz de Pontuação (*Lead Score 0 a 100*):**
   * **Situação do Site (até 40 pts):** Sem site (+40), rede social (+35), sem HTTPS (+30), lento/mobile ruim (+20).
   * **Volume de Avaliações (até 25 pts):** Mais de 200 avaliações (+25), 50 a 200 avaliações (+15).
   * **Qualidade / Estrelas (até 15 pts):** Nota >= 4.5 (+15), 4.0 a 4.4 (+10).
   * **Canal Direto (até 10 pts):** Celular / WhatsApp identificado (+10), fixo (+3).
   * **Atividade Recente (até 10 pts):** Gerência responde avaliações (+10).
   * Classificação em: 🔥 **Quente (85+)**, ⚡ **Promissor (60-84)** e ❄️ **Frio (<60)**.

4. **Mini-CRM com Funil Kanban Interativo:**
   * Etapas: *Novos Leads* ➔ *Contatados* ➔ *Em Conversa* ➔ *Proposta Enviada* ➔ *Fechados / Ganhos*.
   * Tabela dinâmica com filtros rápidos e busca textual.
   * Exportação completa para **Excel / CSV** com 1 clique.

5. **Gerador de Abordagem / Pitch para WhatsApp:**
   * Gera automaticamente um pitch comercial adaptado à fraqueza exata da empresa (sem site, site não seguro, instagram no lugar de site, etc.).
   * Botão direto que abre o **WhatsApp Web** com a mensagem pré-formatada.

---

## 🛠️ Como Executar Localmente

### Opção 1: Inicialização em 1 Clique (Recomendado no Windows)

Basta dar um duplo-clique no arquivo:
```cmd
start.bat
```
*(Ou executar `.\start.ps1` no PowerShell)*

O script iniciará o servidor FastAPI na porta 8000, o frontend Vite na porta 5173 e abrirá automaticamente seu navegador em `http://localhost:5173`.

---

### Opção 2: Inicialização Manual

#### 1. Iniciar o Backend (FastAPI):
```bash
cd backend
# O ambiente virtual já está configurado em backend/venv
.\venv\Scripts\activate
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
* API Docs interativa: `http://localhost:8000/docs`

#### 2. Iniciar o Frontend (React / Vite):
```bash
cd frontend
npm run dev
```
* Acesse no navegador: `http://localhost:5173`

---

## ☁️ Publicação no Cloudflare Pages & GitHub

O frontend do **BucaLeads** foi construído de forma totalmente desacoplada e gera um pacote estático pronto para o **Cloudflare Pages**:

1. Suba o código para o seu repositório no **GitHub**.
2. No painel da **Cloudflare**:
   * Vá em **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
   * Selecione o repositório do BucaLeads.
   * Defina as configurações de build:
     * **Root directory:** `frontend`
     * **Build command:** `npm run build`
     * **Build output directory:** `dist`
   * Em **Environment variables**, adicione:
     * `VITE_API_URL`: URL da sua API (caso hospede o backend em VPS ou utilize um Cloudflare Tunnel gratuito para apontar para sua máquina local).
3. Clique em **Save and Deploy**. O frontend estará publicado globalmente com CDN de alta performance e certificado SSL gratuito.

---

## 📁 Estrutura do Projeto

```
BucaLeads/
├── backend/
│   ├── app/
│   │   ├── collector/      # Scraper Playwright + Google Places API + Site Inspector
│   │   ├── routers/        # Endpoints REST (search, leads, export)
│   │   ├── services/       # Lead Scoring (0-100) e Gerador de Pitch WhatsApp
│   │   ├── database.py     # Configuração SQLite
│   │   ├── models.py       # Modelos SQLAlchemy
│   │   ├── schemas.py      # Schemas Pydantic
│   │   └── main.py         # App FastAPI com CORS
│   ├── requirements.txt    # Dependências Python
│   ├── leads.db            # Banco SQLite local
│   └── venv/               # Ambiente virtual Python
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # Dashboard, Kanban, Tabela, Modais de Pitch e Auditoria
│   │   ├── index.css       # Design System Glassmorphism moderno
│   │   └── main.jsx        # Ponto de entrada React
│   ├── index.html          # HTML com Google Fonts
│   ├── package.json        # Dependências React / Lucide
│   └── .env                # Configuração da URL da API
├── start.bat               # Inicializador de 1 clique (Windows)
├── start.ps1               # Inicializador PowerShell
├── .gitignore              # Proteção de credenciais e venv
└── README.md               # Documentação da solução
```
