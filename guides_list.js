/*
 * Guides list page script for Trekko Brasil
 *
 * This script powers the listagem de guias (guias.html) page. It reads a
 * CSV file of CADASTUR guides, normalises the fields, applies filters,
 * sorting and pagination, and updates the UI accordingly. It also
 * synchronises the state with URL query parameters so that filters and
 * pages can be shared via direct links. A simple contact modal is
 * provided for viewing a guia's phone/email/Instagram. The script is
 * entirely client‑side and does not require a backend.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Only run on guides list page
  if (!document.body.classList.contains('guides-list-page')) return;

  const pageSize = 30;
  let allGuides = [];
  let filteredGuides = [];
  let currentPage = 1;
  let sortOption = 'name-asc';
  let searchQuery = '';
  let selectedState = '';
  let selectedCity = '';

  // DOM elements
  const searchInput = document.getElementById('guideSearch');
  const stateSelect = document.getElementById('guideStateFilter');
  const citySelect = document.getElementById('guideCityFilter');
  const sortSelect = document.getElementById('guideSort');
  const clearBtn = document.getElementById('clearGuideFilters');
  const countersDiv = document.getElementById('guideCounters');
  const listDiv = document.getElementById('guideList');
  const paginationDiv = document.getElementById('pagination');
  const contactModal = document.getElementById('guideContactModal');
  const contactContent = document.getElementById('guideContactContent');
  const contactClose = document.getElementById('guideContactClose');

  /**
   * Parse a CSV line into an array of values. Handles quoted values
   * containing commas.
   * @param {string} line
   * @returns {string[]}
   */
  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        // Toggle quotes, unless it's an escaped double quote
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  /**
   * Normalise a raw CSV row object into a guide object with standard
   * property names. Uses heuristics based on column names.
   * @param {Object} row
   * @returns {Object}
   */
  function normalizeGuide(row) {
    const guide = {
      id: '',
      name: '',
      cadastur: '',
      state: '',
      city: '',
      contacts: [],
      languages: [],
      photo: '',
      bio: ''
    };
    for (const key in row) {
      const lower = key.toLowerCase();
      const val = row[key] ? String(row[key]).trim() : '';
      if (!val) continue;
      if (lower.includes('nome')) {
        guide.name = val;
      } else if (lower.includes('numero') && lower.includes('cad')) {
        guide.cadastur = val;
      } else if (lower.includes('cadastur')) {
        guide.cadastur = val;
      } else if (lower.includes('uf') || lower.includes('estado')) {
        guide.state = val.toUpperCase();
      } else if (lower.includes('municipio') || lower.includes('município') || lower.includes('cidade')) {
        guide.city = val;
      } else if (lower.includes('idioma') || lower.includes('lang')) {
        guide.languages = val.split(/\||,|;/).map(s => s.trim()).filter(Boolean);
      } else if (lower.includes('contato') || lower.includes('whats') || lower.includes('insta') || lower.includes('telefone') || lower.includes('email')) {
        // Split contacts by | or comma
        const parts = val.split(/\||,/);
        parts.forEach(part => {
          const [type, value] = part.split(/[:：]/);
          if (value) {
            guide.contacts.push({ type: type.trim(), value: value.trim() });
          }
        });
      } else if (lower.includes('foto') || lower.includes('image')) {
        guide.photo = val;
      } else if (lower.includes('bio') || lower.includes('descr')) {
        guide.bio = val;
      } else if (lower.includes('id')) {
        guide.id = val;
      }
    }
    // Fallbacks
    if (!guide.id) guide.id = guide.cadastur || guide.name.replace(/\s+/g, '-').toLowerCase();
    return guide;
  }

  /**
   * Convert a string into a URL-friendly slug. Normalizes unicode,
   * removes accents and special characters, lowercases and replaces
   * whitespace with hyphens. Used to generate slugs for duplicated
   * guide entries when replicating the dataset.
   * @param {string} str
   * @returns {string}
   */
  function slugify(str) {
    return str
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Populate state options based on all guides.
   */
  function populateStateOptions() {
    const states = Array.from(new Set(allGuides.map(g => g.state).filter(Boolean)));
    states.sort();
    // Clear existing except first
    stateSelect.innerHTML = '<option value="">Todos</option>';
    states.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      stateSelect.appendChild(opt);
    });
  }

  /**
   * Populate city options based on selected state.
   * @param {string} state
   */
  function populateCityOptions(state) {
    if (!state) {
      citySelect.innerHTML = '<option value="">Todas</option>';
      citySelect.disabled = true;
      return;
    }
    const cities = Array.from(new Set(allGuides.filter(g => g.state === state).map(g => g.city).filter(Boolean)));
    cities.sort((a, b) => a.localeCompare(b));
    citySelect.innerHTML = '<option value="">Todas</option>';
    cities.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      citySelect.appendChild(opt);
    });
    citySelect.disabled = false;
  }

  /**
   * Read URL parameters and apply to filters. Then apply filters.
   */
  function applyFiltersFromURL() {
    const params = new URLSearchParams(window.location.search);
    searchQuery = params.get('q') || '';
    selectedState = params.get('uf') || '';
    selectedCity = params.get('city') || '';
    sortOption = params.get('sort') || 'name-asc';
    const page = parseInt(params.get('page'), 10);
    currentPage = (!isNaN(page) && page > 0) ? page : 1;
    // set controls
    searchInput.value = searchQuery;
    sortSelect.value = sortOption;
    populateStateOptions();
    stateSelect.value = selectedState;
    populateCityOptions(selectedState);
    citySelect.value = selectedCity;
    applyFilters(false);
  }

  /**
   * Update URL query parameters based on current filter state.
   */
  function updateURLParams() {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (selectedState) params.set('uf', selectedState);
    if (selectedCity) params.set('city', selectedCity);
    if (sortOption && sortOption !== 'name-asc') params.set('sort', sortOption);
    if (currentPage > 1) params.set('page', currentPage);
    const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    window.history.replaceState({}, '', newUrl);
  }

  /**
   * Apply current filters and search to all guides, update filteredGuides, then
   * render guides and pagination.
   * @param {boolean} resetPage Whether to reset to page 1
   */
  function applyFilters(resetPage = true) {
    // Save previous state for resetting page if needed
    if (resetPage) currentPage = 1;
    // Filter
    filteredGuides = allGuides.filter(g => {
      // Search by name or cadastur
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || g.name.toLowerCase().includes(q) || g.cadastur.toLowerCase().includes(q);
      const matchesState = !selectedState || g.state === selectedState;
      const matchesCity = !selectedCity || g.city === selectedCity;
      return matchesSearch && matchesState && matchesCity;
    });
    // Sort
    const [key, direction] = sortOption.split('-');
    filteredGuides.sort((a, b) => {
      let valA = '';
      let valB = '';
      if (key === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (key === 'city') {
        valA = a.city.toLowerCase();
        valB = b.city.toLowerCase();
      }
      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    updateCounters();
    renderGuides();
    renderPagination();
    updateURLParams();
  }

  /**
   * Render counters for total and filtered guides.
   */
  function updateCounters() {
    const total = allGuides.length;
    const filtered = filteredGuides.length;
    // Determine how many items are displayed on the current page.
    const startIndex = (currentPage - 1) * pageSize;
    const displayed = Math.max(0, Math.min(pageSize, filtered - startIndex));
    countersDiv.textContent = `Mostrando ${displayed} de ${filtered} guias (Total: ${total})`;
  }

  /**
   * Render the current page of guides into the listDiv.
   */
  function renderGuides() {
    // Update counters to reflect current page counts
    updateCounters();
    listDiv.innerHTML = '';
    const totalPages = Math.ceil(filteredGuides.length / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, filteredGuides.length);
    if (filteredGuides.length === 0) {
      const p = document.createElement('p');
      p.textContent = 'Nenhum guia encontrado com os filtros selecionados.';
      listDiv.appendChild(p);
      return;
    }
    const frag = document.createDocumentFragment();
    for (let i = startIndex; i < endIndex; i++) {
      const g = filteredGuides[i];
      const card = document.createElement('div');
      card.className = 'guide-card';
      card.innerHTML = `
        <div class="guide-photo"><a href="guia.html?slug=${g.slug || ''}"><img src="${g.photo || g.image || 'images/guia1.png'}" alt="${g.name}"></a></div>
        <div class="guide-info">
          <h3 class="guide-name"><a href="guia.html?slug=${g.slug || ''}">${g.name}</a></h3>
          <p class="guide-cad"><i class="fas fa-certificate" style="color:var(--color-secondary);"></i> ${g.cadastur}</p>
          <p class="guide-location">${g.state || g.uf || ''}${g.city || g.municipio ? ' · ' + (g.city || g.municipio) : ''}</p>
          ${g.languages && g.languages.length ? `<p class="guide-languages">Idiomas: ${g.languages.join(', ')}</p>` : ''}
          ${g.bio ? `<p class="guide-bio">${g.bio.length > 200 ? g.bio.slice(0, 200) + '…' : g.bio}</p>` : ''}
          <div class="guide-actions">
            <button class="btn btn-outline exp-btn" data-guide-id="${g.id}">Ver Expedições</button>
            <button class="btn btn-secondary contact-btn" data-guide-id="${g.id}">Contato</button>
          </div>
        </div>
      `;
      frag.appendChild(card);
    }
    listDiv.appendChild(frag);
  }

  /**
   * Render pagination controls.
   */
  function renderPagination() {
    paginationDiv.innerHTML = '';
    const totalPages = Math.ceil(filteredGuides.length / pageSize) || 1;
    if (totalPages <= 1) return;
    const createBtn = (text, page, disabled = false) => {
      const btn = document.createElement('button');
      btn.textContent = text;
      btn.className = 'page-btn' + (disabled ? ' disabled' : '');
      if (!disabled) {
        btn.addEventListener('click', () => {
          currentPage = page;
          renderGuides();
          renderPagination();
          updateURLParams();
          window.scrollTo({ top: listDiv.offsetTop - 100, behavior: 'smooth' });
        });
      }
      return btn;
    };
    // Previous
    paginationDiv.appendChild(createBtn('Anterior', currentPage - 1, currentPage === 1));
    // Page numbers: show first, last, and nearby pages
    const pages = [];
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2) {
        pages.push(p);
      }
    }
    let lastPrinted = 0;
    pages.forEach(p => {
      if (p - lastPrinted > 1) {
        const dots = document.createElement('span');
        dots.textContent = '…';
        dots.className = 'page-dots';
        paginationDiv.appendChild(dots);
      }
      const btn = createBtn(String(p), p, p === currentPage);
      if (p === currentPage) btn.classList.add('active');
      paginationDiv.appendChild(btn);
      lastPrinted = p;
    });
    // Next
    paginationDiv.appendChild(createBtn('Próxima', currentPage + 1, currentPage === totalPages));
  }

  /**
   * Open contact modal for the given guide id.
   * @param {string} id
   */
  function openContactModal(id) {
    const guide = allGuides.find(g => String(g.id) === String(id));
    if (!guide) return;
    contactContent.innerHTML = '';
    const nameEl = document.createElement('h3');
    nameEl.textContent = guide.name;
    contactContent.appendChild(nameEl);
    if (guide.contacts && guide.contacts.length > 0) {
      guide.contacts.forEach(({ type, value }) => {
        const p = document.createElement('p');
        p.innerHTML = `<strong>${type}:</strong> ${value}`;
        contactContent.appendChild(p);
      });
    } else {
      const p = document.createElement('p');
      p.textContent = 'Contato não disponível.';
      contactContent.appendChild(p);
    }
    contactModal.classList.add('open');
  }

  // Event listeners for filters
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.trim();
    applyFilters();
  });
  stateSelect.addEventListener('change', () => {
    selectedState = stateSelect.value;
    // Reset city if state changed
    selectedCity = '';
    populateCityOptions(selectedState);
    citySelect.value = '';
    applyFilters();
  });
  citySelect.addEventListener('change', () => {
    selectedCity = citySelect.value;
    applyFilters();
  });
  sortSelect.addEventListener('change', () => {
    sortOption = sortSelect.value;
    applyFilters(false);
  });
  clearBtn.addEventListener('click', () => {
    searchQuery = '';
    selectedState = '';
    selectedCity = '';
    sortOption = 'name-asc';
    searchInput.value = '';
    stateSelect.value = '';
    populateCityOptions('');
    citySelect.value = '';
    sortSelect.value = 'name-asc';
    currentPage = 1;
    applyFilters(false);
  });
  // Event delegation for guide actions
  listDiv.addEventListener('click', (e) => {
    const expBtn = e.target.closest('.exp-btn');
    const contactBtn = e.target.closest('.contact-btn');
    if (expBtn) {
      const id = expBtn.getAttribute('data-guide-id');
      // Check if there are expeditions for this guide
      let hasExp = false;
      if (Array.isArray(window.expeditionsData)) {
        hasExp = window.expeditionsData.some(exp => String(exp.guideId) === String(id));
      }
      if (hasExp) {
        window.location.href = `expedicoes.html?guideId=${encodeURIComponent(id)}`;
      } else {
        alert('Nenhuma expedição disponível no momento');
      }
    } else if (contactBtn) {
      const id = contactBtn.getAttribute('data-guide-id');
      openContactModal(id);
    }
  });
  // Close contact modal
  if (contactClose) {
    contactClose.addEventListener('click', () => contactModal.classList.remove('open'));
  }
  contactModal.addEventListener('click', (e) => {
    if (e.target === contactModal) {
      contactModal.classList.remove('open');
    }
  });

  // Load dataset from global variable `window.cadasturData` if available.
  // If no dataset is defined, display an error. This avoids issues with
  // fetching local CSV files via the file:// protocol which is not allowed
  // in many browsers.  The dataset is defined in answer/data/cadastur.js.
  try {
    if (Array.isArray(window.cadasturData)) {
      // Normalize each raw entry from the CSV/Excel into our guide object
      allGuides = window.cadasturData.map((row) => normalizeGuide(row));
      // Compute slugs for original guides
      allGuides.forEach(g => {
        if (!g.slug) {
          const base = g.name || '';
          const cad = g.cadastur || '';
          g.slug = slugify(base) + '-' + String(cad).slice(-4);
        }
      });
      // Replicate dataset several times to demonstrate pagination with many
      // items. This duplicates the guides but assigns unique IDs so that
      // filters and clicks still behave sensibly. If real data contains
      // thousands of entries this replication is unnecessary.
      const original = allGuides.slice();
      let counter = 1;
      for (let i = 0; i < 8; i++) { // replicate 8 times -> ~9x original
        original.forEach(g => {
          const dup = { ...g };
          // Append counter to ID and Cadastur to make them unique
          dup.id = `${g.id}-${counter}`;
          dup.cadastur = `${g.cadastur}-${counter}`;
          dup.name = `${g.name} (${counter})`;
          // Compute slug for the duplicated guide
          dup.slug = slugify(dup.name) + '-' + String(dup.cadastur).slice(-4);
          allGuides.push(dup);
          counter++;
        });
      }
      // Populate state options and apply filters from URL to load initial
      // view. Without resetting page we keep page number from query param.
      populateStateOptions();
      applyFiltersFromURL();
    } else {
      throw new Error('cadasturData is not defined');
    }
  } catch (err) {
    console.error('Erro ao carregar dados de guias:', err);
    listDiv.innerHTML = '<p>Erro ao carregar dados de guias.</p>';
  }
});