/* ============================================
   FILE MANAGER - File Upload/Download Module
   ============================================ */

const FileManager = {
  // Render file list for admin
  renderFileListAdmin() {
    const files = Storage.getFiles();
    const container = document.getElementById('files-list');
    if (!container) return;

    if (files.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <div class="empty-state__title">Chưa có file báo cáo</div>
          <div class="empty-state__text">Các tài khoản con sẽ tải file báo cáo lên đây</div>
        </div>`;
      return;
    }

    let html = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>STT</th>
              <th>Tên file</th>
              <th>Người gửi</th>
              <th>Mô tả</th>
              <th>Kích thước</th>
              <th>Ngày gửi</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>`;

    files.forEach((file, index) => {
      const uploader = Storage.getAccountById(file.uploadedBy);
      const ext = Utils.getFileExtension(file.fileName);
      const iconColor = ext === 'docx' || ext === 'doc' ? '#2b5797' : ext === 'xlsx' || ext === 'xls' ? '#217346' : ext === 'pdf' ? '#d32f2f' : 'var(--color-primary)';

      html += `
        <tr>
          <td>${index + 1}</td>
          <td>
            <div class="d-flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" width="20" height="20"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <strong>${Utils.escapeHtml(file.fileName)}</strong>
            </div>
          </td>
          <td>${Utils.escapeHtml(uploader ? uploader.fullName : 'Không xác định')}</td>
          <td>${Utils.escapeHtml(Utils.truncate(file.description || '', 40))}</td>
          <td>${Utils.formatFileSize(file.fileSize || 0)}</td>
          <td>${Utils.formatDateTime(file.createdAt)}</td>
          <td>
            <div class="d-flex gap-2">
              <button class="btn btn-secondary btn-sm" onclick="FileManager.downloadFile('${file.id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Tải
              </button>
              <button class="btn btn-ghost btn-sm text-danger" onclick="FileManager.deleteFile('${file.id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </td>
        </tr>`;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
  },

  // Render file list for user (their own files + upload zone)
  renderFileListUser() {
    const session = Auth.getSession();
    const files = Storage.getFiles().filter(f => f.uploadedBy === session.userId);
    const container = document.getElementById('files-list');
    if (!container) return;

    let html = `
      <div class="upload-zone" id="upload-zone" onclick="document.getElementById('file-upload-input').click()" 
           ondragover="event.preventDefault();this.classList.add('drag-over')" 
           ondragleave="this.classList.remove('drag-over')"
           ondrop="FileManager.handleDrop(event)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <div class="upload-zone__text">Kéo thả file vào đây hoặc <strong style="color:var(--color-primary)">nhấn để chọn file</strong></div>
        <div class="upload-zone__hint">Hỗ trợ: Word (.doc, .docx), Excel (.xls, .xlsx), PDF (.pdf) - Tối đa 10MB</div>
        <input type="file" id="file-upload-input" style="display:none" accept=".doc,.docx,.xls,.xlsx,.pdf" onchange="FileManager.handleFileSelect(event)">
      </div>`;

    if (files.length > 0) {
      html += `
        <div class="mt-6">
          <h4 class="mb-4">File đã tải lên</h4>
          <div class="doc-list">`;

      files.forEach(file => {
        html += `
          <div class="doc-item">
            <div class="doc-item__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div class="doc-item__content">
              <div class="doc-item__title">${Utils.escapeHtml(file.fileName)}</div>
              <div class="doc-item__meta">
                <span>${Utils.escapeHtml(file.description || 'Không có mô tả')}</span>
                <span>${Utils.formatFileSize(file.fileSize || 0)}</span>
                <span>${Utils.timeAgo(file.createdAt)}</span>
              </div>
            </div>
            <div class="doc-item__actions">
              <button class="btn btn-secondary btn-sm" onclick="FileManager.downloadFile('${file.id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Tải
              </button>
              <button class="btn btn-ghost btn-sm text-danger" onclick="FileManager.deleteFile('${file.id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>`;
      });

      html += '</div></div>';
    }

    container.innerHTML = html;
  },

  // Handle file drop
  handleDrop(event) {
    event.preventDefault();
    event.target.classList.remove('drag-over');
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      FileManager.uploadFile(files[0]);
    }
  },

  // Handle file select
  handleFileSelect(event) {
    const files = event.target.files;
    if (files.length > 0) {
      FileManager.uploadFile(files[0]);
    }
  },

  // Upload file
  uploadFile(file) {
    const allowedTypes = ['.doc', '.docx', '.xls', '.xlsx', '.pdf'];
    const ext = '.' + Utils.getFileExtension(file.name);
    
    if (!allowedTypes.includes(ext)) {
      Utils.showToast('error', 'Lỗi', 'Định dạng file không được hỗ trợ');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      Utils.showToast('error', 'Lỗi', 'File quá lớn (tối đa 10MB)');
      return;
    }

    const description = prompt('Nhập mô tả cho file (có thể bỏ trống):');
    if (description === null) return; // Cancel upload

    Utils.showToast('info', 'Đang xử lý', 'Đang đọc và chuẩn bị tải file...');

    const fileId = Utils.generateId();
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      const base64Payload = dataUrl.split(',')[1];
      
      let downloadUrl = null;
      
      // Nếu có kích hoạt đồng bộ, tải file lên server/db
      if (typeof Sync !== 'undefined' && Sync.isEnabled() && Sync.getUrl()) {
        Utils.showToast('info', 'Đang tải lên', 'Đang tải file lên cơ sở dữ liệu...');
        try {
          const response = await fetch('/api/uploadFile', {
            method: 'POST',
            headers: Sync.getAuthHeaders(),
            body: JSON.stringify({
              id: fileId,
              fileName: file.name,
              mimeType: file.type,
              base64: base64Payload,
              uploadedBy: Auth.getSession().userId,
              description: description.trim()
            })
          });
          
          if (response.status === 401) {
            Sync.handleUnauthorized();
            return;
          }

          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              downloadUrl = result.downloadUrl;
            } else {
              Utils.showToast('error', 'Lỗi', 'Tải file lên không thành công: ' + (result.error || 'Lỗi không xác định'));
              return;
            }
          } else {
            const errText = await response.text().catch(() => '');
            console.error('Upload failed:', response.status, errText);
            Utils.showToast('error', 'Lỗi', `Không thể tải file lên máy chủ (Mã lỗi: ${response.status}).`);
            return;
          }
        } catch (err) {
          console.error('Lỗi khi tải file lên máy chủ:', err);
          Utils.showToast('error', 'Lỗi', 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng.');
          return;
        }
      }

      const newFile = {
        id: fileId,
        fileName: file.name,
        fileSize: file.size,
        uploadedBy: Auth.getSession().userId,
        description: description.trim(),
        createdAt: Utils.getCurrentDate(),
        downloadUrl: downloadUrl,
        fileData: downloadUrl ? null : (file.size < 1.5 * 1024 * 1024 ? dataUrl : null) // Chỉ lưu base64 cục bộ khi không dùng đồng bộ và file dưới 1.5MB
      };

      Storage.addFile(newFile);
      Utils.showToast('success', 'Thành công', `Đã tải lên "${file.name}" thành công!`);
      
      if (Auth.isAdmin()) {
        FileManager.renderFileListAdmin();
      } else {
        FileManager.renderFileListUser();
      }
    };

    reader.onerror = () => {
      Utils.showToast('error', 'Lỗi', 'Không thể đọc file.');
    };

    reader.readAsDataURL(file);
  },

  // Download file
  async downloadFile(id) {
    const file = Storage.getFiles().find(f => f.id === id);
    if (!file) return;

    Utils.showToast('info', 'Tải xuống', `Đang tải "${file.fileName}"...`);
    
    // Nếu file có downloadUrl (trên server), tải qua API có xác thực
    if (file.downloadUrl) {
      try {
        const token = Auth.getAuthToken();
        const response = await fetch(file.downloadUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401) {
          Sync.handleUnauthorized();
          return;
        }

        if (response.ok) {
          const blob = await response.blob();
          
          // Kiểm tra blob có dữ liệu thực sự không
          if (!blob || blob.size === 0) {
            console.error('Download error: File trống (blob size = 0)');
            Utils.showToast('error', 'Lỗi', 'File tải về bị trống. File có thể đã bị xóa trên máy chủ.');
            return;
          }

          // Kiểm tra nếu response trả về là HTML error page (không phải file thực)
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('text/html')) {
            console.error('Download error: Server trả về HTML thay vì file');
            Utils.showToast('error', 'Lỗi', 'Không tìm thấy file trên máy chủ. Vui lòng tải lại báo cáo.');
            return;
          }

          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = file.fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
          Utils.showToast('success', 'Thành công', `Đã tải "${file.fileName}" thành công.`);
        } else {
          const errText = await response.text().catch(() => '');
          console.error('Download error:', response.status, errText);
          Utils.showToast('error', 'Lỗi', `Không thể tải file (Mã lỗi: ${response.status}). File có thể không tồn tại trên máy chủ.`);
        }
      } catch (err) {
        console.error('Download error:', err);
        Utils.showToast('error', 'Lỗi', 'Lỗi kết nối khi tải file. Vui lòng kiểm tra mạng và thử lại.');
      }
    } 
    // Nếu có dữ liệu base64 local
    else if (file.fileData) {
      setTimeout(() => {
        Utils.downloadBase64File(file.fileName, file.fileData);
        Utils.showToast('success', 'Thành công', `Đã tải "${file.fileName}" thành công.`);
      }, 500);
    } 
    // Fallback
    else {
      setTimeout(() => {
        Utils.downloadFile(file.fileName, `Tên file: ${file.fileName}\nMô tả: ${file.description || 'Không có mô tả'}\nNgày gửi: ${Utils.formatDateTime(file.createdAt)}\n\n(Lưu ý: Nội dung file gốc không khả dụng trên trình duyệt này)`);
        Utils.showToast('success', 'Thành công', `Đã tải "${file.fileName}" thành công.`);
      }, 500);
    }
  },

  // Delete file
  deleteFile(id) {
    const file = Storage.getFiles().find(f => f.id === id);
    if (file && confirm(`Xóa file "${file.fileName}"?`)) {
      Storage.deleteFile(id);
      Utils.showToast('success', 'Đã xóa', `Đã xóa file "${file.fileName}"`);
      
      if (Auth.isAdmin()) {
        FileManager.renderFileListAdmin();
      } else {
        FileManager.renderFileListUser();
      }
    }
  }
};
