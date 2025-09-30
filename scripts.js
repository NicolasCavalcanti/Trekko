/*
 * Trekko Inspired Website JavaScript
 *
 * This file centralises the interactive behaviour for all pages in
 * the static Trekko site. It detects which page is currently loaded
 * based on the presence of specific elements and executes the
 * appropriate logic. Features include:
 *
 * - Responsive mobile menu toggle
 * - Login/register modal handling
 * - Passing search filters from the homepage to the trilhas page
 * - Filtering and rendering of sample trail and guide data
 * - Simple modal implementation for trail details and guide contact
 * - Animated counters on the about page using the Intersection Observer
 */

// Utility: mapping state codes to names for display purposes
const STATE_NAMES = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo',
  GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba',
  PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia',
  RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins'
};

// Track session state for reuse across components that need to react
// when the authentication status changes (e.g. navigation + page CTAs).
let currentSession = null;
let navigationSessionPromise = null;
let userMenuOutsideClickBound = false;

// Utility: slugify a string (remove accents, spaces and special characters, replace with hyphens).
function slugify(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[^\p{L}\p{N}\s-]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Compute slug properties for trails and guides loaded from the global datasets.
 * The slug helps build SEO-friendly URLs. It uses state/city/name for trails
 * and name plus id for guides. Only computed once per page load.
 */
function computeSlugs() {
  // Trails slug: first state abbreviation + city + trail name
  if (window.trailsData && Array.isArray(window.trailsData)) {
    window.trailsData.forEach(t => {
      if (!t.slug) {
        const firstState = (t.state || '').split('/')[0].toLowerCase();
        const citySlug = slugify(t.city || '');
        const nameSlug = slugify(t.name || '');
        t.slug = `${firstState}${citySlug ? '-' + citySlug : ''}-${nameSlug}`;
      }
    });
  }
  // Guides slug: name + last four characters of id to ensure uniqueness
  if (window.guidesData && Array.isArray(window.guidesData)) {
    window.guidesData.forEach(g => {
      if (!g.slug) {
        const nameSlug = slugify(g.name || g.nome_completo || '');
        const idPart = String(g.id || '').slice(-4);
        g.slug = `${nameSlug}${idPart ? '-' + idPart : ''}`;
      }
    });
  }

/**
 * Normalises a single entry from the CADASTUR CSV into a guide object
 * with standard property names. This allows us to display guide profiles
 * consistently using either the internal guides dataset or the CADASTUR
 * dataset. Note: This does not attach additional properties such as
 * ratings or categories unless present in the raw entry.
 * @param {Object} entry Raw CADASTUR entry
 * @returns {Object} Normalised guide object
 */
function normalizeCadasturGuide(entry) {
  const guide = {};
  // Name
  guide.name = entry.nome || entry.nome_completo || entry.name || '';
  // Cadastur number
  guide.cadastur = entry.numero_cadastur || entry.numero || entry.numero_cad || entry['nº cadastur'] || entry['número cadastur'] || '';
  // UF/state
  guide.uf = entry.uf || entry.estado || entry.state || '';
  // City/municipality
  guide.city = entry.municipio || entry.município || entry.cidade || entry.city || '';
  // Languages
  if (entry.idiomas) {
    if (Array.isArray(entry.idiomas)) {
      guide.languages = entry.idiomas;
    } else {
      guide.languages = String(entry.idiomas)
        .split(/\||,|;/)
        .map(s => s.trim())
        .filter(Boolean);
    }
  } else {
    guide.languages = [];
  }
  // Contacts: parse key:value pairs separated by | or comma
  guide.contacts = [];
  if (entry.contatos) {
    const parts = String(entry.contatos).split(/\||,/);
    parts.forEach(part => {
      const [type, value] = part.split(/:|：/);
      if (value) {
        guide.contacts.push({ type: type.trim(), value: value.trim() });
      }
    });
  }
  // Photo
  guide.photo = entry.foto || entry.foto_url || entry.image || entry.foto_perfil || '';
  // Also assign image to photo so that our display logic can use a single
  // field regardless of the source dataset. This helps avoid cases where
  // the guide profile page checks guide.image and falls back to a generic
  // placeholder even though a photo exists in the CADASTUR data.
  guide.image = guide.photo;
  // Bio/description
  guide.bio = entry.bio || entry.descricao || entry.descrição || entry.description || '';
  // Categories and segments if present (may be arrays or strings)
  if (entry.categorias || entry.category) {
    const cat = entry.categorias || entry.category;
    guide.categorias = Array.isArray(cat) ? cat : String(cat).split(/\||,|;/).map(s => s.trim()).filter(Boolean);
  }
  if (entry.segmentos || entry.segment) {
    const seg = entry.segmentos || entry.segment;
    guide.segmentos = Array.isArray(seg) ? seg : String(seg).split(/\||,|;/).map(s => s.trim()).filter(Boolean);
  }
  // Driver flag
  if (typeof entry.guia_motorista !== 'undefined') {
    guide.guia_motorista = Boolean(entry.guia_motorista);
  }
  // Rating if available (rare in raw CSV)
  if (typeof entry.rating !== 'undefined') {
    guide.rating = entry.rating;
  }
  // Precomputed slug
  guide.slug = entry.slug;
  // Use cadastur number or slug as id fallback
  guide.id = entry.id || guide.cadastur || guide.slug;
  return guide;
}
  // CADASTUR data slug: use guide name + last 4 digits of Cadastur number
  if (window.cadasturData && Array.isArray(window.cadasturData)) {
    window.cadasturData.forEach(entry => {
      if (!entry.slug) {
        const nameSlug = slugify(entry.nome || entry.nome_completo || entry.name || '');
        // find cadastur number if present
        const cad = entry.numero_cadastur || entry.numero || entry.numero_cad || entry['nº cadastur'] || entry['número cadastur'] || '';
        const idPart = cad ? String(cad).slice(-4) : '';
        entry.slug = `${nameSlug}${idPart ? '-' + idPart : ''}`;
      }
    });
  }
}

function normaliseApiBase(base) {
  if (typeof base !== 'string') return ''
  const trimmed = base.trim()
  if (!trimmed) return ''
  return trimmed.replace(/\/+$/, '')
}

const trekkoApiConfig = (() => {
  let cachedBase = ''

  if (typeof window !== 'undefined') {
    const explicitBase = normaliseApiBase(window.__TREKKO_API_BASE__)
    if (explicitBase) {
      cachedBase = explicitBase
    } else if (window.location) {
      const { hostname, origin, protocol } = window.location
      if (hostname && hostname.endsWith('github.io')) {
        cachedBase = 'https://trekko.vercel.app'
      } else if (protocol === 'file:') {
        cachedBase = 'https://trekko.vercel.app'
      } else {
        cachedBase = ''
        if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
          cachedBase = origin
        }
      }
    }
  }

  function resolve(path = '') {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    if (!cachedBase) {
      return normalizedPath
    }
    if (cachedBase.endsWith('/api') && normalizedPath.startsWith('/api')) {
      const withoutPrefix = normalizedPath.slice(4) || '/'
      return `${cachedBase}${withoutPrefix}`
    }
    return `${cachedBase}${normalizedPath}`
  }

  return {
    resolve
  }
})()

function resolveApiUrl(path = '') {
  return trekkoApiConfig.resolve(path)
}

if (typeof window !== 'undefined') {
  window.trekkoResolveApiUrl = resolveApiUrl
}

const expeditionService = (() => {
  const cache = new Map()

  function buildKey(prefix, params) {
    return `${prefix}:${JSON.stringify(params || {})}`
  }

  function buildQueryString(params = {}) {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) return
      const stringValue = String(value).trim()
      if (stringValue !== '') {
        query.set(key, stringValue)
      }
    })
    const queryString = query.toString()
    return queryString ? `?${queryString}` : ''
  }

  async function list(params = {}) {
    const cacheKey = buildKey('list', params)
    if (!cache.has(cacheKey)) {
      cache.set(
        cacheKey,
        (async () => {
          const baseUrl = resolveApiUrl('/api/expeditions')
          const response = await fetch(`${baseUrl}${buildQueryString(params)}`, {
            headers: { Accept: 'application/json' }
          })
          let data = null
          try {
            data = await response.json()
          } catch (err) {
            data = null
          }
          if (!response.ok) {
            const message = data?.message || 'Não foi possível carregar as expedições.'
            throw new Error(message)
          }
          return data
        })()
      )
    }
    try {
      return await cache.get(cacheKey)
    } catch (error) {
      cache.delete(cacheKey)
      throw error
    }
  }

  async function getById(id) {
    if (!id) {
      throw new Error('Identificador da expedição é obrigatório.')
    }
    const cacheKey = buildKey('detail', { id })
    if (!cache.has(cacheKey)) {
      cache.set(
        cacheKey,
        (async () => {
          const baseUrl = resolveApiUrl(`/api/expeditions/${encodeURIComponent(id)}`)
          const response = await fetch(baseUrl, {
            headers: { Accept: 'application/json' }
          })
          let data = null
          try {
            data = await response.json()
          } catch (err) {
            data = null
          }
          if (!response.ok) {
            const message = data?.message || 'Expedição não encontrada.'
            throw new Error(message)
          }
          return data
        })()
      )
    }
    try {
      return await cache.get(cacheKey)
    } catch (error) {
      cache.delete(cacheKey)
      throw error
    }
  }

  function clearCache() {
    cache.clear()
  }

  return {
    list,
    getById,
    clearCache
  }
})()

function formatDateDisplay(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleDateString('pt-BR')
}

/**
 * Setup the top navigation bar according to the current user session.
 * Shows login/register buttons for anonymous users or a user dropdown for
 * authenticated users. Also binds logout behaviour.
 */
async function setupNavigation() {
  const navLoginButtons = document.querySelector('.auth-buttons');
  const userNav = document.getElementById('userNav');
  const guideCTA = document.getElementById('guideCTA');
  let session = null;
  try {
    session = await Auth.getSession();
    currentSession = session;
    if (!session) {
      // Anonymous visitor
      if (navLoginButtons) navLoginButtons.style.display = 'flex';
      if (userNav) userNav.style.display = 'none';
      if (guideCTA) guideCTA.style.display = 'block';
      updateGuideExpeditionActionsForUser(null);
    } else {
      // Logged in user
      if (navLoginButtons) navLoginButtons.style.display = 'none';
      if (userNav) {
        userNav.style.display = 'block';
        // Hide or show CTA for guides: show for non-guide roles
        if (guideCTA) guideCTA.style.display = (session.user.type === 'guide') ? 'none' : 'block';
        const name = session.user.name || '';
        const firstName = name.split(' ')[0];
        const nameSpan = userNav.querySelector('.user-name');
        if (nameSpan) nameSpan.textContent = firstName;
        const menu = userNav.querySelector('.user-menu');
        if (menu) {
          let html = `<a href="conta.html">Minha Conta</a>`;
          html += `<a href="conta.html#mensagens">Mensagens</a>`;
          html += `<a href="conta.html#reservas">Minhas Reservas</a>`;
          if (session.user.type === 'guide') {
            html += `<a href="guia_painel.html">Painel do Guia</a>`;
          }
          if (session.user.type === 'admin') {
            html += `<a href="admin.html">Admin</a>`;
          }
          html += `<a href="#" id="logoutLink">Sair</a>`;
          menu.innerHTML = html;
        }
        // Bind logout
        const logoutLink = userNav.querySelector('#logoutLink');
        if (logoutLink) {
          logoutLink.addEventListener('click', (ev) => {
            ev.preventDefault();
            Auth.logout();
            window.location.reload();
          });
        }
        // Toggle menu on click
        const userButton = userNav.querySelector('.user-button');
        const menuBox = userNav.querySelector('.user-menu');
        if (userButton && menuBox && userNav && !userNav.dataset.menuBound) {
          userButton.addEventListener('click', (e) => {
            e.stopPropagation();
            menuBox.classList.toggle('open');
          });
          userNav.dataset.menuBound = 'true';
        }
        if (menuBox && userNav && !userMenuOutsideClickBound) {
          document.addEventListener('click', (e) => {
            if (!userNav.contains(e.target)) {
              menuBox.classList.remove('open');
            }
          });
          userMenuOutsideClickBound = true;
        }
      }
      updateGuideExpeditionActionsForUser(session.user);
    }
  } catch (err) {
    console.error('Falha ao configurar navegação:', err);
    currentSession = null;
    updateGuideExpeditionActionsForUser(null);
  }
  return session;
}

