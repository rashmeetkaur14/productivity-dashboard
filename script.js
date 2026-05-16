/**
 * Session Check
 */
if (sessionStorage.getItem('authenticated') !== 'true') {
    window.location.href = 'login.html';
}

/**
 * State Management (Model)
 */
class TaskStore {
    constructor() {
        this.userEmail = sessionStorage.getItem('userEmail') || 'default';
        this.tasksKey = `tasks_${this.userEmail}`;
        this.activitiesKey = `activities_${this.userEmail}`;
        
        this.tasks = JSON.parse(localStorage.getItem(this.tasksKey)) || [];
        this.activities = JSON.parse(localStorage.getItem(this.activitiesKey)) || [];
        this.currentFilter = 'all';
        this.currentSort = 'default';
    }

    save() {
        localStorage.setItem(this.tasksKey, JSON.stringify(this.tasks));
        localStorage.setItem(this.activitiesKey, JSON.stringify(this.activities));
    }

    logActivity(type, taskName) {
        this.activities.unshift({
            id: Date.now().toString(),
            type,
            taskName,
            time: new Date().toISOString()
        });
        if (this.activities.length > 20) {
            this.activities = this.activities.slice(0, 20);
        }
        this.save();
    }

    addTask(text, dueDate, priority) {
        const newTask = {
            id: Date.now().toString(),
            text,
            completed: false,
            dueDate: dueDate || null,
            priority: priority || 'medium'
        };
        this.tasks.push(newTask);
        this.save();
        this.logActivity('add', text);
    }

    toggleTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            this.save();
            this.logActivity(task.completed ? 'complete' : 'uncomplete', task.text);
        }
    }

    deleteTask(id) {
        const initialLength = this.tasks.length;
        const taskToDelete = this.tasks.find(t => t.id === id);
        this.tasks = this.tasks.filter(task => task.id !== id);
        if (this.tasks.length !== initialLength && taskToDelete) {
            this.save();
            this.logActivity('delete', taskToDelete.text);
        }
    }

    editTask(id, newText) {
        if (!newText) return;
        const task = this.tasks.find(t => t.id === id);
        if (task && task.text !== newText) {
            task.text = newText;
            this.save();
            this.logActivity('edit', newText);
        }
    }

    clearCompleted() {
        const initialLength = this.tasks.length;
        this.tasks = this.tasks.filter(task => !task.completed);
        if (this.tasks.length !== initialLength) {
            this.save();
        }
    }

    reorderTasksByArray(newOrderIds) {
        this.tasks.sort((a, b) => {
            return newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id);
        });
        this.save();
    }

    setFilter(filter) {
        this.currentFilter = filter;
    }

    setSort(sort) {
        this.currentSort = sort;
    }

    getFilteredAndSortedTasks() {
        let filtered = this.tasks;
        if (this.currentFilter === 'active') {
            filtered = this.tasks.filter(t => !t.completed);
        } else if (this.currentFilter === 'completed') {
            filtered = this.tasks.filter(t => t.completed);
        } else if (this.currentFilter === 'important') {
            filtered = this.tasks.filter(t => t.priority === 'high');
        }

        let sorted = [...filtered];
        const w = { 'high': 3, 'medium': 2, 'low': 1 };

        if (this.currentSort === 'priority-desc') {
            sorted.sort((a, b) => w[b.priority || 'medium'] - w[a.priority || 'medium']);
        } else if (this.currentSort === 'priority-asc') {
            sorted.sort((a, b) => w[a.priority || 'medium'] - w[b.priority || 'medium']);
        }

        return sorted;
    }

    getPendingCount() {
        return this.tasks.filter(t => !t.completed).length;
    }
}

/**
 * UI Rendering (View)
 */
class UI {
    constructor() {
        this.taskList = document.getElementById('taskList');
        this.emptyState = document.getElementById('emptyState');
        this.loader = document.getElementById('loader');
        this.deleteModal = document.getElementById('deleteModal');
        this.taskModal = document.getElementById('taskModal');
        this.settingsModal = document.getElementById('settingsModal');
    }

