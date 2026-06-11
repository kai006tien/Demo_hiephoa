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

  // Initialize Sync settings
  init() {
    // Initialize from CONFIG if not set in localStorage yet
    if (localStorage.getItem(this.KEYS.ENABLED) === null) {
      localStorage.setItem(this.KEYS.ENABLED, CONFIG.syncEnabled);
    }
    if (localStorage.getItem(this.KEYS.URL) === null) {
      localStorage.setItem(this.KEYS.URL, CONFIG.googleScriptUrl);
    }

    // Add status indicator to top bar if it exists
    this.injectStatusIndicator();

    // Perform background sync if enabled
    if (this.isEnabled()) {
      this.backgroundSync();
    }
  },

  // Check if sync is enabled
  isEnabled() {
    return localStorage.getItem(this.KEYS.ENABLED) === 'true';
  },

  // Get Google Apps Script URL
  getUrl() {
    return localStorage.getItem(this.KEYS.URL) || '';
  },

  // Save settings from Admin UI
  saveSettings(enabled, url) {
    localStorage.setItem(this.KEYS.ENABLED, enabled);
    localStorage.setItem(this.KEYS.URL, url.trim());
    
    // Update active CONFIG object
    CONFIG.syncEnabled = enabled;
    CONFIG.googleScriptUrl = url.trim();

    this.updateStatusUI();

    // If turned on, perform initial background sync
    if (enabled && url.trim()) {
      this.backgroundSync();
    }
  },

  // Inject sync status indicator into top-bar
  injectStatusIndicator() {
    const timeEl = document.querySelector('.top-bar__time');
    if (!timeEl || document.getElementById('sync-status-container')) return;

    const syncHtml = `
      <span id="sync-status-container" style="display: none; align-items: center; gap: 6px; margin-left: 15px;">
        <span style="color: rgba(255,255,255,0.4);">|</span>
        <span id="sync-status-badge" style="font-size: 11px; padding: 2px 8px; border-radius: 12px; background: rgba(255,255,255,0.15); display: inline-flex; align-items: center; gap: 5px; cursor: pointer;" title="Nhấn để đồng bộ lại" onclick="Sync.backgroundSync()">
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

  // Test connection to Google Apps Script Web App
  async testConnection(testUrl = null) {
    const url = testUrl || this.getUrl();
    if (!url) {
      return { success: false, error: 'Chưa cấu hình URL Google Apps Script.' };
    }

    try {
      const response = await fetch(`${url}?action=read&sheet=Accounts`);
      if (!response.ok) throw new Error('Không thể kết nối đến Web App.');
      
      const result = await response.json();
      if (result.error) {
        return { success: false, error: result.error };
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message || 'Lỗi mạng hoặc CORS.' };
    }
  },

  // Background Sync (runs on app load)
  async backgroundSync() {
    if (!this.isEnabled() || this.isSyncing) return;
    const url = this.getUrl();
    if (!url) return;

    this.isSyncing = true;
    this.updateStatusUI('syncing');

    try {
      const response = await fetch(`${url}?action=readAll`);
      if (!response.ok) throw new Error('Network error');
      
      const result = await response.json();
      if (result.error) throw new Error(result.error);

      const cloudData = result.data || {};
      
      // Check if cloud database is empty (meaning first time setup)
      const isCloudEmpty = !cloudData.Accounts || cloudData.Accounts.length === 0;
      
      if (isCloudEmpty) {
        // Cloud is empty. Upload current local data to initialize it
        console.log('☁️ Cloud database is empty. Uploading local data to initialize Sheets...');
        await this.uploadAllToCloudInternal(url);
      } else {
        // Cloud has data. Sync down and overwrite local storage
        console.log('☁️ Downloading and syncing cloud data to localStorage...');
        this.saveCloudDataToLocalStorage(cloudData);
        
        // Dispatch event to notify application components to re-render
        document.dispatchEvent(new CustomEvent('hha_data_synced'));
      }
      this.updateStatusUI('synced');
    } catch (e) {
      console.error('☁️ Sync error:', e);
      this.updateStatusUI('error');
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
      // Use text/plain POST content-type to prevent preflight CORS triggers
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({
          action: 'sync',
          sheet: sheetName,
          rows: data
        })
      });
      
      // Delay status change briefly so the user sees the confirmation
      setTimeout(() => this.updateStatusUI('synced'), 500);
    } catch (e) {
      console.error(`☁️ Error syncing sheet ${sheetName}:`, e);
      this.updateStatusUI('error');
    }
  },

  // Manual Download Action
  async downloadAllFromCloud() {
    const url = this.getUrl();
    if (!url) {
      alert('Vui lòng cấu hình URL Google Apps Script trước.');
      return false;
    }

    if (!confirm('Bạn có chắc chắn muốn tải dữ liệu từ Google Sheets về? Việc này sẽ GHI ĐÈ toàn bộ dữ liệu hiện tại trong trình duyệt này.')) {
      return false;
    }

    this.updateStatusUI('syncing');
    try {
      const response = await fetch(`${url}?action=readAll`);
      if (!response.ok) throw new Error('Không thể kết nối đến Web App.');
      
      const result = await response.json();
      if (result.error) throw new Error(result.error);

      this.saveCloudDataToLocalStorage(result.data || {});
      this.updateStatusUI('synced');
      
      alert('Đã tải và đồng bộ dữ liệu từ Google Sheets thành công!');
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
      alert('Vui lòng cấu hình URL Google Apps Script trước.');
      return false;
    }

    if (!confirm('Bạn có chắc chắn muốn đẩy toàn bộ dữ liệu hiện tại lên Google Sheets? Việc này sẽ GHI ĐÈ toàn bộ dữ liệu đang có trên Google Sheets.')) {
      return false;
    }

    this.updateStatusUI('saving');
    try {
      const success = await this.uploadAllToCloudInternal(url);
      if (success) {
        this.updateStatusUI('synced');
        alert('Đã đẩy toàn bộ dữ liệu lên Google Sheets thành công!');
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

  // Internal helper to upload all local data to Apps Script
  async uploadAllToCloudInternal(url) {
    const payload = {
      action: 'syncAll',
      data: {
        accounts: Storage.getAccounts(),
        documents: Storage.getDocuments(),
        votes: Storage.getVotes(),
        notifications: Storage.getNotifications(),
        files: Storage.getFiles()
      }
    };

    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(payload)
      });
      return true;
    } catch (e) {
      console.error('☁️ Error during uploadAll:', e);
      return false;
    }
  },

  // Save configuration from UI inputs
  saveSettingsFromUI() {
    const enabled = document.getElementById('sync-enabled-toggle').checked;
    const url = document.getElementById('sync-script-url').value.trim();

    this.saveSettings(enabled, url);
    alert('Đã lưu cấu hình đồng bộ thành công!');
  }
};
