/* ============================================
   DOCUMENTS - Document Management Module
   ============================================ */

const Documents = {
  currentFilter: 'all',

  // Render document list
  renderDocumentList(role = 'admin') {
    const docs = Storage.getDocuments();
    const session = Auth.getSession();
    const container = document.getElementById('documents-list');
    if (!container) return;

    let filtered = docs;

    // Filter by status
    if (Documents.currentFilter !== 'all') {
      filtered = filtered.filter(d => d.status === Documents.currentFilter);
    }

    // For users, only show documents they have permission to see
    if (role === 'user') {
      filtered = filtered.filter(d => 
        d.status !== 'draft' && d.permissions && d.permissions[session.userId]
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          <div class="empty-state__title">Chưa có văn bản nào</div>
          <div class="empty-state__text">${role === 'admin' ? 'Nhấn "Tạo văn bản" để thêm văn bản mới' : 'Chưa có văn bản được ban hành cho bạn'}</div>
        </div>`;
      return;
    }

    let html = '';
    filtered.forEach(doc => {
      const statusMap = {
        draft: { label: 'Nháp', class: 'doc-status--draft' },
        published: { label: 'Đã ban hành', class: 'doc-status--published' },
        finalized: { label: 'Đã chốt', class: 'doc-status--finalized' }
      };
      const status = statusMap[doc.status] || statusMap.draft;
      const permission = role === 'user' && doc.permissions ? doc.permissions[session.userId] : null;

      html += `
        <div class="doc-item" onclick="Documents.viewDocument('${doc.id}')">
          <div class="doc-item__icon doc-item__icon--word">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </div>
          <div class="doc-item__content">
            <div class="doc-item__title">${Utils.escapeHtml(doc.title)}</div>
            <div class="doc-item__meta">
              <span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                ${Utils.formatDate(doc.createdAt)}
              </span>
              <span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/></svg>
                ${Utils.escapeHtml(doc.fileName)}
              </span>
              <span>${Utils.formatFileSize(doc.fileSize || 0)}</span>
              ${permission ? `<span class="badge badge--info">${permission === 'edit' ? 'Được chỉnh sửa' : 'Chỉ xem'}</span>` : ''}
            </div>
          </div>
          <div class="doc-item__actions" onclick="event.stopPropagation()">
            <span class="doc-status ${status.class}">${status.label}</span>
            ${role === 'admin' ? `
              ${doc.status !== 'finalized' ? `
                <button class="btn btn-ghost btn-sm" onclick="Documents.editDocument('${doc.id}')" data-tooltip="Chỉnh sửa">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
              ` : ''}
              <button class="btn btn-ghost btn-sm text-danger" onclick="Documents.deleteDocument('${doc.id}')" data-tooltip="Xóa">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
              ${doc.status === 'draft' ? `
                <button class="btn btn-success btn-sm" onclick="Documents.publishDocument('${doc.id}')">Ban hành</button>
              ` : ''}
              ${doc.status === 'published' ? `
                <button class="btn btn-primary btn-sm" onclick="Documents.finalizeDocument('${doc.id}')">Chốt</button>
              ` : ''}
            ` : `
              <button class="btn btn-secondary btn-sm" onclick="Documents.downloadDocument('${doc.id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Tải về
              </button>
            `}
          </div>
        </div>`;
    });

    container.innerHTML = html;
  },

  // Set filter
  setFilter(filter) {
    Documents.currentFilter = filter;
    document.querySelectorAll('.doc-filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    const role = Auth.isAdmin() ? 'admin' : 'user';
    Documents.renderDocumentList(role);
  },

  // Open create document modal
  openCreateModal() {
    document.getElementById('modal-doc-title').textContent = 'Tạo văn bản mới';
    document.getElementById('doc-form').reset();
    document.getElementById('doc-edit-id').value = '';
    
    const currentFileEl = document.getElementById('doc-current-file');
    if (currentFileEl) {
      currentFileEl.textContent = '';
      currentFileEl.style.display = 'none';
    }

    Documents.renderPermissionCheckboxes();
    Utils.openModal('modal-document');
  },

  // Render permission checkboxes
  renderPermissionCheckboxes(existingPerms = {}) {
    const accounts = Storage.getAccounts().filter(a => a.role !== 'admin' && a.active);
    const container = document.getElementById('doc-permissions-list');
    if (!container) return;

    let html = '';
    accounts.forEach(acc => {
      const perm = existingPerms[acc.id] || '';
      html += `
        <div class="doc-permissions__user">
          <div class="d-flex items-center gap-2">
            <input type="checkbox" id="perm-${acc.id}" ${perm ? 'checked' : ''} onchange="Documents.togglePermission('${acc.id}')">
            <label for="perm-${acc.id}" class="doc-permissions__name">${Utils.escapeHtml(acc.fullName)}</label>
          </div>
          <select id="perm-type-${acc.id}" class="form-select" style="width:140px;height:32px;font-size:12px;" ${!perm ? 'disabled' : ''}>
            <option value="view" ${perm === 'view' ? 'selected' : ''}>Chỉ xem</option>
            <option value="edit" ${perm === 'edit' ? 'selected' : ''}>Chỉnh sửa</option>
          </select>
        </div>`;
    });

    container.innerHTML = html || '<p class="text-muted">Chưa có tài khoản con nào</p>';
  },

  togglePermission(userId) {
    const checkbox = document.getElementById(`perm-${userId}`);
    const select = document.getElementById(`perm-type-${userId}`);
    if (select) select.disabled = !checkbox.checked;
  },

  // Edit document
  editDocument(id) {
    const doc = Storage.getDocuments().find(d => d.id === id);
    if (!doc) return;

    document.getElementById('modal-doc-title').textContent = 'Chỉnh sửa văn bản';
    document.getElementById('doc-edit-id').value = id;
    document.getElementById('doc-title-input').value = doc.title;
    document.getElementById('doc-desc-input').value = doc.description || '';
    
    const currentFileEl = document.getElementById('doc-current-file');
    if (currentFileEl) {
      currentFileEl.textContent = `File hiện tại: ${doc.fileName}`;
      currentFileEl.style.display = 'block';
    }

    Documents.renderPermissionCheckboxes(doc.permissions || {});

    Utils.openModal('modal-document');
  },

  // Save document
  saveDocument() {
    const editId = document.getElementById('doc-edit-id').value;
    const title = document.getElementById('doc-title-input').value.trim();
    const description = document.getElementById('doc-desc-input').value.trim();

    if (!title) {
      Utils.showToast('error', 'Lỗi', 'Vui lòng nhập tiêu đề văn bản');
      return;
    }

    // Collect permissions
    const permissions = {};
    const accounts = Storage.getAccounts().filter(a => a.role !== 'admin');
    accounts.forEach(acc => {
      const checkbox = document.getElementById(`perm-${acc.id}`);
      const select = document.getElementById(`perm-type-${acc.id}`);
      if (checkbox && checkbox.checked && select) {
        permissions[acc.id] = select.value;
      }
    });

    if (editId) {
      const doc = Storage.getDocuments().find(d => d.id === editId);
      if (doc && doc.status === 'finalized') {
        Utils.showToast('error', 'Lỗi', 'Không thể chỉnh sửa văn bản đã chốt');
        return;
      }
      const fileInput = document.getElementById('doc-file-input');
      const updates = { title, description, permissions };
      if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        updates.fileName = file.name;
        updates.fileSize = file.size;
      }
      Storage.updateDocument(editId, updates);
      Utils.showToast('success', 'Thành công', 'Đã cập nhật văn bản');
    } else {
      // Check for file upload
      const fileInput = document.getElementById('doc-file-input');
      let fileName = 'Document.docx';
      let fileSize = 0;

      if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        fileName = file.name;
        fileSize = file.size;
      }

      const newDoc = {
        id: Utils.generateId(),
        title,
        description,
        fileName,
        fileSize,
        status: 'draft',
        permissions,
        createdBy: Auth.getSession().userId,
        createdAt: Utils.getCurrentDate()
      };
      Storage.addDocument(newDoc);
      Utils.showToast('success', 'Thành công', `Đã tạo văn bản "${title}"`);
    }

    Utils.closeModal('modal-document');
    Documents.renderDocumentList('admin');
    App.updateStats();
  },

  // Publish document
  publishDocument(id) {
    if (confirm('Ban hành văn bản này? Các tài khoản được phân quyền sẽ có thể xem.')) {
      Storage.updateDocument(id, { 
        status: 'published', 
        publishedAt: Utils.getCurrentDate() 
      });
      Utils.showToast('success', 'Thành công', 'Đã ban hành văn bản');
      
      // Create notification
      const doc = Storage.getDocuments().find(d => d.id === id);
      if (doc) {
        Storage.addNotification({
          id: Utils.generateId(),
          title: `Văn bản mới: ${doc.title}`,
          content: `Văn bản "${doc.title}" đã được ban hành. Vui lòng kiểm tra trong mục Văn bản.`,
          priority: 'important',
          readBy: [],
          createdBy: Auth.getSession().userId,
          createdAt: Utils.getCurrentDate()
        });
      }

      Documents.renderDocumentList('admin');
      App.updateStats();
      Notifications.updateBadge();
    }
  },

  // Finalize document
  finalizeDocument(id) {
    if (confirm('Chốt văn bản này? Văn bản sẽ không thể chỉnh sửa nữa.')) {
      Storage.updateDocument(id, { 
        status: 'finalized', 
        finalizedAt: Utils.getCurrentDate() 
      });
      Utils.showToast('success', 'Thành công', 'Đã chốt văn bản');
      Documents.renderDocumentList('admin');
    }
  },

  // View document detail
  viewDocument(id) {
    const doc = Storage.getDocuments().find(d => d.id === id);
    if (!doc) return;

    const statusMap = {
      draft: 'Nháp',
      published: 'Đã ban hành',
      finalized: 'Đã chốt'
    };

    let permHtml = '';
    if (doc.permissions) {
      Object.entries(doc.permissions).forEach(([userId, perm]) => {
        const user = Storage.getAccountById(userId);
        if (user) {
          permHtml += `<div class="d-flex items-center justify-between p-2"><span>${Utils.escapeHtml(user.fullName)}</span><span class="badge ${perm === 'edit' ? 'badge--success' : 'badge--info'}">${perm === 'edit' ? 'Chỉnh sửa' : 'Chỉ xem'}</span></div>`;
        }
      });
    }

    const modalBody = document.getElementById('modal-doc-view-body');
    if (modalBody) {
      modalBody.innerHTML = `
        <div class="mb-6">
          <h3 style="margin-bottom:var(--space-4)">${Utils.escapeHtml(doc.title)}</h3>
          <p>${Utils.escapeHtml(doc.description || 'Không có mô tả')}</p>
          <div class="d-flex gap-4 flex-wrap mt-4" style="font-size:13px;color:var(--color-text-muted);">
            <span>📄 ${Utils.escapeHtml(doc.fileName)}</span>
            <span>📦 ${Utils.formatFileSize(doc.fileSize || 0)}</span>
            <span>📅 ${Utils.formatDateTime(doc.createdAt)}</span>
            <span class="badge ${doc.status === 'finalized' ? 'badge--success' : doc.status === 'published' ? 'badge--info' : 'badge--warning'}">${statusMap[doc.status]}</span>
          </div>
        </div>
        ${permHtml ? `
          <div class="card mt-4">
            <div class="card__header"><div class="card__title">Phân quyền truy cập</div></div>
            <div class="card__body" style="padding:var(--space-3)">${permHtml}</div>
          </div>
        ` : ''}
      `;
    }
    const modal = document.getElementById('modal-doc-view');
    const modalFooter = modal ? modal.querySelector('.modal__footer') : null;
    if (modalFooter) {
      modalFooter.innerHTML = `
        <button class="btn btn-secondary" onclick="Utils.closeModal('modal-doc-view')">Đóng</button>
        <button class="btn btn-primary" onclick="Documents.downloadDocument('${doc.id}'); event.stopPropagation();">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" style="margin-right:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Tải về máy
        </button>
      `;
    }

    Utils.openModal('modal-doc-view');
  },

  // Download document
  downloadDocument(id) {
    const doc = Storage.getDocuments().find(d => d.id === id);
    if (doc) {
      Utils.showToast('info', 'Tải xuống', `Đang tải "${doc.fileName}"...`);
      setTimeout(() => {
        Utils.downloadFile(doc.fileName, `Tiêu đề văn bản: ${doc.title}\nMô tả: ${doc.description || 'Không có mô tả'}\nNgày tạo: ${Utils.formatDateTime(doc.createdAt)}\nTrạng thái: ${doc.status}`);
      }, 500);
    }
  },

  // Delete document
  deleteDocument(id) {
    const doc = Storage.getDocuments().find(d => d.id === id);
    if (doc && confirm(`Bạn có chắc muốn xóa văn bản "${doc.title}"?`)) {
      Storage.deleteDocument(id);
      Utils.showToast('success', 'Đã xóa', `Đã xóa văn bản "${doc.title}"`);
      const role = Auth.isAdmin() ? 'admin' : 'user';
      Documents.renderDocumentList(role);
      App.updateStats();
    }
  }
};
