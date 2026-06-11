/* ============================================
   SUGGESTIONS - Suggestions & Mailbox Module
   ============================================ */

const Suggestions = {
  currentTab: 'inbox', // 'inbox' or 'sent'
  selectedId: null,

  // Initialize suggestions panel
  init() {
    this.currentTab = 'inbox';
    this.selectedId = null;
    this.renderSuggestionsSection();
    
    // Listen for custom database sync events to reload lists
    document.addEventListener('hha_data_synced', () => {
      if (App.currentSection === 'suggestions') {
        Suggestions.renderMailList();
        if (Suggestions.selectedId) {
          Suggestions.renderMailDetail(Suggestions.selectedId);
        }
      }
    });
  },

  // Render main layout
  renderSuggestionsSection() {
    const container = document.getElementById('section-suggestions');
    if (!container) return;

    container.innerHTML = `
      <div class="main-content__header">
        <h2 class="main-content__title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          Hòm thư góp ý
        </h2>
        <button class="btn btn-primary" onclick="Suggestions.openCreateModal()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" style="margin-right:6px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Viết góp ý mới
        </button>
      </div>

      <div class="suggestions-layout">
        <!-- Sidebar: Mail List -->
        <div class="suggestions-sidebar">
          <div class="suggestions-sidebar__header">
            <div class="suggestions-tabs">
              <div class="suggestions-tab active" id="tab-sug-inbox" onclick="Suggestions.setTab('inbox')">Hộp thư đến</div>
              <div class="suggestions-tab" id="tab-sug-sent" onclick="Suggestions.setTab('sent')">Thư đã gửi</div>
            </div>
            <div class="search-bar" style="max-width: 100%;">
              <svg class="search-bar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input class="search-bar__input" type="text" placeholder="Tìm kiếm thư..." oninput="Suggestions.searchMails(this.value)">
            </div>
          </div>
          <div class="suggestions-list" id="suggestions-mail-list"></div>
        </div>

        <!-- Content: Mail Detail -->
        <div class="suggestions-content" id="suggestions-mail-detail">
          <div class="suggestions-content__empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            <div>Chọn một thư trong danh sách để xem chi tiết</div>
          </div>
        </div>
      </div>
    `;

    this.renderMailList();
  },

  // Set active tab
  setTab(tab) {
    this.currentTab = tab;
    this.selectedId = null;

    document.getElementById('tab-sug-inbox').classList.toggle('active', tab === 'inbox');
    document.getElementById('tab-sug-sent').classList.toggle('active', tab === 'sent');

    // Reset detail view to empty state
    const detailContainer = document.getElementById('suggestions-mail-detail');
    if (detailContainer) {
      detailContainer.innerHTML = `
        <div class="suggestions-content__empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          <div>Chọn một thư trong danh sách để xem chi tiết</div>
        </div>
      `;
    }

    this.renderMailList();
  },

  // Filter and render list
  renderMailList(query = '') {
    const listContainer = document.getElementById('suggestions-mail-list');
    if (!listContainer) return;

    const session = Auth.getSession();
    if (!session) return;

    let mails = Storage.getSuggestions();

    // Filter based on tab role
    if (this.currentTab === 'inbox') {
      // Inbox contains mail addressed to this user (or addressed to admin_001 if current user is admin)
      mails = mails.filter(m => m.receiverId === session.userId);
    } else {
      // Sent contains mail sent by this user
      // Anonymous mails are still stored with senderId so the sender can review their own sent mails!
      mails = mails.filter(m => m.senderId === session.userId);
    }

    // Filter based on search query
    if (query.trim() !== '') {
      const q = query.toLowerCase();
      mails = mails.filter(m => 
        m.title.toLowerCase().includes(q) || 
        m.content.toLowerCase().includes(q) ||
        (!m.isAnonymous && m.senderName.toLowerCase().includes(q)) ||
        m.receiverName.toLowerCase().includes(q)
      );
    }

    if (mails.length === 0) {
      listContainer.innerHTML = `
        <div class="text-muted text-center p-6" style="font-size: 13px;">
          ${this.currentTab === 'inbox' ? 'Hộp thư đến trống' : 'Chưa gửi góp ý nào'}
        </div>
      `;
      return;
    }

    listContainer.innerHTML = mails.map(mail => {
      const isAnon = mail.isAnonymous;
      const displayName = this.currentTab === 'inbox' 
        ? (isAnon ? 'Ẩn danh' : Utils.escapeHtml(mail.senderName))
        : `Gửi: ${Utils.escapeHtml(mail.receiverName)}`;

      const isActive = this.selectedId === mail.id;

      return `
        <div class="suggestion-mail-item ${isActive ? 'active' : ''}" onclick="Suggestions.selectMail('${mail.id}')">
          <div class="suggestion-mail-item__header">
            <span class="suggestion-mail-item__sender">${displayName}</span>
            <span class="suggestion-mail-item__time">${Utils.timeAgo(mail.createdAt)}</span>
          </div>
          <div class="suggestion-mail-item__title">${Utils.escapeHtml(mail.title || 'Không có tiêu đề')}</div>
          <div class="suggestion-mail-item__desc">${Utils.escapeHtml(Utils.truncate(mail.content, 40))}</div>
          <div class="d-flex gap-2 mt-1">
            ${isAnon ? '<span class="suggestion-mail-item__badge suggestion-mail-item__badge--anon">🕵 Ẩn danh</span>' : ''}
            <span class="suggestion-mail-item__badge ${this.currentTab === 'inbox' ? 'suggestion-mail-item__badge--received' : 'suggestion-mail-item__badge--sent'}">
              ${this.currentTab === 'inbox' ? '📥 Nhận' : '📤 Đã gửi'}
            </span>
          </div>
        </div>
      `;
    }).join('');
  },

  // Search filter
  searchMails(val) {
    this.renderMailList(val);
  },

  // Select mail to view detail
  selectMail(id) {
    this.selectedId = id;
    
    // Highlight list item
    document.querySelectorAll('.suggestion-mail-item').forEach(item => {
      item.classList.remove('active');
    });
    
    // Re-render list to show active state
    this.renderMailList();
    this.renderMailDetail(id);
  },

  // Render detail pane
  renderMailDetail(id) {
    const detailContainer = document.getElementById('suggestions-mail-detail');
    if (!detailContainer) return;

    const mail = Storage.getSuggestions().find(m => m.id === id);
    if (!mail) return;

    const session = Auth.getSession();
    const isInbox = mail.receiverId === session.userId;
    const senderDisplay = mail.isAnonymous 
      ? 'Ẩn danh (Người dùng ẩn danh tính)' 
      : `${Utils.escapeHtml(mail.senderName)} (${Utils.escapeHtml(mail.senderPosition || 'Thành viên')})`;

    detailContainer.innerHTML = `
      <div class="suggestions-detail">
        <div class="suggestions-detail__header">
          <div class="suggestions-detail__title">${Utils.escapeHtml(mail.title || 'Không có tiêu đề')}</div>
          <div class="suggestions-detail__meta">
            <div class="suggestions-detail__parties">
              <div class="suggestions-detail__party-row">
                Từ: <strong>${senderDisplay}</strong>
              </div>
              <div class="suggestions-detail__party-row">
                Đến: <strong>${Utils.escapeHtml(mail.receiverName)}</strong>
              </div>
            </div>
            <div class="suggestions-detail__time">
              📅 ${Utils.formatDateTime(mail.createdAt)}
            </div>
          </div>
        </div>
        <div class="suggestions-detail__body">${Utils.escapeHtml(mail.content)}</div>
      </div>
    `;
  },

  // Open modal compose suggest box
  openCreateModal() {
    const form = document.getElementById('suggestion-form');
    if (form) form.reset();

    this.populateReceivers();
    Utils.openModal('modal-suggestion');
  },

  // Populate recipient list in select option
  populateReceivers() {
    const select = document.getElementById('suggestion-receiver');
    if (!select) return;

    const session = Auth.getSession();
    const accounts = Storage.getAccounts().filter(a => a.active && a.id !== session.userId);

    let html = '<option value="" disabled selected>-- Chọn người nhận ý kiến --</option>';
    
    // Always keep Admin or general support at top if exist
    accounts.forEach(acc => {
      const roleLabel = acc.role === 'admin' ? '[Quản trị viên]' : `[${acc.position || 'Nhân viên'}]`;
      html += `<option value="${acc.id}">${Utils.escapeHtml(acc.fullName)} ${roleLabel}</option>`;
    });

    select.innerHTML = html;
  },

  // Save suggestion
  saveSuggestion() {
    const receiverSelect = document.getElementById('suggestion-receiver');
    const titleInput = document.getElementById('suggestion-title-input');
    const contentText = document.getElementById('suggestion-content-input');
    const anonCheckbox = document.getElementById('suggestion-anon-checkbox');

    if (!receiverSelect || !titleInput || !contentText) return;

    const receiverId = receiverSelect.value;
    const title = titleInput.value.trim();
    const content = contentText.value.trim();
    const isAnonymous = anonCheckbox ? anonCheckbox.checked : false;

    if (!receiverId) {
      Utils.showToast('error', 'Lỗi', 'Vui lòng chọn người nhận đóng góp');
      return;
    }
    if (!title || !content) {
      Utils.showToast('error', 'Lỗi', 'Vui lòng nhập đầy đủ tiêu đề và nội dung đóng góp');
      return;
    }

    const session = Auth.getSession();
    const receiver = Storage.getAccountById(receiverId);

    const newSuggestion = {
      id: 'sug_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      senderId: session.userId,
      senderName: session.fullName,
      senderPosition: session.position || 'Thành viên',
      receiverId: receiverId,
      receiverName: receiver ? receiver.fullName : 'Người nhận',
      title,
      content,
      isAnonymous,
      createdAt: Utils.getCurrentDate()
    };

    Storage.addSuggestion(newSuggestion);
    Utils.showToast('success', 'Đã gửi', 'Đóng góp ý kiến của bạn đã được gửi thành công!');
    Utils.closeModal('modal-suggestion');

    // Reload suggestions lists
    if (App.currentSection === 'suggestions') {
      this.setTab('sent'); // Automatically switch to Sent tab to see their sent feedback
    }
  }
};