    hideLoader() {
        if (this.loader) {
            setTimeout(() => {
                this.loader.classList.add('hidden');
                setTimeout(() => this.loader.style.display = 'none', 400);
            }, 500); 
        }
    }

    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    getDateStatus(dateString) {
        if (!dateString) return null;
        const [year, month, day] = dateString.split('-').map(Number);
        const dueDate = new Date(year, month - 1, day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
        const formatted = formatter.format(dueDate);

        if (diffDays < 0) return { status: 'overdue', text: formatted, isOverdue: true };
        if (diffDays === 0) return { status: 'today', text: 'Today', isToday: true };
        if (diffDays === 1) return { status: 'upcoming', text: 'Tomorrow' };
        return { status: 'upcoming', text: formatted };
    }

    createTaskElement(task) {
        const dateInfo = this.getDateStatus(task.dueDate);
        let dateHtml = '';
        
        if (dateInfo) {
            const dateClass = dateInfo.isOverdue ? 'overdue' : (dateInfo.isToday ? 'today' : '');
            dateHtml = `<span class="badge badge-due ${dateClass}"><i class="far fa-calendar-alt"></i> ${dateInfo.text}</span>`;
        }

        const pLevel = task.priority || 'medium';
        const priorityText = pLevel.charAt(0).toUpperCase() + pLevel.slice(1);
        const priorityHtml = `<span class="badge priority-${pLevel}"><i class="fas fa-flag"></i> ${priorityText}</span>`;

        const li = document.createElement('li');
        li.className = `task-item priority-${pLevel} ${task.completed ? 'completed' : ''}`;
        li.setAttribute('data-id', task.id);

        li.innerHTML = `
            <div class="checkbox-wrapper">
                <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} aria-label="Mark completed">
            </div>
            <div class="task-content-wrapper">
                <span class="task-content">${this.escapeHTML(task.text)}</span>
                <div class="task-meta">
                    ${priorityHtml}
                    ${dateHtml}
                </div>
            </div>
            <input type="text" class="edit-input" style="display: none;" value="${this.escapeHTML(task.text)}">
            <div class="task-actions">
                <button class="action-btn edit-btn" title="Edit" aria-label="Edit">
                    <i class="fas fa-pen" style="pointer-events: none;"></i>
                </button>
                <button class="action-btn delete-btn" title="Delete" aria-label="Delete">
                    <i class="fas fa-trash" style="pointer-events: none;"></i>
                </button>
                <button class="action-btn save-btn" title="Save" style="display: none; color: var(--accent-color);">
                    <i class="fas fa-check" style="pointer-events: none;"></i>
                </button>
            </div>
        `;
        return li;
    }

    renderTasks(tasks) {
        this.taskList.innerHTML = '';
        if (tasks.length === 0) {
            if (this.emptyState) this.emptyState.classList.remove('hidden');
        } else {
            if (this.emptyState) this.emptyState.classList.add('hidden');
            const fragment = document.createDocumentFragment();
            tasks.forEach(task => {
                fragment.appendChild(this.createTaskElement(task));
            });
            this.taskList.appendChild(fragment);
        }
    }

    showDeleteModal(onConfirm) {
        this.deleteModal.classList.remove('hidden');
        this.deleteModal.setAttribute('aria-hidden', 'false');
        
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        const cancelBtn = document.getElementById('cancelDeleteBtn');
        
        const newConfirm = confirmBtn.cloneNode(true);
        const newCancel = cancelBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
        
        const closeModal = () => {
            this.deleteModal.classList.add('hidden');
            this.deleteModal.setAttribute('aria-hidden', 'true');
        };

        newCancel.addEventListener('click', closeModal);
        newConfirm.addEventListener('click', () => {
            onConfirm();
            closeModal();
        });
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            modal.setAttribute('aria-hidden', 'false');
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
        }
    }
}

