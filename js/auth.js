/* ============================================
   AUTH - Authentication & Session Management
   ============================================ */

const Auth = {
  // Login
  login(username, password) {
    const accounts = Storage.getAccounts();
    const account = accounts.find(a => 
      a.username === username && 
      Utils.decode(a.password) === password &&
      a.active
    );

    if (account) {
      const session = {
        userId: account.id,
        username: account.username,
        fullName: account.fullName,
        role: account.role,
        position: account.position,
        loginTime: Utils.getCurrentDate()
      };
      Storage.setSession(session);
      return { success: true, session };
    }

    return { success: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng!' };
  },

  // Logout
  logout() {
    Storage.clearSession();
    window.location.href = 'index.html';
  },

  // Get current session
  getSession() {
    return Storage.getSession();
  },

  // Check if logged in
  isLoggedIn() {
    return !!Storage.getSession();
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
    return true;
  },

  // Change password
  changePassword(userId, oldPassword, newPassword) {
    const account = Storage.getAccountById(userId);
    if (!account) return { success: false, message: 'Tài khoản không tồn tại' };
    
    if (Utils.decode(account.password) !== oldPassword) {
      return { success: false, message: 'Mật khẩu cũ không đúng' };
    }

    Storage.updateAccount(userId, { password: Utils.encode(newPassword) });
    return { success: true, message: 'Đổi mật khẩu thành công' };
  }
};
