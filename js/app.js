/* ============================================
   APP - Main Application Controller
   ============================================ */

const App = {
  currentSection: 'dashboard',

  // Initialize app
  init(role) {
    if (typeof Sync !== 'undefined') {
      Sync.init();
    }

    Storage.initializeDefaultData();

    if (role === 'admin') {
      if (!Auth.requireAdmin()) return;
    } else {
      if (!Auth.requireUser()) return;
    }

    const session = Auth.getSession();
    App.setupHeader(session);
    App.setupSidebar(role);
    App.setupClock();
    Notifications.updateBadge();

    // Listen for cloud data sync to reload views dynamically
    document.addEventListener('hha_data_synced', () => {
      App.navigateTo(App.currentSection);
    });

    App.navigateTo('dashboard');
  },

  // Setup header
  setupHeader(session) {
    const userNameEl = document.getElementById('header-user-name');
    const userRoleEl = document.getElementById('header-user-role');
    const avatarEl = document.getElementById('header-avatar');
    const welcomeNameEl = document.getElementById('welcome-name');

    if (userNameEl) userNameEl.textContent = session.fullName;
    if (userRoleEl) userRoleEl.textContent = session.role === 'admin' ? 'Quản trị viên' : session.position || 'Người dùng';
    if (avatarEl) avatarEl.textContent = Utils.getInitials(session.fullName);
    if (welcomeNameEl) welcomeNameEl.textContent = session.fullName;

    // Setup welcome banner
    const greetingEl = document.getElementById('greeting-text');
    const dateEl = document.getElementById('current-date-text');
    if (greetingEl) greetingEl.textContent = Utils.getGreeting();
    if (dateEl) dateEl.textContent = Utils.getVietnameseDay();

    // Hamburger toggle
    const hamburger = document.getElementById('hamburger-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (hamburger) {
      hamburger.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
      });
    }

    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
      });
    }

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('Bạn muốn đăng xuất?')) {
          Auth.logout();
        }
      });
    }
  },

  // Setup sidebar navigation
  setupSidebar(role) {
    const items = document.querySelectorAll('.sidebar__item[data-section]');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const section = item.dataset.section;
        App.navigateTo(section);

        // Close sidebar on mobile
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (window.innerWidth <= 768) {
          sidebar.classList.remove('open');
          overlay.classList.remove('active');
        }
      });
    });
  },

  // Navigate to section
  navigateTo(section) {
    App.currentSection = section;

    // Update sidebar active
    document.querySelectorAll('.sidebar__item').forEach(item => {
      item.classList.toggle('active', item.dataset.section === section);
    });

    // Show/hide sections
    document.querySelectorAll('.content-section').forEach(el => {
      el.classList.toggle('active', el.id === `section-${section}`);
    });

    // Load section data
    const role = Auth.isAdmin() ? 'admin' : 'user';
    switch (section) {
      case 'dashboard':
        App.updateStats();
        App.renderRecentActivity();
        break;
      case 'accounts':
        if (role === 'admin') Accounts.renderAccountsList();
        break;
      case 'documents':
        Documents.renderDocumentList(role);
        break;
      case 'voting':
        if (role === 'admin') {
          Voting.renderVoteListAdmin();
        } else {
          Voting.renderVoteListUser();
        }
        break;
      case 'notifications':
        Notifications.renderNotificationList(role);
        break;
      case 'files':
        if (role === 'admin') {
          FileManager.renderFileListAdmin();
        } else {
          FileManager.renderFileListUser();
        }
        break;
      case 'sync':
        if (role === 'admin') {
          document.getElementById('sync-enabled-toggle').checked = Sync.isEnabled();
          document.getElementById('sync-script-url').value = Sync.getUrl();
        }
        break;
    }
  },

  // Update statistics
  updateStats() {
    const accounts = Storage.getAccounts().filter(a => a.role !== 'admin');
    const docs = Storage.getDocuments();
    const votes = Storage.getVotes();
    const notifs = Storage.getNotifications();
    const files = Storage.getFiles();
    const activeVotes = votes.filter(v => v.status === 'active');

    // Admin stats
    const statElements = {
      'stat-accounts': accounts.length,
      'stat-documents': docs.length,
      'stat-votes': activeVotes.length,
      'stat-notifications': notifs.length,
      'stat-files': files.length,
      'stat-published-docs': docs.filter(d => d.status === 'published').length,
      'stat-total-votes': votes.length
    };

    Object.entries(statElements).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) {
        Utils.animateCounter(el, value, 800);
      }
    });

    // User-specific stats
    const session = Auth.getSession();
    if (session && session.role === 'user') {
      const myDocs = docs.filter(d => d.status !== 'draft' && d.permissions && d.permissions[session.userId]);
      const myUnread = notifs.filter(n => !n.readBy || !n.readBy.includes(session.userId));

      const userStatElements = {
        'stat-my-docs': myDocs.length,
        'stat-my-votes': activeVotes.length,
        'stat-my-notifs': myUnread.length,
        'stat-my-files': files.filter(f => f.uploadedBy === session.userId).length
      };

      Object.entries(userStatElements).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) Utils.animateCounter(el, value, 800);
      });
    }
  },

  // Render recent activity
  renderRecentActivity() {
    const container = document.getElementById('recent-activity');
    if (!container) return;

    const activities = [];

    // Collect recent documents
    Storage.getDocuments().slice(0, 3).forEach(doc => {
      activities.push({
        type: 'doc',
        text: `Văn bản "${Utils.truncate(doc.title, 35)}" - ${doc.status === 'draft' ? 'Nháp' : doc.status === 'published' ? 'Đã ban hành' : 'Đã chốt'}`,
        time: doc.publishedAt || doc.createdAt
      });
    });

    // Collect recent votes
    Storage.getVotes().slice(0, 2).forEach(vote => {
      activities.push({
        type: 'vote',
        text: `Biểu quyết "${Utils.truncate(vote.title, 35)}" - ${vote.voters ? vote.voters.length : 0} phiếu`,
        time: vote.createdAt
      });
    });

    // Collect recent notifications
    Storage.getNotifications().slice(0, 2).forEach(notif => {
      activities.push({
        type: 'notify',
        text: `Thông báo: ${Utils.truncate(notif.title, 40)}`,
        time: notif.createdAt
      });
    });

    // Sort by time
    activities.sort((a, b) => new Date(b.time) - new Date(a.time));

    const iconMap = {
      doc: '<div class="activity-icon activity-icon--doc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>',
      vote: '<div class="activity-icon activity-icon--vote"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/></svg></div>',
      notify: '<div class="activity-icon activity-icon--notify"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/></svg></div>',
      file: '<div class="activity-icon activity-icon--file"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>'
    };

    let html = '';
    activities.slice(0, 6).forEach(act => {
      html += `
        <div class="activity-item">
          ${iconMap[act.type]}
          <div class="activity-content">
            <div class="activity-text">${Utils.escapeHtml(act.text)}</div>
            <div class="activity-time">${Utils.timeAgo(act.time)}</div>
          </div>
        </div>`;
    });

    container.innerHTML = html || '<div class="text-muted p-4">Chưa có hoạt động nào</div>';
  },

  // Setup realtime clock
  setupClock() {
    const clockEl = document.getElementById('realtime-clock');
    if (!clockEl) return;

    const updateClock = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      clockEl.textContent = `${h}:${m}:${s}`;
    };

    updateClock();
    setInterval(updateClock, 1000);
  }
};