/**
 * Application Controller
 */
class App {
    constructor() {
        this.store = new TaskStore();
        this.ui = new UI();
        
        this.cacheDOM();
        this.bindEvents();
        this.initTheme();
        this.initUser();
        
        this.refresh();
        this.ui.hideLoader();
        
        // Start time interval for greeting
        setInterval(() => this.updateGreeting(), 60000);
    }

    cacheDOM() {
        // Top actions
        this.sortSelect = document.getElementById('sortSelect');
        this.clearCompletedBtn = document.getElementById('clearCompletedBtn');
        
        // Sidebar nav
        this.navItems = document.querySelectorAll('.sidebar-nav .nav-item');
        this.sidebar = document.getElementById('sidebar');
        this.mobileToggleBtn = document.getElementById('mobileToggleBtn');
        this.mobileCloseBtn = document.getElementById('mobileCloseBtn');
        
        // Theme
        this.headerThemeToggle = document.getElementById('headerThemeToggle');
        this.settingsThemeToggle = document.getElementById('settingsThemeToggle');
        
        // Dashboard Stats
        this.statTotal = document.getElementById('statTotal');
        this.statPending = document.getElementById('statPending');
        this.statCompleted = document.getElementById('statCompleted');
        this.progressRing = document.getElementById('progressRing');
        this.progressText = document.getElementById('progressText');
        this.greetingText = document.getElementById('greetingText');
        this.pageTitle = document.getElementById('pageTitle');
        
        // Modals
        this.fabAddBtn = document.getElementById('fabAddBtn');
        this.emptyAddBtn = document.getElementById('emptyAddBtn');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.logoutBtn = document.getElementById('logoutBtn');

        // Profile Dropdown
        this.profileDropdownBtn = document.getElementById('profileDropdownBtn');
        this.profileDropdown = document.getElementById('profileDropdown');
        this.dropdownSettingsBtn = document.getElementById('dropdownSettingsBtn');
        this.dropdownLogoutBtn = document.getElementById('dropdownLogoutBtn');
        this.dropdownName = document.getElementById('dropdownName');
        this.dropdownEmail = document.getElementById('dropdownEmail');
        
        // Task Form
        this.saveTaskBtn = document.getElementById('saveTaskBtn');
        this.taskInput = document.getElementById('taskInput');
        this.dueDateInput = document.getElementById('dueDateInput');
        this.priorityInput = document.getElementById('priorityInput');

        // Onboarding
        this.dashboardContent = document.getElementById('dashboardContent');
        this.onboardingState = document.getElementById('onboardingState');
        this.onboardingAddBtn = document.getElementById('onboardingAddBtn');
    }

    initUser() {
        const email = sessionStorage.getItem('userEmail') || 'user@example.com';
        const name = sessionStorage.getItem('userName') || email;
        const profileEl = document.getElementById('profileEmail');
        if (profileEl) profileEl.textContent = email;
        const initial = name.charAt(0).toUpperCase();
        const userEl = document.getElementById('userInitial');
        if (userEl) userEl.textContent = initial;
        const setEl = document.getElementById('settingsInitial');
        if (setEl) setEl.textContent = initial;

        if (this.dropdownName) this.dropdownName.textContent = name;
        if (this.dropdownEmail) this.dropdownEmail.textContent = email;
    }

    updateGreeting() {
        const hour = new Date().getHours();
        let greeting = 'Good evening';
        if (hour < 12) greeting = 'Good morning';
        else if (hour < 18) greeting = 'Good afternoon';
        
        const name = sessionStorage.getItem('userName') || '';
        if (this.greetingText) {
            this.greetingText.textContent = `${greeting}${name ? ', ' + name.split(' ')[0] : ''}!`;
        }

        const pending = this.store.getPendingCount();
        const moti = document.getElementById('motivationalText');
        if (moti) {
            if (pending === 0) {
                moti.innerHTML = "You're all caught up for the day. Great job!";
            } else {
                moti.innerHTML = `Let's crush some goals today. You have <strong class="text-accent">${pending}</strong> tasks waiting for you.`;
            }
        }
    }

