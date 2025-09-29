/* guide_profile.js – Perfil do Guia via CADASTUR */

(function () {
  const container = document.getElementById('guide-detail');
  if (!container) return;

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

  const norm = (row) => {
    const get = (...keys) => {
      for (const k of keys) {
        const v = row[k]; if (v != null && String(v).trim() !== '') return String(v).trim();
      }
      return '';
    };
    const name = get('nome','nome_completo','name');
    const cad  = get('numero_cadastur','cadastur','n_cadastur','número_cadastur');
    const uf   = get('uf','estado','estado_uf');
    const city = get('municipio','cidade','city');
    const bio  = get('bio','descricao','descrição','mini_bio','sobre');
    const langs= get('idiomas','languages');
    const photo= get('foto','foto_url','image','foto_perfil');
    const contacts = parseContacts(get('contatos','contact','contato','contacts'));

    return {
      id: cad || slugify(name),
      name, cadastur: cad, uf, city, bio,
      languages: langs ? langs.split('|').map(s=>s.trim()).filter(Boolean) : [],
      photo: photo || 'images/placeholder_guide.png',
      contacts,
      slug: `${slugify(name)}-${(cad || '').slice(-4)}`
    };
  };

  async function loadData() {
    if (window.__USE_CSV__) {
      try {
        const resp = await fetch('data/cadastur.csv', { cache: 'no-store' });
        if (resp.ok) {
          const text = await resp.text();
          const [header, ...lines] = text.trim().split(/\r?\n/);
          const cols = header.split(',').map(h=>h.trim());
          return lines.map(line => {
            const parts = line.split(',');
            const obj = {};
            cols.forEach((c,i)=>obj[c]=parts[i]);
            return obj;
          }).map(norm);
        }
      } catch(_) {}
    }
    return (Array.isArray(window.cadasturData) ? window.cadasturData.map(norm) : []);
  }

  function render(guide) {
    const langs = guide.languages.length ? `<p><i class="fas fa-language"></i> ${guide.languages.join(', ')}</p>` : '';
    const contacts = guide.contacts;
    const contactsHtml = `
      <ul class="contact-list">
        ${contacts.whatsapp ? `<li><i class="fab fa-whatsapp"></i> ${contacts.whatsapp}</li>` : ''}
        ${contacts.instagram ? `<li><i class="fab fa-instagram"></i> @${contacts.instagram}</li>` : ''}
        ${contacts.email ? `<li><i class="far fa-envelope"></i> ${contacts.email}</li>` : ''}
        ${(!contacts.whatsapp && !contacts.instagram && !contacts.email) ? '<li>Contatos não informados.</li>' : ''}
      </ul>
    `;

    container.innerHTML = `
      <div class="guide-hero">
        <img src="${guide.photo}" alt="${guide.name}">
        <div class="guide-hero-overlay">
          <h1>${guide.name}</h1>
          <p><i class="fas fa-certificate" style="color:var(--color-secondary);"></i> ${guide.cadastur || 'Sem Cadastur'}</p>
          <p><i class="fas fa-map-marker-alt"></i> ${guide.uf || '-'} · ${guide.city || '-'}</p>
        </div>
      </div>

      <div class="guide-detail-section">
        <div class="guide-detail-left">
          <h2>Sobre</h2>
          <p>${guide.bio || 'Sem descrição.'}</p>
          ${langs}
          <h3>Contato</h3>
          ${contactsHtml}
        </div>
        <div class="guide-detail-right">
          <h2>Expedições</h2>
          <div id="guide-exps"></div>
        </div>
      </div>
    `;

    // expedições (opcional: quando sua base real estiver pronta)
    const expsDiv = document.getElementById('guide-exps');
    expsDiv.innerHTML = `<p>Nenhuma expedição disponível no momento.</p>`;
  }

  window.addEventListener('load', async () => {
    const data = await loadData();
    const url = new URL(location.href);
    const viaCad = url.searchParams.get('cadastur');
    const viaSlug= url.searchParams.get('slug');

    let guide = null;

    if (viaCad) {
      guide = data.find(g => (g.cadastur||'').toUpperCase() === viaCad.toUpperCase());
    }
    if (!guide && viaSlug) {
      guide = data.find(g => g.slug === viaSlug);
      if (!guide) {
        const base = viaSlug.replace(/-\d{3,4}$/, '');
        const suffix = (viaSlug.match(/-(\d{3,4})$/)||[])[1] || '';
        guide = data.find(g => slugify(g.name) === base && (g.cadastur||'').endsWith(suffix));
      }
    }

    if (!guide) {
      container.innerHTML = '<p>Guia não encontrado.</p>';
      return;
    }
    render(guide);
  });
})();
