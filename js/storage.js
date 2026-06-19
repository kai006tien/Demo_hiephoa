/* ============================================
   STORAGE - LocalStorage Wrapper + Mock Data
   ============================================ */

const Storage = {
  // Keys
  KEYS: {
    ACCOUNTS: 'hha_accounts',
    DOCUMENTS: 'hha_documents',
    VOTES: 'hha_votes',
    NOTIFICATIONS: 'hha_notifications',
    FILES: 'hha_files',
    SUGGESTIONS: 'hha_suggestions',
    SESSIONS: 'hha_sessions',
    SESSION: 'hha_session'
  },

  // Get data
  get(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  // Set data
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Storage error:', e);
      return false;
    }
  },

  // Remove data
  remove(key) {
    localStorage.removeItem(key);
  },

  // === ACCOUNTS ===
  getAccounts() {
    return Storage.get(Storage.KEYS.ACCOUNTS) || [];
  },

  saveAccounts(accounts) {
    Storage.set(Storage.KEYS.ACCOUNTS, accounts);
  },

  getAccountById(id) {
    return Storage.getAccounts().find(a => a.id === id);
  },

  getAccountByUsername(username) {
    return Storage.getAccounts().find(a => a.username === username);
  },

  addAccount(account) {
    const accounts = Storage.getAccounts();
    accounts.push(account);
    Storage.saveAccounts(accounts);
    if (typeof Sync !== 'undefined') Sync.syncMutation('upsert', 'Accounts', account);
    return account;
  },

  updateAccount(id, updates) {
    const accounts = Storage.getAccounts();
    const index = accounts.findIndex(a => a.id === id);
    if (index !== -1) {
      accounts[index] = { ...accounts[index], ...updates };
      Storage.saveAccounts(accounts);
      if (typeof Sync !== 'undefined') Sync.syncMutation('upsert', 'Accounts', accounts[index]);
      return accounts[index];
    }
    return null;
  },

  deleteAccount(id) {
    const accounts = Storage.getAccounts().filter(a => a.id !== id);
    Storage.saveAccounts(accounts);
    if (typeof Sync !== 'undefined') Sync.syncMutation('delete', 'Accounts', { id });
  },

  // === DOCUMENTS ===
  getDocuments() {
    const list = Storage.get(Storage.KEYS.DOCUMENTS) || [];
    return list.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  },

  saveDocuments(docs) {
    Storage.set(Storage.KEYS.DOCUMENTS, docs);
  },

  addDocument(doc) {
    const docs = Storage.getDocuments();
    docs.unshift(doc);
    Storage.saveDocuments(docs);
    if (typeof Sync !== 'undefined') Sync.syncMutation('upsert', 'Documents', doc);
    return doc;
  },

  updateDocument(id, updates) {
    const docs = Storage.get(Storage.KEYS.DOCUMENTS) || [];
    const index = docs.findIndex(d => d.id === id);
    if (index !== -1) {
      const updatedItem = { ...docs[index], ...updates, updatedAt: new Date().toISOString() };
      docs[index] = updatedItem;
      Storage.saveDocuments(docs);
      if (typeof Sync !== 'undefined') Sync.syncMutation('upsert', 'Documents', updatedItem);
      return updatedItem;
    }
    return null;
  },

  deleteDocument(id) {
    const docs = Storage.getDocuments().filter(d => d.id !== id);
    Storage.saveDocuments(docs);
    if (typeof Sync !== 'undefined') Sync.syncMutation('delete', 'Documents', { id });
  },

  // === VOTES ===
  getVotes() {
    const list = Storage.get(Storage.KEYS.VOTES) || [];
    return list.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  },

  saveVotes(votes) {
    Storage.set(Storage.KEYS.VOTES, votes);
  },

  addVote(vote) {
    const votes = Storage.getVotes();
    votes.unshift(vote);
    Storage.saveVotes(votes);
    if (typeof Sync !== 'undefined') Sync.syncMutation('upsert', 'Votes', vote);
    return vote;
  },

  updateVote(id, updates) {
    const votes = Storage.get(Storage.KEYS.VOTES) || [];
    const index = votes.findIndex(v => v.id === id);
    if (index !== -1) {
      const updatedItem = { ...votes[index], ...updates, updatedAt: new Date().toISOString() };
      votes[index] = updatedItem;
      Storage.saveVotes(votes);
      if (typeof Sync !== 'undefined') Sync.syncMutation('upsert', 'Votes', updatedItem);
      return updatedItem;
    }
    return null;
  },

  // === NOTIFICATIONS ===
  getNotifications() {
    const list = Storage.get(Storage.KEYS.NOTIFICATIONS) || [];
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  saveNotifications(notifs) {
    Storage.set(Storage.KEYS.NOTIFICATIONS, notifs);
  },

  addNotification(notif) {
    const notifs = Storage.getNotifications();
    notifs.unshift(notif);
    Storage.saveNotifications(notifs);
    if (typeof Sync !== 'undefined') Sync.syncMutation('upsert', 'Notifications', notif);
    return notif;
  },

  // === FILES ===
  getFiles() {
    const list = Storage.get(Storage.KEYS.FILES) || [];
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  saveFiles(files) {
    Storage.set(Storage.KEYS.FILES, files);
  },

  addFile(file) {
    const files = Storage.getFiles();
    files.unshift(file);
    Storage.set(Storage.KEYS.FILES, files);
    if (typeof Sync !== 'undefined') Sync.syncMutation('upsert', 'Files', file);
    return file;
  },

  deleteFile(id) {
    const files = Storage.getFiles().filter(f => f.id !== id);
    Storage.saveFiles(files);
    if (typeof Sync !== 'undefined') Sync.syncMutation('delete', 'Files', { id });
  },

  // === SUGGESTIONS ===
  getSuggestions() {
    const list = Storage.get(Storage.KEYS.SUGGESTIONS) || [];
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  saveSuggestions(suggestions) {
    Storage.set(Storage.KEYS.SUGGESTIONS, suggestions);
  },

  addSuggestion(suggestion) {
    const suggestions = Storage.getSuggestions();
    suggestions.unshift(suggestion);
    Storage.saveSuggestions(suggestions);
    if (typeof Sync !== 'undefined') Sync.syncMutation('upsert', 'Suggestions', suggestion);
    return suggestion;
  },

  // === SESSIONS (Kỳ họp) ===
  getSessions() {
    const list = Storage.get(Storage.KEYS.SESSIONS) || [];
    return list.sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  saveSessions(sessions) {
    Storage.set(Storage.KEYS.SESSIONS, sessions);
  },

  addSession(session) {
    const sessions = Storage.getSessions();
    sessions.push(session);
    Storage.saveSessions(sessions);
    if (typeof Sync !== 'undefined') Sync.syncMutation('upsert', 'Sessions', session);
    return session;
  },

  updateSession(id, updates) {
    const sessions = Storage.get(Storage.KEYS.SESSIONS) || [];
    const index = sessions.findIndex(s => s.id === id);
    if (index !== -1) {
      const updatedItem = { ...sessions[index], ...updates, updatedAt: new Date().toISOString() };
      sessions[index] = updatedItem;
      Storage.saveSessions(sessions);
      if (typeof Sync !== 'undefined') Sync.syncMutation('upsert', 'Sessions', updatedItem);
      return updatedItem;
    }
    return null;
  },

  deleteSession(id) {
    const sessions = Storage.getSessions().filter(s => s.id !== id);
    Storage.saveSessions(sessions);
    if (typeof Sync !== 'undefined') Sync.syncMutation('delete', 'Sessions', { id });
  },

  // === SESSION ===
  getSession() {
    return Storage.get(Storage.KEYS.SESSION);
  },

  setSession(session) {
    Storage.set(Storage.KEYS.SESSION, session);
  },

  clearSession() {
    Storage.remove(Storage.KEYS.SESSION);
  },

  // === INITIALIZE DEFAULT DATA ===
  // Không còn khởi tạo dữ liệu mặc định phía client
  // Server tự seed dữ liệu với mật khẩu đã hash bcrypt
  initializeDefaultData() {
    // No-op: Dữ liệu mặc định được quản lý bởi server
    // Client chỉ nhận dữ liệu thông qua Sync sau khi đăng nhập
    return;
  }
};