    animateValue(obj, start, end, duration, suffix = '') {
        if (!obj || start === end) {
            if (obj) obj.textContent = end + suffix;
            return;
        }
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const current = Math.floor(progress * (end - start) + start);
            obj.textContent = current + suffix;
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                obj.textContent = end + suffix;
            }
        };
        window.requestAnimationFrame(step);
    }

    updateDashboardStats() {
        const total = this.store.tasks.length;
        const pending = this.store.getPendingCount();
        const completed = total - pending;
        
        if (this.statTotal) this.animateValue(this.statTotal, parseInt(this.statTotal.textContent) || 0, total, 500);
        if (this.statPending) this.animateValue(this.statPending, parseInt(this.statPending.textContent) || 0, pending, 500);
        if (this.statCompleted) this.animateValue(this.statCompleted, parseInt(this.statCompleted.textContent) || 0, completed, 500);
        
        // Progress ring logic
        let percentage = 0;
        if (total > 0) {
            percentage = Math.round((completed / total) * 100);
        }
        
        if (this.progressText) {
            const currentProgress = parseInt(this.progressText.textContent) || 0;
            this.animateValue(this.progressText, currentProgress, percentage, 500, '%');
        }
        
        // Circumference of circle is ~131.95 (2 * PI * 21)
        if (this.progressRing) {
            const circumference = 131.95;
            const offset = circumference - (percentage / 100) * circumference;
            this.progressRing.style.strokeDashoffset = offset;
        }
    }

    refresh() {
        // Handle onboarding view
        if (this.store.tasks.length === 0 && this.store.currentFilter === 'all') {
            if (this.dashboardContent) this.dashboardContent.classList.add('hidden');
            if (this.onboardingState) this.onboardingState.classList.remove('hidden');
            if (this.fabAddBtn) this.fabAddBtn.style.display = 'none';
        } else {
            if (this.dashboardContent) this.dashboardContent.classList.remove('hidden');
            if (this.onboardingState) this.onboardingState.classList.add('hidden');
            if (this.fabAddBtn) this.fabAddBtn.style.display = 'grid';
            
            const tasks = this.store.getFilteredAndSortedTasks();
            this.ui.renderTasks(tasks);
            this.updateDashboardStats();
            this.updateGreeting();

            this.renderActivityFeed();
            this.renderUpcomingDeadlines();

            // Enable drag & drop only when viewing all tasks in default sort order
            const canDrag = this.store.currentFilter === 'all' && this.store.currentSort === 'default';
            const items = this.ui.taskList.querySelectorAll('.task-item');
            items.forEach(item => {
                if (canDrag) {
                    item.setAttribute('draggable', 'true');
                    item.classList.add('draggable-item');
                } else {
                    item.removeAttribute('draggable');
                    item.classList.remove('draggable-item');
                }
            });
        }
        
        // Update page title
        const activeNav = document.querySelector('.sidebar-nav .nav-item.active');
        if (activeNav && this.pageTitle) {
            this.pageTitle.textContent = activeNav.textContent.trim();
        }
    }

    renderActivityFeed() {
        const feed = document.getElementById('activityFeed');
        if (!feed) return;
        feed.innerHTML = '';
        
        const acts = this.store.activities.slice(0, 5); // top 5
        if (acts.length === 0) {
            feed.innerHTML = '<p style="color: var(--text-tertiary); font-size: 0.9rem; text-align: center; padding: 1rem 0;">No recent activity</p>';
            return;
        }

        acts.forEach(act => {
            let icon = '';
            let text = '';
            let bgClass = '';
            
            if (act.type === 'add') {
                icon = '<i class="fas fa-plus"></i>';
                text = `Created task "<strong>${this.ui.escapeHTML(act.taskName)}</strong>"`;
                bgClass = 'bg-blue';
            } else if (act.type === 'complete') {
                icon = '<i class="fas fa-check"></i>';
                text = `Completed task "<strong>${this.ui.escapeHTML(act.taskName)}</strong>"`;
                bgClass = 'bg-green';
            } else if (act.type === 'uncomplete') {
                icon = '<i class="fas fa-undo"></i>';
                text = `Unmarked task "<strong>${this.ui.escapeHTML(act.taskName)}</strong>"`;
                bgClass = 'bg-orange';
            } else if (act.type === 'delete') {
                icon = '<i class="fas fa-trash"></i>';
                text = `Deleted task "<strong>${this.ui.escapeHTML(act.taskName)}</strong>"`;
                bgClass = 'bg-orange';
            } else {
                icon = '<i class="fas fa-edit"></i>';
                text = `Edited task "<strong>${this.ui.escapeHTML(act.taskName)}</strong>"`;
                bgClass = 'bg-blue';
            }

            const timeStr = this.timeAgo(new Date(act.time));

            feed.innerHTML += `
                <div class="activity-item">
                    <div class="activity-icon ${bgClass}">${icon}</div>
                    <div class="activity-details">
                        <span class="activity-text">${text}</span>
                        <span class="activity-time">${timeStr}</span>
                    </div>
                </div>
            `;
        });
    }

    timeAgo(date) {
        if (isNaN(date.getTime())) return "Just now";
        const seconds = Math.floor((new Date() - date) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " years ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutes ago";
        return "Just now";
    }

    renderUpcomingDeadlines() {
        const upcomingList = document.getElementById('upcomingList');
        if (!upcomingList) return;
        upcomingList.innerHTML = '';

        const pendingTasks = this.store.tasks.filter(t => !t.completed && t.dueDate);
        // Sort by closest date
        pendingTasks.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        
        const upcoming = pendingTasks.slice(0, 3);
        
        if (upcoming.length === 0) {
            upcomingList.innerHTML = '<p style="color: var(--text-tertiary); font-size: 0.9rem; text-align: center; padding: 1rem 0;">No upcoming deadlines</p>';
            return;
        }

        const fragment = document.createDocumentFragment();
        upcoming.forEach(task => {
            const el = this.ui.createTaskElement(task);
            // hide actions for upcoming list
            const actions = el.querySelector('.task-actions');
            if (actions) actions.style.display = 'none';
            // disable drag
            el.removeAttribute('draggable');
            el.classList.remove('draggable-item');
            // disable checkbox mapping to list click handling
            const chk = el.querySelector('.task-checkbox');
            if (chk) chk.disabled = true;
            fragment.appendChild(el);
        });
        upcomingList.appendChild(fragment);
    }

    bindEvents() {
        // Modals opening
        const openTaskModal = () => {
            if(this.taskInput) this.taskInput.value = '';
            if(this.dueDateInput) this.dueDateInput.value = '';
            if(this.priorityInput) this.priorityInput.value = 'medium';
            this.ui.openModal('taskModal');
            setTimeout(() => { if(this.taskInput) this.taskInput.focus() }, 100);
        };
        
        if (this.fabAddBtn) this.fabAddBtn.addEventListener('click', openTaskModal);
        if (this.emptyAddBtn) this.emptyAddBtn.addEventListener('click', openTaskModal);
        if (this.onboardingAddBtn) this.onboardingAddBtn.addEventListener('click', openTaskModal);
        
        if (this.settingsBtn) {
            this.settingsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.ui.openModal('settingsModal');
            });
        }
        
        if (this.logoutBtn) {
            this.logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                sessionStorage.removeItem('authenticated');
                sessionStorage.removeItem('userEmail');
                window.location.href = 'login.html';
            });
        }

        // Close modals
        document.querySelectorAll('.modal-close, .settings-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal-overlay');
                if (modal) modal.classList.add('hidden');
            });
        });

        // Profile Dropdown logic
        if (this.profileDropdownBtn && this.profileDropdown) {
            this.profileDropdownBtn.addEventListener('click', (e) => {
                this.profileDropdown.classList.toggle('hidden');
                e.stopPropagation();
            });

            document.addEventListener('click', (e) => {
                if (!this.profileDropdownBtn.contains(e.target)) {
                    this.profileDropdown.classList.add('hidden');
                }
            });

            if (this.dropdownSettingsBtn) {
                this.dropdownSettingsBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.profileDropdown.classList.add('hidden');
                    this.ui.openModal('settingsModal');
                });
            }

            if (this.dropdownLogoutBtn) {
                this.dropdownLogoutBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    sessionStorage.removeItem('authenticated');
                    sessionStorage.removeItem('userEmail');
                    window.location.href = 'login.html';
                });
            }
        }

        // Add Task save
        if (this.saveTaskBtn) {
            this.saveTaskBtn.addEventListener('click', () => {
                const text = this.taskInput.value.trim();
                if (!text) return;
                this.store.addTask(text, this.dueDateInput.value, this.priorityInput.value);
                this.ui.closeModal('taskModal');
                this.refresh();
            });
        }
        
        if (this.taskInput) {
            this.taskInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.saveTaskBtn.click();
            });
        }

        // Sidebar Navigation
        if (this.navItems) {
            this.navItems.forEach(btn => {
                if (btn.dataset.filter) {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        document.querySelector('.nav-item.active')?.classList.remove('active');
                        btn.classList.add('active');
                        this.store.setFilter(btn.dataset.filter);
                        this.refresh();
                        
                        // Close sidebar on mobile
                        if (window.innerWidth <= 768 && this.sidebar) {
                            this.sidebar.classList.remove('open');
                        }
                    });
                }
            });
        }

        // Mobile Sidebar Toggle
        if (this.mobileToggleBtn && this.sidebar) {
            this.mobileToggleBtn.addEventListener('click', () => this.sidebar.classList.add('open'));
        }
        if (this.mobileCloseBtn && this.sidebar) {
            this.mobileCloseBtn.addEventListener('click', () => this.sidebar.classList.remove('open'));
        }

        // Sort and Clear
        if (this.sortSelect) {
            this.sortSelect.addEventListener('change', (e) => {
                this.store.setSort(e.target.value);
                this.refresh();
            });
        }

        if (this.clearCompletedBtn) {
            this.clearCompletedBtn.addEventListener('click', () => {
                this.store.clearCompleted();
                this.refresh();
            });
        }

        // Event Delegation for Task List
        if (this.ui.taskList) {
            this.ui.taskList.addEventListener('click', this.handleListClick.bind(this));
            this.ui.taskList.addEventListener('change', this.handleListChange.bind(this));
            this.ui.taskList.addEventListener('keyup', this.handleListKeyup.bind(this));

            // Drag and Drop
            this.ui.taskList.addEventListener('dragstart', this.handleDragStart.bind(this));
            this.ui.taskList.addEventListener('dragover', this.handleDragOver.bind(this));
            this.ui.taskList.addEventListener('dragend', this.handleDragEnd.bind(this));
            this.ui.taskList.addEventListener('drop', this.handleDrop.bind(this));
        }
        
        // Theme
        if (this.headerThemeToggle) {
            this.headerThemeToggle.addEventListener('click', () => this.toggleTheme());
        }
        if (this.settingsThemeToggle) {
            this.settingsThemeToggle.addEventListener('change', (e) => {
                if (e.target.checked !== document.body.classList.contains('dark-theme')) {
                    this.toggleTheme();
                }
            });
        }
    }

    handleListClick(e) {
        const target = e.target;
        const taskItem = target.closest('.task-item');
        if (!taskItem) return;
        
        const id = taskItem.dataset.id;

        if (target.closest('.delete-btn')) {
            this.ui.showDeleteModal(() => {
                this.store.deleteTask(id);
                this.refresh();
            });
        } else if (target.closest('.edit-btn')) {
            this.startEditing(taskItem);
        } else if (target.closest('.save-btn')) {
            this.saveEdit(taskItem, id);
        }
    }

    startEditing(taskItem) {
        taskItem.classList.add('editing');
        const contentWrapper = taskItem.querySelector('.task-content-wrapper');
        const editInput = taskItem.querySelector('.edit-input');
        const editBtn = taskItem.querySelector('.edit-btn');
        const saveBtn = taskItem.querySelector('.save-btn');
        
        if(contentWrapper) contentWrapper.style.display = 'none';
        if(editInput) {
            editInput.style.display = 'block';
            editInput.focus();
            const val = editInput.value;
            editInput.value = '';
            editInput.value = val;
        }
        if(editBtn) editBtn.style.display = 'none';
        if(saveBtn) saveBtn.style.display = 'flex';
    }

    saveEdit(taskItem, id) {
        const editInput = taskItem.querySelector('.edit-input');
        if(editInput) {
            this.store.editTask(id, editInput.value.trim());
            this.refresh();
        }
    }

    handleListChange(e) {
        if (e.target.classList.contains('task-checkbox')) {
            const taskItem = e.target.closest('.task-item');
            if(taskItem) {
                this.store.toggleTask(taskItem.dataset.id);
                this.refresh();
            }
        }
    }

    handleListKeyup(e) {
        if (!e.target.classList.contains('edit-input')) return;

        if (e.key === 'Enter') {
            const taskItem = e.target.closest('.task-item');
            if(taskItem) {
                this.store.editTask(taskItem.dataset.id, e.target.value.trim());
                this.refresh();
            }
        } else if (e.key === 'Escape') {
            this.refresh();
        }
    }

    handleDragStart(e) {
        const taskItem = e.target.closest('.task-item');
        if (!taskItem || taskItem.getAttribute('draggable') !== 'true') {
            e.preventDefault();
            return;
        }
        
        taskItem.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', taskItem.dataset.id);
    }

    handleDragOver(e) {
        e.preventDefault();
        const dragging = this.ui.taskList.querySelector('.dragging');
        if (!dragging) return;
        
        const afterElement = this.getDragAfterElement(this.ui.taskList, e.clientY);
        if (afterElement == null) {
            this.ui.taskList.appendChild(dragging);
        } else {
            this.ui.taskList.insertBefore(dragging, afterElement);
        }
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.task-item:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    handleDragEnd(e) {
        const taskItem = e.target.closest('.task-item');
        if (taskItem) {
            taskItem.classList.remove('dragging');
        }
    }

    handleDrop(e) {
        e.preventDefault();
        const items = [...this.ui.taskList.querySelectorAll('.task-item')];
        const newOrderIds = items.map(item => item.dataset.id);
        this.store.reorderTasksByArray(newOrderIds);
        this.refresh();
    }

    initTheme() {
        const currentTheme = localStorage.getItem('theme');
        const isDark = currentTheme === 'dark';
        if (isDark) {
            document.body.classList.add('dark-theme');
            document.body.classList.remove('light-theme');
            if (this.headerThemeToggle) this.headerThemeToggle.innerHTML = '<i class="fas fa-sun"></i>';
            if (this.settingsThemeToggle) this.settingsThemeToggle.checked = true;
        } else {
            if (this.headerThemeToggle) this.headerThemeToggle.innerHTML = '<i class="fas fa-moon"></i>';
            if (this.settingsThemeToggle) this.settingsThemeToggle.checked = false;
        }
    }

    toggleTheme() {
        const isDark = document.body.classList.toggle('dark-theme');
        document.body.classList.toggle('light-theme', !isDark);
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        
        if (this.headerThemeToggle) this.headerThemeToggle.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        if (this.settingsThemeToggle) this.settingsThemeToggle.checked = isDark;
    }
}

// Initialize application on load
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
