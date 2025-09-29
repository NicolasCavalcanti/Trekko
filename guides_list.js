/* guides_list.js – Lista de Guias 100% CADASTUR */

(function () {
  const grid = document.getElementById('guidesGrid');
  const countersDiv = document.getElementById('guidesCounters');
  const stateSel = document.getElementById('filterUF');
  const citySel  = document.getElementById('filterCity');
  const searchIn = document.getElementById('searchInput');
  const sortSel  = document.getElementById('sortSelect');
  const clearBtn = document.getElementById('clearFilters');
  const pager    = document.getElementById('pagination');

  const pageSize = 30;
  let allGuides = [];       // dataset normalizado
  let filtered = [];        // após filtros/busca
  let currentPage = 1;

  // ---- Util ----
  const slugify = (s) =>
    (s || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  const parseContacts = (s) => {
    if (!s) return {};
    let wpp = (/whats(app)?:\s*([^|]+)/i.exec(s) || [])[2];
    let ig  = (/insta(gram)?:\s*([^|]+)/i.exec(s) || [])[2];
    let em  = (/mail|e-?mail:\s*([^|]+)/i.exec(s) || [])[2];
    return {
      whatsapp: wpp ? wpp.trim() : '',
      instagram: ig ? ig.trim().replace(/^@/, '') : '',
      email: em ? em.trim() : ''
    };
  };

  // Normaliza uma linha vinda do CSV/JS para shape padrão
  function normalize(row) {
    // nomes de coluna variáveis
    const get = (...keys) => {
      for (const k of keys) {
        const v = row[k]; if (v != null && String(v).trim() !== '') return String(v).trim();
      }
      return '';
    };

    const name = get('nome', 'nome_completo', 'name');
    const cad  = get('numero_cadastur','cadastur','n_cadastur','número_cadastur');
    const uf   = get('uf','estado','estado_uf');
    const city = get('municipio','cidade','city');
    const bio  = get('bio','descricao','descrição','mini_bio','sobre');
    const langs= get('idiomas','languages');
    const photo= get('foto','foto_url','image','foto_perfil');

    const contacts = parseContacts(get('contatos','contact','contato','contacts'));
    const id = cad || (name ? name.toLowerCase().replace(/\s+/g,'-') : '');

    return {
      id,
      name,
      cadastur: cad,
      uf,
      city,
      bio,
      languages: langs ? langs.split('|').map(s=>s.trim()).filter(Boolean) : [],
      photo: photo || 'images/placeholder_guide.png',
      contacts,
      slug: `${slugify(name)}-${(cad || '').slice(-4)}`
    };
  }

  // ---- Carregar dados: CSV (preferência) ou JS (fallback) ----
  async function loadData() {
    // Tentar CSV?
    if (window.__USE_CSV__) {
      try {
        const resp = await fetch('data/cadastur.csv', { cache: 'no-store' });
        if (resp.ok) {
          const text = await resp.text();
          const [header, ...lines] = text.trim().split(/\r?\n/);
          const cols = header.split(',').map(h=>h.trim());
          const rows = lines.map(line => {
            // parser leve (atenção: CSV simples — se seu CSV tem vírgulas entre aspas, troque por PapaParse)
            const parts = line.split(','); 
            const obj = {};
            cols.forEach((c,i)=>obj[c]=parts[i]);
            return obj;
          });
          return rows.map(normalize);
        }
      } catch (_) { /* ignora e cai no fallback */ }
    }
    // Fallback: usar dataset JS embutido (window.cadasturData)
    if (Array.isArray(window.cadasturData)) return window.cadasturData.map(normalize);
    return [];
  }

  // ---- Filtros/busca/ordenação ----
  function applyFilters() {
    const q = (searchIn.value || '').trim().toLowerCase();
    const uf = stateSel.value;
    const city = citySel.value;

    filtered = allGuides.filter(g => {
      if (uf && g.uf !== uf) return false;
      if (city && g.city !== city) return false;
      if (q) {
        // busca em nome ou Cadastur
        const hay = (g.name + ' ' + g.cadastur).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    // ordenar
    const sort = sortSel.value || 'name_asc';
    const cmp = {
      'name_asc': (a,b)=> a.name.localeCompare(b.name, 'pt'),
      'name_desc':(a,b)=> b.name.localeCompare(a.name, 'pt'),
      'city_asc': (a,b)=> a.city.localeCompare(b.city, 'pt') || a.name.localeCompare(b.name,'pt'),
      'city_desc':(a,b)=> b.city.localeCompare(a.city, 'pt') || a.name.localeCompare(b.name,'pt')
    }[sort] || ((a,b)=>0);

    filtered.sort(cmp);
    currentPage = 1;
    render();
    syncURL();
  }

  function syncURL() {
    const p = new URLSearchParams();
    if (searchIn.value) p.set('q', searchIn.value);
    if (stateSel.value) p.set('uf', stateSel.value);
    if (citySel.value)  p.set('city', citySel.value);
    if (sortSel.value)  p.set('sort', sortSel.value);
    if (currentPage>1)  p.set('page', String(currentPage));
    history.replaceState(null,'',`?${p.toString()}`);
  }

  function fromURL() {
    const u = new URL(location.href);
    searchIn.value = u.searchParams.get('q') || '';
    stateSel.value = u.searchParams.get('uf') || '';
    sortSel.value  = u.searchParams.get('sort') || 'name_asc';
    // cidade será preenchida após montarmos a lista dinâmica
    const p = parseInt(u.searchParams.get('page')||'1',10);
    currentPage = isNaN(p) ? 1 : Math.max(1,p);
    return u.searchParams.get('city') || '';
  }

  // ---- UI ----
  function renderCounters() {
    const total = allGuides.length;
    const filteredTotal = filtered.length;
    const start = (currentPage-1)*pageSize;
    const showing = Math.min(pageSize, Math.max(filteredTotal - start, 0));
    countersDiv.textContent = `Mostrando ${showing} de ${filteredTotal} guias (Total: ${total})`;
  }

  function renderGrid() {
    grid.innerHTML = '';
    const start = (currentPage-1)*pageSize;
    const items = filtered.slice(start, start+pageSize);

    items.forEach(g => {
      const card = document.createElement('div');
      card.className = 'guide-card';
      card.innerHTML = `
        <div class="guide-photo"><img src="${g.photo}" alt="${g.name}"></div>
        <div class="guide-info">
          <h3 class="guide-name">
            <a href="guia.html?slug=${encodeURIComponent(g.slug)}" class="guide-link">${g.name}</a>
          </h3>
          <p class="guide-cad"><i class="fas fa-certificate" style="color:var(--color-secondary);"></i> ${g.cadastur}</p>
          <p class="guide-loc"><i class="fas fa-map-marker-alt"></i> ${g.uf} • ${g.city}</p>
          ${g.languages.length ? `<p class="guide-langs"><i class="fas fa-language"></i> ${g.languages.join(', ')}</p>` : ''}
          ${g.bio ? `<p class="guide-bio">${g.bio.slice(0, 200)}${g.bio.length>200?'…':''}</p>` : ''}
          <div class="guide-actions">
            <a class="btn btn-outline" href="expedicoes.html?guia=${encodeURIComponent(g.cadastur)}">Ver Expedições</a>
            <button class="btn btn-solid" data-action="contact" data-wpp="${g.contacts.whatsapp||''}" data-ig="${g.contacts.instagram||''}" data-email="${g.contacts.email||''}">Contato</button>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  function renderPager() {
    pager.innerHTML = '';
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (totalPages <= 1) return;

    const addBtn = (label, page, disabled=false, active=false) => {
      const b = document.createElement('button');
      b.className = `page-btn${active?' active':''}`;
      b.textContent = label;
      b.disabled = disabled;
      b.addEventListener('click', () => {
        currentPage = page;
        render();
        syncURL();
        window.scrollTo({top:0, behavior:'smooth'});
      });
      pager.appendChild(b);
    };

    addBtn('Anterior', Math.max(1, currentPage-1), currentPage===1);

    // números com reticências
    const tp = totalPages;
    const pages = new Set([1,2,tp-1,tp,currentPage-1,currentPage,currentPage+1].filter(p=>p>=1&&p<=tp));
    const sorted = [...pages].sort((a,b)=>a-b);
    let prev = 0;
    sorted.forEach(p => {
      if (p - prev > 1) {
        const span = document.createElement('span');
        span.textContent = '…';
        span.className = 'page-ellipsis';
        pager.appendChild(span);
      }
      addBtn(String(p), p, false, p===currentPage);
      prev = p;
    });

    addBtn('Próxima', Math.min(tp, currentPage+1), currentPage===tp);
  }

  function render() {
    renderCounters();
    renderGrid();
    renderPager();
  }

  function populateUFs() {
    const ufs = [...new Set(allGuides.map(g=>g.uf).filter(Boolean))].sort();
    stateSel.innerHTML = `<option value="">Todos os Estados</option>` + ufs.map(u=>`<option value="${u}">${u}</option>`).join('');
  }

  function populateCitiesFor(uf, preselect='') {
    const cities = [...new Set(allGuides.filter(g=>!uf || g.uf===uf).map(g=>g.city).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt'));
    citySel.innerHTML = `<option value="">Todas as Cidades</option>` + cities.map(c=>`<option value="${c}">${c}</option>`).join('');
    if (preselect) citySel.value = preselect;
  }

  // ---- Eventos ----
  function wireEvents() {
    stateSel.addEventListener('change', () => {
      populateCitiesFor(stateSel.value, '');
      applyFilters();
    });
    citySel.addEventListener('change', applyFilters);
    searchIn.addEventListener('input', () => { currentPage=1; applyFilters(); });
    sortSel.addEventListener('change', applyFilters);
    clearBtn.addEventListener('click', () => {
      searchIn.value = '';
      stateSel.value = '';
      populateCitiesFor('');
      citySel.value = '';
      sortSel.value = 'name_asc';
      currentPage = 1;
      applyFilters();
    });

    // Modal de contato simples
    document.body.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-action="contact"]');
      if (!btn) return;
      const w = btn.dataset.wpp, ig = btn.dataset.ig, em = btn.dataset.email;
      let html = '<div class="contact-modal"><div class="contact-card">';
      html += '<h3>Contato do Guia</h3><ul class="contact-list">';
      if (w) html += `<li><i class="fab fa-whatsapp"></i> ${w}</li>`;
      if (ig) html += `<li><i class="fab fa-instagram"></i> @${ig}</li>`;
      if (em) html += `<li><i class="far fa-envelope"></i> ${em}</li>`;
      if (!w && !ig && !em) html += `<li>Contatos não informados.</li>`;
      html += '</ul><button class="btn btn-outline" id="closeContact">Fechar</button></div></div>';
      const wrap = document.createElement('div');
      wrap.innerHTML = html;
      document.body.appendChild(wrap.firstChild);
      document.getElementById('closeContact').addEventListener('click', ()=> {
        document.querySelector('.contact-modal')?.remove();
      });
    });
  }

  // ---- Inicialização ----
  window.addEventListener('load', async () => {
    allGuides = await loadData();

    // Preenche filtros a partir da URL
    const preCity = fromURL();

    populateUFs();
    populateCitiesFor(stateSel.value, preCity);

    applyFilters();
    wireEvents();
  });
})();
