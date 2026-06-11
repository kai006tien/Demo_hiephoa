/* ============================================
   SYNC - Google Sheets Cloud Sync Engine
   ============================================ */

const Sync = {
  // LocalStorage keys for sync configuration
  KEYS: {
    ENABLED: 'hha_google_sync_enabled',
    URL: 'hha_google_script_url'
  },

  isSyncing: false,
  pollingIntervalId: null,

  // Initialize Sync settings
  init() {
    // Add status indicator to top bar if it exists
    this.injectStatusIndicator();

    // Perform background sync and start polling
    this.backgroundSync();
    this.startPolling(3000); // Đồng bộ nền mỗi 3 giây
  },

  // Check if sync is enabled (always true since MongoDB is core backend)
  isEnabled() {
    return true;
  },

  // Get API URL
  getUrl() {
    return CONFIG.googleScriptUrl || '/api/sync';
  },

  // Bắt đầu đồng bộ tự động theo chu kỳ
  startPolling(ms = 3000) {
    if (this.pollingIntervalId) clearInterval(this.pollingIntervalId);
    this.pollingIntervalId = setInterval(() => {
      this.backgroundSync(true); // silent polling
    }, ms);
  },

  // Dừng đồng bộ tự động
  stopPolling() {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
  },

  // Inject sync status indicator into top-bar
  injectStatusIndicator() {
    const timeEl = document.querySelector('.top-bar__time');
    if (!timeEl || document.getElementById('sync-status-container')) return;

    const syncHtml = `
      <span id="sync-status-container" style="display: none; align-items: center; gap: 6px; margin-left: 15px;">
        <span style="color: rgba(255,255,255,0.4);">|</span>
        <span id="sync-status-badge" style="font-size: 11px; padding: 2px 8px; border-radius: 12px; background: rgba(255,255,255,0.15); display: inline-flex; align-items: center; gap: 5px; cursor: pointer;" title="Nhấn để xem thông tin kết nối" onclick="Sync.showConnectionInfo()">
          <span class="sync-dot" id="sync-status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #10B981; display: inline-block;"></span>
          <span id="sync-status-text">Đã đồng bộ</span>
        </span>
      </span>
    `;
    timeEl.insertAdjacentHTML('beforeend', syncHtml);
    this.updateStatusUI();
  },

  // Update status UI indicator
  updateStatusUI(status = 'synced') {
    const container = document.getElementById('sync-status-container');
    const dot = document.getElementById('sync-status-dot');
    const text = document.getElementById('sync-status-text');

    if (!container) return;

    if (!this.isEnabled()) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'inline-flex';

    if (status === 'syncing' || status === 'saving') {
      dot.style.background = '#F59E0B'; // Orange
      dot.style.boxShadow = '0 0 8px #F59E0B';
      dot.classList.add('animate-pulse');
      text.textContent = status === 'saving' ? 'Đang lưu...' : 'Đang đồng bộ...';
    } else if (status === 'error') {
      dot.style.background = '#EF4444'; // Red
      dot.style.boxShadow = '0 0 8px #EF4444';
      dot.classList.remove('animate-pulse');
      text.textContent = 'Lỗi kết nối';
    } else {
      dot.style.background = '#10B981'; // Green
      dot.style.boxShadow = '0 0 8px #10B981';
      dot.classList.remove('animate-pulse');
      text.textContent = 'Đã đồng bộ';
    }
  },

  // Test connection to Database
  async testConnection(testUrl = null) {
    const url = testUrl || this.getUrl();
    if (!url) {
      return { success: false, error: 'Chưa cấu hình URL kết nối.' };
    }

    try {
      const response = await fetch(`${url}?action=read&sheet=Accounts&token=${CONFIG.secretToken}`);
      if (!response.ok) throw new Error('Không thể kết nối đến máy chủ.');

      const result = await response.json();
      if (result.error) {
        return { success: false, error: result.error };
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message || 'Lỗi mạng hoặc CORS.' };
    }
  },

  // Background Sync (runs on app load & periodic polling)
  async backgroundSync(isSilent = false) {
    if (!this.isEnabled() || this.isSyncing) return;
    const url = this.getUrl();
    if (!url) return;

    this.isSyncing = true;
    if (!isSilent) {
      this.updateStatusUI('syncing');
    }

    try {
      const response = await fetch(`${url}?action=readAll&token=${CONFIG.secretToken}`);
      if (!response.ok) throw new Error('Network error');

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      const cloudData = result.data || {};

      // So sánh dữ liệu để tránh cập nhật lại giao diện không cần thiết
      const currentAccounts = localStorage.getItem('hha_accounts');
      const currentDocs = localStorage.getItem('hha_documents');
      const currentVotes = localStorage.getItem('hha_votes');
      const currentNotifs = localStorage.getItem('hha_notifications');
      const currentFiles = localStorage.getItem('hha_files');

      const newAccounts = JSON.stringify(cloudData.Accounts || []);
      const newDocs = JSON.stringify(cloudData.Documents || []);
      const newVotes = JSON.stringify(cloudData.Votes || []);
      const newNotifs = JSON.stringify(cloudData.Notifications || []);
      const newFiles = JSON.stringify(cloudData.Files || []);

      const hasChanged =
        currentAccounts !== newAccounts ||
        currentDocs !== newDocs ||
        currentVotes !== newVotes ||
        currentNotifs !== newNotifs ||
        currentFiles !== newFiles;

      if (hasChanged) {
        console.log('☁️ Phát hiện dữ liệu mới từ đám mây. Đang đồng bộ và cập nhật...');
        this.saveCloudDataToLocalStorage(cloudData);
        document.dispatchEvent(new CustomEvent('hha_data_synced'));
      }

      this.lastSyncTime = new Date().toISOString();
      this.updateStatusUI('synced');
    } catch (e) {
      console.error('☁️ Sync error:', e);
      if (!isSilent) {
        this.updateStatusUI('error');
      }
    } finally {
      this.isSyncing = false;
    }
  },

  // Save cloud data payload to localStorage keys
  saveCloudDataToLocalStorage(cloudData) {
    if (cloudData.Accounts && cloudData.Accounts.length > 0) {
      localStorage.setItem('hha_accounts', JSON.stringify(cloudData.Accounts));
    }
    if (cloudData.Documents) {
      localStorage.setItem('hha_documents', JSON.stringify(cloudData.Documents));
    }
    if (cloudData.Votes) {
      localStorage.setItem('hha_votes', JSON.stringify(cloudData.Votes));
    }
    if (cloudData.Notifications) {
      localStorage.setItem('hha_notifications', JSON.stringify(cloudData.Notifications));
    }
    if (cloudData.Files) {
      localStorage.setItem('hha_files', JSON.stringify(cloudData.Files));
    }
  },

  // Sync a single sheet asynchronously in the background when local edits are made
  async syncSheet(sheetName, data) {
    if (!this.isEnabled()) return;
    const url = this.getUrl();
    if (!url) return;

    this.updateStatusUI('saving');

    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'sync',
          sheet: sheetName,
          rows: data,
          token: CONFIG.secretToken
        })
      });

      // Delay status change briefly so the user sees the confirmation
      setTimeout(() => this.updateStatusUI('synced'), 500);
    } catch (e) {
      console.error(`☁️ Error syncing sheet ${sheetName}:`, e);
      this.updateStatusUI('error');
    }
  },

  // Sync a single item mutation (upsert/delete) in the background
  async syncMutation(mutationType, sheetName, item) {
    if (!this.isEnabled()) return;
    const url = this.getUrl();
    if (!url) return;

    this.updateStatusUI('saving');

    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'mutation',
          mutationType: mutationType,
          sheet: sheetName,
          item: item,
          token: CONFIG.secretToken
        })
      });

      setTimeout(() => this.updateStatusUI('synced'), 500);
    } catch (e) {
      console.error(`☁️ Error syncing mutation in ${sheetName}:`, e);
      this.updateStatusUI('error');
    }
  },

  // Manual Download Action
  async downloadAllFromCloud() {
    const url = this.getUrl();
    if (!url) {
      alert('Vui lòng cấu hình URL kết nối trước.');
      return false;
    }

    if (!confirm('Bạn có chắc chắn muốn tải dữ liệu từ cơ sở dữ liệu đám mây về? Việc này sẽ GHI ĐÈ toàn bộ dữ liệu hiện tại trong trình duyệt này.')) {
      return false;
    }

    this.updateStatusUI('syncing');
    try {
      const response = await fetch(`${url}?action=readAll&token=${CONFIG.secretToken}`);
      if (!response.ok) throw new Error('Không thể kết nối đến máy chủ.');

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      this.saveCloudDataToLocalStorage(result.data || {});
      this.updateStatusUI('synced');

      alert('Đã tải và đồng bộ dữ liệu thành công!');
      window.location.reload();
      return true;
    } catch (e) {
      alert(`Lỗi khi tải dữ liệu: ${e.message}`);
      this.updateStatusUI('error');
      return false;
    }
  },

  // Manual Upload Action
  async uploadAllToCloud() {
    const url = this.getUrl();
    if (!url) {
      alert('Vui lòng cấu hình URL kết nối trước.');
      return false;
    }

    if (!confirm('Bạn có chắc chắn muốn đẩy toàn bộ dữ liệu hiện tại lên cơ sở dữ liệu đám mây? Việc này sẽ GHI ĐÈ toàn bộ dữ liệu đang có trên đám mây.')) {
      return false;
    }

    this.updateStatusUI('saving');
    try {
      const success = await this.uploadAllToCloudInternal(url);
      if (success) {
        this.updateStatusUI('synced');
        alert('Đã đẩy toàn bộ dữ liệu lên cơ sở dữ liệu thành công!');
        return true;
      } else {
        throw new Error('Upload request failed.');
      }
    } catch (e) {
      alert(`Lỗi khi đẩy dữ liệu: ${e.message}`);
      this.updateStatusUI('error');
      return false;
    }
  },

  // Internal helper to upload all local data to Express
  async uploadAllToCloudInternal(url) {
    const payload = {
      action: 'syncAll',
      data: {
        accounts: Storage.getAccounts(),
        documents: Storage.getDocuments(),
        votes: Storage.getVotes(),
        notifications: Storage.getNotifications(),
        files: Storage.getFiles()
      },
      token: CONFIG.secretToken
    };

    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      return true;
    } catch (e) {
      console.error('☁️ Error during uploadAll:', e);
      return false;
    }
  },

  lastSyncTime: null,

  showConnectionInfo() {
    // Check if the modal already exists
    let modal = document.getElementById('modal-sync-connection');
    if (modal) modal.remove();

    const formattedTime = this.lastSyncTime ? Utils.formatDateTime(this.lastSyncTime) : 'Chưa đồng bộ';
    const serverUrl = window.location.origin;

    const modalHtml = `
      <div class="modal-overlay active" id="modal-sync-connection" style="z-index: 9999; display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5);">
        <div class="modal animate-fadeInUp" style="max-width: 450px; background: var(--color-surface, #ffffff); border-radius: var(--radius-lg, 12px); box-shadow: 0 10px 25px rgba(0,0,0,0.15); width: 90%; overflow: hidden; display: flex; flex-direction: column;">
          <div class="modal__header" style="border-bottom: 1px solid var(--color-divider, #e2e8f0); padding: 16px 20px; display: flex; justify-content: space-between; align-items: center;">
            <h3 class="modal__title" style="display: flex; align-items: center; gap: 8px; font-size: 16px; margin: 0; font-weight: 600; color: var(--color-text, #1e293b);">
              <svg viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2" width="22" height="22"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              Thông tin kết nối hệ thống
            </h3>
            <button class="modal__close" onclick="document.getElementById('modal-sync-connection').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--color-text-muted, #64748b); line-height: 1;">&times;</button>
          </div>
          <div class="modal__body" style="padding: 20px; font-size: 14px;">
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--color-divider, #cbd5e1); padding-bottom: 8px;">
                <span style="color: var(--color-text-secondary, #475569);">Địa chỉ máy chủ:</span>
                <strong style="color: var(--color-text, #1e293b);">${serverUrl}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--color-divider, #cbd5e1); padding-bottom: 8px;">
                <span style="color: var(--color-text-secondary, #475569);">Đường truyền mạng:</span>
                <strong style="color: #10B981;">Đang trực tuyến</strong>
              </div>
              <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--color-divider, #cbd5e1); padding-bottom: 8px;">
                <span style="color: var(--color-text-secondary, #475569);">Tần suất tự động đồng bộ:</span>
                <strong style="color: var(--color-primary, #2b5797);">3 giây / lần (Đang chạy)</strong>
              </div>
              <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--color-divider, #cbd5e1); padding-bottom: 8px;">
                <span style="color: var(--color-text-secondary, #475569);">Đồng bộ lần cuối:</span>
                <strong style="color: var(--color-text, #1e293b);">${formattedTime}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; padding-bottom: 4px;">
                <span style="color: var(--color-text-secondary, #475569);">Mã Token truy cập:</span>
                <strong style="color: var(--color-text-muted, #64748b); font-family: monospace;">HiepHoaSecret2026</strong>
              </div>
            </div>
          </div>
          <div class="modal__footer" style="border-top: 1px solid var(--color-divider, #e2e8f0); padding: 12px 20px; display: flex; justify-content: flex-end; gap: 10px; background: var(--color-surface-hover, #f8fafc);">
            <button class="btn btn-secondary" onclick="document.getElementById('modal-sync-connection').remove()" style="padding: 6px 12px; font-size: 13px;">Đóng</button>
            <button class="btn btn-primary" onclick="document.getElementById('modal-sync-connection').remove(); Sync.backgroundSync(false);" style="padding: 6px 12px; font-size: 13px;">Đồng bộ ngay</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Close on overlay click
    const overlay = document.getElementById('modal-sync-connection');
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }
};
