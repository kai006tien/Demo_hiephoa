/* ============================================
   SESSIONS - Kỳ họp lệ & Kỳ họp chuyên đề
   ============================================ */

const Sessions = {
  currentType: 'regular',  // 'regular' | 'special'
  currentSessionId: null,
  currentTab: 'documents', // 'documents' | 'resolutions'

  // ========================================
  // RENDER SESSION LIST (Tree View)
  // ========================================
  renderSessionList(type, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    Sessions.currentType = type;
    const sessions = Storage.getSessions().filter(s => s.type === type);
    const isAdmin = Auth.isAdmin();
    const typeLabel = type === 'regular' ? 'Kỳ họp lệ' : 'Kỳ họp chuyên đề';

    if (sessions.length === 0 && !isAdmin) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          <div class="empty-state__title">Chưa có ${typeLabel} nào</div>
          <div class="empty-state__text">Quản trị viên chưa tạo kỳ họp.</div>
        </div>`;
      return;
    }

    let html = '<div class="session-list">';

    // Sort by order
    sessions.sort((a, b) => (a.order || 0) - (b.order || 0));

    sessions.forEach(session => {
      const docCount = session.documents ? session.documents.length : 0;
      const resCount = session.resolutions ? session.resolutions.length : 0;
      html += `
        <div class="session-folder" id="session-${session.id}">
          <div class="session-folder__header" onclick="Sessions.toggleFolder('${session.id}')">
            <div class="session-folder__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" style="color: white; display: block;">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div class="session-folder__info">
              <div class="session-folder__name">${Utils.escapeHtml(session.name)}</div>
              <div class="session-folder__meta">${docCount} văn kiện · ${resCount} dự thảo NQ · ${Utils.formatDateTime(session.createdAt)}</div>
            </div>
            <div class="session-folder__actions" onclick="event.stopPropagation()">
              ${isAdmin ? `<button class="btn btn-ghost btn-sm text-danger" onclick="Sessions.deleteSession('${session.id}')" title="Xóa kỳ họp">✕</button>` : ''}
            </div>
            <div class="session-folder__toggle">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>
          <div class="session-folder__body">
            <div class="session-folder__content">
              ${Sessions.renderSessionContent(session, isAdmin)}
            </div>
          </div>
        </div>`;
    });

    // Admin: Create new session button
    if (isAdmin) {
      html += `
        <button class="session-create-btn" onclick="Sessions.openCreateModal('${type}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Tạo ${typeLabel} mới
        </button>`;
    }

    html += '</div>';
    container.innerHTML = html;
  },

  // ========================================
  // RENDER SESSION CONTENT (Tabs: Văn kiện + Dự thảo NQ)
  // ========================================
  renderSessionContent(session, isAdmin) {
    const tabDocsId = `tab-docs-${session.id}`;
    const tabResId = `tab-res-${session.id}`;
    const contentDocsId = `content-docs-${session.id}`;
    const contentResId = `content-res-${session.id}`;

    return `
      <div class="session-tabs">
        <button class="session-tab active" onclick="Sessions.switchTab('${session.id}', 'documents')" id="${tabDocsId}">📄 Văn kiện kỳ họp (${session.documents ? session.documents.length : 0})</button>
        <button class="session-tab" onclick="Sessions.switchTab('${session.id}', 'resolutions')" id="${tabResId}">📋 Dự thảo nghị quyết (${session.resolutions ? session.resolutions.length : 0})</button>
      </div>
      <div class="session-tab-content active" id="${contentDocsId}">
        ${Sessions.renderDocumentsTab(session, isAdmin)}
      </div>
      <div class="session-tab-content" id="${contentResId}">
        ${Sessions.renderResolutionsTab(session, isAdmin)}
      </div>
    `;
  },

  // ========================================
  // RENDER DOCUMENTS TAB (Văn kiện kỳ họp)
  // ========================================
  renderDocumentsTab(session, isAdmin) {
    let html = '';

    // Upload zone (admin only)
    if (isAdmin) {
      html += `
        <div class="upload-zone" onclick="Sessions.triggerUpload('${session.id}', 'document')" 
             ondragover="event.preventDefault();this.classList.add('drag-over')" 
             ondragleave="this.classList.remove('drag-over')"
             ondrop="event.preventDefault();this.classList.remove('drag-over');Sessions.handleDrop(event,'${session.id}','document')">
          <div class="upload-zone__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          </div>
          <div class="upload-zone__text">Kéo thả file hoặc nhấn để tải văn kiện</div>
          <div class="upload-zone__hint">Hỗ trợ PDF, Word, Excel, PowerPoint (tối đa 10MB)</div>
        </div>
        <input type="file" id="upload-doc-${session.id}" style="display:none" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" multiple onchange="Sessions.handleFileUpload(event,'${session.id}','document')">
      `;
    }

    // File list
    const docs = session.documents || [];
    if (docs.length === 0) {
      html += `<div class="session-empty"><div class="session-empty__text">Chưa có văn kiện nào được tải lên</div></div>`;
    } else {
      html += '<div class="file-cards">';
      docs.forEach(doc => {
        const ext = Sessions.getFileExtension(doc.fileName);
        const iconClass = ext === 'pdf' ? 'file-card__icon--pdf' : (ext === 'doc' || ext === 'docx') ? 'file-card__icon--word' : 'file-card__icon--other';
        const iconLabel = ext.toUpperCase().substring(0, 4);

        html += `
          <div class="file-card">
            <div class="file-card__icon ${iconClass}">${iconLabel}</div>
            <div class="file-card__info">
              <div class="file-card__name">${Utils.escapeHtml(doc.fileName)}</div>
              <div class="file-card__size">${Sessions.formatFileSize(doc.fileSize)} · ${Utils.timeAgo(doc.uploadedAt)}</div>
            </div>
            <div class="file-card__actions">
              ${['pdf', 'docx', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext) ? `<button class="file-card__btn" onclick="Sessions.previewFile('${session.id}','document','${doc.id}')">👁 Xem</button>` : ''}
              <button class="file-card__btn" onclick="Sessions.downloadFile('${session.id}','document','${doc.id}')">⬇ Tải</button>
              ${isAdmin ? `<button class="file-card__btn file-card__btn--danger" onclick="Sessions.removeFile('${session.id}','document','${doc.id}')">✕</button>` : ''}
            </div>
          </div>`;
      });
      html += '</div>';
    }

    return html;
  },

  // ========================================
  // RENDER RESOLUTIONS TAB (Dự thảo NQ + Biểu quyết)
  // ========================================
  renderResolutionsTab(session, isAdmin) {
    let html = '';

    // Upload zone (admin only)
    if (isAdmin) {
      html += `
        <div class="upload-zone" onclick="Sessions.triggerUpload('${session.id}', 'resolution')"
             ondragover="event.preventDefault();this.classList.add('drag-over')" 
             ondragleave="this.classList.remove('drag-over')"
             ondrop="event.preventDefault();this.classList.remove('drag-over');Sessions.handleDrop(event,'${session.id}','resolution')">
          <div class="upload-zone__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
          </div>
          <div class="upload-zone__text">Tải lên dự thảo nghị quyết</div>
          <div class="upload-zone__hint">Hỗ trợ PDF, Word (tối đa 10MB)</div>
        </div>
        <input type="file" id="upload-res-${session.id}" style="display:none" accept=".pdf,.doc,.docx" multiple onchange="Sessions.handleFileUpload(event,'${session.id}','resolution')">
      `;
    }

    // Resolution list
    const resolutions = session.resolutions || [];
    if (resolutions.length === 0) {
      html += `<div class="session-empty"><div class="session-empty__text">Chưa có dự thảo nghị quyết nào</div></div>`;
    } else {
      resolutions.forEach(res => {
        html += Sessions.renderResolutionCard(session, res, isAdmin);
      });
    }

    return html;
  },

  // ========================================
  // RENDER SINGLE RESOLUTION CARD
  // ========================================
  renderResolutionCard(session, res, isAdmin) {
    const ext = Sessions.getFileExtension(res.fileName);
    const iconClass = ext === 'pdf' ? 'resolution-card__file-icon--pdf' : 'resolution-card__file-icon--word';
    const iconLabel = ext.toUpperCase().substring(0, 4);
    const vote = res.vote;
    const voters = vote ? (vote.voters || []) : [];
    const totalVoters = voters.length;
    const agreeCount = voters.filter(v => v.voteType === 'agree').length;
    const disagreeCount = totalVoters - agreeCount;
    const agreePercent = totalVoters > 0 ? Math.round((agreeCount / totalVoters) * 100) : 0;
    const disagreePercent = totalVoters > 0 ? 100 - agreePercent : 0;

    // Check if current user has voted
    const currentSession = Auth.getSession();
    const myVote = vote && vote.voters ? vote.voters.find(v => v.userId === currentSession.userId) : null;

    let voteStatusHtml = '';
    let voteActionsHtml = '';
    let votersListHtml = '';

    if (!vote || !vote.status) {
      // No vote started yet
      voteStatusHtml = `<span class="resolution-vote__status resolution-vote__status--pending">⏳ Chưa biểu quyết</span>`;
      if (isAdmin) {
        voteActionsHtml = `
          <button class="start-vote-btn" onclick="Sessions.startVote('${session.id}','${res.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/></svg>
            Phát biểu quyết
          </button>`;
      }
    } else if (vote.status === 'active') {
      voteStatusHtml = `<span class="resolution-vote__status resolution-vote__status--active">● Đang mở</span>`;
      if (isAdmin) {
        voteActionsHtml = `
          <button class="close-vote-btn" onclick="Sessions.closeVote('${session.id}','${res.id}')">
            Đóng biểu quyết
          </button>`;
      }
      // User voting buttons
      if (!isAdmin && !myVote) {
        voteActionsHtml = `
          <div class="resolution-vote__opinion-input-group">
            <label>Ý kiến đóng góp (nếu có):</label>
            <input type="text" id="opinion-input-${res.id}" placeholder="Nhập ý kiến đóng góp của bạn...">
          </div>
          <div class="resolution-vote__actions">
            <button class="resolution-vote__btn resolution-vote__btn--agree" onclick="Sessions.submitVote('${session.id}','${res.id}','agree')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
              TÁN THÀNH
            </button>
            <button class="resolution-vote__btn resolution-vote__btn--disagree" onclick="Sessions.submitVote('${session.id}','${res.id}','disagree')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/></svg>
              KHÔNG TÁN THÀNH
            </button>
          </div>`;
      } else if (!isAdmin && myVote) {
        voteActionsHtml = `
          <div class="resolution-vote__voted resolution-vote__voted--${myVote.voteType}">
            ${myVote.voteType === 'agree' ? '✓ Bạn đã tán thành' : '✗ Bạn đã không tán thành'}
            ${myVote.opinion ? `<div style="font-size: 12px; color: var(--color-text-secondary); margin-top: 4px; font-style: italic;">Ý kiến của bạn: "${Utils.escapeHtml(myVote.opinion)}"</div>` : ''}
          </div>`;
      }
    } else {
      voteStatusHtml = `<span class="resolution-vote__status resolution-vote__status--closed">✓ Đã đóng</span>`;
    }

    // Admin voters list
    if (isAdmin && vote && voters.length > 0) {
      votersListHtml = `
        <div class="resolution-voters">
          <div class="resolution-voters__title">Danh sách đã biểu quyết (${totalVoters})</div>
          <div class="resolution-voters__list" style="display: flex; flex-direction: column; gap: 8px;">
            ${voters.map(v => {
              const user = Storage.getAccountById(v.userId);
              const opinionText = v.opinion ? `<div class="resolution-voter__opinion">"Ý kiến: ${Utils.escapeHtml(v.opinion)}"</div>` : '';
              return `
                <div class="resolution-voter-wrapper">
                  <div class="resolution-voter">
                    <div class="resolution-voter__avatar">${Utils.getInitials(user ? user.fullName : '?')}</div>
                    <span class="resolution-voter__name">${Utils.escapeHtml(user ? user.fullName : 'Không xác định')}</span>
                    <span class="resolution-voter__vote--${v.voteType}">${v.voteType === 'agree' ? '✓ Tán thành' : '✗ Không tán thành'}</span>
                  </div>
                  ${opinionText}
                </div>`;
            }).join('')}
          </div>
        </div>`;
    }

    const previewable = ['pdf', 'docx', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext);

    return `
      <div class="resolution-card">
        <div class="resolution-card__header">
          <div class="resolution-card__file-icon ${iconClass}">${iconLabel}</div>
          <div class="resolution-card__info">
            <div class="resolution-card__title">${Utils.escapeHtml(res.title || res.fileName)}</div>
            <div class="resolution-card__meta">${Sessions.formatFileSize(res.fileSize)} · ${Utils.timeAgo(res.uploadedAt)}</div>
          </div>
          <div class="resolution-card__actions-top">
            ${previewable ? `<button class="file-card__btn" onclick="Sessions.previewFile('${session.id}','resolution','${res.id}')">👁 Xem trước</button>` : ''}
            <button class="file-card__btn" onclick="Sessions.downloadFile('${session.id}','resolution','${res.id}')">⬇ Tải</button>
            ${isAdmin ? `<button class="file-card__btn file-card__btn--danger" onclick="Sessions.removeFile('${session.id}','resolution','${res.id}')">✕</button>` : ''}
          </div>
        </div>

        ${/* Preview area for PDF files */''}
        <div class="resolution-card__preview" id="preview-${res.id}" style="display:none;"></div>

        ${/* Voting Section */''}
        <div class="resolution-vote">
          <div class="resolution-vote__title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/></svg>
            Biểu quyết dự thảo nghị quyết
            ${voteStatusHtml}
          </div>

          ${vote && vote.status ? `
            <div class="resolution-vote__results">
              <div class="resolution-vote__bar">
                <span class="resolution-vote__bar-label" style="color:var(--color-success)">✓ Tán thành</span>
                <div class="resolution-vote__bar-track">
                  <div class="resolution-vote__bar-fill resolution-vote__bar-fill--agree" style="width:${agreePercent}%">${agreePercent > 10 ? agreePercent + '%' : ''}</div>
                </div>
                <span class="resolution-vote__bar-count" style="color:var(--color-success)">${agreeCount}</span>
              </div>
              <div class="resolution-vote__bar">
                <span class="resolution-vote__bar-label" style="color:var(--color-danger)">✗ Không tán thành</span>
                <div class="resolution-vote__bar-track">
                  <div class="resolution-vote__bar-fill resolution-vote__bar-fill--disagree" style="width:${disagreePercent}%">${disagreePercent > 10 ? disagreePercent + '%' : ''}</div>
                </div>
                <span class="resolution-vote__bar-count" style="color:var(--color-danger)">${disagreeCount}</span>
              </div>
            </div>
            <div class="resolution-vote__total">Tổng số đại biểu đã tham gia: ${totalVoters}</div>
          ` : ''}

          ${voteActionsHtml}
          ${votersListHtml}
        </div>
      </div>`;
  },

  // ========================================
  // FOLDER TOGGLE
  // ========================================
  toggleFolder(sessionId) {
    const folder = document.getElementById(`session-${sessionId}`);
    if (folder) {
      folder.classList.toggle('session-folder--open');
    }
  },

  // ========================================
  // TAB SWITCHING
  // ========================================
  switchTab(sessionId, tab) {
    // Toggle tab buttons
    const tabDocs = document.getElementById(`tab-docs-${sessionId}`);
    const tabRes = document.getElementById(`tab-res-${sessionId}`);
    const contentDocs = document.getElementById(`content-docs-${sessionId}`);
    const contentRes = document.getElementById(`content-res-${sessionId}`);

    if (tab === 'documents') {
      tabDocs.classList.add('active');
      tabRes.classList.remove('active');
      contentDocs.classList.add('active');
      contentRes.classList.remove('active');
    } else {
      tabDocs.classList.remove('active');
      tabRes.classList.add('active');
      contentDocs.classList.remove('active');
      contentRes.classList.add('active');
    }
  },

  // ========================================
  // CREATE SESSION MODAL
  // ========================================
  openCreateModal(type) {
    Sessions.currentType = type;
    const modal = document.getElementById('modal-session');
    const title = document.getElementById('modal-session-title');
    const input = document.getElementById('session-name-input');
    
    if (title) title.textContent = type === 'regular' ? 'Tạo kỳ họp lệ mới' : 'Tạo kỳ họp chuyên đề mới';
    if (input) input.value = '';
    Utils.openModal('modal-session');
  },

  saveSession() {
    const nameInput = document.getElementById('session-name-input');
    const name = nameInput ? nameInput.value.trim() : '';

    if (!name) {
      Utils.showToast('error', 'Lỗi', 'Vui lòng nhập tên kỳ họp');
      return;
    }

    const sessions = Storage.getSessions().filter(s => s.type === Sessions.currentType);
    const newSession = {
      id: Utils.generateId(),
      type: Sessions.currentType,
      name: name,
      order: sessions.length + 1,
      documents: [],
      resolutions: [],
      createdBy: Auth.getSession().userId,
      createdAt: Utils.getCurrentDate()
    };

    Storage.addSession(newSession);
    Utils.showToast('success', 'Thành công', `Đã tạo "${name}"`);
    Utils.closeModal('modal-session');

    // Re-render
    const containerId = Sessions.currentType === 'regular' ? 'sessions-regular-list' : 'sessions-special-list';
    Sessions.renderSessionList(Sessions.currentType, containerId);
  },

  // ========================================
  // DELETE SESSION
  // ========================================
  deleteSession(sessionId) {
    if (!confirm('Xóa kỳ họp này? Tất cả văn kiện và dự thảo bên trong sẽ bị xóa.')) return;

    Storage.deleteSession(sessionId);
    Utils.showToast('success', 'Đã xóa', 'Kỳ họp đã được xóa');

    const containerId = Sessions.currentType === 'regular' ? 'sessions-regular-list' : 'sessions-special-list';
    Sessions.renderSessionList(Sessions.currentType, containerId);
  },

  // ========================================
  // FILE UPLOAD HANDLING
  // ========================================
  triggerUpload(sessionId, fileType) {
    const inputId = fileType === 'document' ? `upload-doc-${sessionId}` : `upload-res-${sessionId}`;
    const input = document.getElementById(inputId);
    if (input) input.click();
  },

  handleDrop(event, sessionId, fileType) {
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      Sessions.processFiles(files, sessionId, fileType);
    }
  },

  handleFileUpload(event, sessionId, fileType) {
    const files = event.target.files;
    if (files.length > 0) {
      Sessions.processFiles(files, sessionId, fileType);
    }
    event.target.value = '';
  },

  processFiles(files, sessionId, fileType) {
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB

    Array.from(files).forEach(file => {
      if (file.size > MAX_SIZE) {
        Utils.showToast('error', 'Lỗi', `File "${file.name}" vượt quá 10MB`);
        return;
      }

      // Thông báo đang tải tài liệu lên
      Utils.showToast('info', 'Thông báo', `Đang tải tài liệu "${file.name}" lên hệ thống...`);

      const reader = new FileReader();
      reader.onload = (e) => {
        const fileData = e.target.result;
        const fileId = Utils.generateId();
        
        // Gửi tệp lên server qua API uploadFile
        const payload = {
          id: fileId,
          fileName: file.name,
          mimeType: file.type,
          base64: fileData,
          uploadedBy: Auth.getSession() ? Auth.getSession().fullName : 'admin',
          description: fileType === 'document' ? 'Tài liệu kỳ họp' : 'Dự thảo nghị quyết'
        };

        const token = Auth.getAuthToken();
        const headers = {
          'Content-Type': 'application/json'
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        Utils.resilientFetch('/api/uploadFile', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(payload)
        })
        .then(async response => {
          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Lỗi tải lên máy chủ');
          }
          return response.json();
        })
        .then(result => {
          // Lưu tệp vào session với downloadUrl nhận được từ server, fileData để null để không lưu base64 ở local
          const fileEntry = {
            id: fileId,
            fileName: file.name,
            fileSize: file.size,
            downloadUrl: result.downloadUrl,
            fileData: null,
            uploadedAt: Utils.getCurrentDate()
          };

          if (fileType === 'resolution') {
            fileEntry.title = file.name.replace(/\.[^/.]+$/, '');
            fileEntry.vote = null;
          }

          // Cập nhật session
          const session = Storage.getSessions().find(s => s.id === sessionId);
          if (!session) return;

          if (fileType === 'document') {
            if (!session.documents) session.documents = [];
            session.documents.push(fileEntry);
          } else {
            if (!session.resolutions) session.resolutions = [];
            session.resolutions.push(fileEntry);
          }

          Storage.updateSession(sessionId, {
            documents: session.documents,
            resolutions: session.resolutions
          });

          // Thông báo tải thành công
          Utils.showToast('success', 'Thành công', `Đã tải lên và lưu trữ thành công "${file.name}"`);

          // Re-render
          const containerId = Sessions.currentType === 'regular' ? 'sessions-regular-list' : 'sessions-special-list';
          Sessions.renderSessionList(Sessions.currentType, containerId);
        })
        .catch(err => {
          console.error("Tải file lên thất bại:", err);
          Utils.showToast('error', 'Lỗi', `Không thể tải file "${file.name}": ${err.message}`);
        });
      };

      reader.readAsDataURL(file);
    });
  },

  // ========================================
  // FILE PREVIEW
  // ========================================
  previewFile(sessionId, fileType, fileId) {
    const session = Storage.getSessions().find(s => s.id === sessionId);
    if (!session) return;

    let file;
    if (fileType === 'document') {
      file = (session.documents || []).find(d => d.id === fileId);
    } else {
      file = (session.resolutions || []).find(r => r.id === fileId);
    }

    if (!file) {
      Utils.showToast('error', 'Lỗi', 'Không tìm thấy file');
      return;
    }

    const runPreview = (fileData) => {
      const ext = Sessions.getFileExtension(file.fileName);
      const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext);

      if (ext === 'pdf') {
        // Open PDF in preview modal
        const modal = document.getElementById('modal-file-preview');
        const body = document.getElementById('modal-file-preview-body');
        const title = document.getElementById('modal-file-preview-title');

        if (title) title.textContent = file.fileName;
        if (body) {
          let srcUrl = fileData;
          try {
            const blob = Sessions.base64ToBlob(fileData);
            if (blob) {
              if (window.currentPreviewBlobUrl) {
                URL.revokeObjectURL(window.currentPreviewBlobUrl);
              }
              window.currentPreviewBlobUrl = URL.createObjectURL(blob);
              srcUrl = window.currentPreviewBlobUrl;
            }
          } catch (e) {
            console.error("Failed to generate blob url for preview", e);
          }

          body.innerHTML = `
            <div class="preview-modal__content" style="height:70vh;">
              <iframe src="${srcUrl}" type="application/pdf" style="width:100%; height:100%; border:none;"></iframe>
            </div>`;
        }
        Utils.openModal('modal-file-preview');
      } else if (isImage) {
        // Open Image in preview modal
        const modal = document.getElementById('modal-file-preview');
        const body = document.getElementById('modal-file-preview-body');
        const title = document.getElementById('modal-file-preview-title');

        if (title) title.textContent = file.fileName;
        if (body) {
          body.innerHTML = `
            <div style="display:flex; justify-content:center; align-items:center; background:#f0f2f5; padding:20px; border-radius:8px; overflow:auto; max-height:75vh;">
              <img src="${fileData}" style="max-width:100%; max-height:70vh; object-fit:contain; border-radius:4px; box-shadow:0 4px 12px rgba(0,0,0,0.15);" alt="${Utils.escapeHtml(file.fileName)}">
            </div>`;
        }
        Utils.openModal('modal-file-preview');
      } else if (ext === 'docx') {
        // Open Docx using docx-preview
        const modal = document.getElementById('modal-file-preview');
        const body = document.getElementById('modal-file-preview-body');
        const title = document.getElementById('modal-file-preview-title');

        if (title) title.textContent = file.fileName;
        if (body) {
          body.innerHTML = `
            <div id="docx-preview-container" class="preview-modal__docx" style="padding: 20px; background: white; overflow: auto; max-height: 70vh; border: 1px solid var(--color-border); border-radius: 4px;">
              <div style="text-align:center; padding: 40px 0;">
                <p style="color: var(--color-text-secondary);">Đang tải tài liệu...</p>
              </div>
            </div>`;
        }
        Utils.openModal('modal-file-preview');

        setTimeout(() => {
          try {
            const base64Data = fileData.split(',')[1];
            const arrayBuffer = Sessions.base64ToArrayBuffer(base64Data);
            const container = document.getElementById('docx-preview-container');
            container.innerHTML = ''; // clear loading state
            
            if (typeof docx !== 'undefined') {
              docx.renderAsync(arrayBuffer, container)
                .then(() => console.log("docx rendered successfully"))
                .catch(err => {
                  console.error(err);
                  container.innerHTML = `<div class="alert alert-danger" style="margin:20px; color:var(--color-danger)">Lỗi hiển thị file Word: ${err.message}</div>`;
                });
            } else {
              container.innerHTML = `<div class="alert alert-warning" style="margin:20px;">Thư viện hiển thị Word chưa được tải hoàn toàn. Vui lòng thử lại.</div>`;
            }
          } catch (err) {
            console.error(err);
            const container = document.getElementById('docx-preview-container');
            if (container) container.innerHTML = `<div class="alert alert-danger" style="margin:20px; color:var(--color-danger)">Lỗi giải mã dữ liệu: ${err.message}</div>`;
          }
        }, 100);
      } else {
        // Word/Other fallback - show info only
        const modal = document.getElementById('modal-file-preview');
        const body = document.getElementById('modal-file-preview-body');
        const title = document.getElementById('modal-file-preview-title');

        if (title) title.textContent = file.fileName;
        if (body) {
          body.innerHTML = `
            <div class="preview-modal__word-fallback">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <div style="text-align:center">
                <div style="font-size:16px;font-weight:600;margin-bottom:8px;">${Utils.escapeHtml(file.fileName)}</div>
                <div style="font-size:13px;color:var(--color-text-muted);margin-bottom:16px;">${Sessions.formatFileSize(file.fileSize)}</div>
                <div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:16px;">Trình duyệt không hỗ trợ xem trước định dạng này.</div>
                <button class="btn btn-primary" onclick="Sessions.downloadFile('${sessionId}','${fileType}','${fileId}')">
                  ⬇ Tải file về máy
                </button>
              </div>
            </div>`;
        }
        Utils.openModal('modal-file-preview');
      }
    };

    if (file.fileData) {
      runPreview(file.fileData);
    } else if (file.downloadUrl) {
      Utils.showToast('info', 'Đang tải', 'Đang tải file để xem trước...');
      const token = Auth.getAuthToken();
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      Utils.resilientFetch(file.downloadUrl, { headers })
        .then(response => {
          if (!response.ok) throw new Error('Không thể tải file từ máy chủ');
          return response.blob();
        })
        .then(blob => {
          const reader = new FileReader();
          reader.onload = (e) => {
            runPreview(e.target.result);
          };
          reader.readAsDataURL(blob);
        })
        .catch(err => {
          console.error(err);
          Utils.showToast('error', 'Lỗi', 'Không thể xem trước file: ' + err.message);
        });
    } else {
      Utils.showToast('error', 'Lỗi', 'Không tìm thấy dữ liệu file để xem trước');
    }
  },

  base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  },

  base64ToBlob(dataURI) {
    try {
      const parts = dataURI.split(',');
      const byteString = atob(parts[1]);
      const mimeString = parts[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      return new Blob([ab], {type: mimeString});
    } catch (e) {
      console.error('Error parsing base64 to blob', e);
      return null;
    }
  },

  // ========================================
  // FILE DOWNLOAD
  // ========================================
  downloadFile(sessionId, fileType, fileId) {
    const session = Storage.getSessions().find(s => s.id === sessionId);
    if (!session) return;

    let file;
    if (fileType === 'document') {
      file = (session.documents || []).find(d => d.id === fileId);
    } else {
      file = (session.resolutions || []).find(r => r.id === fileId);
    }

    if (!file) {
      Utils.showToast('error', 'Lỗi', 'Không tìm thấy file');
      return;
    }

    // Nếu có downloadUrl, tải qua API với token
    if (file.downloadUrl) {
      Utils.showToast('info', 'Đang tải', 'Đang tải file từ máy chủ...');
      const token = Auth.getAuthToken();
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      Utils.resilientFetch(file.downloadUrl, { headers })
        .then(response => {
          if (!response.ok) throw new Error('Không thể tải file từ máy chủ');
          return response.blob();
        })
        .then(blob => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = file.fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        })
        .catch(err => {
          console.error(err);
          // Fallback sang base64 nếu có sẵn ở local
          if (file.fileData) {
            const link = document.createElement('a');
            link.href = file.fileData;
            link.download = file.fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          } else {
            Utils.showToast('error', 'Lỗi', 'Không thể tải file: ' + err.message);
          }
        });
      return;
    }

    if (!file.fileData) {
      Utils.showToast('error', 'Lỗi', 'Không có dữ liệu file');
      return;
    }

    const link = document.createElement('a');
    link.href = file.fileData;
    link.download = file.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  // ========================================
  // REMOVE FILE
  // ========================================
  removeFile(sessionId, fileType, fileId) {
    if (!confirm('Xóa file này?')) return;

    const session = Storage.getSessions().find(s => s.id === sessionId);
    if (!session) return;

    if (fileType === 'document') {
      session.documents = (session.documents || []).filter(d => d.id !== fileId);
    } else {
      session.resolutions = (session.resolutions || []).filter(r => r.id !== fileId);
    }

    Storage.updateSession(sessionId, {
      documents: session.documents,
      resolutions: session.resolutions
    });

    Utils.showToast('success', 'Đã xóa', 'File đã được xóa');
    const containerId = Sessions.currentType === 'regular' ? 'sessions-regular-list' : 'sessions-special-list';
    Sessions.renderSessionList(Sessions.currentType, containerId);
  },

  // ========================================
  // VOTING ON RESOLUTIONS
  // ========================================
  startVote(sessionId, resolutionId) {
    if (!confirm('Phát biểu quyết cho dự thảo nghị quyết này?')) return;

    const session = Storage.getSessions().find(s => s.id === sessionId);
    if (!session) return;

    const resolution = (session.resolutions || []).find(r => r.id === resolutionId);
    if (!resolution) return;

    resolution.vote = {
      id: Utils.generateId(),
      status: 'active',
      voters: [],
      startedAt: Utils.getCurrentDate()
    };

    Storage.updateSession(sessionId, { resolutions: session.resolutions });

    // Send notification
    Storage.addNotification({
      id: Utils.generateId(),
      title: `Biểu quyết mới: ${resolution.title || resolution.fileName}`,
      content: `Có biểu quyết dự thảo nghị quyết "${resolution.title || resolution.fileName}". Vui lòng tham gia biểu quyết.`,
      priority: 'urgent',
      readBy: [],
      createdBy: Auth.getSession().userId,
      createdAt: Utils.getCurrentDate()
    });

    Utils.showToast('success', 'Thành công', 'Đã phát biểu quyết');
    Notifications.updateBadge();

    const containerId = Sessions.currentType === 'regular' ? 'sessions-regular-list' : 'sessions-special-list';
    Sessions.renderSessionList(Sessions.currentType, containerId);
  },

  closeVote(sessionId, resolutionId) {
    if (!confirm('Đóng biểu quyết này? Người dùng sẽ không thể biểu quyết thêm.')) return;

    const session = Storage.getSessions().find(s => s.id === sessionId);
    if (!session) return;

    const resolution = (session.resolutions || []).find(r => r.id === resolutionId);
    if (!resolution || !resolution.vote) return;

    resolution.vote.status = 'closed';
    resolution.vote.closedAt = Utils.getCurrentDate();

    Storage.updateSession(sessionId, { resolutions: session.resolutions });
    Utils.showToast('success', 'Đã đóng', 'Biểu quyết đã được đóng');

    const containerId = Sessions.currentType === 'regular' ? 'sessions-regular-list' : 'sessions-special-list';
    Sessions.renderSessionList(Sessions.currentType, containerId);
  },

  submitVote(sessionId, resolutionId, voteType) {
    const input = document.getElementById(`opinion-input-${resolutionId}`);
    const opinion = input ? input.value.trim() : '';
    Sessions.castVote(sessionId, resolutionId, voteType, opinion);
  },

  castVote(sessionId, resolutionId, voteType, opinion = '') {
    const currentSession = Auth.getSession();
    const session = Storage.getSessions().find(s => s.id === sessionId);
    if (!session) return;

    const resolution = (session.resolutions || []).find(r => r.id === resolutionId);
    if (!resolution || !resolution.vote || resolution.vote.status !== 'active') {
      Utils.showToast('warning', 'Không thể biểu quyết', 'Biểu quyết đã đóng hoặc chưa mở');
      return;
    }

    // Check if already voted
    if (resolution.vote.voters.find(v => v.userId === currentSession.userId)) {
      Utils.showToast('warning', 'Đã biểu quyết', 'Bạn đã biểu quyết rồi');
      return;
    }

    resolution.vote.voters.push({
      userId: currentSession.userId,
      voteType: voteType,
      opinion: opinion,
      votedAt: Utils.getCurrentDate()
    });

    Storage.updateSession(sessionId, { resolutions: session.resolutions });
    Utils.showToast('success', 'Thành công', `Bạn đã biểu quyết "${voteType === 'agree' ? 'Tán thành' : 'Không tán thành'}"`);

    const containerId = Sessions.currentType === 'regular' ? 'sessions-regular-list' : 'sessions-special-list';
    Sessions.renderSessionList(Sessions.currentType, containerId);
  },

  // ========================================
  // UTILITY HELPERS
  // ========================================
  getFileExtension(fileName) {
    return (fileName || '').split('.').pop().toLowerCase();
  },

  formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }
    return size.toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
  }
};
