/*
 * Guide profile page script for Trekko Brasil
 *
 * This script is responsible for populating the guia.html page with
 * information about a single guide based on the CADASTUR dataset. It
 * parses the query parameters for a slug or cadastur number, searches
 * through the window.cadasturData array for a matching entry, and then
 * builds the profile details including photo, name, Cadastur number,
 * location, languages, bio and contact information. If no guide is
 * found, it displays a fallback message. This script operates
 * independently of the larger scripts.js logic to ensure the profile
 * page always renders correctly even when the main scripts are
 * modified.
 */

// Use the load event instead of DOMContentLoaded because guia.html loads this
// script at the end of the document. If DOMContentLoaded has already fired
// before this script is parsed, a listener on DOMContentLoaded would never
// trigger. The load event guarantees the code runs once resources are
// finished loading.
window.addEventListener('load', () => {
  // Only run on the guia profile page (avoid interference on other pages)
  const container = document.getElementById('guideProfile');
  if (!container) return;
  // Clear any existing content before populating the profile
  container.innerHTML = '';

  // Helper: slugify a string (remove accents, special characters, lower case)
  function slugify(str) {
    return String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // Normalise a raw CADASTUR entry into a guide object with standard fields
  function normaliseCadastur(entry) {
    const guide = {};
    guide.name = entry.nome || entry.nome_completo || entry.name || '';
    guide.cadastur = entry.numero_cadastur || entry.numero || entry.numero_cad || entry['nº cadastur'] || entry['número cadastur'] || '';
    guide.uf = entry.uf || entry.estado || entry.state || '';
    guide.city = entry.municipio || entry.município || entry.cidade || entry.city || '';
    guide.languages = [];
    if (entry.idiomas) {
      if (Array.isArray(entry.idiomas)) {
        guide.languages = entry.idiomas;
      } else {
        guide.languages = String(entry.idiomas)
          .split(/\||,|;/)
          .map(s => s.trim())
          .filter(Boolean);
      }
    }
    guide.contacts = [];
    if (entry.contatos) {
      const parts = String(entry.contatos).split(/\||,/);
      parts.forEach(part => {
        const [type, value] = part.split(/[:：]/);
        if (value) {
          guide.contacts.push({ type: type.trim(), value: value.trim() });
        }
      });
    }
    guide.photo = entry.foto || entry.foto_url || entry.image || entry.foto_perfil || '';
    guide.image = guide.photo;
    guide.bio = entry.bio || entry.descricao || entry.descrição || entry.description || '';
    return guide;
  }

  // Extract query params
  const params = new URLSearchParams(window.location.search);
  const slugParam = params.get('slug');
  const idParam = params.get('id');

  // Find matching guide in the CADASTUR dataset
  function findGuide() {
    if (!Array.isArray(window.cadasturData)) return null;
    // Compute slug for each entry on the fly
    let entryFound = null;
    if (slugParam) {
      // Try direct match based on precomputed slug if exists
      entryFound = window.cadasturData.find(entry => entry.slug === slugParam);
      if (!entryFound) {
        // Fallback: parse slug into name slug and last digits of cadastur
        const parts = slugParam.split('-');
        const idPart = parts.pop();
        const namePart = parts.join('-');
        window.cadasturData.forEach(entry => {
          if (entryFound) return;
          const entryNameSlug = slugify(entry.nome || entry.nome_completo || entry.name || '');
          const cad = String(entry.numero_cadastur || entry.numero || entry.numero_cad || entry['nº cadastur'] || entry['número cadastur'] || '');
          if (entryNameSlug === namePart && cad.slice(-idPart.length) === idPart) {
            entryFound = entry;
          }
        });
      }
    }
    // If not found by slug, try by id or cadastur
    if (!entryFound && idParam) {
      entryFound = window.cadasturData.find(entry => {
        const cad = String(entry.numero_cadastur || entry.numero || entry.numero_cad || '');
        return cad === idParam || String(entry.id) === idParam;
      });
    }
    return entryFound;
  }

  const rawGuide = findGuide();
  if (!rawGuide) {
    container.innerHTML = '<p>Guia não encontrado.</p>';
    return;
  }
  const guide = normaliseCadastur(rawGuide);

  // Build HTML for profile
  let html = '';
  html += `<h1 class="detail-title">${guide.name}</h1>`;
  const imgSrc = guide.image || 'images/guia1.png';
  html += `<img src="${imgSrc}" alt="${guide.name}" class="detail-image" />`;
  html += '<div class="detail-info">';
  if (guide.cadastur) html += `<p><strong>Nº Cadastur:</strong> ${guide.cadastur}</p>`;
  if (guide.uf) html += `<p><strong>Estado:</strong> ${guide.uf}</p>`;
  if (guide.city) html += `<p><strong>Município:</strong> ${guide.city}</p>`;
  if (guide.languages && guide.languages.length) html += `<p><strong>Idiomas:</strong> ${guide.languages.join(', ')}</p>`;
  html += '</div>';
  html += `<div class="detail-description"><h3>Sobre o Guia</h3><p>${guide.bio}</p></div>`;
  html += '<div class="detail-contact"><h3>Contato</h3>';
  if (guide.contacts && guide.contacts.length) {
    guide.contacts.forEach(({ type, value }) => {
      html += `<p><strong>${type}:</strong> ${value}</p>`;
    });
  } else {
    html += '<p>Contato não disponível.</p>';
  }
  html += '</div>';
  // Expeditions section
  let guideExps = [];
  if (Array.isArray(window.expeditionsData) && guide.cadastur) {
    // Match guide id or cadastur with expedition.guideId
    guideExps = window.expeditionsData.filter(exp => {
      return String(exp.guideId) === String(guide.cadastur) || String(exp.guideId) === String(rawGuide.id);
    });
  }
  if (guideExps.length) {
    html += '<div class="detail-expeditions"><h3>Expedições deste Guia</h3><div class="expedition-list">';
    guideExps.forEach(exp => {
      const spotsLeft = exp.maxPeople - exp.spotsTaken;
      html += `<div class="expedition-card">
        <div class="expedition-content">
          <div class="expedition-title">${exp.title || ''}</div>
          <div class="expedition-meta">${(exp.startDate || '').replace(/-/g,'/')} - ${(exp.endDate || '').replace(/-/g,'/')} · ${exp.level || ''}</div>
          <div class="expedition-price">R$ ${exp.price ? exp.price.toFixed(2) : ''} por pessoa</div>
          <div class="expedition-meta">${spotsLeft} vaga${spotsLeft !== 1 ? 's' : ''} disponível${spotsLeft !== 1 ? 's' : ''}</div>
          <a href="expedicao.html?id=${exp.id}" class="btn btn-secondary">Ver Expedição</a>
        </div>
      </div>`;
    });
    html += '</div></div>';
  } else {
    html += '<div class="detail-expeditions"><h3>Expedições deste Guia</h3><p>Nenhuma expedição disponível no momento.</p></div>';
  }
  container.innerHTML = html;
});