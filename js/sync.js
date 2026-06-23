/* ============================================
   SYNC - Cloud Sync Engine (Secured + Resilient)
   ============================================ */

const Sync = {
  KEYS: {
    ENABLED: 'hha_google_sync_enabled',
    URL: 'hha_google_script_url'
  },

  isSyncing: false,
  pollingIntervalId: null,
  keepAliveIntervalId: null,
  consecutiveErrors: 0,
  DEFAULT_POLL_MS: 10000,
  KEEP_ALIVE_MS: 4 * 60 * 1000, // Ping server mỗi 4 phút để tránh Render sleep
  MAX_RETRY_BEFORE_ERROR: 5, // Số lần thử trước khi hiện "Lỗi kết nối"
  isRecovering: false,
  mutationQueue: [],

  // Initialize Sync
  init() {
    try {
      console.log('--- LOCALSTORAGE DIAGNOSIS ---');
      Object.keys(localStorage).forEach(k => {
        const val = localStorage.getItem(k) || '';
        console.log(`LS_KEY_SIZE: ${k} = ${(val.length / 1024).toFixed(2)} KB (${val.length} chars)`);
      });
      console.log('-----------------------------');
    } catch (e) {
      console.error('Diag error:', e);
    }

    this.mutationQueue = JSON.parse(localStorage.getItem('hha_failed_mutations') || '[]');
    this.injectStatusIndicator();
    this.backgroundSync();
    this.startPolling(this.DEFAULT_POLL_MS);
    this.startKeepAlive();
  },

  isEnabled() {
    return true;
  },

  getUrl() {
    return CONFIG.googleScriptUrl || '/api/sync';
  },

  // Lấy Authorization headers cho mọi API call
  getAuthHeaders() {
    const token = Auth.getAuthToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  },

  startPolling(ms) {
    const interval = ms || this.DEFAULT_POLL_MS;
    if (this.pollingIntervalId) clearInterval(this.pollingIntervalId);
    this.pollingIntervalId = setInterval(() => {
      this.backgroundSync(true);
    }, interval);
  },

  stopPolling() {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
  },

  // Keep-alive: ping server định kỳ để tránh Render free tier ngủ
  startKeepAlive() {
    if (this.keepAliveIntervalId) clearInterval(this.keepAliveIntervalId);
    this.keepAliveIntervalId = setInterval(() => {
      this.pingServer();
    }, this.KEEP_ALIVE_MS);
    // Ping ngay lần đầu
    this.pingServer();
  },

  stopKeepAlive() {
    if (this.keepAliveIntervalId) {
      clearInterval(this.keepAliveIntervalId);
      this.keepAliveIntervalId = null;
    }
  },

  // Ping server health endpoint (không cần auth)
  async pingServer() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const response = await fetch('/api/health', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        console.log('💓 Server alive:', data.status, '| Uptime:', Math.floor(data.uptime) + 's');
        return true;
      }
      return false;
    } catch (e) {
      console.warn('💔 Server ping failed:', e.message);
      return false;
    }
  },

  // Kiểm tra session còn hợp lệ không
  async validateSession() {
    try {
      const token = Auth.getAuthToken();
      if (!token) return false;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const response = await fetch('/api/validate-session', {
        headers: this.getAuthHeaders(),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) return false;

      const result = await response.json();
      return result.valid === true;
    } catch (e) {
      console.warn('⚠️ Session validation failed:', e.message);
      return false;
    }
  },

  injectStatusIndicator() {
    const timeEl = document.querySelector('.top-bar__time');
    if (!timeEl || document.getElementById('sync-status-container')) return;

    const syncHtml = `
      <span id="sync-status-container" style="display: none; align-items: center; gap: 6px; margin-left: 15px;">
        <span style="color: rgba(255,255,255,0.4);">|</span>
        <span id="sync-status-badge" style="font-size: 11px; padding: 2px 8px; border-radius: 12px; background: rgba(255,255,255,0.15); display: inline-flex; align-items: center; gap: 5px; cursor: pointer;" title="Trạng thái đồng bộ" onclick="Sync.showConnectionInfo()">
          <span class="sync-dot" id="sync-status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #10B981; display: inline-block;"></span>
          <span id="sync-status-text">Đã đồng bộ</span>
        </span>
      </span>
    `;
    timeEl.insertAdjacentHTML('beforeend', syncHtml);
    this.updateStatusUI();
  },

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
      dot.style.background = '#F59E0B';
      dot.style.boxShadow = '0 0 8px #F59E0B';
      dot.classList.add('animate-pulse');
      text.textContent = status === 'saving' ? 'Đang lưu...' : 'Đang đồng bộ...';
    } else if (status === 'reconnecting') {
      dot.style.background = '#F59E0B';
      dot.style.boxShadow = '0 0 8px #F59E0B';
      dot.classList.add('animate-pulse');
      text.textContent = 'Đang kết nối lại...';
    } else if (status === 'error') {
      dot.style.background = '#EF4444';
      dot.style.boxShadow = '0 0 8px #EF4444';
      dot.classList.remove('animate-pulse');
      text.textContent = 'Lỗi kết nối';
    } else {
      dot.style.background = '#10B981';
      dot.style.boxShadow = '0 0 8px #10B981';
      dot.classList.remove('animate-pulse');
      text.textContent = 'Đã đồng bộ';
    }
  },

  // Xử lý response 401 - tự động đăng xuất
  handleUnauthorized() {
    this.stopPolling();
    this.stopKeepAlive();
    sessionStorage.removeItem('hha_auth_token');
    Storage.clearSession();
    alert('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    window.location.href = 'index.html';
  },

  async testConnection(testUrl = null) {
    const url = testUrl || this.getUrl();
    if (!url) {
      return { success: false, error: 'Chưa cấu hình URL kết nối.' };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(`${url}?action=read&sheet=Accounts`, {
        headers: this.getAuthHeaders(),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.status === 401) {
        return { success: false, error: 'Phiên đăng nhập không hợp lệ.' };
      }
      if (!response.ok) throw new Error('Không thể kết nối đến máy chủ.');

      const result = await response.json();
      if (result.error) {
        return { success: false, error: result.error };
      }
      return { success: true };
    } catch (e) {
      if (e.name === 'AbortError') {
        return { success: false, error: 'Máy chủ không phản hồi (timeout).' };
      }
      return { success: false, error: e.message || 'Lỗi mạng.' };
    }
  },

  // Thử phục hồi kết nối trước khi hiển thị lỗi
  async tryRecover() {
    if (this.isRecovering) return false;
    this.isRecovering = true;
    this.updateStatusUI('reconnecting');

    try {
      // Bước 1: Kiểm tra server có sống không
      const serverAlive = await this.pingServer();
      if (!serverAlive) {
        console.log('🔄 Server chưa phản hồi, đợi cold start...');
        // Đợi 3 giây cho cold start
        await new Promise(resolve => setTimeout(resolve, 3000));
        const retryAlive = await this.pingServer();
        if (!retryAlive) {
          this.isRecovering = false;
          return false;
        }
      }

      // Bước 2: Kiểm tra session còn hợp lệ không
      const sessionValid = await this.validateSession();
      if (!sessionValid) {
        console.log('🔑 Session không hợp lệ, chuyển đến trang đăng nhập...');
        this.isRecovering = false;
        this.handleUnauthorized();
        return false;
      }

      // Session hợp lệ, server sống → kết nối lại thành công
      console.log('✅ Phục hồi kết nối thành công!');
      this.isRecovering = false;
      return true;
    } catch (e) {
      console.error('🔄 Recovery failed:', e);
      this.isRecovering = false;
      return false;
    }
  },

  async backgroundSync(isSilent = false) {
    if (!this.isEnabled() || this.isSyncing) return;

    // Không sync nếu chưa đăng nhập
    if (!Auth.getAuthToken()) return;

    // Cố gắng xử lý hàng đợi đồng bộ local trước khi pull
    if (this.mutationQueue.length > 0) {
      await this.processMutationQueue();
      if (this.mutationQueue.length > 0) {
        console.warn('⚠️ Bỏ qua cập nhật dữ liệu từ máy chủ do còn thay đổi chưa được đồng bộ.');
        return;
      }
    }

    const url = this.getUrl();
    if (!url) return;

    this.isSyncing = true;
    if (!isSilent) {
      this.updateStatusUI('syncing');
    }

    try {
      // Thêm timeout cho fetch request (15 giây)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${url}?action=readAll`, {
        headers: this.getAuthHeaders(),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.status === 401) {
        // Session hết hạn trên server → thử validate lại
        const recovered = await this.tryRecover();
        if (!recovered) return; // handleUnauthorized đã được gọi bên trong
        // Nếu recover thành công, thử sync lại
        this.isSyncing = false;
        this.backgroundSync(isSilent);
        return;
      }

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      const cloudData = result.data || {};

      const currentAccounts = localStorage.getItem('hha_accounts');
      const currentDocs = localStorage.getItem('hha_documents');
      const currentVotes = localStorage.getItem('hha_votes');
      const currentNotifs = localStorage.getItem('hha_notifications');
      const currentFiles = localStorage.getItem('hha_files');
      const currentSuggestions = localStorage.getItem('hha_suggestions');
      const currentSessions = localStorage.getItem('hha_sessions');

      const newAccounts = JSON.stringify(cloudData.Accounts || []);
      const newDocs = JSON.stringify(cloudData.Documents || []);
      const newVotes = JSON.stringify(cloudData.Votes || []);
      const newNotifs = JSON.stringify(cloudData.Notifications || []);
      const newFiles = JSON.stringify(cloudData.Files || []);
      const newSuggestions = JSON.stringify(cloudData.Suggestions || []);
      const newSessions = JSON.stringify(cloudData.Sessions || []);

      const hasChanged =
        currentAccounts !== newAccounts ||
        currentDocs !== newDocs ||
        currentVotes !== newVotes ||
        currentNotifs !== newNotifs ||
        currentFiles !== newFiles ||
        currentSuggestions !== newSuggestions ||
        currentSessions !== newSessions;

      if (hasChanged) {
        console.log('☁️ Phát hiện dữ liệu mới. Đang đồng bộ...');
        this.saveCloudDataToLocalStorage(cloudData);
        document.dispatchEvent(new CustomEvent('hha_data_synced'));
      }

      this.lastSyncTime = new Date().toISOString();
      // Reset error counter on success
      if (this.consecutiveErrors > 0) {
        console.log('✅ Kết nối đã phục hồi sau', this.consecutiveErrors, 'lần lỗi');
      }
      this.consecutiveErrors = 0;
      // Khôi phục polling interval về mặc định nếu đang backoff
      this.startPolling(this.DEFAULT_POLL_MS);
      this.updateStatusUI('synced');
    } catch (e) {
      this.consecutiveErrors++;

      if (e.name === 'AbortError') {
        console.warn('☁️ Sync timeout (server có thể đang khởi động lại)');
      } else {
        console.error('☁️ Sync error:', e.message);
      }

      // Hiển thị trạng thái phù hợp dựa trên số lần lỗi
      if (this.consecutiveErrors < this.MAX_RETRY_BEFORE_ERROR) {
        // Chưa đủ lỗi → hiện "Đang kết nối lại..." thay vì "Lỗi kết nối"
        if (!isSilent || this.consecutiveErrors >= 2) {
          this.updateStatusUI('reconnecting');
        }
      } else if (this.consecutiveErrors === this.MAX_RETRY_BEFORE_ERROR) {
        // Đủ lỗi → thử phục hồi
        console.log('🔄 Đã lỗi', this.consecutiveErrors, 'lần. Thử phục hồi kết nối...');
        const recovered = await this.tryRecover();
        if (recovered) {
          this.consecutiveErrors = 0;
          this.startPolling(this.DEFAULT_POLL_MS);
          this.updateStatusUI('synced');
          // Trigger lại sync
          this.isSyncing = false;
          this.backgroundSync(isSilent);
          return;
        } else {
          this.updateStatusUI('error');
        }
      } else {
        this.updateStatusUI('error');
      }

      // Exponential backoff: 10s → 20s → 40s → max 60s
      if (this.consecutiveErrors >= 2) {
        const backoffMs = Math.min(this.DEFAULT_POLL_MS * Math.pow(2, this.consecutiveErrors - 1), 60000);
        console.log(`☁️ Backoff: ${backoffMs / 1000}s (lỗi liên tục ${this.consecutiveErrors} lần)`);
        this.startPolling(backoffMs);
      }
    } finally {
      this.isSyncing = false;
    }
  },

  saveCloudDataToLocalStorage(cloudData) {
    try {
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
      if (cloudData.Suggestions) {
        localStorage.setItem('hha_suggestions', JSON.stringify(cloudData.Suggestions));
      }
      if (cloudData.Sessions) {
        localStorage.setItem('hha_sessions', JSON.stringify(cloudData.Sessions));
      }
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.code === 22 || (e.message && e.message.includes('quota'))) {
        console.warn('⚠️ Hạn mức localStorage bị đầy! Tiến hành xóa cache file để giải phóng dung lượng...');
        localStorage.removeItem('hha_files');
        try {
          // Thử ghi lại các dữ liệu cốt lõi
          if (cloudData.Sessions) {
            localStorage.setItem('hha_sessions', JSON.stringify(cloudData.Sessions));
          }
          console.log('✅ Đã giải phóng và ghi đè dữ liệu phiên họp thành công.');
        } catch (retryErr) {
          console.error('❌ Vẫn vượt quá hạn mức sau khi giải phóng hha_files. Xóa toàn bộ cache...', retryErr);
          // Xóa hết cache, chỉ giữ lại auth token và session người dùng để tránh bị đăng xuất
          const token = localStorage.getItem('hha_auth_token') || sessionStorage.getItem('hha_auth_token');
          const userSession = localStorage.getItem('hha_session');
          localStorage.clear();
          if (token) {
            sessionStorage.setItem('hha_auth_token', token);
            localStorage.setItem('hha_auth_token', token);
          }
          if (userSession) localStorage.setItem('hha_session', userSession);
          window.location.reload();
        }
      } else {
        throw e;
      }
    }
  },

  async syncSheet(sheetName, data) {
    if (!this.isEnabled()) return;
    const url = this.getUrl();
    if (!url) return;

    this.updateStatusUI('saving');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          action: 'sync',
          sheet: sheetName,
          rows: data
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.status === 401) {
        this.handleUnauthorized();
        return;
      }

      setTimeout(() => this.updateStatusUI('synced'), 500);
    } catch (e) {
      console.error(`☁️ Error syncing sheet ${sheetName}:`, e);
      this.updateStatusUI('error');
    }
  },

  async syncMutation(mutationType, sheetName, item) {
    if (!this.isEnabled()) return;

    // Add to queue
    const mutationId = `${mutationType}_${sheetName}_${item.id || Utils.generateId()}`;
    const exists = this.mutationQueue.some(m => m.id === mutationId);
    if (!exists) {
      this.mutationQueue.push({
        id: mutationId,
        mutationType,
        sheetName,
        item,
        timestamp: Date.now()
      });
      localStorage.setItem('hha_failed_mutations', JSON.stringify(this.mutationQueue));
    }

    await this.processMutationQueue();
  },

  isProcessingQueue: false,
  async processMutationQueue() {
    if (this.isProcessingQueue || this.mutationQueue.length === 0) return;
    this.isProcessingQueue = true;
    
    const url = this.getUrl();
    if (!url) {
      this.isProcessingQueue = false;
      return;
    }

    this.updateStatusUI('saving');
    console.log(`☁️ Đang xử lý hàng đợi đồng bộ (${this.mutationQueue.length} thay đổi)...`);

    let successCount = 0;
    
    while (this.mutationQueue.length > 0) {
      const mutation = this.mutationQueue[0];
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(url, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({
            action: 'mutation',
            mutationType: mutation.mutationType,
            sheet: mutation.sheetName,
            item: mutation.item
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.status === 401) {
          this.isProcessingQueue = false;
          this.handleUnauthorized();
          return;
        }

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        // Success: remove from queue
        this.mutationQueue.shift();
        localStorage.setItem('hha_failed_mutations', JSON.stringify(this.mutationQueue));
        successCount++;
      } catch (err) {
        console.error(`☁️ Đồng bộ thất bại cho ${mutation.sheetName}:`, err.message);
        this.updateStatusUI('error');
        this.isProcessingQueue = false;
        return; // Dừng xử lý hàng đợi, thử lại ở lần sau
      }
    }

    console.log(`☁️ Đã đồng bộ thành công ${successCount} thay đổi lên đám mây.`);
    this.updateStatusUI('synced');
    this.isProcessingQueue = false;
  },

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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${url}?action=readAll`, {
        headers: this.getAuthHeaders(),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.status === 401) {
        this.handleUnauthorized();
        return false;
      }

      if (!response.ok) throw new Error('Không thể kết nối đến máy chủ.');

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      this.saveCloudDataToLocalStorage(result.data || {});
      this.updateStatusUI('synced');

      alert('Đã tải và đồng bộ dữ liệu thành công!');
      window.location.reload();
      return true;
    } catch (e) {
      if (e.name === 'AbortError') {
        alert('Máy chủ không phản hồi. Vui lòng thử lại sau.');
      } else {
        alert(`Lỗi khi tải dữ liệu: ${e.message}`);
      }
      this.updateStatusUI('error');
      return false;
    }
  },

  async uploadAllToCloud() {
    const url = this.getUrl();
    if (!url) {
      alert('Vui lòng cấu hình URL kết nối trước.');
      return false;
    }

    if (!confirm('Bạn có chắc chắn muốn đẩy toàn bộ dữ liệu hiện tại lên cơ sở dữ liệu đám mây?')) {
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

  async uploadAllToCloudInternal(url) {
    const payload = {
      action: 'syncAll',
      data: {
        accounts: Storage.getAccounts(),
        documents: Storage.getDocuments(),
        votes: Storage.getVotes(),
        notifications: Storage.getNotifications(),
        files: Storage.getFiles(),
        suggestions: Storage.getSuggestions(),
        sessions: Storage.getSessions()
      }
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.status === 401) {
        this.handleUnauthorized();
        return false;
      }

      return true;
    } catch (e) {
      console.error('☁️ Error during uploadAll:', e);
      return false;
    }
  },

  lastSyncTime: null,

  showConnectionInfo() {
    let modal = document.getElementById('modal-sync-connection');
    if (modal) modal.remove();

    const formattedTime = this.lastSyncTime ? Utils.formatDateTime(this.lastSyncTime) : 'Chưa đồng bộ';
    const serverUrl = window.location.origin;
    const errorCount = this.consecutiveErrors;
    const statusColor = errorCount === 0 ? '#10B981' : errorCount < this.MAX_RETRY_BEFORE_ERROR ? '#F59E0B' : '#EF4444';
    const statusText = errorCount === 0 ? 'Đang trực tuyến' : errorCount < this.MAX_RETRY_BEFORE_ERROR ? 'Đang kết nối lại...' : 'Mất kết nối';

    const modalHtml = `
      <div class="modal-overlay active" id="modal-sync-connection" style="z-index: 9999; display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5);">
        <div class="modal animate-fadeInUp" style="max-width: 450px; background: var(--color-surface, #ffffff); border-radius: var(--radius-lg, 12px); box-shadow: 0 10px 25px rgba(0,0,0,0.15); width: 90%; overflow: hidden; display: flex; flex-direction: column;">
          <div class="modal__header" style="border-bottom: 1px solid var(--color-divider, #e2e8f0); padding: 16px 20px; display: flex; justify-content: space-between; align-items: center;">
            <h3 class="modal__title" style="display: flex; align-items: center; gap: 8px; font-size: 16px; margin: 0; font-weight: 600; color: var(--color-text, #1e293b);">
              <svg viewBox="0 0 24 24" fill="none" stroke="${statusColor}" stroke-width="2" width="22" height="22"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
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
                <strong style="color: ${statusColor};">${statusText}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--color-divider, #cbd5e1); padding-bottom: 8px;">
                <span style="color: var(--color-text-secondary, #475569);">Tần suất tự động đồng bộ:</span>
                <strong style="color: var(--color-primary, #2b5797);">10 giây / lần</strong>
              </div>
              <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--color-divider, #cbd5e1); padding-bottom: 8px;">
                <span style="color: var(--color-text-secondary, #475569);">Đồng bộ lần cuối:</span>
                <strong style="color: var(--color-text, #1e293b);">${formattedTime}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--color-divider, #cbd5e1); padding-bottom: 8px;">
                <span style="color: var(--color-text-secondary, #475569);">Keep-alive:</span>
                <strong style="color: #10B981;">🟢 Mỗi 4 phút</strong>
              </div>
              <div style="display: flex; justify-content: space-between; padding-bottom: 4px;">
                <span style="color: var(--color-text-secondary, #475569);">Xác thực:</span>
                <strong style="color: #10B981;">🔒 Session Token (Bảo mật)</strong>
              </div>
            </div>
          </div>
          <div class="modal__footer" style="border-top: 1px solid var(--color-divider, #e2e8f0); padding: 12px 20px; display: flex; justify-content: flex-end; gap: 10px; background: var(--color-surface-hover, #f8fafc);">
            <button class="btn btn-secondary" onclick="document.getElementById('modal-sync-connection').remove()" style="padding: 6px 12px; font-size: 13px;">Đóng</button>
            <button class="btn btn-primary" onclick="document.getElementById('modal-sync-connection').remove(); Sync.consecutiveErrors = 0; Sync.backgroundSync(false);" style="padding: 6px 12px; font-size: 13px;">Đồng bộ ngay</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const overlay = document.getElementById('modal-sync-connection');
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }
};