function updateGuideExpeditionActionsForUser(user) {
  const guideActions = document.getElementById('guideExpeditionActions');
  if (!guideActions) return;
  if (user && user.type === 'guide') {
    guideActions.classList.add('is-visible');
  } else {
    guideActions.classList.remove('is-visible');
  }
}

/**
 * Configura a barra de busca global com autosuggest.
 * Procura por trilhas, guias, estados e cidades. Ao selecionar
 * um item, redireciona para a página correspondente com filtros.
 */
function setupGlobalSearch() {
  const input = document.getElementById('globalSearchInput');
  const suggestionsBox = document.getElementById('searchSuggestions');
  if (!input || !suggestionsBox) return;
  // Construir o conjunto de sugestões combinando trilhas, guias, estados e cidades
  let suggestionList = [];
  // Trails
  if (Array.isArray(window.trailsData)) {
    window.trailsData.forEach(t => suggestionList.push({ type: 'trail', id: t.id, name: t.name }));
  }
  // Guides
  if (Array.isArray(window.guidesData)) {
    window.guidesData.forEach(g => suggestionList.push({ type: 'guide', id: g.id, name: g.name }));
  }
  // States
  const stateSet = new Set();
  if (Array.isArray(window.trailsData)) {
    window.trailsData.forEach(t => {
      t.state.split('/').forEach(s => stateSet.add(s.trim()));
    });
  }
  if (Array.isArray(window.guidesData)) {
    window.guidesData.forEach(g => {
      if (g.uf) stateSet.add(g.uf);
    });
  }
  stateSet.forEach(s => suggestionList.push({ type: 'state', id: s, name: STATE_NAMES[s] || s }));
  // Cities
  const citySet = new Set();
  if (Array.isArray(window.trailsData)) {
    window.trailsData.forEach(t => citySet.add(t.city));
  }
  if (Array.isArray(window.guidesData)) {
    window.guidesData.forEach(g => citySet.add(g.municipio));
  }
  citySet.forEach(c => suggestionList.push({ type: 'city', id: c, name: c }));
  // Input event
  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    suggestionsBox.innerHTML = '';
    if (!query) {
      suggestionsBox.classList.remove('open');
      return;
    }
    const matches = suggestionList.filter(item => item.name.toLowerCase().includes(query)).slice(0, 5);
    if (matches.length === 0) {
      suggestionsBox.classList.remove('open');
      return;
    }
    matches.forEach(item => {
      const div = document.createElement('div');
      div.className = 'suggestion-item';
      const icon = document.createElement('i');
      if (item.type === 'trail') icon.className = 'fas fa-mountain';
      else if (item.type === 'guide') icon.className = 'fas fa-user';
      else if (item.type === 'state' || item.type === 'city') icon.className = 'fas fa-map-marker-alt';
      div.appendChild(icon);
      const span = document.createElement('span');
      span.textContent = item.name;
      div.appendChild(span);
      div.addEventListener('click', () => handleSuggestionSelect(item));
      suggestionsBox.appendChild(div);
    });
    suggestionsBox.classList.add('open');
  });
  // Click outside to close
  document.addEventListener('click', (e) => {
    if (!suggestionsBox.contains(e.target) && e.target !== input) {
      suggestionsBox.classList.remove('open');
    }
  });
  // Enter key triggers generic search
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = input.value.trim();
      if (q) {
        try {
          sessionStorage.setItem('trailFilters', JSON.stringify({ q }));
          sessionStorage.setItem('guideFilters', JSON.stringify({ q }));
        } catch (err) {
          console.warn('Falha ao salvar filtros de busca global', err);
        }
        window.location.href = 'trilhas.html';
      }
    }
  });
  // Handler for suggestion selection
  function handleSuggestionSelect(item) {
    if (item.type === 'trail') {
      // Go directly to trail page or filtered list
      sessionStorage.setItem('trailFilters', JSON.stringify({ q: item.name }));
      window.location.href = 'trilhas.html';
    } else if (item.type === 'guide') {
      sessionStorage.setItem('guideFilters', JSON.stringify({ q: item.name }));
      window.location.href = 'guias.html';
    } else if (item.type === 'state') {
      sessionStorage.setItem('trailFilters', JSON.stringify({ uf: item.id }));
      sessionStorage.setItem('guideFilters', JSON.stringify({ uf: item.id }));
      window.location.href = 'trilhas.html';
    } else if (item.type === 'city') {
      sessionStorage.setItem('trailFilters', JSON.stringify({ q: item.name }));
      sessionStorage.setItem('guideFilters', JSON.stringify({ q: item.name }));
      window.location.href = 'trilhas.html';
    }
    suggestionsBox.classList.remove('open');
  }
}

/**
 * Inicializa a página inicial (home) adicionando carrossel de estados,
 * seções de trilhas e guias em destaque e expedições próximas.
 */
async function initHomePage() {
  // States carousel container
  const statesSection = document.querySelector('.states-carousel');
  if (statesSection && Array.isArray(window.trailsData)) {
    const carousel = document.createElement('div');
    carousel.className = 'carousel-container';
    // Calcular número de trilhas por UF
    const counts = {};
    window.trailsData.forEach(t => {
      t.state.split('/').forEach(s => {
        counts[s] = (counts[s] || 0) + 1;
      });
    });
    Object.keys(counts).forEach(uf => {
      const card = document.createElement('div');
      card.className = 'state-card';
      // No images specifically for estados: use first trail image or generic hero
      let imgSrc = 'images/hero.jpg';
      const trailForState = window.trailsData.find(t => t.state.includes(uf));
      if (trailForState) imgSrc = trailForState.image;
      card.innerHTML = `
        <img src="${imgSrc}" alt="${STATE_NAMES[uf] || uf}">
        <div class="state-content">
          <div class="state-name">${STATE_NAMES[uf] || uf}</div>
          <div class="state-count">${counts[uf]} trilha${counts[uf] > 1 ? 's' : ''}</div>
        </div>
      `;
      card.addEventListener('click', () => {
        // Ao clicar, filtrar por estado
        sessionStorage.setItem('trailFilters', JSON.stringify({ uf }));
        window.location.href = 'trilhas.html';
      });
      carousel.appendChild(card);
    });
    statesSection.appendChild(carousel);
  }
  // Trending trails and guides
  const trendingSection = document.querySelector('.trending-section .trending-grid');
  if (trendingSection && Array.isArray(window.trailsData) && Array.isArray(window.guidesData)) {
    // Top 3 trails by rating
    // Top 3 trails by rating
    const topTrails = [...window.trailsData]
      .filter(t => typeof t.rating === 'number')
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3);
    topTrails.forEach(trail => {
      // ensure slug exists
      if (!trail.slug) {
        const firstState = (trail.state || '').split('/')[0].toLowerCase();
        const citySlug = slugify(trail.city || '');
        const nameSlug = slugify(trail.name || '');
        trail.slug = `${firstState}${citySlug ? '-' + citySlug : ''}-${nameSlug}`;
      }
      const card = document.createElement('div');
      card.className = 'trending-card';
      card.innerHTML = `
        <img src="${trail.image}" alt="${trail.name}">
        <div class="trending-content">
          <div class="trending-title">${trail.name}</div>
          <div class="trending-meta">${trail.state} · ${trail.distance} km · ${trail.difficulty}</div>
          <div class="trending-rating"><i class="fas fa-star"></i> ${trail.rating}</div>
          <button class="btn btn-secondary" data-slug="${trail.slug}" data-type="trail">Ver Detalhes</button>
        </div>
      `;
      trendingSection.appendChild(card);
    });
    // Top 2 guides by rating
    const sortedGuides = [...window.guidesData]
      .filter(g => typeof g.rating === 'number')
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 2);
    sortedGuides.forEach(guide => {
      // ensure slug exists
      if (!guide.slug) {
        const nameSlug = slugify(guide.name || guide.nome_completo || '');
        const idPart = String(guide.id || '').slice(-4);
        guide.slug = `${nameSlug}${idPart ? '-' + idPart : ''}`;
      }
      const card = document.createElement('div');
      card.className = 'trending-card';
      card.innerHTML = `
        <img src="${guide.image || 'images/guia1.png'}" alt="${guide.name}">
        <div class="trending-content">
          <div class="trending-title">${guide.name}</div>
          <div class="trending-meta">${guide.uf} · ${guide.municipio}</div>
          <div class="trending-rating"><i class="fas fa-star"></i> ${guide.rating}</div>
          <button class="btn btn-secondary" data-slug="${guide.slug}" data-type="guide">Ver Perfil</button>
        </div>
      `;
      trendingSection.appendChild(card);
    });
    trendingSection.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-slug]');
      if (btn) {
        const slug = btn.getAttribute('data-slug');
        const type = btn.getAttribute('data-type');
        if (type === 'trail') {
          window.location.href = `trilha.html?slug=${encodeURIComponent(slug)}`;
        } else if (type === 'guide') {
          window.location.href = `guia.html?slug=${encodeURIComponent(slug)}`;
        }
      }
    });
  }
  // Upcoming expeditions
  const expSection = document.querySelector('.expeditions-section .expedition-grid');
  if (expSection) {
    expSection.innerHTML = '<p class="expedition-loading">Carregando expedições...</p>';
    try {
      const result = await expeditionService.list({ status: 'active', pageSize: 3 });
      const upcoming = Array.isArray(result?.data) ? result.data.slice(0, 3) : [];
      expSection.innerHTML = '';
      if (upcoming.length === 0) {
        const empty = document.createElement('p');
        empty.textContent = 'Nenhuma expedição ativa no momento.';
        empty.className = 'expedition-empty';
        expSection.appendChild(empty);
      } else {
        upcoming.forEach(exp => {
          const card = document.createElement('div');
          card.className = 'expedition-card';
          const trail = Array.isArray(window.trailsData)
            ? window.trailsData.find(t => t.id === exp.trailId)
            : null;
          const imgSrc = trail ? trail.image : 'images/hero.jpg';
          const price = Number(exp.pricePerPerson || exp.price || 0);
          const difficulty = exp.difficultyLevel || exp.level || '';
          const startDate = formatDateDisplay(exp.startDate || exp.start_date);
          const endDate = formatDateDisplay(exp.endDate || exp.end_date);
          const spotsLeft = Number.isFinite(Number(exp.maxPeople)) ? Number(exp.maxPeople) : null;
          card.innerHTML = `
            <img src="${imgSrc}" alt="${exp.title}" style="width:100%;height:160px;object-fit:cover;">
            <div class="expedition-content">
              <div class="expedition-title">${exp.title}</div>
              <div class="expedition-meta">${startDate} - ${endDate}${difficulty ? ` · ${difficulty}` : ''}</div>
              <div class="expedition-price">${price > 0 ? `R$ ${price.toFixed(2)} por pessoa` : 'Consulte valores'}</div>
              ${spotsLeft ? `<div class="expedition-meta">${spotsLeft} vaga${spotsLeft !== 1 ? 's' : ''} disponíveis</div>` : ''}
              <button class="btn btn-secondary" data-exp-id="${exp.id}">Ver Expedição</button>
            </div>
          `;
          expSection.appendChild(card);
        });
        expSection.addEventListener('click', (e) => {
          const btn = e.target.closest('button[data-exp-id]');
          if (btn) {
            const expId = btn.getAttribute('data-exp-id');
            window.location.href = `expedicao.html?id=${expId}`;
          }
        });
      }
    } catch (error) {
      expSection.innerHTML = '';
      const message = document.createElement('p');
      message.className = 'expedition-error';
      message.textContent = error?.message || 'Não foi possível carregar as expedições.';
      expSection.appendChild(message);
    }
  }
  // CTA segmented buttons
  const ctaSegment = document.querySelector('.cta-segment');
  if (ctaSegment) {
    ctaSegment.innerHTML = '';
    const trekkerCard = document.createElement('div');
    trekkerCard.className = 'cta-card';
    trekkerCard.innerHTML = `
      <h3>Sou Trekker</h3>
      <p>Crie seu perfil, descubra trilhas e reserve expedições incríveis.</p>
      <a href="cadastro.html" class="btn btn-primary">Cadastrar-se</a>
    `;
    const guideCard = document.createElement('div');
    guideCard.className = 'cta-card';
    guideCard.innerHTML = `
      <h3>Sou Guia</h3>
      <p>Cadastre-se com seu número CADASTUR e publique suas expedições.</p>
      <a href="cadastro.html" class="btn btn-secondary">Cadastrar Guia</a>
    `;
    ctaSegment.appendChild(trekkerCard);
    ctaSegment.appendChild(guideCard);
  }
}

