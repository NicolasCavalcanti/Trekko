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

  // Utility: load users from LocalStorage
  function loadUsers() {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error('Erro ao carregar usuários do armazenamento local', err);
      return [];
    }
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
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('E-mail já cadastrado.');
    }
    // Validate cadastur number exists in guides dataset if provided
    if (guidesDataset && Array.isArray(guidesDataset)) {
      const exists = guidesDataset.some(g => {
        const num = g.cadastur || g.cadasturNumber || g.numero_do_certificado || g.número_do_certificado;
        return num && num.toString() === cadastur.toString();
      });
      if (!exists) {
        throw new Error('Número Cadastur não encontrado na base de dados CADASTUR.');
      }
    }
    const salt = randomString(16);
    const passwordHash = await hashPassword(password, salt);
    const verificationToken = randomString(32);
    const user = {
      id: randomString(24),
      type: 'guide',
      name,
      email,
      phone,
      cadastur: cadastur.toString(),
      state,
      city,
      parks,
      description,
      photos,
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
    const users = loadUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      throw new Error('Usuário ou senha inválidos.');
    }
    const hashed = await hashPassword(password, user.salt);
    if (hashed !== user.passwordHash) {
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
    // Save session
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user: payload }));
    return { token, user: payload };
  }

  // Logout function
  function logout() {
    localStorage.removeItem(SESSION_KEY);
  }

  // Get current session
  async function getSession() {
    const data = localStorage.getItem(SESSION_KEY);
    if (!data) return null;
    try {
      const session = JSON.parse(data);
      const payload = await verifyJWT(session.token);
      if (!payload) {
        logout();
        return null;
      }
      return { token: session.token, user: session.user };
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