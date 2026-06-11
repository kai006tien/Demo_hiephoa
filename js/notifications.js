/* ============================================
   NOTIFICATIONS - Notification Module
   ============================================ */

const Notifications = {
  // Render notification list
  renderNotificationList(role = 'admin') {
    const notifs = Storage.getNotifications();
    const session = Auth.getSession();
    const container = document.getElementById('notifications-list');
    if (!container) return;

    if (notifs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <div class="empty-state__title">Chưa có thông báo</div>
          <div class="empty-state__text">${role === 'admin' ? 'Nhấn "Tạo thông báo" để gửi thông báo' : 'Bạn chưa có thông báo nào'}</div>
        </div>`;
      return;
    }

    let html = '<div class="notif-list">';
    notifs.forEach(notif => {
      const isUnread = !notif.readBy || !notif.readBy.includes(session.userId);
      const priorityIcons = {
        normal: 'notif-item__icon--normal',
        important: 'notif-item__icon--important',
        urgent: 'notif-item__icon--urgent'
      };
      const priorityLabels = {
        normal: 'Bình thường',
        important: 'Quan trọng',
        urgent: 'Khẩn cấp'
      };

      html += `
        <div class="notif-item ${isUnread ? 'unread' : ''}" onclick="Notifications.viewNotification('${notif.id}')">
          <div class="notif-item__icon ${priorityIcons[notif.priority] || priorityIcons.normal}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${notif.priority === 'urgent' ? '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>' : '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'}
            </svg>
          </div>
          <div class="notif-item__content">
            <div class="notif-item__title">${Utils.escapeHtml(notif.title)}</div>
            <div class="notif-item__text">${Utils.escapeHtml(notif.content)}</div>
            <div class="notif-item__time">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${Utils.timeAgo(notif.createdAt)}
            </div>
          </div>
          <div class="notif-item__priority">
            <span class="badge badge--${notif.priority === 'urgent' ? 'danger' : notif.priority === 'important' ? 'warning' : 'info'}">
              ${priorityLabels[notif.priority] || 'Bình thường'}
            </span>
          </div>
        </div>`;
    });
    html += '</div>';

    container.innerHTML = html;
  },

  // View notification detail
  viewNotification(id) {
    const notif = Storage.getNotifications().find(n => n.id === id);
    if (!notif) return;

    const session = Auth.getSession();

    // Mark as read for users and admins
    if (session) {
      if (!notif.readBy) notif.readBy = [];
      if (!notif.readBy.includes(session.userId)) {
        notif.readBy.push(session.userId);
        const notifs = Storage.getNotifications();
        const idx = notifs.findIndex(n => n.id === id);
        if (idx !== -1) {
          notifs[idx] = notif;
          Storage.saveNotifications(notifs);
        }
        Notifications.updateBadge();
        if (typeof renderNotifDropdown === 'function') {
          renderNotifDropdown();
        }
      }
    }

    const priorityLabels = {
      normal: 'Bình thường',
      important: 'Quan trọng',
      urgent: 'Khẩn cấp'
    };

    const modalBody = document.getElementById('modal-notif-view-body');
    if (modalBody) {
      modalBody.innerHTML = `
        <div class="mb-4">
          <span class="badge badge--${notif.priority === 'urgent' ? 'danger' : notif.priority === 'important' ? 'warning' : 'info'}" style="margin-bottom:var(--space-3);display:inline-flex;">
            ${priorityLabels[notif.priority]}
          </span>
          <h3 style="margin-top:var(--space-3)">${Utils.escapeHtml(notif.title)}</h3>
          <div style="font-size:13px;color:var(--color-text-muted);margin-top:var(--space-2);">
            📅 ${Utils.formatDateTime(notif.createdAt)}
          </div>
        </div>
        <div style="font-size:15px;line-height:1.8;color:var(--color-text-secondary);white-space:pre-wrap;background:var(--color-bg);padding:var(--space-5);border-radius:var(--radius-md);">
          ${Utils.escapeHtml(notif.content)}
        </div>
      `;
    }
    Utils.openModal('modal-notif-view');
  },

  // Open create notification modal
  openCreateModal() {
    document.getElementById('notif-form').reset();
    // Reset priority
    document.querySelectorAll('.priority-option').forEach(opt => opt.classList.remove('active'));
    const normalOpt = document.querySelector('.priority-option[data-priority="normal"]');
    if (normalOpt) normalOpt.classList.add('active');
    Utils.openModal('modal-notification');
  },

  // Set priority
  setPriority(priority) {
    document.querySelectorAll('.priority-option').forEach(opt => opt.classList.remove('active'));
    document.querySelector(`.priority-option[data-priority="${priority}"]`).classList.add('active');
    document.getElementById('notif-priority-input').value = priority;
  },

  // Save notification
  saveNotification() {
    const title = document.getElementById('notif-title-input').value.trim();
    const content = document.getElementById('notif-content-input').value.trim();
    const priority = document.getElementById('notif-priority-input').value || 'normal';

    if (!title || !content) {
      Utils.showToast('error', 'Lỗi', 'Vui lòng nhập đầy đủ tiêu đề và nội dung');
      return;
    }

    const newNotif = {
      id: Utils.generateId(),
      title,
      content,
      priority,
      readBy: [],
      createdBy: Auth.getSession().userId,
      createdAt: Utils.getCurrentDate()
    };

    Storage.addNotification(newNotif);
    Utils.showToast('success', 'Thành công', 'Đã gửi thông báo');
    Utils.closeModal('modal-notification');
    Notifications.renderNotificationList('admin');
    App.updateStats();
    Notifications.updateBadge();
  },

  // Get unread count for current user
  getUnreadCount() {
    const session = Auth.getSession();
    if (!session) return 0;
    const notifs = Storage.getNotifications();
    return notifs.filter(n => !n.readBy || !n.readBy.includes(session.userId)).length;
  },

  // Update notification badge
  updateBadge() {
    const count = Notifications.getUnreadCount();
    const badges = document.querySelectorAll('.notification-badge');
    badges.forEach(badge => {
      if (count > 0) {
        badge.textContent = count > 9 ? '9+' : count;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    });

    // Update sidebar badge too
    const sidebarBadge = document.getElementById('sidebar-notif-badge');
    if (sidebarBadge) {
      if (count > 0) {
        sidebarBadge.textContent = count;
        sidebarBadge.style.display = 'flex';
      } else {
        sidebarBadge.style.display = 'none';
      }
    }
  },

  // Mark all as read
  markAllRead() {
    const session = Auth.getSession();
    const notifs = Storage.getNotifications();
    notifs.forEach(n => {
      if (!n.readBy) n.readBy = [];
      if (!n.readBy.includes(session.userId)) {
        n.readBy.push(session.userId);
      }
    });
    Storage.saveNotifications(notifs);
    Notifications.updateBadge();
    Notifications.renderNotificationList(session.role);
    if (typeof renderNotifDropdown === 'function') {
      renderNotifDropdown();
    }
    Utils.showToast('success', 'Thành công', 'Đã đánh dấu tất cả là đã đọc');
  }
};
