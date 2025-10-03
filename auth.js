/*
 * Simple client‑side authentication module for Trekko
 *
 * This script provides a minimal user management layer entirely in the
 * browser using LocalStorage. It supports registration for Trekkers and
 * Guides, email confirmation, password hashing (using Web Crypto),
 * and JWT‑like token generation. While a real production system would
 * implement these features on the server side with robust security
 * measures, this module demonstrates the core flows for the MVP.
 */

const Auth = (() => {
  // Key names in localStorage
  const USERS_KEY = 'trekkoUsers';
  const SESSION_KEY = 'trekkoSession';
  const SECRET = 'trekko_client_secret';
  const GUIDE_AUTH_BASE = '/api/auth/guides';
  const SESSION_REFRESH_THRESHOLD_MS = 60 * 1000; // 1 minute window to refresh tokens

  // Utility: load users from LocalStorage
  function loadUsers() {
    let storedUsers = [];
    try {
      const raw = localStorage.getItem(USERS_KEY);
      storedUsers = raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error('Erro ao carregar usuários do armazenamento local', err);
      storedUsers = [];
    }

    const result = Array.isArray(storedUsers) ? [...storedUsers] : [];
    const storedSession = getStoredSessionRaw();
    if (isGuideStoredSession(storedSession) && storedSession.user) {
      const sessionUser = storedSession.user;
      const alreadyExists = result.some(item => item && item.id === sessionUser.id);
      if (!alreadyExists) {
        const contacts = sessionUser.contacts && typeof sessionUser.contacts === 'object' ? sessionUser.contacts : null;
        result.push({
          id: sessionUser.id,
          type: sessionUser.type || 'guide',
          name: sessionUser.name || '',
          email: sessionUser.email || '',
          phone: sessionUser.phone || (contacts && contacts.phone) || '',
          cadastur: sessionUser.cadastur || '',
          state: sessionUser.state || '',
          city: sessionUser.city || '',
          specialties: sessionUser.specialties || (contacts && contacts.parks) || [],
          isVerified: true,
          fromServer: true
        });
      }
    }

    return result;
  }

  // Utility: persist users
  function saveUsers(users) {
    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } catch (err) {
      console.error('Erro ao salvar usuários no armazenamento local', err);
    }
  }

  // Generate a random string of given length
  function randomString(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Detect if the secure Web Crypto API is available (requires HTTPS context)
  function hasSubtleCrypto() {
    return typeof crypto !== 'undefined' && crypto && typeof crypto.subtle !== 'undefined';
  }

  // Fallback hash implementation for environments without crypto.subtle
  function fallbackHashHex(input) {
    const bytes = [];
    for (let i = 0; i < input.length; i++) {
      const code = input.charCodeAt(i);
      if (code < 0x80) {
        bytes.push(code);
      } else if (code < 0x800) {
        bytes.push(0xc0 | (code >> 6));
        bytes.push(0x80 | (code & 0x3f));
      } else {
        bytes.push(0xe0 | (code >> 12));
        bytes.push(0x80 | ((code >> 6) & 0x3f));
        bytes.push(0x80 | (code & 0x3f));
      }
    }
    let h1 = 0x811c9dc5;
    let h2 = 0xc9dc5111;
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i];
      h1 = Math.imul(h1 ^ byte, 0x01000193) >>> 0;
      h2 = Math.imul(h2 + byte, 0x01000193) >>> 0;
    }
    const parts = [h1, h2, h1 ^ h2, Math.imul(h1 + 0x9e3779b9, h2 ^ 0x85ebca6b) >>> 0];
    return parts.map(n => n.toString(16).padStart(8, '0')).join('');
  }

  // Hash password with salt using SHA‑256 via Web Crypto, with fallback for insecure origins
  async function hashPassword(password, salt) {
    const data = password + salt;
    if (hasSubtleCrypto()) {
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // Fallback when crypto.subtle is unavailable (e.g., file:// origin)
    return fallbackHashHex(data);
  }

  // Generate a basic JWT (header.payload.signature) signed with HMAC‑SHA256
  async function generateJWT(payload) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encoder = new TextEncoder();
    function base64url(obj) {
      return btoa(JSON.stringify(obj))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    }
    const headerEncoded = base64url(header);
    const payloadEncoded = base64url(payload);
    const toSign = `${headerEncoded}.${payloadEncoded}`;
    let signatureHex;
    if (hasSubtleCrypto()) {
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(SECRET),
        { name: 'HMAC', hash: { name: 'SHA-256' } },
        false,
        ['sign']
      );
      const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(toSign));
      const signatureArray = Array.from(new Uint8Array(signature));
      signatureHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
      signatureHex = fallbackHashHex(`${toSign}.${SECRET}`);
    }
    const jwt = `${toSign}.${signatureHex}`;
    return jwt;
  }

  function getStoredSessionRaw() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      console.error('Erro ao ler sessão armazenada', err);
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  function isGuideStoredSession(session) {
    return session && session.provider === 'guide' && typeof session.token === 'string';
  }

  function storeGuideSession(session) {
    if (!session || typeof session.accessToken !== 'string') {
      throw new Error('Sessão inválida do guia.');
    }
    const storedSession = {
      provider: 'guide',
      token: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
      refreshExpiresAt: session.refreshExpiresAt,
      tokenType: session.tokenType || 'Bearer',
      user: session.user
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(storedSession));
    return storedSession;
  }

  function storeLocalSession(token, user) {
    const storedSession = {
      provider: 'local',
      token,
      user
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(storedSession));
    return storedSession;
  }

  async function requestGuideAuth(endpoint, payload) {
    const url = `${GUIDE_AUTH_BASE}/${endpoint.replace(/^\/+/, '')}`;
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload ?? {})
      });
    } catch (networkError) {
      const error = new Error('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.');
      error.cause = networkError;
      throw error;
    }

    let data = null;
    try {
      data = await response.json();
    } catch (parseError) {
      data = null;
    }

    if (!response.ok) {
      const error = new Error((data && data.message) || 'Não foi possível concluir a operação.');
      Object.assign(error, { status: response.status, code: data && data.code });
      throw error;
    }

    return data;
  }

  function buildGuideContactsPayload({ phone, parks, description, photos }) {
    const contacts = {};
    if (phone) contacts.phone = phone;
    if (Array.isArray(parks) && parks.length) contacts.parks = parks;
    if (description) contacts.description = description;
    if (Array.isArray(photos) && photos.length) contacts.photos = photos.slice(0, 5);
    return Object.keys(contacts).length ? contacts : null;
  }

  async function refreshGuideSessionIfNeeded(storedSession) {
    if (!isGuideStoredSession(storedSession)) {
      return storedSession;
    }
    const expiresAtMs = storedSession.expiresAt ? Date.parse(storedSession.expiresAt) : NaN;
    if (Number.isFinite(expiresAtMs) && expiresAtMs - Date.now() > SESSION_REFRESH_THRESHOLD_MS) {
      return storedSession;
    }
    const refreshExpiresMs = storedSession.refreshExpiresAt ? Date.parse(storedSession.refreshExpiresAt) : NaN;
    if (!Number.isFinite(refreshExpiresMs) || refreshExpiresMs <= Date.now()) {
      await logout();
      return null;
    }
    try {
      const data = await requestGuideAuth('refresh', { refreshToken: storedSession.refreshToken });
      return storeGuideSession(data.session);
    } catch (error) {
      console.error('Falha ao renovar sessão do guia', error);
      await logout();
      return null;
    }
  }

  // Verify token signature and decode payload. Returns payload or null.
  async function verifyJWT(token) {
    try {
      const [headerEnc, payloadEnc, signatureHex] = token.split('.');
      const encoder = new TextEncoder();
      const toSign = `${headerEnc}.${payloadEnc}`;
      let expectedHex;
      if (hasSubtleCrypto()) {
        const key = await crypto.subtle.importKey(
          'raw',
          encoder.encode(SECRET),
          { name: 'HMAC', hash: { name: 'SHA-256' } },
          false,
          ['sign']
        );
        const signatureBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(toSign));
        const signatureArray = Array.from(new Uint8Array(signatureBuf));
        expectedHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } else {
        expectedHex = fallbackHashHex(`${toSign}.${SECRET}`);
      }
      if (expectedHex !== signatureHex) return null;
      const payloadJson = JSON.parse(atob(payloadEnc.replace(/-/g, '+').replace(/_/g, '/')));
      return payloadJson;
    } catch (err) {
      console.error('Erro ao verificar JWT', err);
      return null;
    }
  }

  // Register a Trekker user
  async function registerTrekker({ name, email, password, phone = '', state = '', city = '', preferences = [], termsAccepted }) {
    const users = loadUsers();
    if (!name || !email || !password) {
      throw new Error('Nome, email e senha são obrigatórios.');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('E-mail inválido.');
    }
    const passwordRegex = /^(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    if (!passwordRegex.test(password)) {
      throw new Error('Senha deve ter no mínimo 8 caracteres, incluindo um número e um caractere especial.');
    }
    if (termsAccepted !== true) {
      throw new Error('É necessário aceitar os Termos de Uso e Política de Privacidade.');
    }
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('E-mail já cadastrado.');
    }
    const salt = randomString(16);
    const passwordHash = await hashPassword(password, salt);
    const verificationToken = randomString(32);
    const user = {
      id: randomString(24),
      type: 'trekker',
      name,
      email,
      phone,
      state,
      city,
      preferences,
      salt,
      passwordHash,
      verificationToken,
      isVerified: false,
      createdAt: new Date().toISOString(),
      termsAccepted: !!termsAccepted
    };
    users.push(user);
    saveUsers(users);
    return { userId: user.id, verificationToken };
  }

  // Register a Guide user. Accepts dataset for Cadastur validation.
  async function registerGuide({ name, email, password, phone, cadastur, state = '', city = '', parks = [], description = '', photos = [], termsAccepted }, guidesDataset) {
    const users = loadUsers();
    if (!name || !email || !password || !phone || !cadastur) {
      throw new Error('Nome, email, senha, telefone e número Cadastur são obrigatórios.');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('E-mail inválido.');
    }
    const passwordRegex = /^(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    if (!passwordRegex.test(password)) {
      throw new Error('Senha deve ter no mínimo 8 caracteres, incluindo um número e um caractere especial.');
    }
    if (termsAccepted !== true) {
      throw new Error('É necessário aceitar os Termos de Uso e Política de Privacidade.');
    }
    if (users.some(u => u.email && u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('E-mail já cadastrado.');
    }

    let cadRecord = null;
    if (guidesDataset && Array.isArray(guidesDataset)) {
      cadRecord = guidesDataset.find(g => {
        const num = g.cadastur || g.cadasturNumber || g.numero_do_certificado || g.número_do_certificado;
        return num && num.toString() === cadastur.toString();
      }) || null;
      if (!cadRecord) {
        throw new Error('Número Cadastur não encontrado na base de dados CADASTUR.');
      }
    }

    const normalizedPhone = phone ? phone.toString().trim() : '';
    const normalizedState = (state || cadRecord?.uf || cadRecord?.estado || '').toString().trim().toUpperCase();
    const normalizedCity = (city || cadRecord?.municipio || cadRecord?.city || '').toString().trim();
    const normalizedCadastur = cadastur.toString().trim();
    const normalizedParks = Array.isArray(parks)
      ? parks.map(item => (item ? item.toString().trim() : '')).filter(Boolean)
      : [];
    const normalizedDescription = description ? description.toString().trim() : '';
    const normalizedPhotos = Array.isArray(photos)
      ? photos.map(item => (item ? item.toString().trim() : '')).filter(Boolean)
      : [];
    const contactsPayload = buildGuideContactsPayload({ phone: normalizedPhone, parks: normalizedParks, description: normalizedDescription, photos: normalizedPhotos });
    const primaryPhoto = normalizedPhotos.length ? normalizedPhotos[0] : (cadRecord?.foto_url || cadRecord?.fotoUrl || '');

    try {
      const response = await requestGuideAuth('register', {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: normalizedPhone,
        cadastur: normalizedCadastur,
        estado: normalizedState || undefined,
        municipio: normalizedCity || undefined,
        contatos: contactsPayload || undefined,
        foto_url: primaryPhoto || undefined
      });

      const storedSession = storeGuideSession(response.session);
      return {
        guideId: response.guide?.id,
        guide: response.guide,
        session: {
          token: storedSession.token,
          user: storedSession.user
        }
      };
    } catch (error) {
      throw error;
    }
  }

  // Verify email by token
  function verifyEmail(token) {
    const users = loadUsers();
    const user = users.find(u => u.verificationToken === token);
    if (!user) {
      throw new Error('Token de verificação inválido.');
    }
    user.isVerified = true;
    user.verificationToken = null;
    saveUsers(users);
    return { success: true, userId: user.id };
  }

  // Login function. Returns JWT token and user info
  async function login(email, password) {
    const emailTrimmed = (email || '').trim();
    const passwordValue = password || '';
    let remoteError = null;

    if (emailTrimmed && passwordValue) {
      try {
        const response = await requestGuideAuth('login', { email: emailTrimmed, password: passwordValue });
        const storedSession = storeGuideSession(response.session);
        return { token: storedSession.token, user: storedSession.user };
      } catch (error) {
        remoteError = error;
      }
    }

    const users = loadUsers();
    const user = users.find(u =>
      typeof u.email === 'string'
        && u.email.toLowerCase() === emailTrimmed.toLowerCase()
        && typeof u.salt === 'string'
        && typeof u.passwordHash === 'string'
    );
    if (!user) {
      if (remoteError) throw remoteError;
      throw new Error('Usuário ou senha inválidos.');
    }
    const hashed = await hashPassword(passwordValue, user.salt);
    if (hashed !== user.passwordHash) {
      if (remoteError) throw remoteError;
      throw new Error('Usuário ou senha inválidos.');
    }
    if (!user.isVerified) {
      throw new Error('Conta ainda não verificada. Verifique seu e-mail.');
    }
    const rawSpecialties = Array.isArray(user.specialties)
      ? user.specialties
      : Array.isArray(user.parks)
        ? user.parks
        : [];
    const payload = {
      id: user.id,
      email: user.email,
      type: user.type,
      name: user.name,
      cadastur: user.cadastur || '',
      phone: user.phone || '',
      state: user.state || '',
      city: user.city || '',
      specialties: rawSpecialties.map((item) =>
        typeof item === 'string' ? item : typeof item === 'number' ? item.toString() : ''
      ).filter(Boolean),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7
    };
    const token = await generateJWT(payload);
    const storedSession = storeLocalSession(token, payload);
    return { token: storedSession.token, user: storedSession.user };
  }

  // Logout function
  async function logout() {
    const storedSession = getStoredSessionRaw();
    if (isGuideStoredSession(storedSession) && storedSession.refreshToken) {
      try {
        await requestGuideAuth('logout', { refreshToken: storedSession.refreshToken });
      } catch (error) {
        console.warn('Falha ao encerrar sessão remota', error);
      }
    }
    localStorage.removeItem(SESSION_KEY);
  }

  // Get current session
  async function getSession() {
    const storedSession = getStoredSessionRaw();
    if (!storedSession) {
      return null;
    }
    if (isGuideStoredSession(storedSession)) {
      const refreshed = await refreshGuideSessionIfNeeded(storedSession);
      if (!refreshed) {
        return null;
      }
      return { token: refreshed.token, user: refreshed.user };
    }
    if (!storedSession.token || !storedSession.user) {
      return null;
    }
    try {
      const payload = await verifyJWT(storedSession.token);
      if (!payload) {
        await logout();
        return null;
      }
      return { token: storedSession.token, user: storedSession.user };
    } catch (err) {
      console.error('Erro ao obter sessão', err);
      return null;
    }
  }

  return {
    registerTrekker,
    registerGuide,
    verifyEmail,
    login,
    logout,
    getSession,
    loadUsers
  };
})();