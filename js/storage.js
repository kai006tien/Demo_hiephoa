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
    if (typeof Sync !== 'undefined') Sync.syncSheet('Accounts', accounts);
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
    return account;
  },

  updateAccount(id, updates) {
    const accounts = Storage.getAccounts();
    const index = accounts.findIndex(a => a.id === id);
    if (index !== -1) {
      accounts[index] = { ...accounts[index], ...updates };
      Storage.saveAccounts(accounts);
      return accounts[index];
    }
    return null;
  },

  deleteAccount(id) {
    const accounts = Storage.getAccounts().filter(a => a.id !== id);
    Storage.saveAccounts(accounts);
  },

  // === DOCUMENTS ===
  getDocuments() {
    return Storage.get(Storage.KEYS.DOCUMENTS) || [];
  },

  saveDocuments(docs) {
    Storage.set(Storage.KEYS.DOCUMENTS, docs);
    if (typeof Sync !== 'undefined') Sync.syncSheet('Documents', docs);
  },

  addDocument(doc) {
    const docs = Storage.getDocuments();
    docs.unshift(doc);
    Storage.saveDocuments(docs);
    return doc;
  },

  updateDocument(id, updates) {
    const docs = Storage.getDocuments();
    const index = docs.findIndex(d => d.id === id);
    if (index !== -1) {
      docs[index] = { ...docs[index], ...updates };
      Storage.saveDocuments(docs);
      return docs[index];
    }
    return null;
  },

  deleteDocument(id) {
    const docs = Storage.getDocuments().filter(d => d.id !== id);
    Storage.saveDocuments(docs);
  },

  // === VOTES ===
  getVotes() {
    return Storage.get(Storage.KEYS.VOTES) || [];
  },

  saveVotes(votes) {
    Storage.set(Storage.KEYS.VOTES, votes);
    if (typeof Sync !== 'undefined') Sync.syncSheet('Votes', votes);
  },

  addVote(vote) {
    const votes = Storage.getVotes();
    votes.unshift(vote);
    Storage.saveVotes(votes);
    return vote;
  },

  updateVote(id, updates) {
    const votes = Storage.getVotes();
    const index = votes.findIndex(v => v.id === id);
    if (index !== -1) {
      votes[index] = { ...votes[index], ...updates };
      Storage.saveVotes(votes);
      return votes[index];
    }
    return null;
  },

  // === NOTIFICATIONS ===
  getNotifications() {
    return Storage.get(Storage.KEYS.NOTIFICATIONS) || [];
  },

  saveNotifications(notifs) {
    Storage.set(Storage.KEYS.NOTIFICATIONS, notifs);
    if (typeof Sync !== 'undefined') Sync.syncSheet('Notifications', notifs);
  },

  addNotification(notif) {
    const notifs = Storage.getNotifications();
    notifs.unshift(notif);
    Storage.saveNotifications(notifs);
    return notif;
  },

  // === FILES ===
  getFiles() {
    return Storage.get(Storage.KEYS.FILES) || [];
  },

  saveFiles(files) {
    Storage.set(Storage.KEYS.FILES, files);
    if (typeof Sync !== 'undefined') Sync.syncSheet('Files', files);
  },

  addFile(file) {
    const files = Storage.getFiles();
    files.unshift(file);
    Storage.set(Storage.KEYS.FILES, files);
    return file;
  },

  deleteFile(id) {
    const files = Storage.getFiles().filter(f => f.id !== id);
    Storage.saveFiles(files);
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
  initializeDefaultData() {
    // Only initialize if no accounts exist
    if (Storage.getAccounts().length > 0) return;

    // Create admin account
    const accounts = [
      {
        id: 'admin_001',
        username: 'admin',
        password: Utils.encode('admin123'),
        fullName: 'Quản trị viên',
        role: 'admin',
        position: 'Quản trị hệ thống',
        email: 'admin@hiephoa.gov.vn',
        phone: '0987654321',
        active: true,
        createdAt: new Date(2024, 0, 1).toISOString()
      },
      {
        id: 'user_001',
        username: 'nguyenvana',
        password: Utils.encode('123456'),
        fullName: 'Nguyễn Văn A',
        role: 'user',
        position: 'Phó phòng Hành chính',
        email: 'nguyenvana@hiephoa.gov.vn',
        phone: '0912345678',
        active: true,
        createdAt: new Date(2024, 1, 15).toISOString()
      },
      {
        id: 'user_002',
        username: 'tranthib',
        password: Utils.encode('123456'),
        fullName: 'Trần Thị B',
        role: 'user',
        position: 'Chuyên viên Tổng hợp',
        email: 'tranthib@hiephoa.gov.vn',
        phone: '0923456789',
        active: true,
        createdAt: new Date(2024, 2, 20).toISOString()
      },
      {
        id: 'user_003',
        username: 'levanc',
        password: Utils.encode('123456'),
        fullName: 'Lê Văn C',
        role: 'user',
        position: 'Trưởng phòng Kế hoạch',
        email: 'levanc@hiephoa.gov.vn',
        phone: '0934567890',
        active: true,
        createdAt: new Date(2024, 3, 10).toISOString()
      }
    ];
    Storage.set(Storage.KEYS.ACCOUNTS, accounts);

    // Create sample documents
    const documents = [
      {
        id: 'doc_001',
        title: 'Kế hoạch công tác năm 2026',
        description: 'Kế hoạch triển khai các nhiệm vụ trọng tâm năm 2026 của đơn vị',
        fileName: 'Ke_hoach_cong_tac_2026.docx',
        fileSize: 245760,
        status: 'published',
        permissions: {
          'user_001': 'view',
          'user_002': 'edit',
          'user_003': 'view'
        },
        createdBy: 'admin_001',
        createdAt: new Date(2026, 0, 15).toISOString(),
        publishedAt: new Date(2026, 0, 16).toISOString()
      },
      {
        id: 'doc_002',
        title: 'Quy chế chi tiêu nội bộ',
        description: 'Quy chế quản lý và sử dụng ngân sách nội bộ đơn vị',
        fileName: 'Quy_che_chi_tieu_noi_bo.docx',
        fileSize: 189440,
        status: 'finalized',
        permissions: {
          'user_001': 'view',
          'user_002': 'view',
          'user_003': 'view'
        },
        createdBy: 'admin_001',
        createdAt: new Date(2025, 11, 1).toISOString(),
        publishedAt: new Date(2025, 11, 5).toISOString(),
        finalizedAt: new Date(2025, 11, 10).toISOString()
      },
      {
        id: 'doc_003',
        title: 'Dự thảo báo cáo tổng kết quý II/2026',
        description: 'Dự thảo báo cáo kết quả hoạt động quý II năm 2026',
        fileName: 'Du_thao_bao_cao_Q2_2026.docx',
        fileSize: 156672,
        status: 'draft',
        permissions: {},
        createdBy: 'admin_001',
        createdAt: new Date(2026, 5, 1).toISOString()
      }
    ];
    Storage.set(Storage.KEYS.DOCUMENTS, documents);

    // Create sample votes
    const votes = [
      {
        id: 'vote_001',
        title: 'Phê duyệt kế hoạch tổ chức Hội nghị tổng kết 2025',
        description: 'Biểu quyết thông qua kế hoạch tổ chức Hội nghị tổng kết năm 2025, dự kiến tổ chức vào ngày 20/01/2026 tại Hội trường lớn.',
        status: 'active',
        voters: [
          { userId: 'user_001', vote: 'agree', comment: 'Đồng ý với kế hoạch', votedAt: new Date(2026, 5, 10, 9, 30).toISOString() },
          { userId: 'user_002', vote: 'agree', comment: '', votedAt: new Date(2026, 5, 10, 10, 15).toISOString() }
        ],
        createdBy: 'admin_001',
        createdAt: new Date(2026, 5, 10, 8, 0).toISOString()
      },
      {
        id: 'vote_002',
        title: 'Điều chỉnh quy chế làm việc ngoài giờ',
        description: 'Biểu quyết về việc sửa đổi quy chế làm thêm giờ, bổ sung chế độ phụ cấp cho nhân viên làm việc ngoài giờ hành chính.',
        status: 'closed',
        voters: [
          { userId: 'user_001', vote: 'agree', comment: 'Rất cần thiết', votedAt: new Date(2026, 4, 20, 14, 30).toISOString() },
          { userId: 'user_002', vote: 'disagree', comment: 'Cần xem lại mức phụ cấp', votedAt: new Date(2026, 4, 20, 15, 0).toISOString() },
          { userId: 'user_003', vote: 'agree', comment: '', votedAt: new Date(2026, 4, 21, 8, 30).toISOString() }
        ],
        createdBy: 'admin_001',
        createdAt: new Date(2026, 4, 20, 8, 0).toISOString(),
        closedAt: new Date(2026, 4, 22, 17, 0).toISOString()
      }
    ];
    Storage.set(Storage.KEYS.VOTES, votes);

    // Create sample notifications
    const notifications = [
      {
        id: 'notif_001',
        title: 'Thông báo lịch họp giao ban tháng 6/2026',
        content: 'Kính mời các đồng chí tham dự cuộc họp giao ban định kỳ tháng 6/2026 vào lúc 8h00 ngày 15/06/2026 tại Phòng họp số 1.',
        priority: 'important',
        readBy: ['user_001'],
        createdBy: 'admin_001',
        createdAt: new Date(2026, 5, 10, 7, 0).toISOString()
      },
      {
        id: 'notif_002',
        title: 'Cập nhật hệ thống phần mềm',
        content: 'Hệ thống sẽ được bảo trì và nâng cấp vào ngày 20/06/2026 từ 22h00 đến 06h00 ngày hôm sau. Trong thời gian này, hệ thống sẽ tạm ngừng hoạt động.',
        priority: 'normal',
        readBy: [],
        createdBy: 'admin_001',
        createdAt: new Date(2026, 5, 9, 15, 0).toISOString()
      },
      {
        id: 'notif_003',
        title: 'Yêu cầu nộp báo cáo quý II/2026',
        content: 'Đề nghị các phòng ban hoàn thành và nộp báo cáo kết quả hoạt động quý II/2026 trước ngày 25/06/2026. File báo cáo gửi qua hệ thống.',
        priority: 'urgent',
        readBy: [],
        createdBy: 'admin_001',
        createdAt: new Date(2026, 5, 8, 9, 0).toISOString()
      }
    ];
    Storage.set(Storage.KEYS.NOTIFICATIONS, notifications);

    // Create sample files
    const files = [
      {
        id: 'file_001',
        fileName: 'Bao_cao_thang_5.docx',
        fileSize: 102400,
        uploadedBy: 'user_001',
        description: 'Báo cáo kết quả tháng 5/2026 - Phòng Hành chính',
        createdAt: new Date(2026, 5, 5, 14, 30).toISOString()
      },
      {
        id: 'file_002',
        fileName: 'De_xuat_ngan_sach_Q3.xlsx',
        fileSize: 87040,
        uploadedBy: 'user_003',
        description: 'Đề xuất ngân sách hoạt động quý III/2026',
        createdAt: new Date(2026, 5, 6, 10, 0).toISOString()
      }
    ];
    Storage.set(Storage.KEYS.FILES, files);

    console.log('✅ Default data initialized locally without network push');
  }
};
