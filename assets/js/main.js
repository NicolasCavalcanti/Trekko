/* Trekko - JavaScript principal */
(function () {
  const selectors = {
    navToggle: '.nav__toggle',
    navMenu: '.nav__menu',
    searchForm: '#searchForm',
    autocomplete: '#autocomplete',
    guideHighlights: '#guideHighlights',
    trailHighlights: '#trailHighlights',
    estadosGrid: '#estadosGrid',
    trailsList: '#trailsList',
    guidesList: '#guidesList',
    expeditionsList: '#expeditionsList',
  };

  const state = {
    autocompleteItems: [],
    autocompleteActiveIndex: -1,
  };

  const debounce = (fn, delay = 250) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined || value === '') return '—';
    return Number(value).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    });
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('pt-BR');
  };

  const parseQuery = () => Object.fromEntries(new URLSearchParams(window.location.search));

  const updateQuery = (params) => {
    const url = new URL(window.location.href);
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, value);
      }
    });
    window.history.pushState({}, '', url);
  };

  const fetchJSON = async (url, options = {}) => {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      credentials: options.credentials || 'include',
      ...options,
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Erro ${response.status}`);
    }
    return response.json();
  };

  const createTrailCard = (trail) => {
    const article = document.createElement('article');
    article.className = 'card card--trail';
    article.setAttribute('itemscope', '');
    article.setAttribute('itemtype', 'https://schema.org/TouristTrip');

    const image = document.createElement('img');
    image.className = 'card__media';
    image.loading = 'lazy';
    image.width = 400;
    image.height = 250;
    image.src = trail?.imageUrl || 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=800&q=80';
    image.alt = trail?.imageAlt || `Vista da trilha ${trail?.nome || 'desconhecida'}`;
    article.appendChild(image);

    const body = document.createElement('div');
    body.className = 'card__body';
    article.appendChild(body);

    const title = document.createElement('h3');
    title.className = 'card__title';
    title.itemProp = 'name';
    title.textContent = trail?.nome || 'Trilha sem nome';
    body.appendChild(title);

    const meta = document.createElement('p');
    meta.className = 'card__meta';
    meta.innerHTML = `
      <span itemprop="touristType">Nível: ${trail?.nivel || '—'}</span> •
      <span><span itemprop="distance">${trail?.km || '—'}</span> km</span> •
      <span>Ganho <span itemprop="itinerary">${trail?.ganho || '—'}</span> m</span>
    `;
    body.appendChild(meta);

    const location = document.createElement('p');
    location.className = 'card__location';
    location.innerHTML = `${trail?.cidade || 'Cidade desconhecida'}, ${trail?.estado || 'UF'} • ${trail?.parque || 'Área de conservação'}`;
    body.appendChild(location);

    const link = document.createElement('a');
    link.className = 'button button--ghost';
    link.href = `/trilha.html?id=${encodeURIComponent(trail?.id)}`;
    link.textContent = 'Ver detalhes';
    body.appendChild(link);

    return article;
  };

  const createGuideCard = (guide) => {
    const article = document.createElement('article');
    article.className = 'card card--guide';
    article.setAttribute('itemscope', '');
    article.setAttribute('itemtype', 'https://schema.org/Person');

    const image = document.createElement('img');
    image.className = 'card__avatar';
    image.loading = 'lazy';
    image.width = 160;
    image.height = 160;
    image.src = guide?.fotoUrl || 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=320&q=80';
    image.alt = guide?.fotoAlt || `Foto do guia ${guide?.nome || 'sem registro'}`;
    article.appendChild(image);

    const body = document.createElement('div');
    body.className = 'card__body';
    article.appendChild(body);

    const title = document.createElement('h3');
    title.className = 'card__title';
    title.itemProp = 'name';
    title.textContent = guide?.nome || 'Guia sem nome';
    body.appendChild(title);

    const cad = document.createElement('p');
    cad.className = 'card__meta';
    cad.innerHTML = `CADASTUR: <span itemprop="identifier">${guide?.cadastur || '—'}</span>`;
    body.appendChild(cad);

    const city = document.createElement('p');
    city.className = 'card__meta';
    city.textContent = `UF/Cidade: ${guide?.uf || '—'} — ${guide?.municipio || '—'}`;
    body.appendChild(city);

    const actions = document.createElement('div');
    actions.className = 'card__actions';
    body.appendChild(actions);

    const profile = document.createElement('a');
    profile.className = 'button button--primary';
    profile.href = `/guia.html?id=${encodeURIComponent(guide?.id)}`;
    profile.textContent = 'Ver perfil';
    actions.appendChild(profile);

    if (guide?.contatos?.whatsapp) {
      const wa = document.createElement('a');
      wa.className = 'button';
      wa.href = `https://wa.me/${guide.contatos.whatsapp.replace(/\D/g, '')}`;
      wa.target = '_blank';
      wa.rel = 'noopener';
      wa.textContent = 'WhatsApp';
      actions.appendChild(wa);
    }

    return article;
  };

  const renderStateCard = (stateData) => {
    const article = document.createElement('article');
    article.className = 'state-card';
    article.innerHTML = `
      <img class="state-card__image" src="${stateData.imageUrl || 'https://images.unsplash.com/photo-1523419409543-0c1df022bdd1?auto=format&fit=crop&w=400&q=80'}" alt="Paisagem do estado ${stateData.uf}" loading="lazy" width="320" height="180" />
      <div>
        <p class="badge">${stateData.total} trilhas</p>
        <h3>${stateData.uf}</h3>
        <p class="muted">${stateData.cidade || ''}</p>
      </div>
      <a class="button button--ghost" href="/trilhas.html?estado=${stateData.uf}">Explorar</a>
    `;
    return article;
  };

  const updateDataState = (element, stateName) => {
    if (!element) return;
    element.dataset.state = stateName;
    element.setAttribute('aria-busy', stateName === 'loading' ? 'true' : 'false');
  };

  const initNav = () => {
    const toggle = document.querySelector(selectors.navToggle);
    const menu = document.querySelector(selectors.navMenu);
    if (!toggle || !menu) return;
    const closeMenu = () => {
      menu.dataset.state = 'closed';
      toggle.setAttribute('aria-expanded', 'false');
    };
    closeMenu();
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      if (expanded) {
        closeMenu();
      } else {
        menu.dataset.state = 'open';
      }
    });
    document.addEventListener('keyup', (event) => {
      if (event.key === 'Escape') {
        closeMenu();
        toggle.focus();
      }
    });
  };

  const initSearchAutocomplete = () => {
    const form = document.querySelector(selectors.searchForm);
    const list = document.querySelector(selectors.autocomplete);
    if (!form || !list) return;
    const input = form.querySelector('input[type="search"]');
    if (!input) return;

    const closeList = () => {
      list.hidden = true;
      list.innerHTML = '';
      state.autocompleteItems = [];
      state.autocompleteActiveIndex = -1;
    };

    const openList = () => {
      list.hidden = false;
    };

    const renderItems = (items) => {
      list.innerHTML = '';
      if (!items.length) {
        closeList();
        return;
      }
      items.forEach((item, index) => {
        const li = document.createElement('li');
        li.id = `autocomplete-${index}`;
        li.role = 'option';
        li.textContent = item.label;
        li.dataset.value = item.value;
        li.addEventListener('mousedown', (event) => {
          event.preventDefault();
          input.value = item.value;
          closeList();
          form.submit();
        });
        list.appendChild(li);
      });
      openList();
    };

    const search = debounce(async (value) => {
      if (!value || value.length < 2) {
        closeList();
        return;
      }
      try {
        const data = await fetchJSON(`/api/search/autocomplete?q=${encodeURIComponent(value)}`);
        const items = (data?.results || []).map((result) => ({
          label: `${result.nome} — ${result.cidade || result.parque || result.estado || ''}`.trim(),
          value: result.nome || result.cidade || result.estado,
        }));
        state.autocompleteItems = items;
        renderItems(items);
      } catch (error) {
        console.warn('Autocomplete error', error);
        closeList();
      }
    }, 250);

    input.addEventListener('input', (event) => {
      search(event.target.value);
    });

    input.addEventListener('keydown', (event) => {
      const items = Array.from(list.querySelectorAll('li'));
      if (!items.length) return;
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          state.autocompleteActiveIndex = (state.autocompleteActiveIndex + 1) % items.length;
          break;
        case 'ArrowUp':
          event.preventDefault();
          state.autocompleteActiveIndex = (state.autocompleteActiveIndex - 1 + items.length) % items.length;
          break;
        case 'Enter':
          if (state.autocompleteActiveIndex >= 0) {
            event.preventDefault();
            const item = state.autocompleteItems[state.autocompleteActiveIndex];
            input.value = item?.value || input.value;
            closeList();
            form.submit();
          }
          break;
        case 'Escape':
          closeList();
          break;
        default:
          break;
      }
      items.forEach((item, index) => {
        const isSelected = index === state.autocompleteActiveIndex;
        item.setAttribute('aria-selected', String(isSelected));
        if (isSelected) {
          input.setAttribute('aria-activedescendant', item.id);
        }
      });
    });

    document.addEventListener('click', (event) => {
      if (!list.contains(event.target) && event.target !== input) {
        closeList();
      }
    });
  };

  const initHighlights = async () => {
    const trailContainer = document.querySelector(selectors.trailHighlights);
    if (trailContainer) {
      updateDataState(trailContainer, 'loading');
      try {
        const data = await fetchJSON('/api/trails?limit=10&sort=featured');
        const trails = data?.data || data?.results || [];
        if (!trails.length) {
          updateDataState(trailContainer, 'empty');
        } else {
          trailContainer.innerHTML = '';
          trails.forEach((trail) => trailContainer.appendChild(createTrailCard(trail)));
          updateDataState(trailContainer, 'ready');
        }
      } catch (error) {
        console.error(error);
        updateDataState(trailContainer, 'error');
      }
    }

    const guideContainer = document.querySelector(selectors.guideHighlights);
    if (guideContainer) {
      updateDataState(guideContainer, 'loading');
      try {
        const data = await fetchJSON('/api/guides?limit=4&sort=featured');
        const guides = data?.data || data?.results || [];
        if (!guides.length) {
          updateDataState(guideContainer, 'empty');
        } else {
          guideContainer.innerHTML = '';
          guides.forEach((guide) => guideContainer.appendChild(createGuideCard(guide)));
          updateDataState(guideContainer, 'ready');
        }
      } catch (error) {
        console.error(error);
        updateDataState(guideContainer, 'error');
      }
    }

    const estadosGrid = document.querySelector(selectors.estadosGrid);
    if (estadosGrid) {
      updateDataState(estadosGrid, 'loading');
      try {
        const data = await fetchJSON('/api/trails/states');
        const states = data?.data || data?.results || [];
        if (!states.length) {
          updateDataState(estadosGrid, 'empty');
        } else {
          estadosGrid.innerHTML = '';
          states.forEach((stateInfo) => estadosGrid.appendChild(renderStateCard(stateInfo)));
          updateDataState(estadosGrid, 'ready');
        }
      } catch (error) {
        console.error(error);
        updateDataState(estadosGrid, 'error');
      }
    }
  };

  const renderPagination = ({ container, meta, onPageChange }) => {
    if (!container || !meta) return;
    const { page = 1, totalPages = 1 } = meta;
    container.innerHTML = '';
    if (totalPages <= 1) {
      container.hidden = true;
      return;
    }
    container.hidden = false;
    const createLink = (label, targetPage, disabled = false, ariaLabel) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'pagination__link';
      button.textContent = label;
      if (ariaLabel) button.setAttribute('aria-label', ariaLabel);
      if (disabled) {
        button.disabled = true;
        button.setAttribute('aria-disabled', 'true');
      } else {
        button.addEventListener('click', () => onPageChange(targetPage));
      }
      return button;
    };

    container.appendChild(createLink('Anterior', page - 1, page <= 1, 'Página anterior'));
    for (let p = 1; p <= totalPages; p += 1) {
      const link = createLink(String(p), p, false, `Ir para página ${p}`);
      if (p === page) {
        link.setAttribute('aria-current', 'page');
      }
      container.appendChild(link);
    }
    container.appendChild(createLink('Próxima', page + 1, page >= totalPages, 'Próxima página'));
  };

  const initTrailsList = () => {
    const listContainer = document.querySelector(selectors.trailsList);
    if (!listContainer) return;
    const form = document.querySelector('#trailFilters');
    const counter = document.querySelector('#trailCounter');
    const pagination = document.querySelector('#trailPagination');

    const applyFiltersFromQuery = () => {
      if (!form) return;
      const params = parseQuery();
      Array.from(form.elements).forEach((field) => {
        if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement)) return;
        if (field.type === 'checkbox') {
          field.checked = params[field.name] === 'true';
        } else {
          field.value = params[field.name] || '';
        }
      });
    };

    const buildQuery = () => {
      const params = new URLSearchParams();
      if (!form) return params;
      Array.from(form.elements).forEach((field) => {
        if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement)) return;
        if (!field.name) return;
        if (field.type === 'checkbox') {
          if (field.checked) params.set(field.name, 'true');
        } else if (field.value) {
          params.set(field.name, field.value);
        }
      });
      return params;
    };

    const loadTrails = async () => {
      updateDataState(listContainer, 'loading');
      const params = buildQuery();
      const url = `/api/trails?${params.toString()}`;
      try {
        const data = await fetchJSON(url);
        const trails = data?.data || data?.results || [];
        const meta = data?.meta || { total: trails.length, page: Number(params.get('page')) || 1, perPage: trails.length, totalPages: data?.totalPages || 1 };
        listContainer.innerHTML = '';
        if (!trails.length) {
          updateDataState(listContainer, 'empty');
        } else {
          trails.forEach((trail) => listContainer.appendChild(createTrailCard(trail)));
          updateDataState(listContainer, 'ready');
        }
        if (counter) {
          const from = (meta.page - 1) * meta.perPage + (trails.length ? 1 : 0);
          const to = (meta.page - 1) * meta.perPage + trails.length;
          counter.textContent = trails.length ? `Exibindo ${from}–${to} de ${meta.total} trilhas` : 'Nenhuma trilha encontrada';
        }
        if (pagination) {
          renderPagination({
            container: pagination,
            meta: {
              page: meta.page,
              totalPages: meta.totalPages || Math.ceil((meta.total || trails.length) / (meta.perPage || 1)) || 1,
            },
            onPageChange: (page) => {
              updateQuery({ page });
              if (form) {
                const pageField = form.querySelector('[name="page"]');
                if (pageField) {
                  pageField.value = page;
                } else {
                  const hidden = document.createElement('input');
                  hidden.type = 'hidden';
                  hidden.name = 'page';
                  hidden.value = page;
                  form.appendChild(hidden);
                }
              }
              window.scrollTo({ top: 0, behavior: 'smooth' });
              loadTrails();
            },
          });
        }
      } catch (error) {
        console.error(error);
        updateDataState(listContainer, 'error');
        if (counter) counter.textContent = 'Erro ao carregar trilhas.';
      }
    };

    applyFiltersFromQuery();

    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const params = buildQuery();
        updateQuery(Object.fromEntries(params.entries()));
        loadTrails();
      });
    }

    window.addEventListener('popstate', () => {
      applyFiltersFromQuery();
      loadTrails();
    });

    loadTrails();
  };

  const initTrailDetails = async () => {
    const trailMain = document.querySelector('[data-trail-details]');
    if (!trailMain) return;
    const params = parseQuery();
    const { id } = params;
    if (!id) return;

    const status = trailMain.querySelector('[data-trail-status]');
    if (status) status.dataset.state = 'loading';

    try {
      const trail = await fetchJSON(`/api/trails/${encodeURIComponent(id)}`);
      renderTrailDetail(trail);
      if (status) status.dataset.state = 'ready';
      if (trail?.nome) {
        document.title = `${trail.nome} — Trekko`;
        const canonical = document.querySelector('link[rel="canonical"]');
        if (canonical) {
          const url = new URL(window.location.href);
          canonical.href = url.href;
        }
      }
      loadTrailExpeditions(id);
      loadTrailComments(id);
    } catch (error) {
      console.error(error);
      if (status) status.dataset.state = 'error';
    }
  };

  const updateTrailSchema = (trail) => {
    const script = document.querySelector('#trailSchema');
    if (!script) return;
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'TouristTrip',
      name: trail?.nome,
      description: trail?.descricao,
      itinerary: `${trail?.cidade || ''}, ${trail?.estado || ''}`.trim(),
      touristType: trail?.nivel,
      distance: trail?.km ? `${trail.km} km` : undefined,
      provider: trail?.parque,
      offers: {
        '@type': 'Offer',
        price: trail?.entradaPaga ? trail?.valorEntrada : 0,
        priceCurrency: 'BRL',
        availability: 'https://schema.org/InStock',
      },
    };
    script.textContent = JSON.stringify(schema);
  };

  const renderTrailDetail = (trail) => {
    const nameEl = document.querySelector('[data-trail-name]');
    if (nameEl) nameEl.textContent = trail?.nome || 'Trilha';

    const summaryEl = document.querySelector('[data-trail-summary]');
    if (summaryEl) summaryEl.textContent = trail?.descricao || '';

    const metaEl = document.querySelector('[data-trail-meta]');
    if (metaEl) metaEl.textContent = `${trail?.nivel || '—'} • ${trail?.km || '—'} km • Ganho ${trail?.ganho || '—'} m`;

    const locationEl = document.querySelector('[data-trail-location]');
    if (locationEl) locationEl.textContent = `${trail?.cidade || ''} — ${trail?.estado || ''} • ${trail?.parque || ''}`;

    const costTable = document.querySelector('[data-trail-costs] tbody');
    if (costTable) {
      costTable.innerHTML = `
        <tr><td>Entrada</td><td>${trail?.entradaPaga ? formatCurrency(trail?.valorEntrada) : 'Gratuita'}</td></tr>
        <tr><td>Camping</td><td>${trail?.camping ? formatCurrency(trail?.valorCamping) : 'Não possui'}</td></tr>
        <tr><td>Estacionamento</td><td>${trail?.estacionamento ? formatCurrency(trail?.valorEstacionamento) : 'Não possui'}</td></tr>
      `;
    }

    const infraList = document.querySelector('[data-trail-infra]');
    if (infraList) {
      infraList.innerHTML = '';
      const facilities = [
        trail?.agua ? 'Pontos de água disponíveis' : 'Sem pontos de água',
        trail?.camping ? 'Área de camping disponível' : 'Sem área de camping',
        trail?.estacionamento ? 'Estacionamento disponível' : 'Sem estacionamento no local',
      ];
      facilities.forEach((facility) => {
        const li = document.createElement('li');
        li.textContent = facility;
        infraList.appendChild(li);
      });
    }

    const logistics = document.querySelector('[data-trail-logistics]');
    if (logistics) {
      logistics.innerHTML = '';
      const transport = trail?.logistica || [];
      transport.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'details-grid__item';
        div.innerHTML = `
          <h3>${item.tipo}</h3>
          <p class="muted">${item.nome} — ${item.cidade}</p>
          <p class="badge">${item.distanciaKm} km</p>
        `;
        logistics.appendChild(div);
      });
    }

    const mapFrame = document.querySelector('[data-trail-map]');
    if (mapFrame) {
      mapFrame.src = trail?.mapaUrl || 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3673.829105538956!2d-43.1779092!3d-22.9068466!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x997f5bdf3bd3ab%3A0x8d546c1f9e4edc35!2sBrasil!5e0!3m2!1spt-BR!2sbr!4v1600000000000!5m2!1spt-BR!2sbr';
    }

    updateTrailSchema(trail);
  };

  const loadTrailExpeditions = async (trailId) => {
    const container = document.querySelector('#trailExpeditions');
    if (!container) return;
    updateDataState(container, 'loading');
    try {
      const data = await fetchJSON(`/api/expeditions?trailId=${encodeURIComponent(trailId)}&from=${encodeURIComponent(new Date().toISOString())}`);
      const expeditions = data?.data || data?.results || [];
      container.innerHTML = '';
      if (!expeditions.length) {
        updateDataState(container, 'empty');
      } else {
        expeditions.forEach((expedition) => container.appendChild(renderExpeditionCard(expedition)));
        updateDataState(container, 'ready');
      }
    } catch (error) {
      console.error(error);
      updateDataState(container, 'error');
    }
  };

  const renderExpeditionCard = (expedition) => {
    const article = document.createElement('article');
    article.className = 'event-card';
    article.setAttribute('itemscope', '');
    article.setAttribute('itemtype', 'https://schema.org/Event');
    article.innerHTML = `
      <h3 itemprop="name">${expedition?.titulo || expedition?.trail?.nome || 'Expedição'}</h3>
      <p class="event-card__meta">
        <span class="tag" itemprop="startDate">${formatDate(expedition?.inicio)}</span>
        <span class="tag" itemprop="endDate">${formatDate(expedition?.fim)}</span>
        <span class="tag">${expedition?.vagas || 0} vagas</span>
      </p>
      <p>${expedition?.descricao || ''}</p>
      <p class="badge">${formatCurrency(expedition?.precoPorPessoa)} por pessoa</p>
      <a class="button button--primary" href="/expedicoes.html?trailId=${encodeURIComponent(expedition?.trailId)}">Agendar</a>
    `;
    return article;
  };

  const loadTrailComments = async (trailId) => {
    const container = document.querySelector('#trailComments');
    if (!container) return;
    const list = container.querySelector('[data-comments-list]');
    const status = container.querySelector('.status-indicator');
    if (status) status.dataset.state = 'loading';
    try {
      const data = await fetchJSON(`/api/trails/${encodeURIComponent(trailId)}/comments`);
      const comments = data?.data || data?.results || [];
      list.innerHTML = '';
      if (!comments.length) {
        list.innerHTML = '<p class="muted">Nenhum comentário ainda. Seja o primeiro a compartilhar sua experiência.</p>';
        if (status) status.dataset.state = 'ready';
        return;
      }
      comments.forEach((comment) => {
        const article = document.createElement('article');
        article.className = 'comment';
        article.innerHTML = `
          <header class="comment__header">
            <span class="comment__author">${comment?.autor || 'Anônimo'}</span>
            <time class="muted" datetime="${comment?.criadoEm}">${formatDate(comment?.criadoEm)}</time>
          </header>
          <p>${comment?.mensagem || ''}</p>
        `;
        list.appendChild(article);
      });
      if (status) status.dataset.state = 'ready';
    } catch (error) {
      console.error(error);
      if (status) status.dataset.state = 'error';
    }
  };

  const initCommentForm = () => {
    const form = document.querySelector('#commentForm');
    if (!form) return;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submitButton = form.querySelector('button[type="submit"]');
      if (submitButton) submitButton.disabled = true;
      const formData = new FormData(form);
      const trailId = form.dataset.trailId;
      try {
        const payload = Object.fromEntries(formData.entries());
        await fetchJSON(`/api/trails/${encodeURIComponent(trailId)}/comments`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        form.reset();
        loadTrailComments(trailId);
      } catch (error) {
        alert('Não foi possível enviar seu comentário. Faça login e tente novamente.');
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  };

  const initGuidesList = () => {
    const list = document.querySelector(selectors.guidesList);
    if (!list) return;
    const form = document.querySelector('#guideFilters');
    const pagination = document.querySelector('#guidePagination');
    const updatedAt = document.querySelector('#cadasturUpdatedAt');

    const applyFilters = () => {
      if (!form) return;
      const params = parseQuery();
      Array.from(form.elements).forEach((field) => {
        if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement)) return;
        if (field.type === 'checkbox') {
          field.checked = params[field.name] === 'true';
        } else {
          field.value = params[field.name] || '';
        }
      });
    };

    const buildQuery = () => {
      const params = new URLSearchParams();
      if (!form) return params;
      Array.from(form.elements).forEach((field) => {
        if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement)) return;
        if (!field.name) return;
        if (field.value) params.set(field.name, field.value);
      });
      return params;
    };

    const loadGuides = async () => {
      updateDataState(list, 'loading');
      const params = buildQuery();
      if (!params.get('page')) params.set('page', '1');
      if (!params.get('limit')) params.set('limit', '30');
      try {
        const data = await fetchJSON(`/api/guides?${params.toString()}`);
        const guides = data?.data || data?.results || [];
        const meta = data?.meta || { page: Number(params.get('page')), totalPages: 1 };
        list.innerHTML = '';
        if (!guides.length) {
          updateDataState(list, 'empty');
        } else {
          guides.forEach((guide) => list.appendChild(createGuideCard(guide)));
          updateDataState(list, 'ready');
        }
        if (updatedAt && data?.meta?.updatedAt) {
          updatedAt.textContent = formatDate(data.meta.updatedAt);
        }
        if (pagination) {
          renderPagination({
            container: pagination,
            meta: {
              page: meta.page,
              totalPages: meta.totalPages || Math.ceil((meta.total || guides.length) / 30) || 1,
            },
            onPageChange: (page) => {
              updateQuery({ page });
              params.set('page', String(page));
              window.scrollTo({ top: 0, behavior: 'smooth' });
              loadGuides();
            },
          });
        }
      } catch (error) {
        console.error(error);
        updateDataState(list, 'error');
      }
    };

    applyFilters();

    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const params = buildQuery();
        updateQuery(Object.fromEntries(params.entries()));
        loadGuides();
      });
    }

    window.addEventListener('popstate', () => {
      applyFilters();
      loadGuides();
    });

    loadGuides();
  };

  const initGuideProfile = async () => {
    const container = document.querySelector('[data-guide-profile]');
    if (!container) return;
    const params = parseQuery();
    const { id } = params;
    if (!id) return;
    const status = container.querySelector('.status-indicator');
    if (status) status.dataset.state = 'loading';
    try {
      const guide = await fetchJSON(`/api/guides/${encodeURIComponent(id)}`);
      renderGuideProfile(guide);
      if (status) status.dataset.state = 'ready';
      loadGuideExpeditions(id);
    } catch (error) {
      console.error(error);
      if (status) status.dataset.state = 'error';
    }
  };

  const updateGuideSchema = (guide) => {
    const script = document.querySelector('#guideSchema');
    if (!script) return;
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: guide?.nome,
      identifier: guide?.cadastur,
      address: {
        '@type': 'PostalAddress',
        addressRegion: guide?.uf,
        addressLocality: guide?.municipio,
        addressCountry: 'BR',
      },
      description: guide?.bio,
      image: guide?.fotoUrl,
      sameAs: Object.values(guide?.contatos || {}).filter(Boolean),
    };
    script.textContent = JSON.stringify(schema);
  };

  const renderGuideProfile = (guide) => {
    const nameEl = document.querySelector('[data-guide-name]');
    if (nameEl) nameEl.textContent = guide?.nome || 'Guia';
    const cadEl = document.querySelector('[data-guide-cadastur]');
    if (cadEl) cadEl.textContent = guide?.cadastur || '—';
    const cityEl = document.querySelector('[data-guide-city]');
    if (cityEl) cityEl.textContent = `${guide?.municipio || ''} — ${guide?.uf || ''}`;
    const bioEl = document.querySelector('[data-guide-bio]');
    if (bioEl) bioEl.textContent = guide?.bio || 'Este guia ainda não escreveu uma biografia.';
    const photoEl = document.querySelector('[data-guide-photo]');
    if (photoEl) {
      photoEl.src = guide?.fotoUrl || photoEl.src;
      photoEl.alt = `Foto do guia ${guide?.nome}`;
    }
    const contactsList = document.querySelector('[data-guide-contacts]');
    if (contactsList) {
      contactsList.innerHTML = '';
      const contacts = guide?.contatos || {};
      Object.entries(contacts).forEach(([key, value]) => {
        if (!value) return;
        const li = document.createElement('li');
        const label = key.replace(/_/g, ' ');
        if (key === 'whatsapp') {
          const sanitized = value.replace(/\D/g, '');
          li.innerHTML = `<a href="https://wa.me/${sanitized}" target="_blank" rel="noopener">WhatsApp: ${value}</a>`;
        } else {
          li.textContent = `${label}: ${value}`;
        }
        contactsList.appendChild(li);
      });
    }
    const whatsappButton = document.querySelector('[data-guide-whatsapp]');
    if (whatsappButton && guide?.contatos?.whatsapp) {
      whatsappButton.href = `https://wa.me/${guide.contatos.whatsapp.replace(/\D/g, '')}`;
    }

    updateGuideSchema(guide);
  };

  const loadGuideExpeditions = async (guideId) => {
    const container = document.querySelector('#guideExpeditions');
    if (!container) return;
    updateDataState(container, 'loading');
    try {
      const data = await fetchJSON(`/api/expeditions?guideId=${encodeURIComponent(guideId)}`);
      const expeditions = data?.data || data?.results || [];
      container.innerHTML = '';
      if (!expeditions.length) {
        updateDataState(container, 'empty');
      } else {
        expeditions.forEach((expedition) => container.appendChild(renderExpeditionCard(expedition)));
        updateDataState(container, 'ready');
      }
    } catch (error) {
      console.error(error);
      updateDataState(container, 'error');
    }
  };

  const initExpeditionForm = () => {
    const form = document.querySelector('#expeditionForm');
    if (!form) return;
    const trailSelect = form.querySelector('[name="trailId"]');
    const status = form.querySelector('.status-indicator');
    const loadTrailsOptions = async () => {
      if (!trailSelect) return;
      if (status) status.dataset.state = 'loading';
      try {
        const filters = new URLSearchParams();
        const stateField = form.querySelector('[name="estadoFiltro"]');
        const cityField = form.querySelector('[name="cidadeFiltro"]');
        const nameField = form.querySelector('[name="nomeFiltro"]');
        if (stateField?.value) filters.set('estado', stateField.value);
        if (cityField?.value) filters.set('cidade', cityField.value);
        if (nameField?.value) filters.set('nome', nameField.value);
        const data = await fetchJSON(`/api/trails?${filters.toString()}&limit=50`);
        const trails = data?.data || data?.results || [];
        trailSelect.innerHTML = '<option value="" disabled selected>Selecione uma trilha</option>';
        trails.forEach((trail) => {
          const option = document.createElement('option');
          option.value = trail.id;
          option.textContent = `${trail.nome} — ${trail.cidade}/${trail.estado}`;
          trailSelect.appendChild(option);
        });
        if (status) status.dataset.state = trails.length ? 'ready' : 'empty';
      } catch (error) {
        console.error(error);
        if (status) status.dataset.state = 'error';
      }
    };

    form.querySelectorAll('[data-trail-filter]').forEach((input) => {
      input.addEventListener('change', loadTrailsOptions);
    });

    loadTrailsOptions();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!trailSelect?.value) {
        alert('Selecione uma trilha válida.');
        return;
      }
      const payload = Object.fromEntries(new FormData(form).entries());
      try {
        await fetchJSON('/api/expeditions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        alert('Expedição criada com sucesso!');
        form.reset();
        loadTrailsOptions();
      } catch (error) {
        alert('Erro ao criar expedição. Verifique se sua conta está ativada como guia CADASTUR.');
      }
    });
  };

  const initExpeditionsList = () => {
    const list = document.querySelector(selectors.expeditionsList);
    if (!list) return;
    const form = document.querySelector('#expeditionFilters');
    const pagination = document.querySelector('#expeditionPagination');

    const applyFilters = () => {
      if (!form) return;
      const params = parseQuery();
      Array.from(form.elements).forEach((field) => {
        if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement)) return;
        if (!field.name) return;
        field.value = params[field.name] || '';
      });
    };

    const buildQuery = () => {
      const params = new URLSearchParams();
      if (!form) return params;
      Array.from(form.elements).forEach((field) => {
        if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement)) return;
        if (!field.name || !field.value) return;
        params.set(field.name, field.value);
      });
      if (!params.get('limit')) params.set('limit', '20');
      if (!params.get('page')) params.set('page', '1');
      return params;
    };

    const loadExpeditions = async () => {
      updateDataState(list, 'loading');
      const params = buildQuery();
      try {
        const data = await fetchJSON(`/api/expeditions?${params.toString()}`);
        const expeditions = data?.data || data?.results || [];
        const meta = data?.meta || { page: Number(params.get('page')), totalPages: 1 };
        list.innerHTML = '';
        if (!expeditions.length) {
          updateDataState(list, 'empty');
        } else {
          expeditions.forEach((expedition) => list.appendChild(renderExpeditionCard(expedition)));
          updateDataState(list, 'ready');
        }
        if (pagination) {
          renderPagination({
            container: pagination,
            meta: {
              page: meta.page,
              totalPages: meta.totalPages || Math.ceil((meta.total || expeditions.length) / (meta.perPage || 20)) || 1,
            },
            onPageChange: (page) => {
              updateQuery({ page });
              params.set('page', String(page));
              window.scrollTo({ top: 0, behavior: 'smooth' });
              loadExpeditions();
            },
          });
        }
      } catch (error) {
        console.error(error);
        updateDataState(list, 'error');
      }
    };

    applyFilters();

    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const params = buildQuery();
        updateQuery(Object.fromEntries(params.entries()));
        loadExpeditions();
      });
    }

    window.addEventListener('popstate', () => {
      applyFilters();
      loadExpeditions();
    });

    loadExpeditions();
  };

  const initAuthForms = () => {
    const loginForm = document.querySelector('#loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const payload = Object.fromEntries(new FormData(loginForm).entries());
        try {
          await fetchJSON('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          window.location.href = '/';
        } catch (error) {
          alert('Não foi possível entrar. Verifique suas credenciais.');
        }
      });
    }

    const signupForm = document.querySelector('#signupForm');
    if (signupForm) {
      signupForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const payload = Object.fromEntries(new FormData(signupForm).entries());
        try {
          await fetchJSON('/api/auth/signup', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          window.location.href = '/login.html?signup=success';
        } catch (error) {
          alert('Erro ao criar conta. Verifique os dados informados.');
        }
      });
    }
  };

  const initGuideActivation = () => {
    const activationForm = document.querySelector('#activationForm');
    if (!activationForm) return;
    activationForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(activationForm).entries());
      try {
        await fetchJSON('/api/auth/activate-guide', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        alert('Conta de guia ativada com sucesso!');
        window.location.reload();
      } catch (error) {
        alert('Erro ao ativar guia. Confira seus dados CADASTUR.');
      }
    });
  };

  const initAdminForms = () => {
    const cadasturForm = document.querySelector('#cadasturUploadForm');
    if (cadasturForm) {
      cadasturForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const fileInput = cadasturForm.querySelector('input[type="file"]');
        if (!fileInput?.files?.length) {
          alert('Selecione um arquivo CSV.');
          return;
        }
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        try {
          await fetch('/api/admin/cadastur', {
            method: 'POST',
            body: formData,
          });
          alert('Base CADASTUR atualizada!');
        } catch (error) {
          alert('Erro ao enviar CSV.');
        }
      });
    }
  };

  const initAnalytics = () => {
    if (!document.querySelector('script[data-gtag]')) {
      const gtagScript = document.createElement('script');
      gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-XXXXXXX';
      gtagScript.async = true;
      gtagScript.setAttribute('data-gtag', 'true');
      gtagScript.crossOrigin = 'anonymous';
      document.head.appendChild(gtagScript);
    }
    window.dataLayer = window.dataLayer || [];
    function gtag(){window.dataLayer.push(arguments);}
    gtag('consent', 'default', {
      ad_storage: 'denied',
      analytics_storage: 'granted',
    });
    gtag('js', new Date());
    gtag('config', 'G-XXXXXXX');

    document.querySelectorAll('[data-analytics="cta"]').forEach((element) => {
      element.addEventListener('click', () => {
        gtag('event', 'cta_click', {
          event_category: element.dataset.category || 'cta',
          event_label: element.textContent.trim(),
        });
      });
    });

    document.querySelectorAll('form[data-analytics="filter"]').forEach((form) => {
      form.addEventListener('submit', () => {
        gtag('event', 'filter_submit', {
          event_category: form.dataset.category || 'filter',
          event_label: window.location.pathname,
        });
      });
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initSearchAutocomplete();
    initHighlights();
    initTrailsList();
    initTrailDetails();
    initCommentForm();
    initGuidesList();
    initGuideProfile();
    initExpeditionForm();
    initExpeditionsList();
    initAuthForms();
    initGuideActivation();
    initAdminForms();
    initAnalytics();
  });
})();
