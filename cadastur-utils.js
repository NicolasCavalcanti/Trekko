(function (global) {
  const DEFAULT_URL = 'data/CADASTUR.csv';
  const HEADER_MAP = {
    'atividade turistica': 'atividade_turistica',
    'uf': 'uf',
    'estado': 'uf',
    'municipio': 'municipio',
    'município': 'municipio',
    'nome completo': 'nome_completo',
    'telefone comercial': 'telefone_comercial',
    'telefone': 'telefone_comercial',
    'e-mail comercial': 'email_comercial',
    'email comercial': 'email_comercial',
    'website': 'website',
    'numero do certificado': 'numero_cadastur',
    'número do certificado': 'numero_cadastur',
    'numero do cadastur': 'numero_cadastur',
    'validade do certificado': 'validade_certificado',
    'idiomas': 'idiomas',
    'municipio de atuacao': 'municipio_de_atuacao',
    'município de atuação': 'municipio_de_atuacao',
    'categoria(s)': 'categorias',
    'categorias': 'categorias',
    'segmento(s)': 'segmentos',
    'segmentos': 'segmentos',
    'guia motorista': 'guia_motorista'
  };

  const TITLE_EXCEPTIONS = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

  const normalizeHeaderKey = (header) => {
    if (!header) return '';
    return header
      .replace(/\ufeff/g, '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  };

  const toTitleCase = (value) => {
    if (!value) return '';
    const trimmed = value.toString().trim();
    if (!trimmed) return '';
    return trimmed
      .toLocaleLowerCase('pt-BR')
      .split(/\s+/)
      .map((segment, index) =>
        segment
          .split('-')
          .map((piece, pieceIndex) => {
            const lower = piece.trim();
            if (!lower) return '';
            const shouldCapitalize = index === 0 && pieceIndex === 0 ? true : !TITLE_EXCEPTIONS.has(lower);
            return shouldCapitalize
              ? lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1)
              : lower;
          })
          .join('-')
      )
      .join(' ');
  };

  const splitList = (value) => {
    if (!value) return [];
    return value
      .toString()
      .split('|')
      .map((part) => toTitleCase(part))
      .filter(Boolean);
  };

  const splitCsvLine = (line, delimiter = ';') => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (char === delimiter && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const buildContacts = (telefone, email, website) => {
    const contacts = [];
    if (telefone) contacts.push(`Whatsapp:${telefone}`);
    if (email) contacts.push(`Email:${email}`);
    if (website) contacts.push(`Website:${website}`);
    return contacts.join('|');
  };

  const formatBio = ({ idiomasLista, categoriasLista, segmentosLista, atuacaoLista }) => {
    const parts = [];
    if (categoriasLista.length) {
      parts.push(`Categorias: ${categoriasLista.join(', ')}`);
    }
    if (segmentosLista.length) {
      parts.push(`Segmentos: ${segmentosLista.join(', ')}`);
    }
    if (idiomasLista.length) {
      parts.push(`Idiomas: ${idiomasLista.join(', ')}`);
    }
    if (atuacaoLista.length) {
      const destaque = atuacaoLista.slice(0, 3);
      parts.push(`Atua em: ${destaque.join(', ')}`);
    }
    return parts.join(' • ');
  };

  const parseBoolean = (value) => {
    if (value == null) return false;
    const normalized = value.toString().trim().toLowerCase();
    if (!normalized) return false;
    return ['1', 'sim', 's', 'true'].includes(normalized);
  };

  const parseCadasturCsv = (text) => {
    if (!text) return [];
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n');
    if (!lines.length) return [];
    const headerLine = lines.shift();
    if (!headerLine) return [];
    const headersRaw = splitCsvLine(headerLine, ';');
    const headers = headersRaw.map((header) => {
      const key = normalizeHeaderKey(header);
      if (!key) return null;
      if (HEADER_MAP[key]) return HEADER_MAP[key];
      return key.replace(/[^a-z0-9]+/g, '_');
    });

    const rows = [];
    for (const line of lines) {
      if (!line || !line.trim()) continue;
      const values = splitCsvLine(line, ';');
      const entry = {};
      for (let i = 0; i < headers.length; i += 1) {
        const key = headers[i];
        if (!key) continue;
        const rawValue = values[i] != null ? values[i].replace(/\ufeff/g, '').trim() : '';
        entry[key] = rawValue;
      }
      if (Object.values(entry).every((value) => !value)) continue;
      rows.push(entry);
    }
    return rows;
  };

  const normalizeRow = (entry) => {
    const nomeOriginal = entry.nome_completo || entry.nome;
    const municipioOriginal = entry.municipio || entry['município'];
    const ufOriginal = entry.uf || entry.estado;
    const cadasturOriginal = entry.numero_cadastur || entry.numero || entry['numero do certificado'] || entry['número_do_certificado'];

    const nome = toTitleCase(nomeOriginal);
    const municipio = toTitleCase(municipioOriginal);
    const uf = (ufOriginal || '').toString().trim().toUpperCase();
    const cadastur = (cadasturOriginal || '').toString().trim();

    if (!nome || !municipio || uf.length !== 2 || !cadastur) {
      return null;
    }

    const telefone = (entry.telefone_comercial || '').trim();
    const email = (entry.email_comercial || '').trim();
    const website = (entry.website || '').trim();

    const idiomasLista = splitList(entry.idiomas);
    const categoriasLista = splitList(entry.categorias);
    const segmentosLista = splitList(entry.segmentos);
    const atuacaoLista = splitList(entry.municipio_de_atuacao);

    const bio = formatBio({ idiomasLista, categoriasLista, segmentosLista, atuacaoLista });

    return {
      ...entry,
      id: cadastur,
      cadastur,
      numero_cadastur: cadastur,
      nome,
      nome_completo: nome,
      municipio,
      uf,
      telefone_comercial: telefone,
      email_comercial: email,
      website,
      idiomas_lista: idiomasLista,
      categorias_lista: categoriasLista,
      segmentos_lista: segmentosLista,
      municipio_de_atuacao_lista: atuacaoLista,
      guia_motorista: parseBoolean(entry.guia_motorista),
      contatos: buildContacts(telefone, email, website),
      bio,
      foto_url: entry.foto_url || entry.foto || '',
      validade_certificado: entry.validade_certificado || entry['validade_do_certificado'] || ''
    };
  };

  let cachedPromise = null;
  let cachedData = null;
  let cachedUrl = DEFAULT_URL;

  const fetchCadasturData = (url = DEFAULT_URL) => {
    const targetUrl = url || DEFAULT_URL;
    if (cachedData && cachedUrl === targetUrl) {
      return Promise.resolve(cachedData);
    }
    if (cachedPromise && cachedUrl === targetUrl) {
      return cachedPromise;
    }

    cachedUrl = targetUrl;
    cachedPromise = fetch(targetUrl, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.text();
      })
      .then((text) => parseCadasturCsv(text))
      .then((rows) => rows.map(normalizeRow).filter(Boolean))
      .then((normalized) => {
        cachedData = normalized;
        return normalized;
      })
      .finally(() => {
        cachedPromise = null;
      });

    return cachedPromise;
  };

  global.CadasturUtils = {
    DEFAULT_URL,
    fetchCadasturData,
    toTitleCase,
    splitList,
    splitCsvLine,
    parseCadasturCsv,
    normalizeRow
  };
})(window);
