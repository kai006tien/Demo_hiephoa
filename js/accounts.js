/* ============================================
   ACCOUNTS - Account Management Module
   ============================================ */

const Accounts = {
  // Render accounts table (Admin)
  renderAccountsList() {
    const accounts = Storage.getAccounts().filter(a => a.role !== 'admin');
    const container = document.getElementById('accounts-list');
    if (!container) return;

    if (accounts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <div class="empty-state__title">Chưa có tài khoản nào</div>
          <div class="empty-state__text">Nhấn "Tạo tài khoản" để thêm tài khoản mới</div>
        </div>`;
      return;
    }

    let html = `
      <div class="table-wrapper">
        <table class="data-table" id="accounts-table">
          <thead>
            <tr>
              <th>STT</th>
              <th>Họ và tên</th>
              <th>Tài khoản</th>
              <th>Chức vụ</th>
              <th>Email</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>`;

    accounts.forEach((acc, index) => {
      html += `
        <tr>
          <td>${index + 1}</td>
          <td>
            <div class="d-flex items-center gap-3">
              <div class="header__avatar" style="width:32px;height:32px;font-size:12px;">${Utils.getInitials(acc.fullName)}</div>
              <strong>${Utils.escapeHtml(acc.fullName)}</strong>
            </div>
          </td>
          <td><code style="background:var(--color-bg);padding:2px 8px;border-radius:4px;font-size:13px;">${Utils.escapeHtml(acc.username)}</code></td>
          <td>${Utils.escapeHtml(acc.position || '—')}</td>
          <td>${Utils.escapeHtml(acc.email || '—')}</td>
          <td>
            <span class="badge ${acc.active ? 'badge--success' : 'badge--danger'}">
              <span class="badge-dot ${acc.active ? 'badge-dot--success' : 'badge-dot--danger'}"></span>
              ${acc.active ? 'Hoạt động' : 'Đã khóa'}
            </span>
          </td>
          <td>
            <div class="d-flex gap-2">
              <button class="btn btn-ghost btn-sm" onclick="Accounts.editAccount('${acc.id}')" data-tooltip="Chỉnh sửa">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn btn-ghost btn-sm" onclick="Accounts.resetPassword('${acc.id}')" data-tooltip="Đặt lại mật khẩu">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </button>
              <button class="btn btn-ghost btn-sm text-danger" onclick="Accounts.toggleActive('${acc.id}')" data-tooltip="${acc.active ? 'Khóa TK' : 'Mở khóa'}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">${acc.active ? '<path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>' : '<path d="M1 1l22 22"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>'}</svg>
              </button>
            </div>
          </td>
        </tr>`;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
  },

  // Open create account modal
  openCreateModal() {
    document.getElementById('modal-account-title').textContent = 'Tạo tài khoản mới';
    document.getElementById('account-form').reset();
    document.getElementById('account-edit-id').value = '';
    document.getElementById('account-password-group').style.display = 'block';
    Utils.openModal('modal-account');
  },

  // Edit account
  editAccount(id) {
    const account = Storage.getAccountById(id);
    if (!account) return;

    document.getElementById('modal-account-title').textContent = 'Chỉnh sửa tài khoản';
    document.getElementById('account-edit-id').value = id;
    document.getElementById('account-fullname').value = account.fullName;
    document.getElementById('account-username').value = account.username;
    document.getElementById('account-position').value = account.position || '';
    document.getElementById('account-email').value = account.email || '';
    document.getElementById('account-phone').value = account.phone || '';
    document.getElementById('account-password-group').style.display = 'none';

    Utils.openModal('modal-account');
  },

  // Save account (create or update)
  saveAccount() {
    const editId = document.getElementById('account-edit-id').value;
    const fullName = document.getElementById('account-fullname').value.trim();
    const username = document.getElementById('account-username').value.trim();
    const position = document.getElementById('account-position').value.trim();
    const email = document.getElementById('account-email').value.trim();
    const phone = document.getElementById('account-phone').value.trim();

    if (!fullName || !username) {
      Utils.showToast('error', 'Lỗi', 'Vui lòng nhập đầy đủ họ tên và tên đăng nhập');
      return;
    }

    if (editId) {
      // Update existing
      Storage.updateAccount(editId, { fullName, position, email, phone });
      Utils.showToast('success', 'Thành công', 'Đã cập nhật thông tin tài khoản');
    } else {
      // Create new
      const password = document.getElementById('account-password').value;
      if (!password) {
        Utils.showToast('error', 'Lỗi', 'Vui lòng nhập mật khẩu');
        return;
      }

      // Check username unique
      if (Storage.getAccountByUsername(username)) {
        Utils.showToast('error', 'Lỗi', 'Tên đăng nhập đã tồn tại');
        return;
      }

      const newAccount = {
        id: Utils.generateId(),
        username,
        password: Utils.encode(password),
        fullName,
        role: 'user',
        position,
        email,
        phone,
        active: true,
        createdAt: Utils.getCurrentDate()
      };
      Storage.addAccount(newAccount);
      Utils.showToast('success', 'Thành công', `Đã tạo tài khoản "${fullName}"`);
    }

    Utils.closeModal('modal-account');
    Accounts.renderAccountsList();
    App.updateStats();
  },

  // Reset password
  resetPassword(id) {
    const account = Storage.getAccountById(id);
    if (!account) return;

    if (confirm(`Đặt lại mật khẩu cho "${account.fullName}" về "123456"?`)) {
      Storage.updateAccount(id, { password: Utils.encode('123456') });
      Utils.showToast('success', 'Thành công', `Đã đặt lại mật khẩu cho "${account.fullName}"`);
    }
  },

  // Toggle active status
  toggleActive(id) {
    const account = Storage.getAccountById(id);
    if (!account) return;

    const newStatus = !account.active;
    const action = newStatus ? 'mở khóa' : 'khóa';

    if (confirm(`Bạn muốn ${action} tài khoản "${account.fullName}"?`)) {
      Storage.updateAccount(id, { active: newStatus });
      Utils.showToast('success', 'Thành công', `Đã ${action} tài khoản "${account.fullName}"`);
      Accounts.renderAccountsList();
    }
  },

  // Search accounts
  searchAccounts(query) {
    const q = query.toLowerCase();
    const rows = document.querySelectorAll('#accounts-table tbody tr');
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(q) ? '' : 'none';
    });
  },

  // Get user display options for selects
  getUserOptions() {
    const accounts = Storage.getAccounts().filter(a => a.role !== 'admin' && a.active);
    return accounts.map(a => `<option value="${a.id}">${Utils.escapeHtml(a.fullName)} (${Utils.escapeHtml(a.position || '')})</option>`).join('');
  },

  // Get user name by ID
  getUserName(userId) {
    const account = Storage.getAccountById(userId);
    return account ? account.fullName : 'Không xác định';
  }
};
