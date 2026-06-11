/* ============================================
   VOTING - Voting/Polling Module
   ============================================ */

const Voting = {
  // Render vote list for admin
  renderVoteListAdmin() {
    const votes = Storage.getVotes();
    const container = document.getElementById('votes-list');
    if (!container) return;

    if (votes.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
          <div class="empty-state__title">Chưa có biểu quyết nào</div>
          <div class="empty-state__text">Nhấn "Tạo biểu quyết" để bắt đầu</div>
        </div>`;
      return;
    }

    let html = '';
    votes.forEach(vote => {
      const totalVoters = vote.voters ? vote.voters.length : 0;
      const agreeCount = vote.voters ? vote.voters.filter(v => v.vote === 'agree').length : 0;
      const disagreeCount = totalVoters - agreeCount;
      const agreePercent = totalVoters > 0 ? Math.round((agreeCount / totalVoters) * 100) : 0;
      const disagreePercent = totalVoters > 0 ? 100 - agreePercent : 0;

      html += `
        <div class="vote-card">
          <div class="vote-card__header">
            <div>
              <div class="vote-card__title">${Utils.escapeHtml(vote.title)}</div>
              <p class="vote-card__desc">${Utils.escapeHtml(vote.description)}</p>
              <div class="mt-2" style="font-size:12px;color:var(--color-text-muted);">
                Tạo lúc: ${Utils.formatDateTime(vote.createdAt)}
                ${vote.closedAt ? ` | Đóng lúc: ${Utils.formatDateTime(vote.closedAt)}` : ''}
              </div>
            </div>
            <div class="d-flex items-center gap-2">
              ${vote.status === 'active' ? `
                <span class="vote-status--active">Đang mở</span>
                <button class="btn btn-danger btn-sm" onclick="Voting.closeVote('${vote.id}')">Đóng</button>
              ` : `
                <span class="vote-status--closed">Đã đóng</span>
              `}
            </div>
          </div>

          <div class="vote-card__results">
            <div class="vote-result-bar">
              <div class="vote-result-label">
                <span class="vote-result-label__text">
                  <span style="color:var(--color-success)">✓</span> Tán thành
                </span>
                <span class="vote-result-label__percent" style="color:var(--color-success)">${agreePercent}% (${agreeCount})</span>
              </div>
              <div class="vote-progress">
                <div class="vote-progress__fill vote-progress__fill--agree" style="width:${agreePercent}%"></div>
              </div>
            </div>
            <div class="vote-result-bar">
              <div class="vote-result-label">
                <span class="vote-result-label__text">
                  <span style="color:var(--color-danger)">✗</span> Không tán thành
                </span>
                <span class="vote-result-label__percent" style="color:var(--color-danger)">${disagreePercent}% (${disagreeCount})</span>
              </div>
              <div class="vote-progress">
                <div class="vote-progress__fill vote-progress__fill--disagree" style="width:${disagreePercent}%"></div>
              </div>
            </div>
            <div class="vote-total-count">Tổng số: ${totalVoters} phiếu</div>
          </div>

          <!-- Voter list (Admin only) -->
          <div class="vote-card__comments" style="background:var(--color-surface)">
            <div class="comments-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Danh sách người biểu quyết
            </div>
            <div class="voter-list">
              ${vote.voters && vote.voters.length > 0 ? vote.voters.map(v => {
                const user = Storage.getAccountById(v.userId);
                return `
                  <div class="voter-item">
                    <div class="voter-item__avatar">${Utils.getInitials(user ? user.fullName : '?')}</div>
                    <div class="voter-item__name">${Utils.escapeHtml(user ? user.fullName : 'Không xác định')}</div>
                    <span class="voter-item__vote voter-item__vote--${v.vote === 'agree' ? 'agree' : 'disagree'}">
                      ${v.vote === 'agree' ? 'Tán thành' : 'Không tán thành'}
                    </span>
                  </div>
                  ${v.comment ? `<div style="padding:0 var(--space-4) var(--space-2) 50px;font-size:13px;color:var(--color-text-secondary);">💬 ${Utils.escapeHtml(v.comment)}</div>` : ''}
                `;
              }).join('') : '<div class="text-muted p-3" style="font-size:13px;">Chưa có người biểu quyết</div>'}
            </div>
          </div>
        </div>`;
    });

    container.innerHTML = html;
  },

  // Render vote list for user
  renderVoteListUser() {
    const votes = Storage.getVotes();
    const session = Auth.getSession();
    const container = document.getElementById('votes-list');
    if (!container) return;

    if (votes.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
          <div class="empty-state__title">Chưa có biểu quyết nào</div>
          <div class="empty-state__text">Chưa có biểu quyết nào được phát.</div>
        </div>`;
      return;
    }

    let html = '';
    votes.forEach(vote => {
      const totalVoters = vote.voters ? vote.voters.length : 0;
      const agreeCount = vote.voters ? vote.voters.filter(v => v.vote === 'agree').length : 0;
      const disagreeCount = totalVoters - agreeCount;
      const agreePercent = totalVoters > 0 ? Math.round((agreeCount / totalVoters) * 100) : 0;
      const disagreePercent = totalVoters > 0 ? 100 - agreePercent : 0;

      // Check if user already voted
      const myVote = vote.voters ? vote.voters.find(v => v.userId === session.userId) : null;
      const isActive = vote.status === 'active';

      html += `
        <div class="vote-card">
          <div class="vote-card__header">
            <div>
              <div class="vote-card__title">${Utils.escapeHtml(vote.title)}</div>
              <p class="vote-card__desc">${Utils.escapeHtml(vote.description)}</p>
            </div>
            ${isActive ? '<span class="vote-status--active">Đang mở</span>' : '<span class="vote-status--closed">Đã đóng</span>'}
          </div>

          ${isActive && !myVote ? `
            <div class="vote-card__actions">
              <button class="vote-btn vote-btn--agree" onclick="Voting.castVote('${vote.id}', 'agree')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                TÁN THÀNH
              </button>
              <button class="vote-btn vote-btn--disagree" onclick="Voting.castVote('${vote.id}', 'disagree')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/></svg>
                KHÔNG TÁN THÀNH
              </button>
            </div>
          ` : ''}

          ${myVote ? `
            <div class="vote-card__actions" style="justify-content:center;">
              <div style="text-align:center;">
                <div class="badge ${myVote.vote === 'agree' ? 'badge--success' : 'badge--danger'}" style="font-size:14px;padding:6px 20px;">
                  ${myVote.vote === 'agree' ? '✓ Bạn đã TÁN THÀNH' : '✗ Bạn đã KHÔNG TÁN THÀNH'}
                </div>
                <div style="font-size:12px;color:var(--color-text-muted);margin-top:8px;">Lúc ${Utils.formatDateTime(myVote.votedAt)}</div>
              </div>
            </div>
          ` : ''}

          <div class="vote-card__results">
            <div class="vote-result-bar">
              <div class="vote-result-label">
                <span class="vote-result-label__text"><span style="color:var(--color-success)">✓</span> Tán thành</span>
                <span class="vote-result-label__percent" style="color:var(--color-success)">${agreePercent}%</span>
              </div>
              <div class="vote-progress">
                <div class="vote-progress__fill vote-progress__fill--agree" style="width:${agreePercent}%"></div>
              </div>
            </div>
            <div class="vote-result-bar">
              <div class="vote-result-label">
                <span class="vote-result-label__text"><span style="color:var(--color-danger)">✗</span> Không tán thành</span>
                <span class="vote-result-label__percent" style="color:var(--color-danger)">${disagreePercent}%</span>
              </div>
              <div class="vote-progress">
                <div class="vote-progress__fill vote-progress__fill--disagree" style="width:${disagreePercent}%"></div>
              </div>
            </div>
            <div class="vote-total-count">Tổng số: ${totalVoters} phiếu</div>
          </div>

          <!-- Comments section -->
          <div class="vote-card__comments">
            <div class="comments-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              Ý kiến (${vote.voters ? vote.voters.filter(v => v.comment).length : 0})
            </div>
            ${vote.voters ? vote.voters.filter(v => v.comment).map(v => {
              const user = Storage.getAccountById(v.userId);
              return `
                <div class="comment-item">
                  <div class="comment-avatar">${Utils.getInitials(user ? user.fullName : '?')}</div>
                  <div class="comment-body">
                    <div class="comment-author">${Utils.escapeHtml(user ? user.fullName : 'Không xác định')}</div>
                    <div class="comment-text">${Utils.escapeHtml(v.comment)}</div>
                    <div class="comment-time">${Utils.timeAgo(v.votedAt)}</div>
                  </div>
                </div>
              `;
            }).join('') : ''}
            ${myVote && isActive ? `
              <div class="comment-input-wrapper">
                <input type="text" class="comment-input" id="comment-${vote.id}" placeholder="Thêm ý kiến..." onkeypress="if(event.key==='Enter')Voting.addComment('${vote.id}')">
                <button class="btn btn-primary btn-sm" onclick="Voting.addComment('${vote.id}')">Gửi</button>
              </div>
            ` : ''}
          </div>
        </div>`;
    });

    container.innerHTML = html;
  },

  // Cast vote
  castVote(voteId, voteType) {
    const session = Auth.getSession();
    const vote = Storage.getVotes().find(v => v.id === voteId);
    if (!vote || vote.status !== 'active') return;

    // Check if already voted
    if (vote.voters && vote.voters.find(v => v.userId === session.userId)) {
      Utils.showToast('warning', 'Đã biểu quyết', 'Bạn đã biểu quyết rồi');
      return;
    }

    // Prompt for comment
    const comment = prompt('Nhập ý kiến (có thể bỏ trống):');
    if (comment === null) return; // Cancel voting action

    if (!vote.voters) vote.voters = [];
    vote.voters.push({
      userId: session.userId,
      vote: voteType,
      comment: comment.trim(),
      votedAt: Utils.getCurrentDate()
    });

    Storage.updateVote(voteId, { voters: vote.voters });
    Utils.showToast('success', 'Thành công', `Bạn đã biểu quyết "${voteType === 'agree' ? 'Tán thành' : 'Không tán thành'}"`);
    Voting.renderVoteListUser();
  },

  // Add comment to existing vote
  addComment(voteId) {
    const input = document.getElementById(`comment-${voteId}`);
    if (!input || !input.value.trim()) return;

    const session = Auth.getSession();
    const vote = Storage.getVotes().find(v => v.id === voteId);
    if (!vote) return;

    const voter = vote.voters.find(v => v.userId === session.userId);
    if (voter) {
      voter.comment = input.value.trim();
      Storage.updateVote(voteId, { voters: vote.voters });
      Utils.showToast('success', 'Đã gửi', 'Ý kiến của bạn đã được ghi nhận');
      Voting.renderVoteListUser();
    }
  },

  // Open create vote modal
  openCreateModal() {
    document.getElementById('vote-form').reset();
    Utils.openModal('modal-vote');
  },

  // Save vote
  saveVote() {
    const title = document.getElementById('vote-title-input').value.trim();
    const description = document.getElementById('vote-desc-input').value.trim();

    if (!title) {
      Utils.showToast('error', 'Lỗi', 'Vui lòng nhập tiêu đề biểu quyết');
      return;
    }

    const newVote = {
      id: Utils.generateId(),
      title,
      description,
      status: 'active',
      voters: [],
      createdBy: Auth.getSession().userId,
      createdAt: Utils.getCurrentDate()
    };

    Storage.addVote(newVote);

    // Create notification for all users
    Storage.addNotification({
      id: Utils.generateId(),
      title: `Biểu quyết mới: ${title}`,
      content: `Có biểu quyết mới "${title}". Vui lòng tham gia biểu quyết trong mục Biểu quyết.`,
      priority: 'urgent',
      readBy: [],
      createdBy: Auth.getSession().userId,
      createdAt: Utils.getCurrentDate()
    });

    Utils.showToast('success', 'Thành công', 'Đã tạo biểu quyết mới');
    Utils.closeModal('modal-vote');
    Voting.renderVoteListAdmin();
    App.updateStats();
    Notifications.updateBadge();
  },

  // Close vote
  closeVote(voteId) {
    if (confirm('Đóng biểu quyết này? Mọi người sẽ không thể biểu quyết thêm.')) {
      Storage.updateVote(voteId, { 
        status: 'closed', 
        closedAt: Utils.getCurrentDate() 
      });
      Utils.showToast('success', 'Đã đóng', 'Biểu quyết đã được đóng');
      Voting.renderVoteListAdmin();
      App.updateStats();
    }
  }
};