/**
 * Inicializa a página de listagem de expedições.
 * Permite filtrar expedições por diversos critérios.
 */
async function initExpeditionsPage() {
  const container = document.getElementById('expeditionsContainer');
  if (!container) return;
  computeSlugs();
  if (navigationSessionPromise) {
    navigationSessionPromise
      .then(session => updateGuideExpeditionActionsForUser(session?.user || null))
      .catch(() => updateGuideExpeditionActionsForUser(null));
  } else if (typeof Auth !== 'undefined' && Auth.getSession) {
    Auth.getSession()
      .then(session => {
        currentSession = session;
        updateGuideExpeditionActionsForUser(session?.user || null);
      })
      .catch(() => updateGuideExpeditionActionsForUser(null));
  }

  const searchInput = document.getElementById('expSearchFilter');
  const stateFilter = document.getElementById('expStateFilter');
  const trailFilter = document.getElementById('expTrailFilter');
  const levelFilter = document.getElementById('expLevelFilter');
  const dateFilter = document.getElementById('expDateFilter');
  const clearBtn = document.getElementById('clearExpFilters');
  const tabsContainer = document.getElementById('expeditionsTabs');
  const paginationContainer = document.getElementById('expeditionsPagination');

  const params = new URLSearchParams(window.location.search);
  const trailParam = params.get('trail');

  const filters = {
    search: '',
    state: '',
    trailId: '',
    level: '',
    startDate: '',
    endDate: ''
  };

  let currentStatus = 'active';
  let currentPage = 1;
  let lastRequestId = 0;

  function updateTrailFilterOptions() {
    if (!trailFilter || !Array.isArray(window.trailsData)) return;
    if (trailFilter.dataset.populated === 'true') return;
    window.trailsData.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      trailFilter.appendChild(opt);
    });
    trailFilter.dataset.populated = 'true';
  }

  function normaliseDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  }

  function parseDateRange(value) {
    if (!value) {
      return { startDate: '', endDate: '' };
    }
    const separator = ' - ';
    if (value.includes(separator)) {
      const [start, end] = value.split(separator);
      return { startDate: normaliseDate(start.trim()), endDate: normaliseDate(end.trim()) };
    }
    const normalized = normaliseDate(value.trim());
    return { startDate: normalized, endDate: '' };
  }

  function buildQuery() {
    return {
      status: currentStatus,
      page: currentPage,
      pageSize: 20,
      search: filters.search,
      state: filters.state,
      trailId: filters.trailId,
      level: filters.level,
      startDate: filters.startDate,
      endDate: filters.endDate
    };
  }

  function renderExpeditions(list) {
    container.innerHTML = '';
    if (!Array.isArray(list) || list.length === 0) {
      const message = document.createElement('p');
      message.className = 'expedition-empty';
      message.textContent = currentStatus === 'historic'
        ? 'Nenhuma expedição histórica disponível.'
        : 'Nenhuma expedição cadastrada até o momento.';
      container.appendChild(message);
      return;
    }
    list.forEach(exp => {
      const card = document.createElement('div');
      card.className = 'expedition-card';
      const trail = Array.isArray(window.trailsData)
        ? window.trailsData.find(t => t.id === exp.trailId)
        : null;
      const trailName = exp.trail?.name || trail?.name || '';
      const trailLocation = [exp.trail?.city || trail?.city || '', exp.trail?.state || trail?.state || '']
        .filter(Boolean)
        .join(' · ');
      const guideName = exp.guide?.name || exp.guideName || '';
      const price = Number(exp.pricePerPerson || exp.price || 0);
      const maxPeople = Number.isFinite(Number(exp.maxPeople)) ? Number(exp.maxPeople) : null;
      const imgSrc = trail?.image || 'images/hero.jpg';
      const startDate = formatDateDisplay(exp.startDate || exp.start_date);
      const endDate = formatDateDisplay(exp.endDate || exp.end_date);
      const difficulty = exp.difficultyLevel || exp.level || '';
      card.innerHTML = `
        <img src="${imgSrc}" alt="${exp.title}" style="width:100%;height:180px;object-fit:cover;">
        <div class="expedition-content">
          <div class="expedition-title">${exp.title}</div>
          ${trailName ? `<div class="expedition-meta">${trailName}${trailLocation ? ` · ${trailLocation}` : ''}</div>` : ''}
          <div class="expedition-meta">${startDate} - ${endDate}${difficulty ? ` · ${difficulty}` : ''}</div>
          <div class="expedition-price">${price > 0 ? `R$ ${price.toFixed(2)} por pessoa` : 'Consulte valores'}</div>
          ${guideName ? `<div class="expedition-meta">Guia: ${guideName}</div>` : ''}
          ${maxPeople ? `<div class="expedition-meta">Até ${maxPeople} participante${maxPeople !== 1 ? 's' : ''}</div>` : ''}
          <button class="btn btn-secondary" data-exp-id="${exp.id}">Ver Detalhes</button>
        </div>
      `;
      container.appendChild(card);
    });
  }

  function renderPagination(pagination) {
    if (!paginationContainer) return;
    paginationContainer.innerHTML = '';
    const totalPages = pagination?.totalPages || 0;
    const page = pagination?.page || 1;
    if (totalPages <= 1) {
      paginationContainer.style.display = 'none';
      return;
    }
    paginationContainer.style.display = 'flex';

    const createButton = (label, targetPage, disabled = false, active = false) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.className = 'pagination-button';
      if (active) button.classList.add('is-active');
      if (disabled) {
        button.disabled = true;
      } else {
        button.addEventListener('click', () => {
          currentPage = targetPage;
          loadExpeditions();
        });
      }
      paginationContainer.appendChild(button);
    };

    createButton('Anterior', Math.max(1, page - 1), page <= 1);

    const maxButtons = 5;
    let startPage = Math.max(1, page - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    if (endPage - startPage + 1 < maxButtons) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let i = startPage; i <= endPage; i += 1) {
      createButton(String(i), i, false, i === page);
    }

    createButton('Próxima', Math.min(totalPages, page + 1), page >= totalPages);
  }

  async function loadExpeditions() {
    const requestId = ++lastRequestId;
    container.innerHTML = '<p class="expedition-loading">Carregando expedições...</p>';
    if (paginationContainer) {
      paginationContainer.innerHTML = '';
    }
    try {
      const query = buildQuery();
      Object.keys(query).forEach(key => {
        if (query[key] === '') {
          delete query[key];
        }
      });
      const result = await expeditionService.list(query);
      if (requestId !== lastRequestId) return;
      const list = Array.isArray(result?.data) ? result.data : [];
      window.expeditionsData = list;
      renderExpeditions(list);
      renderPagination(result?.pagination);
    } catch (error) {
      if (requestId !== lastRequestId) return;
      container.innerHTML = '';
      const message = document.createElement('p');
      message.className = 'expedition-error';
      message.textContent = error?.message || 'Não foi possível carregar as expedições.';
      container.appendChild(message);
    }
  }

  updateTrailFilterOptions();

  if (trailParam && trailFilter) {
    const matchingTrail = Array.isArray(window.trailsData)
      ? window.trailsData.find(t => t.slug === trailParam || t.id === trailParam)
      : null;
    if (matchingTrail) {
      trailFilter.value = matchingTrail.id;
      filters.trailId = matchingTrail.id;
    }
  }

  if (tabsContainer) {
    tabsContainer.addEventListener('click', (event) => {
      const button = event.target.closest('[data-status]');
      if (!button) return;
      const nextStatus = button.getAttribute('data-status') || 'active';
      if (currentStatus === nextStatus) return;
      currentStatus = nextStatus;
      currentPage = 1;
      tabsContainer.querySelectorAll('[data-status]').forEach(tab => {
        tab.classList.toggle('is-active', tab === button);
      });
      loadExpeditions();
    });
  }

  let searchDebounce = null;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        filters.search = searchInput.value.trim();
        currentPage = 1;
        loadExpeditions();
      }, 300);
    });
  }

  if (stateFilter) {
    stateFilter.addEventListener('change', () => {
      filters.state = stateFilter.value;
      currentPage = 1;
      loadExpeditions();
    });
  }

  if (trailFilter) {
    trailFilter.addEventListener('change', () => {
      filters.trailId = trailFilter.value;
      currentPage = 1;
      loadExpeditions();
    });
  }

  if (levelFilter) {
    levelFilter.addEventListener('change', () => {
      filters.level = levelFilter.value;
      currentPage = 1;
      loadExpeditions();
    });
  }

  if (dateFilter) {
    dateFilter.addEventListener('change', () => {
      const { startDate, endDate } = parseDateRange(dateFilter.value);
      filters.startDate = startDate;
      filters.endDate = endDate;
      currentPage = 1;
      loadExpeditions();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      filters.search = '';
      filters.state = '';
      filters.trailId = '';
      filters.level = '';
      filters.startDate = '';
      filters.endDate = '';
      currentPage = 1;
      if (searchInput) searchInput.value = '';
      if (stateFilter) stateFilter.value = '';
      if (trailFilter) trailFilter.value = '';
      if (levelFilter) levelFilter.value = '';
      if (dateFilter) dateFilter.value = '';
      loadExpeditions();
    });
  }

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-exp-id]');
    if (btn) {
      const expId = btn.getAttribute('data-exp-id');
      if (expId) {
        window.location.href = `expedicao.html?id=${expId}`;
      }
    }
  });

  await loadExpeditions();
}

