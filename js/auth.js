/* ============================================
   AUTH - Authentication & Session Management
   ============================================ */

const Auth = {
  // Session timeout: 24 giờ không hoạt động sẽ tự động đăng xuất (đồng bộ với server)
  SESSION_TIMEOUT_MS: 24 * 60 * 60 * 1000,
  activityTimer: null,

  // Login - gọi API server để xác thực
  async login(username, password) {
    try {
      const response = await Utils.resilientFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const result = await response.json();

      if (result.success) {
        // Lưu auth token vào sessionStorage (an toàn hơn localStorage)
        sessionStorage.setItem('hha_auth_token', result.token);

        const session = {
          userId: result.session.userId,
          username: result.session.username,
          fullName: result.session.fullName,
          role: result.session.role,
          position: result.session.position,
          loginTime: result.session.loginTime
        };
        Storage.setSession(session);
        Auth.startActivityMonitor();
        return { success: true, session };
      }

      return { success: false, message: result.error || 'Đăng nhập thất bại' };
    } catch (e) {
      console.error('Login error:', e);
      return { success: false, message: 'Lỗi kết nối đến máy chủ. Vui lòng thử lại.' };
    }
  },

  // Logout - gọi API server để hủy session
  async logout() {
    try {
      const token = Auth.getAuthToken();
      if (token) {
        await Utils.resilientFetch('/api/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
      }
    } catch (e) {
      // Ignore errors during logout
    }

    Auth.stopActivityMonitor();
    sessionStorage.removeItem('hha_auth_token');
    Storage.clearSession();
    window.location.href = 'index.html';
  },

  // Lấy auth token
  getAuthToken() {
    return sessionStorage.getItem('hha_auth_token');
  },

  // Get current session
  getSession() {
    return Storage.getSession();
  },

  // Check if logged in (có cả token VÀ session)
  isLoggedIn() {
    return !!Auth.getAuthToken() && !!Storage.getSession();
  },

  // Check if admin
  isAdmin() {
    const session = Storage.getSession();
    return session && session.role === 'admin';
  },

  // Get current user
  getCurrentUser() {
    const session = Storage.getSession();
    if (!session) return null;
    return Storage.getAccountById(session.userId);
  },

  // Require auth - redirect if not logged in
  requireAuth() {
    if (!Auth.isLoggedIn()) {
      window.location.href = 'index.html';
      return false;
    }
    Auth.startActivityMonitor();
    return true;
  },

  // Require admin - redirect if not admin
  requireAdmin() {
    if (!Auth.isLoggedIn()) {
      window.location.href = 'index.html';
      return false;
    }
    const session = Auth.getSession();
    if (session.role !== 'admin') {
      window.location.href = 'user.html';
      return false;
    }
    Auth.startActivityMonitor();
    return true;
  },

  // Require user
  requireUser() {
    if (!Auth.isLoggedIn()) {
      window.location.href = 'index.html';
      return false;
    }
    const session = Auth.getSession();
    if (session.role === 'admin') {
      window.location.href = 'admin.html';
      return false;
    }
    Auth.startActivityMonitor();
    return true;
  },

  // Change password - gọi API server
  async changePassword(userId, oldPassword, newPassword) {
    try {
      const token = Auth.getAuthToken();
      const response = await Utils.resilientFetch('/api/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ oldPassword, newPassword })
      });

      const result = await response.json();
      if (response.ok) {
        return { success: true, message: result.message };
      }
      return { success: false, message: result.error };
    } catch (e) {
      return { success: false, message: 'Lỗi kết nối đến máy chủ.' };
    }
  },

  // Giám sát hoạt động người dùng - tự động đăng xuất khi không hoạt động
  startActivityMonitor() {
    Auth.resetActivityTimer();

    // Lắng nghe các sự kiện hoạt động
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(event => {
      document.removeEventListener(event, Auth.resetActivityTimer);
      document.addEventListener(event, Auth.resetActivityTimer, { passive: true });
    });
  },

  stopActivityMonitor() {
    if (Auth.activityTimer) {
      clearTimeout(Auth.activityTimer);
      Auth.activityTimer = null;
    }
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(event => {
      document.removeEventListener(event, Auth.resetActivityTimer);
    });
  },

  resetActivityTimer() {
    if (Auth.activityTimer) {
      clearTimeout(Auth.activityTimer);
    }
    Auth.activityTimer = setTimeout(() => {
      alert('Phiên làm việc đã hết hạn do không hoạt động. Vui lòng đăng nhập lại.');
      Auth.logout();
    }, Auth.SESSION_TIMEOUT_MS);
  }
};
