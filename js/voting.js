/* ============================================
   VOTING - Voting/Polling Module
   ============================================ */

const Voting = {
  // Add dynamic vote item row input in modal
  addVoteItemInput(val = '') {
    const container = document.getElementById('vote-items-container');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'd-flex gap-2 vote-item-row';
    row.innerHTML = `
      <input class="form-input vote-item-input" type="text" placeholder="VD: Nội dung biểu quyết..." value="${Utils.escapeHtml(val)}" required>
      <button type="button" class="btn btn-ghost btn-sm text-danger" onclick="this.closest('.vote-item-row').remove()" style="padding: 0 8px;">✕</button>
    `;
    container.appendChild(row);
  },

  // Toggle card expansion/collapse
  toggleCard(header, event) {
    // Tránh toggle khi bấm vào nút, badge, link, hoặc input trong header
    if (event.target.closest('button') || event.target.closest('input') || event.target.closest('a') || event.target.closest('.badge')) {
      return;
    }
    const card = header.closest('.vote-card');
    if (card) {
      card.classList.toggle('vote-card--collapsed');
    }
  },


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

    const activeVotes = votes.filter(v => v.status === 'active');
    const closedVotes = votes.filter(v => v.status === 'closed');

    let html = '';

    if (activeVotes.length > 0) {
      html += `<h3 class="vote-group-title"><span class="pulse-dot"></span> Cuộc họp đang diễn ra (${activeVotes.length})</h3>`;
      activeVotes.forEach(vote => {
        html += this.getVoteCardHtmlAdmin(vote);
      });
    }

    if (closedVotes.length > 0) {
      html += `<h3 class="vote-group-title text-muted mt-8">✓ Cuộc họp đã kết thúc (${closedVotes.length})</h3>`;
      closedVotes.forEach(vote => {
        html += this.getVoteCardHtmlAdmin(vote);
      });
    }

    container.innerHTML = html;
  },

  // Helper for admin card HTML
  getVoteCardHtmlAdmin(vote) {
    const isActive = vote.status === 'active';
    let itemsHtml = '';

    if (vote.items && vote.items.length > 0) {
      // Grouped structure
      itemsHtml = vote.items.map((item, idx) => {
        const votersOnItem = vote.voters ? vote.voters.filter(v => v.votes && v.votes[item.id]) : [];
        const totalVotersOnItem = votersOnItem.length;
        const agreeCount = votersOnItem.filter(v => v.votes[item.id] === 'agree').length;
        const disagreeCount = totalVotersOnItem - agreeCount;
        const agreePercent = totalVotersOnItem > 0 ? Math.round((agreeCount / totalVotersOnItem) * 100) : 0;
        const disagreePercent = totalVotersOnItem > 0 ? 100 - agreePercent : 0;

        return `
          <div class="vote-item-detail" style="border-bottom: 1px dashed var(--color-divider); padding: var(--space-3) 0;">
            <div style="font-weight: 600; font-size: 14px; margin-bottom: var(--space-2); color: var(--color-text);">
              Phần ${idx + 1}: ${Utils.escapeHtml(item.title)}
            </div>
            <div class="vote-result-bar">
              <div class="vote-result-label">
                <span class="vote-result-label__text"><span style="color:var(--color-success)">✓</span> Tán thành</span>
                <span class="vote-result-label__percent" style="color:var(--color-success)">${agreePercent}% (${agreeCount})</span>
              </div>
              <div class="vote-progress">
                <div class="vote-progress__fill vote-progress__fill--agree" style="width:${agreePercent}%"></div>
              </div>
            </div>
            <div class="vote-result-bar">
              <div class="vote-result-label">
                <span class="vote-result-label__text"><span style="color:var(--color-danger)">✗</span> Không tán thành</span>
                <span class="vote-result-label__percent" style="color:var(--color-danger)">${disagreePercent}% (${disagreeCount})</span>
              </div>
              <div class="vote-progress">
                <div class="vote-progress__fill vote-progress__fill--disagree" style="width:${disagreePercent}%"></div>
              </div>
            </div>
          </div>
        `;
      }).join('');
    } else {
      // Legacy structure fallback
      const totalVoters = vote.voters ? vote.voters.length : 0;
      const agreeCount = vote.voters ? vote.voters.filter(v => v.vote === 'agree').length : 0;
      const disagreeCount = totalVoters - agreeCount;
      const agreePercent = totalVoters > 0 ? Math.round((agreeCount / totalVoters) * 100) : 0;
      const disagreePercent = totalVoters > 0 ? 100 - agreePercent : 0;

      itemsHtml = `
        <div class="vote-result-bar">
          <div class="vote-result-label">
            <span class="vote-result-label__text"><span style="color:var(--color-success)">✓</span> Tán thành</span>
            <span class="vote-result-label__percent" style="color:var(--color-success)">${agreePercent}% (${agreeCount})</span>
          </div>
          <div class="vote-progress">
            <div class="vote-progress__fill vote-progress__fill--agree" style="width:${agreePercent}%"></div>
          </div>
        </div>
        <div class="vote-result-bar">
          <div class="vote-result-label">
            <span class="vote-result-label__text"><span style="color:var(--color-danger)">✗</span> Không tán thành</span>
            <span class="vote-result-label__percent" style="color:var(--color-danger)">${disagreePercent}% (${disagreeCount})</span>
          </div>
          <div class="vote-progress">
            <div class="vote-progress__fill vote-progress__fill--disagree" style="width:${disagreePercent}%"></div>
          </div>
        </div>
      `;
    }

    const totalVotersSession = vote.voters ? vote.voters.length : 0;

    // Render voters list with details
    let voterListHtml = '';
    if (vote.voters && vote.voters.length > 0) {
      voterListHtml = vote.voters.map(v => {
        const user = Storage.getAccountById(v.userId);
        let votesInfo = '';

        if (vote.items && vote.items.length > 0) {
          votesInfo = vote.items.map((item, idx) => {
            const voteVal = v.votes ? v.votes[item.id] : null;
            if (!voteVal) return '';
            return `
              <div style="font-size:12px; margin-top:4px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span>Phần ${idx + 1}:</span>
                <span class="voter-item__vote voter-item__vote--${voteVal === 'agree' ? 'agree' : 'disagree'}" style="padding:1px 6px; font-size:11px;">
                  ${voteVal === 'agree' ? 'Tán thành' : 'Không tán thành'}
                </span>
                ${v.comments && v.comments[item.id] ? `<span style="color:var(--color-text-secondary);">💬 ${Utils.escapeHtml(v.comments[item.id])}</span>` : ''}
              </div>
            `;
          }).join('');
        } else {
          votesInfo = `
            <span class="voter-item__vote voter-item__vote--${v.vote === 'agree' ? 'agree' : 'disagree'}">
              ${v.vote === 'agree' ? 'Tán thành' : 'Không tán thành'}
            </span>
            ${v.comment ? `<div style="font-size:13px; color:var(--color-text-secondary); margin-top:2px;">💬 ${Utils.escapeHtml(v.comment)}</div>` : ''}
          `;
        }

        return `
          <div class="voter-item" style="flex-direction:column; align-items:flex-start; gap:4px; padding:10px 16px;">
            <div class="d-flex items-center gap-2">
              <div class="voter-item__avatar" style="width:28px; height:28px; font-size:11px;">${Utils.getInitials(user ? user.fullName : '?')}</div>
              <div class="voter-item__name"><strong>${Utils.escapeHtml(user ? user.fullName : 'Không xác định')}</strong></div>
            </div>
            <div style="padding-left:36px; width:100%;">${votesInfo}</div>
          </div>
        `;
      }).join('');
    } else {
      voterListHtml = '<div class="text-muted p-3" style="font-size:13px; text-align:center;">Chưa có người biểu quyết</div>';
    }

    return `
      <div class="vote-card ${isActive ? 'vote-card--active' : 'vote-card--closed vote-card--collapsed'}">
        <div class="vote-card__header" onclick="Voting.toggleCard(this, event)">
          <div style="flex-grow: 1;">
            <div class="vote-card__title">${Utils.escapeHtml(vote.title)}</div>
            <p class="vote-card__desc">${Utils.escapeHtml(vote.description || '')}</p>
            <div class="mt-2" style="font-size:12px;color:var(--color-text-muted);">
              Tạo lúc: ${Utils.formatDateTime(vote.createdAt)}
              ${vote.closedAt ? ` | Đóng lúc: ${Utils.formatDateTime(vote.closedAt)}` : ''}
            </div>
          </div>
          <div class="d-flex items-center gap-2" onclick="event.stopPropagation()">
            ${isActive ? `
              <span class="vote-status--active">Đang mở</span>
              <button class="btn btn-danger btn-sm" onclick="Voting.closeVote('${vote.id}')">Đóng</button>
            ` : `
              <span class="vote-status--closed">Đã đóng</span>
            `}
          </div>
          <div class="vote-card__toggle-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" class="chevron-icon">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </div>

        <div class="vote-card__body-wrapper">
          <div class="vote-card__body">
            <div class="vote-card__results" style="background:var(--color-surface-hover); display:flex; flex-direction:column; gap:12px;">
              ${itemsHtml}
              <div class="vote-total-count" style="margin-top:4px; font-weight:600; text-align:left;">Tổng số đại biểu đã tham gia: ${totalVotersSession}</div>
            </div>

            <!-- Voter list (Admin only) -->
            <div class="vote-card__comments" style="background:var(--color-surface)">
              <div class="comments-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                Danh sách người biểu quyết
              </div>
              <div class="voter-list">
                ${voterListHtml}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // Render vote list for user
  renderVoteListUser() {
    const votes = Storage.getVotes();
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

    const activeVotes = votes.filter(v => v.status === 'active');
    const closedVotes = votes.filter(v => v.status === 'closed');

    let html = '';

    if (activeVotes.length > 0) {
      html += `<h3 class="vote-group-title"><span class="pulse-dot"></span> Cuộc họp đang diễn ra (${activeVotes.length})</h3>`;
      activeVotes.forEach(vote => {
        html += this.getVoteCardHtmlUser(vote);
      });
    }

    if (closedVotes.length > 0) {
      html += `<h3 class="vote-group-title text-muted mt-8">✓ Cuộc họp đã kết thúc (${closedVotes.length})</h3>`;
      closedVotes.forEach(vote => {
        html += this.getVoteCardHtmlUser(vote);
      });
    }

    container.innerHTML = html;
  },

  // Helper for user card HTML
  getVoteCardHtmlUser(vote) {
    const session = Auth.getSession();
    const isActive = vote.status === 'active';
    const myVoteRecord = vote.voters ? vote.voters.find(v => v.userId === session.userId) : null;

    let itemsHtml = '';
    if (vote.items && vote.items.length > 0) {
      itemsHtml = vote.items.map((item, idx) => {
        const myItemVote = myVoteRecord && myVoteRecord.votes ? myVoteRecord.votes[item.id] : null;
        const votersOnItem = vote.voters ? vote.voters.filter(v => v.votes && v.votes[item.id]) : [];
        const totalVotersOnItem = votersOnItem.length;
        const agreeCount = votersOnItem.filter(v => v.votes[item.id] === 'agree').length;
        const disagreeCount = totalVotersOnItem - agreeCount;
        const agreePercent = totalVotersOnItem > 0 ? Math.round((agreeCount / totalVotersOnItem) * 100) : 0;
        const disagreePercent = totalVotersOnItem > 0 ? 100 - agreePercent : 0;

        let actionsHtml = '';
        if (isActive && !myItemVote) {
          actionsHtml = `
            <div class="vote-card__actions" style="margin-top: 8px; padding: 0; border: none; gap: 8px;">
              <button class="vote-btn vote-btn--agree btn-sm" onclick="Voting.castVoteItem('${vote.id}', '${item.id}', 'agree')" style="padding: 6px 12px; font-size: 12px; min-height: 36px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                TÁN THÀNH
              </button>
              <button class="vote-btn vote-btn--disagree btn-sm" onclick="Voting.castVoteItem('${vote.id}', '${item.id}', 'disagree')" style="padding: 6px 12px; font-size: 12px; min-height: 36px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/></svg>
                KHÔNG TÁN THÀNH
              </button>
            </div>
          `;
        } else if (myItemVote) {
          actionsHtml = `
            <div style="margin-top: 8px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span class="badge ${myItemVote === 'agree' ? 'badge--success' : 'badge--danger'}" style="font-size: 11px; padding: 2px 8px;">
                ${myItemVote === 'agree' ? '✓ Đã tán thành' : '✗ Đã không tán thành'}
              </span>
              ${myVoteRecord.comments && myVoteRecord.comments[item.id] ? `<span style="font-size: 12px; color: var(--color-text-secondary);">💬 ${Utils.escapeHtml(myVoteRecord.comments[item.id])}</span>` : ''}
            </div>
          `;
        }

        return `
          <div class="vote-item-detail" style="border-bottom: 1px dashed var(--color-divider); padding: var(--space-3) 0;">
            <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px; color: var(--color-text);">
              Phần ${idx + 1}: ${Utils.escapeHtml(item.title)}
            </div>
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
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
              <span style="font-size: 12px; color: var(--color-text-muted);">Tổng số: ${totalVotersOnItem} phiếu</span>
              ${actionsHtml}
            </div>
          </div>
        `;
      }).join('');
    } else {
      // Legacy structure fallback
      const totalVoters = vote.voters ? vote.voters.length : 0;
      const agreeCount = vote.voters ? vote.voters.filter(v => v.vote === 'agree').length : 0;
      const disagreeCount = totalVoters - agreeCount;
      const agreePercent = totalVoters > 0 ? Math.round((agreeCount / totalVoters) * 100) : 0;
      const disagreePercent = totalVoters > 0 ? 100 - agreePercent : 0;

      itemsHtml = `
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
      `;
    }

    // Dynamic Comments display
    let commentsSectionHtml = '';
    if (vote.items && vote.items.length > 0) {
      const votersWithComments = vote.voters ? vote.voters.filter(v => v.comments && Object.keys(v.comments).length > 0) : [];
      const totalCommentsCount = votersWithComments.reduce((acc, v) => acc + Object.values(v.comments).filter(Boolean).length, 0);

      const commentsHtml = votersWithComments.map(v => {
        const user = Storage.getAccountById(v.userId);
        const userComments = Object.entries(v.comments).map(([itemId, commentText]) => {
          const item = vote.items.find(it => it.id === itemId);
          if (!item || !commentText) return '';
          return `
            <div style="font-size: 13px; margin-top: 4px; border-left: 2px solid var(--color-primary); padding-left: 8px;">
              <strong style="font-size: 12px; color: var(--color-primary);">${Utils.escapeHtml(item.title)}:</strong>
              <span style="color: var(--color-text);">${Utils.escapeHtml(commentText)}</span>
            </div>
          `;
        }).join('');

        return `
          <div class="comment-item" style="padding: 10px 0; display:flex; gap:12px; align-items:flex-start;">
            <div class="comment-avatar" style="width:28px; height:28px; font-size:11px;">${Utils.getInitials(user ? user.fullName : '?')}</div>
            <div class="comment-body" style="width: 100%;">
              <div class="comment-author" style="font-size:13px; font-weight:600;">${Utils.escapeHtml(user ? user.fullName : 'Không xác định')}</div>
              <div>${userComments}</div>
              <div class="comment-time" style="font-size:10px;">${Utils.timeAgo(v.votedAt)}</div>
            </div>
          </div>
        `;
      }).join('');

      commentsSectionHtml = `
        <div class="vote-card__comments">
          <div class="comments-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Ý kiến đóng góp (${totalCommentsCount})
          </div>
          <div style="max-height: 250px; overflow-y: auto;">
            ${commentsHtml || '<div class="text-muted p-2" style="font-size:12px; text-align: center;">Chưa có ý kiến đóng góp</div>'}
          </div>
        </div>
      `;
    } else {
      // Legacy Comments
      const legacyCommentsCount = vote.voters ? vote.voters.filter(v => v.comment).length : 0;
      commentsSectionHtml = `
        <div class="vote-card__comments">
          <div class="comments-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Ý kiến đóng góp (${legacyCommentsCount})
          </div>
          ${vote.voters && vote.voters.length > 0 ? vote.voters.filter(v => v.comment).map(v => {
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
          }).join('') : '<div class="text-muted p-2" style="font-size:12px; text-align: center;">Chưa có ý kiến đóng góp</div>'}
          
          ${myVoteRecord && isActive ? `
            <div class="comment-input-wrapper">
              <input type="text" class="comment-input" id="comment-${vote.id}" placeholder="Thêm ý kiến..." onkeypress="if(event.key==='Enter')Voting.addComment('${vote.id}')">
              <button class="btn btn-primary btn-sm" onclick="Voting.addComment('${vote.id}')">Gửi</button>
            </div>
          ` : ''}
        </div>
      `;
    }

    const hasVotedAll = vote.items && vote.items.length > 0 
      ? vote.items.every(item => myVoteRecord && myVoteRecord.votes && myVoteRecord.votes[item.id])
      : (myVoteRecord ? !!myVoteRecord.vote : false);
    const shouldCollapse = !isActive || hasVotedAll;

    return `
      <div class="vote-card ${isActive ? 'vote-card--active' : 'vote-card--closed'} ${shouldCollapse ? 'vote-card--collapsed' : ''}">
        <div class="vote-card__header" onclick="Voting.toggleCard(this, event)">
          <div style="flex-grow: 1;">
            <div class="vote-card__title">${Utils.escapeHtml(vote.title)}</div>
            <p class="vote-card__desc">${Utils.escapeHtml(vote.description || '')}</p>
          </div>
          <div class="d-flex items-center gap-2" onclick="event.stopPropagation()">
            ${isActive ? '<span class="vote-status--active">Đang mở</span>' : '<span class="vote-status--closed">Đã đóng</span>'}
          </div>
          <div class="vote-card__toggle-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" class="chevron-icon">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </div>

        <div class="vote-card__body-wrapper">
          <div class="vote-card__body">
            <div class="vote-card__results">
              ${itemsHtml}
            </div>

            ${commentsSectionHtml}
          </div>
        </div>
      </div>
    `;
  },

  // Cast vote on a specific item inside a session
  castVoteItem(voteId, itemId, voteType) {
    const session = Auth.getSession();
    const vote = Storage.getVotes().find(v => v.id === voteId);
    if (!vote || vote.status !== 'active') return;

    // Prompt for comment
    const comment = prompt('Nhập ý kiến cho nội dung này (có thể để trống):');
    if (comment === null) return; // Cancel casting

    if (!vote.voters) vote.voters = [];
    let myVoteRecord = vote.voters.find(v => v.userId === session.userId);

    if (!myVoteRecord) {
      myVoteRecord = {
        userId: session.userId,
        votes: {},
        comments: {},
        votedAt: Utils.getCurrentDate()
      };
      vote.voters.push(myVoteRecord);
    }

    if (!myVoteRecord.votes) myVoteRecord.votes = {};
    if (!myVoteRecord.comments) myVoteRecord.comments = {};

    myVoteRecord.votes[itemId] = voteType;
    myVoteRecord.comments[itemId] = comment.trim();
    myVoteRecord.votedAt = Utils.getCurrentDate();

    Storage.updateVote(voteId, { voters: vote.voters });
    Utils.showToast('success', 'Thành công', `Bạn đã biểu quyết "${voteType === 'agree' ? 'Tán thành' : 'Không tán thành'}"`);
    Voting.renderVoteListUser();
  },

  // Cast vote - legacy method
  castVote(voteId, voteType) {
    const session = Auth.getSession();
    const vote = Storage.getVotes().find(v => v.id === voteId);
    if (!vote || vote.status !== 'active') return;

    if (vote.voters && vote.voters.find(v => v.userId === session.userId)) {
      Utils.showToast('warning', 'Đã biểu quyết', 'Bạn đã biểu quyết rồi');
      return;
    }

    const comment = prompt('Nhập ý kiến (có thể bỏ trống):');
    if (comment === null) return;

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

  // Add comment to legacy vote
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
    const container = document.getElementById('vote-items-container');
    if (container) {
      container.innerHTML = `
        <div class="d-flex gap-2 vote-item-row">
          <input class="form-input vote-item-input" type="text" placeholder="VD: Biểu quyết thông qua báo cáo kinh tế..." required>
          <button type="button" class="btn btn-ghost btn-sm text-danger" onclick="this.closest('.vote-item-row').remove()" style="padding: 0 8px;">✕</button>
        </div>
      `;
    }
    Utils.openModal('modal-vote');
  },

  // Save vote
  saveVote() {
    const title = document.getElementById('vote-title-input').value.trim();
    const description = document.getElementById('vote-desc-input').value.trim();

    if (!title) {
      Utils.showToast('error', 'Lỗi', 'Vui lòng nhập tên cuộc họp/hội nghị');
      return;
    }

    const itemInputs = document.querySelectorAll('.vote-item-input');
    const items = [];
    itemInputs.forEach(input => {
      const val = input.value.trim();
      if (val) {
        items.push({
          id: Utils.generateId(),
          title: val
        });
      }
    });

    if (items.length === 0) {
      Utils.showToast('error', 'Lỗi', 'Vui lòng tạo ít nhất 1 nội dung biểu quyết');
      return;
    }

    const newVote = {
      id: Utils.generateId(),
      title,
      description,
      status: 'active',
      items,
      voters: [],
      createdBy: Auth.getSession().userId,
      createdAt: Utils.getCurrentDate()
    };

    Storage.addVote(newVote);

    // Create notification for all users
    Storage.addNotification({
      id: Utils.generateId(),
      title: `Biểu quyết mới: ${title}`,
      content: `Có biểu quyết mới "${title}" với ${items.length} phần cần biểu quyết. Vui lòng tham gia.`,
      priority: 'urgent',
      readBy: [],
      createdBy: Auth.getSession().userId,
      createdAt: Utils.getCurrentDate()
    });

    Utils.showToast('success', 'Thành công', 'Đã tạo hội nghị biểu quyết mới');
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