/**
 * Inicializa a página de detalhes de expedição.
 */
async function initExpeditionPage() {
  const detailContainer = document.getElementById('expeditionDetail');
  if (!detailContainer) return;
  const params = new URLSearchParams(window.location.search);
  const expId = params.get('id');
  if (!expId) {
    detailContainer.innerHTML = '<p>Expedição não encontrada.</p>';
    return;
  }

  detailContainer.innerHTML = '<p class="expedition-loading">Carregando expedição...</p>';
  try {
    const expedition = await expeditionService.getById(expId);
    if (!expedition) {
      detailContainer.innerHTML = '<p>Expedição não encontrada.</p>';
      return;
    }
    const trail = Array.isArray(window.trailsData)
      ? window.trailsData.find(t => t.id === expedition.trailId)
      : null;
    const guide = expedition.guide || null;
    const price = Number(expedition.pricePerPerson || expedition.price || 0);
    const maxPeople = Number.isFinite(Number(expedition.maxPeople)) ? Number(expedition.maxPeople) : null;
    const startDate = formatDateDisplay(expedition.startDate || expedition.start_date);
    const endDate = formatDateDisplay(expedition.endDate || expedition.end_date);
    const difficulty = expedition.difficultyLevel || expedition.level || '';
    const trailName = expedition.trail?.name || expedition.trailName || trail?.name || '';
    const locationParts = [expedition.trail?.city || trail?.city || '', expedition.trail?.state || trail?.state || '']
      .filter(Boolean);
    const location = locationParts.join(' · ');
    const highlights = expedition.highlights ? expedition.highlights.split('\n').filter(Boolean) : [];

    detailContainer.innerHTML = `
      <h1 style="font-family:'Sora',sans-serif;color:var(--color-primary);margin-bottom:1rem;">${expedition.title}</h1>
      <div class="expedition-detail-grid" style="display:flex;flex-wrap:wrap;gap:2rem;">
        <div style="flex:1 1 300px;">
          <img src="${trail ? trail.image : 'images/hero.jpg'}" alt="${expedition.title}" style="width:100%;border-radius:8px;">
          ${trailName ? `<p style="margin-top:0.5rem;font-size:0.9rem;color:var(--color-muted);"><strong>Trilha:</strong> ${trailName}</p>` : ''}
          ${location ? `<p style="font-size:0.9rem;color:var(--color-muted);"><strong>Localização:</strong> ${location}</p>` : ''}
          <p style="font-size:0.9rem;color:var(--color-muted);"><strong>Datas:</strong> ${startDate} – ${endDate}</p>
          ${difficulty ? `<p style="font-size:0.9rem;color:var(--color-muted);"><strong>Nível:</strong> ${difficulty}</p>` : ''}
          <p style="font-size:0.9rem;color:var(--color-muted);"><strong>Preço:</strong> ${price > 0 ? `R$ ${price.toFixed(2)} por pessoa` : 'Consulte valores'}</p>
          ${maxPeople ? `<p style="font-size:0.9rem;color:var(--color-muted);"><strong>Capacidade:</strong> Até ${maxPeople} participante${maxPeople !== 1 ? 's' : ''}</p>` : ''}
          <p style="font-size:0.9rem;color:var(--color-muted);"><strong>Guia:</strong> ${guide?.name || 'Guia não informado'}${guide?.cadastur ? ` · CADASTUR ${guide.cadastur}` : ''}</p>
        </div>
        <div style="flex:1 1 300px;">
          <h3 style="margin-bottom:0.5rem;color:var(--color-primary);">Descrição</h3>
          <p style="font-size:0.95rem;margin-bottom:1rem;">${expedition.description}</p>
          ${highlights.length ? `<h3 style="margin-bottom:0.5rem;color:var(--color-primary);">Destaques</h3><ul style="margin-bottom:1rem;padding-left:1.2rem;">${highlights.map(item => `<li style=\"margin-bottom:0.25rem;\">${item}</li>`).join('')}</ul>` : ''}
          <h3 style="margin-bottom:0.5rem;color:var(--color-primary);">Sobre a Trilha</h3>
          <p style="font-size:0.95rem;margin-bottom:1rem;">${trail ? trail.description : 'Informações completas da trilha em breve.'}</p>
          <h3 style="margin-bottom:0.5rem;color:var(--color-primary);">Sobre o Guia</h3>
          <p style="font-size:0.95rem;margin-bottom:1rem;">${guide?.bio || guide?.description || 'Guia certificado CADASTUR disponível para contato.'}</p>
          <button id="reserveExpeditionBtn" class="btn btn-primary" style="margin-top:0.5rem;">Reservar agora</button>
        </div>
      </div>
    `;

    const reserveBtn = document.getElementById('reserveExpeditionBtn');
    if (reserveBtn) {
      reserveBtn.addEventListener('click', () => {
        alert('Reserva iniciada! (Funcionalidade em desenvolvimento)');
      });
    }
  } catch (error) {
    detailContainer.innerHTML = `<p class="expedition-error">${error?.message || 'Não foi possível carregar a expedição.'}</p>`;
  }
}

/**
 * Inicializa a página de detalhe de trilha (trilha.html).
 * Lê o parâmetro ?slug=... para identificar a trilha e exibe informações
 * completas: foto de capa, detalhes técnicos, descrição, expedições e guias relacionados.
 */
function initTrailPage() {
  const container = document.getElementById('trailDetail');
  if (!container) return;
  computeSlugs();
  const params = new URLSearchParams(window.location.search);
  const slugParam = params.get('slug');
  const idParam = params.get('id');
  let trail = null;
  if (slugParam && Array.isArray(window.trailsData)) {
    trail = window.trailsData.find(t => t.slug === slugParam);
  }
  if (!trail && idParam && Array.isArray(window.trailsData)) {
    trail = window.trailsData.find(t => t.id === idParam);
  }
  if (!trail) {
    container.innerHTML = '<p class="trail-not-found">Trilha não encontrada.</p>';
    return;
  }

  document.title = `${trail.name} – Trekko Brasil`;

  const breadcrumb = document.getElementById('breadcrumb');
  if (breadcrumb) {
    breadcrumb.innerHTML = '';
    const home = document.createElement('a');
    home.href = 'index.html';
    home.textContent = 'Home';
    breadcrumb.appendChild(home);

    const separator = document.createElement('span');
    separator.textContent = '›';
    breadcrumb.appendChild(separator);

    const trailsLink = document.createElement('a');
    trailsLink.href = 'trilhas.html';
    trailsLink.textContent = 'Trilhas';
    breadcrumb.appendChild(trailsLink);

    const separator2 = document.createElement('span');
    separator2.textContent = '›';
    breadcrumb.appendChild(separator2);

    const current = document.createElement('strong');
    current.textContent = trail.name;
    breadcrumb.appendChild(current);
  }

  const normalizeDifficulty = (value) => {
    if (!value) return '';
    return value
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  const difficultyKey = normalizeDifficulty(trail.difficulty);
  const difficultyLabels = {
    facil: 'Fácil',
    moderada: 'Moderada',
    media: 'Moderada',
    intermediaria: 'Moderada',
    dificil: 'Difícil',
    pesada: 'Difícil',
    extrema: 'Extrema',
    extremo: 'Extrema'
  };
  const difficultyClasses = {
    facil: 'difficulty-easy',
    moderada: 'difficulty-moderate',
    media: 'difficulty-moderate',
    intermediaria: 'difficulty-moderate',
    dificil: 'difficulty-hard',
    pesada: 'difficulty-hard',
    extrema: 'difficulty-extreme',
    extremo: 'difficulty-extreme'
  };
  const difficultyLabel = difficultyLabels[difficultyKey] || (trail.difficulty || 'Nível indefinido');
  const difficultyClass = difficultyClasses[difficultyKey] || 'difficulty-moderate';

  const gallery = Array.isArray(trail.gallery) && trail.gallery.length
    ? trail.gallery.slice(0, 5)
    : [trail.image];
  const heroPrimaryLink = `guias.html?trail=${encodeURIComponent(trail.slug || trail.id || '')}`;
  const heroSecondaryLink = `expedicoes.html?trail=${encodeURIComponent(trail.slug || trail.id || '')}`;
  const heroPrimaryLabel = 'Encontre guias que guiam esta trilha';
  const heroSecondaryLabel = 'Faça parte de expedições';
  const locationSegments = [];
  if (trail.park) locationSegments.push(trail.park);
  const cityState = [trail.city, trail.state].filter(Boolean).join(' / ');
  if (cityState) locationSegments.push(cityState);
  const locationText = locationSegments.join(' – ');

  const iconSvg = (name) => {
    switch (name) {
      case 'route':
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2"/><path d="M6 8v10a2 2 0 0 0 2 2h8"/><circle cx="18" cy="18" r="2"/><path d="M18 16V6a2 2 0 0 0-2-2H8"/></svg>';
      case 'mountain':
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m3 17 6-10 4 7 2-3 6 6"/><path d="M14 3 3 17h18"/></svg>';
      case 'clock':
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>';
      case 'ticket':
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9a3 3 0 0 0 0 6v3a2 2 0 0 0 2 2h3a3 3 0 1 1 6 0h5a2 2 0 0 0 2-2v-3a3 3 0 1 1 0-6V6a2 2 0 0 0-2-2h-3a3 3 0 0 1-6 0H5a2 2 0 0 0-2 2z"/></svg>';
      case 'camping':
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m6 20 6-16 6 16"/><path d="M8 16h8"/><path d="M12 4v4"/></svg>';
      case 'parking':
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v18"/><path d="M5 7h8a4 4 0 0 1 0 8H5"/></svg>';
      default:
        return '';
    }
  };

  const formatCurrency = (value) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return '';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDuration = (hours) => {
    if (typeof hours !== 'number' || Number.isNaN(hours)) return '—';
    const totalMinutes = Math.round(hours * 60);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hrs}h${String(mins).padStart(2, '0')}min`;
  };

  const quickCards = [
    {
      title: 'Extensão',
      value: typeof trail.distance === 'number' ? `${trail.distance.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km` : '—',
      icon: iconSvg('route')
    },
    {
      title: 'Ganho de Altitude',
      value: typeof trail.elevationGain === 'number' ? `${trail.elevationGain.toLocaleString('pt-BR')} m` : '—',
      icon: iconSvg('mountain')
    },
    {
      title: 'Duração média',
      value: formatDuration(trail.duration),
      icon: iconSvg('clock')
    },
    {
      title: 'Entrada paga',
      value: trail.entryFee && trail.entryFee > 0 ? 'Sim' : 'Não',
      icon: iconSvg('ticket'),
      highlight: trail.entryFee && trail.entryFee > 0 ? formatCurrency(trail.entryFee) : 'Gratuita'
    },
    {
      title: 'Camping',
      value: trail.campingPoints ? 'Sim' : 'Não',
      icon: iconSvg('camping'),
      highlight: trail.campingPoints
        ? (typeof trail.campingFee === 'number'
          ? (trail.campingFee > 0 ? formatCurrency(trail.campingFee) : 'Gratuito')
          : 'Sob consulta')
        : 'Somente bate-volta'
    },
    {
      title: 'Estacionamento',
      value: trail.parkingAvailable ? 'Sim' : 'Não',
      icon: iconSvg('parking'),
      highlight: trail.parkingAvailable ? (trail.parkingFee ? formatCurrency(trail.parkingFee) : 'Gratuito') : 'Não disponível'
    }
  ];

  const quickCardsHtml = quickCards
    .map(card => `
      <article class="quick-card">
        <div class="quick-card__icon">${card.icon}</div>
        <span class="quick-card__title">${card.title}</span>
        <span class="quick-card__value">${card.value}</span>
        ${card.highlight ? `<span class="quick-card__highlight">${card.highlight}</span>` : ''}
      </article>
    `)
    .join('');

  const descriptionText = trail.longDescription || trail.description || '';
  const descriptionParagraphs = descriptionText
    .split(/\n{2,}|\r?\n/)
    .map(p => p.trim())
    .filter(Boolean);
  const descriptionHtml = descriptionParagraphs.map(p => `<p>${p}</p>`).join('');
  const showReadMore = descriptionText.length > 420;

  const infrastructureItems = [
    {
      icon: '💧',
      label: 'Pontos de água',
      text: trail.waterPoints ? 'Abastecimento disponível em trechos sinalizados.' : 'Leve toda a água necessária, não há pontos confiáveis no percurso.'
    },
    {
      icon: '⛺',
      label: 'Possui camping',
      text: trail.campingPoints
        ? `Camping autorizado. ${typeof trail.campingFee === 'number' ? (trail.campingFee > 0 ? `Diárias a ${formatCurrency(trail.campingFee)}.` : 'Gratuito para pernoite.') : 'Valores sob consulta.'}`
        : 'Não há estrutura oficial de camping no percurso.'
    },
    {
      icon: '🅿️',
      label: 'Estacionamento',
      text: trail.parkingAvailable ? (trail.parkingFee ? `Estacionamento no acesso por ${formatCurrency(trail.parkingFee)}.` : 'Estacionamento gratuito na portaria.') : 'Sem estacionamento oficial, organize transfer ou carona.'
    },
    {
      icon: '🎫',
      label: 'Entrada paga',
      text: trail.entryFee && trail.entryFee > 0 ? `Ingresso obrigatório: ${formatCurrency(trail.entryFee)} por pessoa.` : 'Acesso livre, sem cobrança de ingresso.'
    },
    {
      icon: '✈️',
      label: 'Aeroporto mais próximo',
      text: trail.airport ? `${trail.airport.name} – ${trail.airport.city} (${trail.airport.distanceKm} km)` : 'Consulte os aeroportos mais próximos.'
    },
    {
      icon: '🚌',
      label: 'Rodoviária mais próxima',
      text: trail.busStation ? `${trail.busStation.name} – ${trail.busStation.city} (${trail.busStation.distanceKm} km)` : 'Verifique o acesso rodoviário mais conveniente.'
    }
  ];

  const infrastructureHtml = infrastructureItems
    .map(item => `
      <div class="infra-item">
        <span>${item.icon}</span>
        <div>
          <strong>${item.label}</strong>
          <span>${item.text}</span>
        </div>
      </div>
    `)
    .join('');

  const mapSection = trail.coordinates
    ? `
      <section class="trail-section">
        <div class="trail-map">
          <div class="trail-map__header">
            <h3>Mapa interativo</h3>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${trail.coordinates.lat},${trail.coordinates.lng}" target="_blank" rel="noopener">Como chegar</a>
          </div>
          <iframe src="https://maps.google.com/maps?q=${trail.coordinates.lat},${trail.coordinates.lng}&z=12&output=embed" allowfullscreen loading="lazy" title="Mapa da trilha ${trail.name}"></iframe>
        </div>
      </section>
    `
    : '';

  const reviews = Array.isArray(trail.reviews) ? trail.reviews : [];
  const reviewCardsHtml = reviews.slice(0, 4).map(review => {
    const initials = (review.user || 'Trekker')
      .split(' ')
      .filter(Boolean)
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    const avatarMarkup = review.avatar
      ? `<span class="review-avatar"><img src="${review.avatar}" alt="${review.user}" loading="lazy"></span>`
      : `<span class="review-avatar">${initials}</span>`;
    return `
      <article class="review-card">
        <div class="review-card__header">
          ${avatarMarkup}
          <div>
            <strong>${review.user || 'Viajante Trekko'}</strong>
            <div class="review-card__meta">${review.date || ''} · ⭐ ${review.rating ? review.rating.toFixed(1).replace('.', ',') : '5,0'}</div>
          </div>
        </div>
        <p>${review.text || ''}</p>
      </article>
    `;
  }).join('');

  const ratingAverage = typeof trail.rating === 'number'
    ? trail.rating.toFixed(1).replace('.', ',')
    : '—';
  const ratingSubtitle = reviews.length
    ? `Baseado em ${reviews.length} avaliações verificadas`
    : 'Seja o primeiro a deixar sua avaliação';

  const expeditionsSection = `
    <section class="trail-section" id="trailExpeditionsSection">
      <h2 class="section-title">Expedições em destaque</h2>
      <div class="trail-expeditions" data-trail-expeditions></div>
    </section>
  `;

  const toSetOfStrings = (value) => {
    if (!Array.isArray(value)) return new Set();
    return new Set(value.map(item => String(item)).filter(Boolean));
  };
  const explicitGuideIds = toSetOfStrings(trail.guideIds);
  const explicitCadastur = new Set(
    Array.isArray(trail.guideCadastur)
      ? trail.guideCadastur.map(item => String(item).toUpperCase()).filter(Boolean)
      : []
  );
  const trailIdentifiers = new Set(
    [trail.id, trail.slug]
      .filter(Boolean)
      .map(identifier => String(identifier).toLowerCase())
  );
  const guideMap = new Map();
  const registerGuide = (rawGuide) => {
    if (!rawGuide) return;
    const cad = rawGuide.cadastur || rawGuide.numero_do_certificado || rawGuide.numero_cadastur || rawGuide.numero || '';
    const displayGuide = {
      id: rawGuide.id || cad || rawGuide.slug || '',
      name: rawGuide.name || rawGuide.nome_completo || rawGuide.nome || 'Guia credenciado',
      uf: rawGuide.uf || rawGuide.estado || '',
      municipio: rawGuide.municipio || rawGuide['município'] || rawGuide.city || '',
      rating: rawGuide.rating,
      slug: rawGuide.slug,
      cadastur: cad ? String(cad) : ''
    };
    const key = displayGuide.slug || displayGuide.cadastur || displayGuide.id;
    if (!key || guideMap.has(key)) return;
    guideMap.set(key, displayGuide);
  };

  const guideMatchesTrail = (guidedValue) => {
    if (!guidedValue) return false;
    if (Array.isArray(guidedValue)) {
      return guidedValue.some(item => trailIdentifiers.has(String(item).toLowerCase()));
    }
    if (typeof guidedValue === 'string') {
      return guidedValue
        .split(/[,|]/)
        .map(part => part.trim().toLowerCase())
        .some(part => trailIdentifiers.has(part));
    }
    return false;
  };

  if (Array.isArray(window.guidesData)) {
    window.guidesData.forEach(rawGuide => {
      const guideId = rawGuide.id != null ? String(rawGuide.id) : null;
      const cadValue = rawGuide.cadastur || rawGuide.numero_do_certificado || rawGuide.numero_cadastur || null;
      const cadUpper = cadValue ? String(cadValue).toUpperCase() : null;
      const guidedSet = rawGuide.trilhas_guiadas || rawGuide.trailsGuided || rawGuide.trilhas || rawGuide.trails;
      const matchesTrail = guideMatchesTrail(guidedSet);
      if (
        (guideId && explicitGuideIds.has(guideId)) ||
        (cadUpper && explicitCadastur.has(cadUpper)) ||
        matchesTrail
      ) {
        registerGuide({ ...rawGuide, cadastur: cadValue || rawGuide.cadastur });
      }
    });
  }

  if (explicitCadastur.size && Array.isArray(window.cadasturData)) {
    window.cadasturData.forEach(entry => {
      const cad = entry.numero_cadastur || entry.numero || entry.id || '';
      if (cad && explicitCadastur.has(String(cad).toUpperCase())) {
        const normalised = normalizeCadasturGuide(entry);
        registerGuide({ ...normalised, cadastur: normalised.cadastur || cad });
      }
    });
  }

  let relatedGuides = Array.from(guideMap.values());

  if (!relatedGuides.length && Array.isArray(window.guidesData)) {
    relatedGuides = window.guidesData
      .filter(g => {
        const ufValue = g.uf || '';
        const cityValue = g.municipio || g['município'] || g.city || '';
        const matchState = ufValue && trail.state && trail.state.toLowerCase().includes(ufValue.toString().toLowerCase());
        const matchCity = cityValue && trail.city && slugify(cityValue) === slugify(trail.city);
        return matchState || matchCity;
      })
      .map(rawGuide => ({
        id: rawGuide.id || rawGuide.slug || '',
        name: rawGuide.name || rawGuide.nome_completo || rawGuide.nome || 'Guia credenciado',
        uf: rawGuide.uf || rawGuide.estado || '',
        municipio: rawGuide.municipio || rawGuide['município'] || rawGuide.city || '',
        rating: rawGuide.rating,
        slug: rawGuide.slug,
        cadastur: rawGuide.cadastur || rawGuide.numero_do_certificado || rawGuide.numero_cadastur || ''
      }));
  }

  const guidesSection = relatedGuides.length
    ? `
      <section class="trail-section">
        <h2 class="section-title">Guias que atuam aqui</h2>
        <div class="trail-guides">
          ${relatedGuides.map(guide => {
            const profileUrl = guide.slug
              ? `guia.html?slug=${encodeURIComponent(guide.slug)}`
              : (guide.cadastur ? `guia.html?cadastur=${encodeURIComponent(guide.cadastur)}` : 'guia.html');
            const ratingDisplay = typeof guide.rating === 'number' ? guide.rating : (guide.rating || '5.0');
            return `
              <article class="guide-card-modern">
                <div class="guide-card-modern__name">${guide.name}</div>
                <div class="guide-card-modern__meta">${guide.uf || ''} · ${guide.municipio || guide.city || ''}</div>
                <div class="guide-card-modern__meta">⭐ ${ratingDisplay}</div>
                <a class="btn cta-secondary" href="${profileUrl}">Ver perfil</a>
              </article>
            `;
          }).join('')}
        </div>
        <div class="trail-guides__actions">
          <a class="btn btn-primary" href="${heroPrimaryLink}">${heroPrimaryLabel}</a>
        </div>
      </section>
    `
    : `
      <section class="trail-section">
        <h2 class="section-title">Guias que atuam aqui</h2>
        <p class="trail-muted">Ainda não temos guias confirmados para esta trilha.</p>
        <div class="trail-guides__actions">
          <a class="btn btn-primary" href="${heroPrimaryLink}">${heroPrimaryLabel}</a>
        </div>
      </section>
    `;

  const heroSlides = gallery
    .map((image, index) => `
      <div class="hero-slide${index === 0 ? ' is-active' : ''}" style="background-image:url('${image}')" role="img" aria-label="Paisagem da ${trail.name}"></div>
    `)
    .join('');

  const heroControls = gallery.length > 1
    ? `
        <button class="hero-control prev" type="button" aria-label="Imagem anterior"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>
        <button class="hero-control next" type="button" aria-label="Próxima imagem"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>
      `
    : '';

  const heroSection = `
    <section class="trail-hero">
      <div class="hero-carousel">
        ${heroSlides}
        ${heroControls}
      </div>
      <div class="hero-overlay">
        <span class="hero-location">${locationText || ''}</span>
        <h1>${trail.name}</h1>
        <div class="hero-meta">
          <span class="difficulty-badge ${difficultyClass}">${difficultyLabel}</span>
        </div>
        <div class="hero-cta">
          <a href="${heroPrimaryLink}" class="btn btn-primary" data-hero-primary>${heroPrimaryLabel}</a>
          <a href="${heroSecondaryLink}" class="btn btn-secondary">${heroSecondaryLabel}</a>
        </div>
      </div>
    </section>
  `;

  const quickInfoSection = `
    <section class="trail-section">
      <h2 class="section-title">Informações rápidas</h2>
      <div class="quick-grid">${quickCardsHtml}</div>
    </section>
  `;

  const descriptionSection = `
    <section class="trail-section">
      <div class="trail-description">
        <h2 class="section-title">Descrição detalhada</h2>
        <div class="trail-description__content" data-description>${descriptionHtml}</div>
        ${showReadMore ? '<div class="trail-description__fade"></div><button class="read-more-btn" type="button" data-read-more><span>Ler mais</span><i class="fas fa-chevron-down" aria-hidden="true"></i></button>' : ''}
      </div>
    </section>
  `;

  const infrastructureSection = `
    <section class="trail-section">
      <h2 class="section-title">Infraestrutura da trilha</h2>
      <div class="trail-infrastructure">${infrastructureHtml}</div>
    </section>
  `;

  const reviewsSection = `
    <section class="trail-section" id="reviews">
      <h2 class="section-title">Comentários e avaliações</h2>
      <div class="trail-reviews">
        <div class="review-summary">
          <div class="review-summary__score">${ratingAverage}</div>
          <div>
            <p><strong>Nota média</strong></p>
            <p class="trail-muted">${ratingSubtitle}</p>
          </div>
        </div>
        ${reviews.length ? `<div class="review-cards">${reviewCardsHtml}</div>` : '<p class="trail-muted">Ainda não há comentários para esta trilha.</p>'}
        <div class="review-actions">
          <a href="#reviews" class="btn cta-secondary">Ver todos os comentários</a>
          <a href="cadastro.html" class="btn cta-primary">Deixe sua avaliação</a>
        </div>
      </div>
    </section>
  `;

  const finalCtaSection = `
    <section class="trail-section" id="trailFinalCta">
      <div class="trail-final-cta">
        <h3>Pronto para explorar a ${trail.name}?</h3>
        <div class="trail-final-cta__actions">
          <a href="${heroPrimaryLink}" class="btn">${heroPrimaryLabel}</a>
          <a href="${heroSecondaryLink}" class="btn btn-secondary">${heroSecondaryLabel}</a>
        </div>
      </div>
    </section>
  `;

  container.innerHTML = [
    heroSection,
    quickInfoSection,
    descriptionSection,
    infrastructureSection,
    mapSection,
    reviewsSection,
    expeditionsSection,
    guidesSection,
    finalCtaSection
  ].join('');

  const trailExpeditionsEl = container.querySelector('[data-trail-expeditions]');
  if (trailExpeditionsEl) {
    loadTrailExpeditions(trailExpeditionsEl);
  }

  const readMoreButton = container.querySelector('[data-read-more]');
  if (readMoreButton) {
    const descriptionBox = container.querySelector('[data-description]');
    const fade = container.querySelector('.trail-description__fade');
    readMoreButton.addEventListener('click', () => {
      const expanded = descriptionBox.classList.toggle('is-expanded');
      if (fade) fade.style.display = expanded ? 'none' : '';
      const label = readMoreButton.querySelector('span');
      const icon = readMoreButton.querySelector('i');
      if (label) label.textContent = expanded ? 'Ler menos' : 'Ler mais';
      if (icon) {
        icon.classList.toggle('fa-chevron-up', expanded);
        icon.classList.toggle('fa-chevron-down', !expanded);
      }
    });
  }

  const slides = Array.from(container.querySelectorAll('.hero-slide'));
  if (slides.length) {
    let currentIndex = 0;
    const prevBtn = container.querySelector('.hero-control.prev');
    const nextBtn = container.querySelector('.hero-control.next');
    const activateSlide = (index) => {
      slides[currentIndex].classList.remove('is-active');
      currentIndex = (index + slides.length) % slides.length;
      slides[currentIndex].classList.add('is-active');
    };
    const autoAdvance = () => activateSlide(currentIndex + 1);
    let autoTimer = slides.length > 1 ? setInterval(autoAdvance, 7000) : null;
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        activateSlide(currentIndex - 1);
        if (autoTimer) {
          clearInterval(autoTimer);
          autoTimer = setInterval(autoAdvance, 7000);
        }
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        autoAdvance();
        if (autoTimer) {
          clearInterval(autoTimer);
          autoTimer = setInterval(autoAdvance, 7000);
        }
      });
    }
  }

  const floatingCTA = document.getElementById('trailFloatingCTA');
  if (floatingCTA) {
    floatingCTA.innerHTML = `
      <span>Guias certificados para ${trail.name}</span>
      <button type="button">${heroPrimaryLabel}</button>
    `;
    const updateFloating = () => {
      if (window.innerWidth <= 768) {
        floatingCTA.classList.add('is-visible');
      } else {
        floatingCTA.classList.remove('is-visible');
      }
    };
    updateFloating();
    window.addEventListener('resize', updateFloating);
    const floatingBtn = floatingCTA.querySelector('button');
    if (floatingBtn) {
      floatingBtn.addEventListener('click', () => {
        window.location.href = heroPrimaryLink;
      });
    }
  }

  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const navMenu = document.getElementById('navMenu');
  if (mobileMenuBtn && navMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      const isOpen = navMenu.classList.toggle('is-open');
      mobileMenuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }
}

/**
 * Inicializa a página de perfil do guia (guia.html).
 * Usa ?slug= para localizar guia e mostra detalhes, bio, certificações e expedições.
 */
function initGuideProfilePage() {
  const container = document.getElementById('guideProfile');
  if (!container) return;
  computeSlugs();
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');
  let guide;
  if (slug) {
    // Try to find guide by slug in main guides dataset
    if (Array.isArray(window.guidesData)) {
      guide = window.guidesData.find(g => g.slug === slug);
    }
    // If not found, try CADASTUR dataset
    if (!guide && Array.isArray(window.cadasturData)) {
      // Attempt direct match on precomputed slug
      const raw = window.cadasturData.find(entry => entry.slug === slug);
      if (raw) {
        guide = normalizeCadasturGuide(raw);
      }
      // Fallback: derive slug heuristically from name and last digits of Cadastur
      if (!guide && slug) {
        const parts = slug.split('-');
        const idPart = parts.pop();
        const namePart = parts.join('-');
        // Helper to slugify names similar to our slugify() function
        const slugifyName = (str) => {
          return str
            .toString()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        };
        for (const entry of window.cadasturData) {
          if (guide) break;
          const entryNameSlug = slugifyName(entry.nome || entry.nome_completo || entry.name || '');
          const cad = String(entry.numero_cadastur || entry.numero || entry.numero_cad || entry['nº cadastur'] || entry['número cadastur'] || '');
          if (entryNameSlug === namePart && cad.slice(-idPart.length) === idPart) {
            guide = normalizeCadasturGuide(entry);
    }
  }

  async function loadTrailExpeditions(targetEl) {
    targetEl.innerHTML = '<p class="expedition-loading">Carregando expedições...</p>';
    try {
      const result = await expeditionService.list({ status: 'active', trailId: trail.id, pageSize: 20 });
      const list = Array.isArray(result?.data) ? result.data : [];
      if (!list.length) {
        targetEl.innerHTML = '<p class="expedition-empty">Nenhuma expedição cadastrada para esta trilha.</p>';
        return;
      }
      targetEl.innerHTML = list
        .map(exp => {
          const startDate = formatDateDisplay(exp.startDate || exp.start_date);
          const endDate = formatDateDisplay(exp.endDate || exp.end_date);
          const difficulty = exp.difficultyLevel || exp.level || '';
          const price = Number(exp.pricePerPerson || exp.price || 0);
          return `
            <article class="exp-card">
              <h3>${exp.title}</h3>
              <div class="exp-card__meta">${startDate} – ${endDate}${difficulty ? ` · ${difficulty}` : ''}</div>
              <div class="exp-card__price">${price > 0 ? formatCurrency(price) : 'Consulte valores'}</div>
              <a class="btn cta-secondary" href="expedicao.html?id=${exp.id}">Ver expedição</a>
            </article>
          `;
        })
        .join('');
    } catch (error) {
      targetEl.innerHTML = `<p class="expedition-error">${error?.message || 'Não foi possível carregar as expedições desta trilha.'}</p>`;
    }
  }
}
    }
  } else {
    const id = params.get('id');
    if (Array.isArray(window.guidesData)) {
      guide = window.guidesData.find(g => String(g.id) === id);
    }
    if (!guide && Array.isArray(window.cadasturData)) {
      // Search by cadastur number
      const raw = window.cadasturData.find(entry => String(entry.numero_cadastur || entry.numero || entry.id) === String(id));
      if (raw) {
        guide = normalizeCadasturGuide(raw);
      }
    }
  }
  if (!guide) {
    container.innerHTML = '<p>Guia não encontrado.</p>';
    return;
  }
  // Breadcrumb
  const breadcrumb = document.getElementById('breadcrumb');
  if (breadcrumb) {
    breadcrumb.innerHTML = '';
    const parts = [];
    parts.push({ text: 'Início', link: 'index.html' });
    parts.push({ text: 'Guias', link: 'guias.html' });
    if (guide.uf) parts.push({ text: guide.uf, link: `guias.html?uf=${guide.uf}` });
    parts.push({ text: guide.name, link: null });
    parts.forEach((p, idx) => {
      const span = document.createElement('span');
      span.className = 'breadcrumb-item';
      if (p.link) {
        const a = document.createElement('a');
        a.href = p.link;
        a.textContent = p.text;
        span.appendChild(a);
      } else {
        const strong = document.createElement('strong');
        strong.textContent = p.text;
        span.appendChild(strong);
      }
      breadcrumb.appendChild(span);
      if (idx < parts.length - 1) {
        const sep = document.createElement('span');
        sep.textContent = ' › ';
        breadcrumb.appendChild(sep);
      }
    });
  }
  // Main details
  let html = '';
  html += `<h1 class="detail-title">${guide.name}</h1>`;
  // Image or photo fallback
  const imgSrc = guide.image || guide.photo || 'images/guia1.png';
  if (imgSrc) {
    html += `<img src="${imgSrc}" alt="${guide.name}" class="detail-image" />`;
  }
  html += `<div class="detail-info">
    ${guide.cadastur ? `<p><strong>Nº Cadastur:</strong> ${guide.cadastur}</p>` : ''}
    ${guide.uf ? `<p><strong>Estado:</strong> ${guide.uf}</p>` : ''}
    ${guide.city || guide.municipio ? `<p><strong>Município:</strong> ${guide.city || guide.municipio}</p>` : ''}
    ${(guide.languages && guide.languages.length) ? `<p><strong>Idiomas:</strong> ${guide.languages.join(', ')}</p>` : ''}
    ${guide.categorias ? `<p><strong>Categoria:</strong> ${Array.isArray(guide.categorias) ? guide.categorias.join(', ') : guide.categorias}</p>` : (guide.category ? `<p><strong>Categoria:</strong> ${guide.category}</p>` : '')}
    ${guide.segmentos ? `<p><strong>Segmento:</strong> ${Array.isArray(guide.segmentos) ? guide.segmentos.join(', ') : guide.segmentos}</p>` : (guide.segment ? `<p><strong>Segmento:</strong> ${guide.segment}</p>` : '')}
    ${typeof guide.guia_motorista !== 'undefined' || typeof guide.driver !== 'undefined' ? `<p><strong>Guia Motorista:</strong> ${(guide.guia_motorista || guide.driver) ? 'Sim' : 'Não'}</p>` : ''}
    ${guide.rating ? `<p><strong>Avaliação:</strong> ${guide.rating} / 5.0</p>` : ''}
  </div>`;
  html += `<div class="detail-description"><h3>Sobre o Guia</h3><p>${guide.bio || guide.descricao || guide.description || ''}</p></div>`;
  // Contact info
  html += `<div class="detail-contact">
    <h3>Contato</h3>`;
  if (guide.contacts && guide.contacts.length > 0) {
    guide.contacts.forEach(({ type, value }) => {
      html += `<p><strong>${type}:</strong> ${value}</p>`;
    });
  } else {
    // Fallback to telephone/email fields if available
    const phone = guide.telefone || guide.telefone_comercial;
    const email = guide.email || guide.email_comercial;
    const website = guide.website;
    if (phone) html += `<p><strong>Telefone:</strong> ${phone}</p>`;
    if (email) {
      const masked = email.replace(/(.{3}).+(@.+)/, '$1***$2');
      html += `<p><strong>E‑mail:</strong> ${masked}</p>`;
    }
    if (website) {
      html += `<p><strong>Website:</strong> <a href="${website}" target="_blank" rel="noopener">${website}</a></p>`;
    }
    if (!phone && !email && !website) {
      html += `<p>Contato não disponível.</p>`;
    }
  }
  html += `</div>`;
  html += '<div class="detail-expeditions"><h3>Expedições deste Guia</h3><div class="expedition-list" data-guide-expeditions></div></div>';
  container.innerHTML = html;

  const guideExpeditionsEl = container.querySelector('[data-guide-expeditions]');
  if (guideExpeditionsEl) {
    loadGuideExpeditions(guideExpeditionsEl, guide);
  }

  async function loadGuideExpeditions(targetEl, guideInfo) {
    targetEl.innerHTML = '<p class="expedition-loading">Carregando expedições...</p>';
    try {
      const guideUserId = Number.parseInt(guideInfo?.id, 10);
      if (!Number.isFinite(guideUserId)) {
        targetEl.innerHTML = '<p class="expedition-empty">Expedições serão exibidas aqui quando o guia estiver cadastrado na plataforma.</p>';
        return;
      }
      const result = await expeditionService.list({ status: 'active', guideId: guideUserId, pageSize: 50 });
      const list = Array.isArray(result?.data) ? result.data : [];
      if (!list.length) {
        targetEl.innerHTML = '<p class="expedition-empty">Nenhuma expedição disponível no momento.</p>';
        return;
      }
      targetEl.innerHTML = list
        .map(exp => {
          const startDate = formatDateDisplay(exp.startDate || exp.start_date);
          const endDate = formatDateDisplay(exp.endDate || exp.end_date);
          const difficulty = exp.difficultyLevel || exp.level || '';
          const price = Number(exp.pricePerPerson || exp.price || 0);
          return `
            <div class="expedition-card">
              <div class="expedition-content">
                <div class="expedition-title">${exp.title}</div>
                <div class="expedition-meta">${startDate} - ${endDate}${difficulty ? ` · ${difficulty}` : ''}</div>
                <div class="expedition-price">${price > 0 ? `R$ ${price.toFixed(2)} por pessoa` : 'Consulte valores'}</div>
                <a href="expedicao.html?id=${exp.id}" class="btn btn-secondary">Ver Expedição</a>
              </div>
            </div>
          `;
        })
        .join('');
    } catch (error) {
      targetEl.innerHTML = `<p class="expedition-error">${error?.message || 'Não foi possível carregar as expedições do guia.'}</p>`;
    }
  }
}

/**
 * Inicializa a página de blog (blog.html).
 * Exibe lista de posts com título, categoria e resumo.
 */
function initBlogPage() {
  const container = document.getElementById('blogList');
  if (!container) return;
  if (!Array.isArray(window.blogData)) {
    container.innerHTML = '<p>Blog sem conteúdos.</p>';
    return;
  }
  let html = '';
  window.blogData.forEach(post => {
    html += `<div class="blog-card">
      <img src="${post.image}" alt="${post.title}" class="blog-card-image" />
      <div class="blog-card-content">
        <div class="blog-card-category">${post.category}</div>
        <h3 class="blog-card-title">${post.title}</h3>
        <p class="blog-card-excerpt">${post.excerpt}</p>
        <a href="blog_post.html?slug=${post.slug}" class="btn btn-secondary">Ler mais</a>
      </div>
    </div>`;
  });
  container.innerHTML = html;
}

/**
 * Inicializa a página de post do blog (blog_post.html).
 */
function initBlogPostPage() {
  const container = document.getElementById('blogPost');
  if (!container) return;
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');
  if (!Array.isArray(window.blogData) || !slug) {
    container.innerHTML = '<p>Post não encontrado.</p>';
    return;
  }
  const post = window.blogData.find(p => p.slug === slug);
  if (!post) {
    container.innerHTML = '<p>Post não encontrado.</p>';
    return;
  }
  // Breadcrumb
  const breadcrumb = document.getElementById('breadcrumb');
  if (breadcrumb) {
    breadcrumb.innerHTML = '';
    const parts = [];
    parts.push({ text: 'Início', link: 'index.html' });
    parts.push({ text: 'Blog', link: 'blog.html' });
    if (post.category) parts.push({ text: post.category, link: 'blog.html' });
    parts.push({ text: post.title, link: null });
    parts.forEach((p, idx) => {
      const span = document.createElement('span');
      span.className = 'breadcrumb-item';
      if (p.link) {
        const a = document.createElement('a');
        a.href = p.link;
        a.textContent = p.text;
        span.appendChild(a);
      } else {
        const strong = document.createElement('strong');
        strong.textContent = p.text;
        span.appendChild(strong);
      }
      breadcrumb.appendChild(span);
      if (idx < parts.length - 1) {
        const sep = document.createElement('span');
        sep.textContent = ' › ';
        breadcrumb.appendChild(sep);
      }
    });
  }
  let html = '';
  html += `<h1 class="blog-post-title">${post.title}</h1>`;
  html += `<div class="blog-post-meta">${post.date} · ${post.category}</div>`;
  if (post.image) {
    html += `<img src="${post.image}" alt="${post.title}" class="blog-post-image" />`;
  }
  html += `<div class="blog-post-content">${post.content}</div>`;
  container.innerHTML = html;
}
  // Envolvemos a lógica de UI dentro de DOMContentLoaded para garantir
  // que os elementos do DOM estejam presentes antes de manipulá‑los.
  document.addEventListener('DOMContentLoaded', () => {
  /* Mobile navigation toggle */
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const navMenu = document.getElementById('navMenu');
  if (mobileMenuBtn && navMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      navMenu.classList.toggle('open');
    });
  }

  /* Login/Register modal */
  const loginModal = document.getElementById('loginModal');
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const loginClose = document.getElementById('loginClose');
  if (loginModal) {
    const openLogin = () => loginModal.classList.add('open');
    const closeLogin = () => loginModal.classList.remove('open');
    if (loginBtn) loginBtn.addEventListener('click', openLogin);
    // Redirect to cadastro page instead of opening login when clicking register
    if (registerBtn) registerBtn.addEventListener('click', () => {
      window.location.href = 'cadastro.html';
    });
    if (loginClose) loginClose.addEventListener('click', closeLogin);
    // Close modal when clicking outside content
    loginModal.addEventListener('click', (e) => {
      if (e.target === loginModal) closeLogin();
    });
    // Handle login form submission with Auth.login
    const loginForm = loginModal.querySelector('form');
    const loginResult = document.createElement('div');
    loginResult.className = 'result-message';
    if (loginForm && !loginForm.dataset.bound) {
      loginForm.dataset.bound = 'true';
      loginForm.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        // Remove previous result message
        loginResult.textContent = '';
        try {
          const email = loginForm.querySelector('input[type="email"]').value.trim();
          const password = loginForm.querySelector('input[type="password"]').value;
          const res = await Auth.login(email, password);
          currentSession = { token: res.token, user: res.user };
          updateGuideExpeditionActionsForUser(res.user);
          navigationSessionPromise = setupNavigation();
          loginResult.innerHTML = '<span class="success">Login bem‑sucedido!</span>';
          loginForm.reset();
          // Close modal after brief delay
          setTimeout(() => {
            closeLogin();
            loginResult.innerHTML = '';
          }, 1000);
        } catch (err) {
          loginResult.innerHTML = `<span class="error">${err.message}</span>`;
        }
      });
      // Append result message below form if not already
      if (!loginForm.nextSibling || !loginForm.nextSibling.classList || !loginForm.nextSibling.classList.contains('result-message')) {
        loginForm.parentNode.insertBefore(loginResult, loginForm.nextSibling);
      }
    }
  }

  /* Homepage search */
  const searchHomepageBtn = document.getElementById('searchHomepageBtn');
  if (searchHomepageBtn) {
    searchHomepageBtn.addEventListener('click', () => {
      const q = (document.getElementById('searchInput') || {}).value || '';
      const uf = (document.getElementById('estadoSelect') || {}).value || '';
      const dif = (document.getElementById('dificuldadeSelect') || {}).value || '';
      const dist = (document.getElementById('distanciaInput') || {}).value || '';
      const filters = { q: q.trim(), uf, dif, dist };
      try {
        sessionStorage.setItem('trailFilters', JSON.stringify(filters));
      } catch (err) {
        console.error('Unable to store filters', err);
      }
      // Redirect to trilhas page
      window.location.href = 'trilhas.html';
    });
  }

  /* Trilhas page logic */
  if (document.getElementById('trailsContainer')) {
    computeSlugs();
    // Dados de trilhas carregados a partir do dataset global (window.trailsData).
    const trailsData = Array.isArray(window.trailsData)
      ? window.trailsData.map(t => ({
          id: t.id,
          name: t.name,
          state: t.state,
          city: t.city || '',
          difficulty: t.difficulty,
          distance: t.distance,
          elevationGain: t.elevationGain,
          duration: t.duration,
          waterPoints: t.waterPoints,
          campingPoints: t.campingPoints,
          requiresGuide: t.requiresGuide,
          entryFee: typeof t.entryFee === 'number' ? t.entryFee : (t.entryFee || 0),
          image: t.image,
          description: t.description,
          rating: t.rating,
          slug: t.slug || t.id
        }))
      : [];

    const trailsContainer = document.getElementById('trailsContainer');
    const nameInput = document.getElementById('trailNameFilter');
    const stateSelect = document.getElementById('trailStateFilter');
    const diffSelect = document.getElementById('trailDifficultyFilter');
    const distInput = document.getElementById('trailDistanceFilter');
    const clearBtn = document.getElementById('clearTrailFilters');

    function createTrailCard(trail) {
      const card = document.createElement('div');
      card.className = 'card';
      const difficultyLabel = trail.difficulty ? trail.difficulty.charAt(0).toUpperCase() + trail.difficulty.slice(1) : '';
      card.innerHTML = `
        <div class="card-image" style="background-image: url('${trail.image}')"></div>
        <div class="card-content">
          <h3 class="card-title">${trail.name}</h3>
          <div class="card-meta">${trail.state} · ${trail.distance} km · ${difficultyLabel}</div>
          <p class="card-description">${trail.description.substring(0, 120)}...</p>
          <div class="card-rating" style="font-size:0.85rem;color:var(--color-secondary);margin-top:0.25rem;"><i class="fas fa-star"></i> ${trail.rating}</div>
          <div class="card-actions">
            <a class="btn btn-secondary" href="trilha.html?slug=${encodeURIComponent(trail.slug || trail.id)}">Ver detalhes</a>
          </div>
        </div>
      `;
      return card;
    }

    function renderTrails(list) {
      trailsContainer.innerHTML = '';
      if (list.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.textContent = 'Nenhuma trilha encontrada com os filtros selecionados.';
        trailsContainer.appendChild(emptyMsg);
        return;
      }
      list.forEach(trail => {
        trailsContainer.appendChild(createTrailCard(trail));
      });
    }

    function applyTrailFilters() {
      let results = [...trailsData];
      const q = nameInput.value.trim().toLowerCase();
      const uf = stateSelect.value;
      const dif = diffSelect.value;
      const dist = distInput.value;
      if (q) {
        results = results.filter(t => t.name.toLowerCase().includes(q));
      }
      if (uf) {
        results = results.filter(t => t.state.toLowerCase().includes(uf.toLowerCase()));
      }
      if (dif) {
        results = results.filter(t => t.difficulty === dif);
      }
      if (dist) {
        const maxDist = parseFloat(dist);
        if (!isNaN(maxDist)) {
          results = results.filter(t => t.distance <= maxDist);
        }
      }
      renderTrails(results);
    }

    // Event listeners for filter controls
    [nameInput, stateSelect, diffSelect, distInput].forEach(el => {
      if (el) {
        el.addEventListener('input', applyTrailFilters);
        el.addEventListener('change', applyTrailFilters);
      }
    });
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        nameInput.value = '';
        stateSelect.value = '';
        diffSelect.value = '';
        distInput.value = '';
        renderTrails(trailsData);
      });
    }

    // Read filters from sessionStorage (coming from homepage)
    try {
      const storedFilters = JSON.parse(sessionStorage.getItem('trailFilters'));
      if (storedFilters) {
        if (storedFilters.q) nameInput.value = storedFilters.q;
        if (storedFilters.uf) stateSelect.value = storedFilters.uf;
        if (storedFilters.dif) diffSelect.value = storedFilters.dif;
        if (storedFilters.dist) distInput.value = storedFilters.dist;
        sessionStorage.removeItem('trailFilters');
      }
    } catch (err) {
      console.warn('No stored filters or failed to parse');
    }

    // Render initial list
    applyTrailFilters();

  }

  /* Guias page logic */
  if (document.getElementById('guidesContainer')) {
    // Data for guias will be loaded from an external JSON file.  
    // The file `data/guides.json` contains an array of objects that mirror
    // the fields defined in the Trekko database schema (nome_completo, uf,
    // município, idiomas, categorias, segmentos, guia_motorista, telefone_comercial, email_comercial, etc.).
    // We'll fetch that file asynchronously and then render the guides.
    let guidesData = [];

    async function loadGuides() {
      try {
        let rawData;
        if (window.guidesData && Array.isArray(window.guidesData)) {
          // If the data is already loaded via a script tag (data/guides.js), use it directly
          rawData = window.guidesData;
        } else {
          // Otherwise fetch the JSON file via AJAX
          const resp = await fetch('data/guides.json');
          if (!resp.ok) throw new Error('HTTP ' + resp.status);
          rawData = await resp.json();
        }
        // Normalise keys: for the UI we expect fields like name, languages, category, segment, municipio, uf and driver.
        guidesData = rawData.map(item => ({
          id: item.id ? String(item.id) : (item.nome_completo || '').toLowerCase().replace(/\s+/g, '-'),
          name: item.nome_completo || item.name || '',
          languages: Array.isArray(item.idiomas) ? item.idiomas : (typeof item.idiomas === 'string' ? item.idiomas.split(/\|/).map(s => s.trim()) : []),
          category: Array.isArray(item.categorias) ? item.categorias.join(', ') : (item.categorias || item.category || ''),
          segment: Array.isArray(item.segmentos) ? item.segmentos.join(', ') : (item.segmentos || item.segment || ''),
          uf: item.uf || '',
          municipio: item.município || item.municipio || '',
          driver: !!item.guia_motorista,
          image: item.image || '',
          description: item.descricao || item.description || '',
          telefone: item.telefone_comercial || '',
          email: item.email_comercial || '',
          website: item.website || ''
        ,
          rating: item.rating || 0
        }));
        renderGuides(guidesData);
      } catch (err) {
        console.error('Failed to load guides data', err);
        renderGuides([]);
      }
    }

    const guidesContainer = document.getElementById('guidesContainer');
    const nameFilter = document.getElementById('guideNameFilter');
    const stateFilter = document.getElementById('guideStateFilter');
    const languageFilter = document.getElementById('guideLanguageFilter');
    const driverFilter = document.getElementById('guideDriverFilter');
    const clearGuideBtn = document.getElementById('clearGuideFilters');

    function createGuideCard(guide) {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-image" style="background-image: url('${guide.image}')"></div>
        <div class="card-content">
          <h3 class="card-title">${guide.name}</h3>
          <div class="card-meta">${guide.uf} · ${guide.municipio}</div>
          <p class="card-description">Idiomas: ${Array.isArray(guide.languages) ? guide.languages.join(', ') : guide.languages}<br>Categoria: ${guide.category}<br>Segmento: ${guide.segment}<br>Guia Motorista: ${guide.driver ? 'Sim' : 'Não'}</p>
          <div class="card-rating" style="font-size:0.85rem;color:var(--color-secondary);margin-top:0.25rem;"><i class="fas fa-star"></i> ${guide.rating}</div>
          <div class="card-actions">
            <button class="btn btn-secondary" data-id="${guide.id}">Contato</button>
          </div>
        </div>
      `;
      return card;
    }

    function renderGuides(list) {
      guidesContainer.innerHTML = '';
      if (list.length === 0) {
        const msg = document.createElement('p');
        msg.textContent = 'Nenhum guia encontrado com os filtros selecionados.';
        guidesContainer.appendChild(msg);
        return;
      }
      list.forEach(g => guidesContainer.appendChild(createGuideCard(g)));
    }

    function applyGuideFilters() {
      let results = [...guidesData];
      const q = nameFilter.value.trim().toLowerCase();
      const uf = stateFilter.value;
      const lang = languageFilter.value;
      const driver = driverFilter.checked;
      if (q) {
        results = results.filter(g => g.name.toLowerCase().includes(q) || g.municipio.toLowerCase().includes(q));
      }
      if (uf) {
        results = results.filter(g => g.uf === uf);
      }
      if (lang) {
        results = results.filter(g => {
          if (!g.languages) return false;
          if (Array.isArray(g.languages)) {
            return g.languages.map(l => l.toLowerCase()).includes(lang.toLowerCase());
          }
          // if languages stored as string separated by comma
          return g.languages.toLowerCase().split(/[,|]/).map(s => s.trim()).includes(lang.toLowerCase());
        });
      }
      if (driver) {
        results = results.filter(g => g.driver === true);
      }
      renderGuides(results);
    }

    // Add listeners
    [nameFilter, stateFilter, languageFilter, driverFilter].forEach(el => {
      if (el) el.addEventListener('input', applyGuideFilters);
      if (el) el.addEventListener('change', applyGuideFilters);
    });
    if (clearGuideBtn) {
      clearGuideBtn.addEventListener('click', () => {
        nameFilter.value = '';
        stateFilter.value = '';
        languageFilter.value = '';
        driverFilter.checked = false;
        renderGuides(guidesData);
      });
    }

    // Load guides from external JSON and render them.  
    // The call to loadGuides() will populate guidesData and then call renderGuides().
    loadGuides();

    // Guide contact modal
    const guideModal = document.getElementById('guideDetailsModal');
    const guideContent = document.getElementById('guideDetailsContent');
    const guideClose = document.getElementById('guideDetailsClose');
    function openGuideModal(id) {
      const guide = guidesData.find(g => g.id === id);
      if (!guide) return;
      guideContent.innerHTML = `
        <h2 style="margin-bottom:1rem;font-family:'Sora',sans-serif;">${guide.name}</h2>
        ${guide.image ? `<img src="${guide.image}" alt="${guide.name}" style="width:100%;border-radius:8px;margin-bottom:1rem;" />` : ''}
        <p><strong>Estado:</strong> ${guide.uf}</p>
        <p><strong>Município:</strong> ${guide.municipio}</p>
        <p><strong>Idiomas:</strong> ${Array.isArray(guide.languages) ? guide.languages.join(', ') : guide.languages}</p>
        <p><strong>Categoria:</strong> ${guide.category}</p>
        <p><strong>Segmento:</strong> ${guide.segment}</p>
        <p><strong>Guia Motorista:</strong> ${guide.driver ? 'Sim' : 'Não'}</p>
        <p><strong>Avaliação:</strong> ${guide.rating} / 5.0</p>
        ${guide.description ? `<p style="margin-top:0.75rem;">${guide.description}</p>` : ''}
        <hr style="margin:1rem 0;" />
        <p><strong>Telefone:</strong> ${guide.telefone || '(não informado)'}<br><strong>Email:</strong> ${guide.email || '(não informado)'}</p>
        ${guide.website ? `<p><strong>Website:</strong> <a href="${guide.website}" target="_blank" rel="noopener">${guide.website}</a></p>` : ''}
      `;
      guideModal.classList.add('open');
    }
    if (guideClose) guideClose.addEventListener('click', () => guideModal.classList.remove('open'));
    if (guideModal) {
      guideModal.addEventListener('click', (e) => {
        if (e.target === guideModal) guideModal.classList.remove('open');
      });
    }
    guidesContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-id]');
      if (btn) {
        const id = btn.getAttribute('data-id');
        openGuideModal(id);
      }
    });
  }

  /* About page counters */
  const counterElements = document.querySelectorAll('.counter');
  if (counterElements.length > 0) {
    const animateCounter = (el) => {
      const target = parseInt(el.getAttribute('data-target'));
      const duration = 2000;
      let start = 0;
      const startTime = performance.now();
      function update(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const current = Math.floor(progress * target);
        el.textContent = current;
        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          el.textContent = target;
        }
      }
      requestAnimationFrame(update);
    };
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.6 });
    counterElements.forEach(el => observer.observe(el));
  }

  // === Initialização de navegação e páginas ===
  // Configura a barra de navegação (login/user) e a busca global
  // Compute slug properties before any page initialisation
  computeSlugs();
  navigationSessionPromise = setupNavigation();
  setupGlobalSearch();
  // Inicializa páginas específicas com base nas classes do body
  const bodyClasses = document.body.classList;
  if (bodyClasses.contains('home-page')) {
    initHomePage();
  }
  if (bodyClasses.contains('expeditions-page')) {
    initExpeditionsPage();
  }
  if (bodyClasses.contains('expedition-page')) {
    initExpeditionPage();
  }
  if (bodyClasses.contains('trail-page')) {
    initTrailPage();
  }
  if (bodyClasses.contains('guide-page')) {
    initGuideProfilePage();
  }
  if (bodyClasses.contains('blog-page')) {
    initBlogPage();
  }
  if (bodyClasses.contains('post-page')) {
    initBlogPostPage();
  }
  });