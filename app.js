/**
 * FocusFlow — Aesthetic To-Do List & Pomodoro Timer
 * High quality vanilla JavaScript application.
 */

// ==========================================
// 1. STATE & CONFIGURATION
// ==========================================
const STORAGE_KEYS = {
  TASKS: 'focusflow_tasks',
  SETTINGS: 'focusflow_settings',
  THEME: 'focusflow_theme',
  STATS: 'focusflow_stats',
  SOUND_ENABLED: 'focusflow_sound_enabled',
  PIANO_VOLUME: 'focusflow_piano_volume',
  PIANO_TRACK: 'focusflow_piano_track',
};

const DEFAULT_SETTINGS = {
  pomodoro: 25,
  shortBreak: 5,
  longBreak: 15,
  autoStartBreaks: false,
  autoStartPomodoros: false,
  pianoTrack: 'Assets/piano.mp3',
  pianoVolume: 0.5,
};

let settings = { ...DEFAULT_SETTINGS };
let tasks = [];
let activeFilter = 'all';
let soundEnabled = true;
let isAmbientPlaying = false;

// Timer State
let timerMode = 'pomodoro'; // 'pomodoro' | 'shortBreak' | 'longBreak'
let isRunning = false;
let timeRemaining = 25 * 60;
let totalDuration = 25 * 60;
let timerInterval = null;
let lastTickTimestamp = null;
let sessionsCompleted = 0;
let totalFocusMinutes = 0;
let activeFocusedTaskId = null;

// SVG Ring Circumference (r = 138)
const RING_RADIUS = 138;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ~867.08

// ==========================================
// 2. AUDIO SYNTHESIS ENGINE (Web Audio API)
// ==========================================
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.ambientSource = null;
    this.ambientGain = null;
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Meditative Tibetan Singing Bowl / Crystalline Bell Chime
  playBellChime() {
    if (!soundEnabled) return;
    try {
      this.initContext();
      const now = this.ctx.currentTime;
      // Frequencies for a rich, warm meditative bell (F# / 528Hz Solfeggio harmonic)
      const freqs = [528, 1056, 1584, 2112];
      const gains = [0.4, 0.22, 0.12, 0.05];

      freqs.forEach((freq, index) => {
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(gains[index], now + 0.04);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 3.2 - index * 0.4);

        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 3.5);
      });
    } catch (err) {
      console.warn('Audio playback error:', err);
    }
  }

  // Subtle pleasant click/pop for UI actions
  playTick() {
    if (!soundEnabled) return;
    try {
      this.initContext();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {
      // Ignore
    }
  }

  // Synthesized Cozy Rain & Soft White Noise (Runs completely offline!)
  toggleAmbientRain() {
    this.initContext();
    if (isAmbientPlaying) {
      this.stopAmbientRain();
      return false;
    } else {
      this.startAmbientRain();
      return true;
    }
  }

  startAmbientRain() {
    try {
      this.initContext();
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // Generate pink noise approximation (natural rainfall sound)
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }

      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = buffer;
      noiseSource.loop = true;

      // Lowpass filter to simulate gentle rain through window
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, this.ctx.currentTime);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.ambientGain.gain.linearRampToValueAtTime(0.18, this.ctx.currentTime + 1.5);

      noiseSource.connect(filter);
      filter.connect(this.ambientGain);
      this.ambientGain.connect(this.ctx.destination);

      noiseSource.start(0);
      this.ambientSource = noiseSource;
      isAmbientPlaying = true;
    } catch (e) {
      console.warn('Ambient sound error:', e);
      isAmbientPlaying = false;
    }
  }

  stopAmbientRain() {
    if (this.ambientGain && this.ctx) {
      try {
        this.ambientGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);
        setTimeout(() => {
          if (this.ambientSource) {
            try { this.ambientSource.stop(); } catch(e) {}
            this.ambientSource = null;
          }
          isAmbientPlaying = false;
        }, 900);
      } catch (e) {
        if (this.ambientSource) {
          try { this.ambientSource.stop(); } catch(err) {}
          this.ambientSource = null;
        }
        isAmbientPlaying = false;
      }
    } else {
      isAmbientPlaying = false;
    }
  }
}

const audio = new SoundEngine();

// ==========================================
// 3. CONFETTI SYSTEM (HTML5 Canvas)
// ==========================================
class ConfettiSystem {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.animationId = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  burst(count = 70) {
    const colors = ['#C084FC', '#818CF8', '#34D399', '#F472B6', '#FBBF24', '#60A5FA'];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: this.canvas.width / 2 + (Math.random() - 0.5) * 300,
        y: this.canvas.height / 3 + (Math.random() - 0.5) * 100,
        vx: (Math.random() - 0.5) * 12,
        vy: -Math.random() * 10 - 4,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10,
        alpha: 1,
        decay: Math.random() * 0.015 + 0.01,
      });
    }

    if (!this.animationId) {
      this.animate();
    }
  }

  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // gravity
      p.vx *= 0.99; // drag
      p.rotation += p.rotSpeed;
      p.alpha -= p.decay;

      if (p.alpha <= 0 || p.y > this.canvas.height) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      this.ctx.restore();
    }

    if (this.particles.length > 0) {
      this.animationId = requestAnimationFrame(() => this.animate());
    } else {
      this.animationId = null;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
}

const confetti = new ConfettiSystem('confetti-canvas');

// ==========================================
// 4. TOAST NOTIFICATIONS
// ==========================================
function showToast(message, icon = '✨') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span style="font-size: 1.1rem">${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 3200);
}

// ==========================================
// 5. STORAGE HELPERS
// ==========================================
function loadStorage() {
  // Load Theme
  const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  // Load Settings
  const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  if (savedSettings) {
    try {
      settings = { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
    } catch (e) {
      settings = { ...DEFAULT_SETTINGS };
    }
  }

  // Load Sound Setting
  const savedSound = localStorage.getItem(STORAGE_KEYS.SOUND_ENABLED);
  if (savedSound !== null) {
    soundEnabled = savedSound === 'true';
  }
  updateSoundIcon();

  // Load Stats
  const savedStats = localStorage.getItem(STORAGE_KEYS.STATS);
  if (savedStats) {
    try {
      const stats = JSON.parse(savedStats);
      sessionsCompleted = stats.sessionsCompleted || 0;
      totalFocusMinutes = stats.totalFocusMinutes || 0;
    } catch (e) {}
  }

  // Load Tasks
  const savedTasks = localStorage.getItem(STORAGE_KEYS.TASKS);
  if (savedTasks) {
    try {
      tasks = JSON.parse(savedTasks);
    } catch (e) {
      tasks = [];
    }
  } else {
    // Cozy default starter tasks
    tasks = [
      {
        id: 't-1',
        title: 'Design high-converting landing section 🎨',
        category: 'Creative',
        priority: 'high',
        completed: false,
        pomodoroCount: 1,
        createdAt: Date.now() - 3600000,
      },
      {
        id: 't-2',
        title: 'Review chapter 4 of deep work guide 📚',
        category: 'Study',
        priority: 'medium',
        completed: false,
        pomodoroCount: 0,
        createdAt: Date.now() - 1800000,
      },
      {
        id: 't-3',
        title: 'Afternoon hydration & mindful walk 🌿',
        category: 'Personal',
        priority: 'low',
        completed: true,
        pomodoroCount: 1,
        createdAt: Date.now() - 7200000,
      },
    ];
    saveTasks();
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

function saveStats() {
  localStorage.setItem(
    STORAGE_KEYS.STATS,
    JSON.stringify({ sessionsCompleted, totalFocusMinutes })
  );
}

// ==========================================
// 6. POMODORO TIMER LOGIC
// ==========================================
const timerDisplay = document.getElementById('time-display');
const timerProgress = document.getElementById('timer-progress');
const currentModeLabel = document.getElementById('current-mode-label');
const playPauseBtn = document.getElementById('play-pause-btn');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');
const playPauseText = document.getElementById('play-pause-text');
const resetBtn = document.getElementById('reset-btn');
const skipBtn = document.getElementById('skip-btn');
const modeTabs = document.querySelectorAll('.mode-tab');
const activeTaskPill = document.getElementById('active-task-pill');
const activeTaskText = document.getElementById('active-task-text');

function getDurationForMode(mode) {
  switch (mode) {
    case 'pomodoro':
      return settings.pomodoro * 60;
    case 'shortBreak':
      return settings.shortBreak * 60;
    case 'longBreak':
      return settings.longBreak * 60;
    default:
      return 25 * 60;
  }
}

function getModeTitle(mode) {
  switch (mode) {
    case 'pomodoro':
      return 'Deep Focus';
    case 'shortBreak':
      return 'Short Break';
    case 'longBreak':
      return 'Long Break';
    default:
      return 'Focus Session';
  }
}

function switchMode(newMode, autoStart = false) {
  pauseTimer();
  timerMode = newMode;
  totalDuration = getDurationForMode(newMode);
  timeRemaining = totalDuration;

  // Update tabs
  modeTabs.forEach((tab) => {
    const isSelected = tab.dataset.mode === newMode;
    tab.classList.toggle('active', isSelected);
    tab.setAttribute('aria-selected', isSelected.toString());
  });

  // Update SVG Ring class
  timerProgress.className = `progress-ring-fill mode-${newMode}`;

  // Update labels
  currentModeLabel.textContent = getModeTitle(newMode);

  updateDisplay();
  updateProgressRing();

  if (autoStart) {
    startTimer();
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function updateDisplay() {
  const formatted = formatTime(timeRemaining);
  timerDisplay.textContent = formatted;
  document.title = `(${formatted}) ${getModeTitle(timerMode)} — FocusFlow`;
}

function updateProgressRing() {
  if (totalDuration <= 0) return;
  const progressRatio = timeRemaining / totalDuration;
  // Dash offset: 0 is completely filled, RING_CIRCUMFERENCE is completely empty
  const offset = RING_CIRCUMFERENCE * (1 - progressRatio);
  timerProgress.style.strokeDashoffset = offset;
}

function startTimer() {
  if (isRunning) return;
  audio.initContext();
  audio.playTick();

  isRunning = true;
  lastTickTimestamp = Date.now();

  playIcon.classList.add('hidden');
  pauseIcon.classList.remove('hidden');
  playPauseText.textContent = 'Pause';
  document.querySelector('.timer-circle-wrapper').classList.add('timer-running');

  timerInterval = setInterval(() => {
    const now = Date.now();
    const deltaSeconds = (now - lastTickTimestamp) / 1000;
    lastTickTimestamp = now;

    timeRemaining -= deltaSeconds;

    if (timeRemaining <= 0) {
      timeRemaining = 0;
      updateDisplay();
      updateProgressRing();
      handleSessionComplete();
    } else {
      updateDisplay();
      updateProgressRing();
    }
  }, 250);
}

function pauseTimer() {
  if (!isRunning) return;
  isRunning = false;
  clearInterval(timerInterval);
  timerInterval = null;

  playIcon.classList.remove('hidden');
  pauseIcon.classList.add('hidden');
  playPauseText.textContent = timerMode === 'pomodoro' ? 'Start Focus' : 'Start Break';
  document.querySelector('.timer-circle-wrapper').classList.remove('timer-running');
}

function resetTimer() {
  pauseTimer();
  audio.playTick();
  timeRemaining = totalDuration;
  updateDisplay();
  updateProgressRing();
  showToast('Timer reset', '🔄');
}

function skipTimer() {
  pauseTimer();
  audio.playTick();
  advanceToNextSession(false);
}

function handleSessionComplete() {
  pauseTimer();
  audio.playBellChime();
  confetti.burst(80);

  if (timerMode === 'pomodoro') {
    sessionsCompleted++;
    totalFocusMinutes += settings.pomodoro;
    saveStats();
    updateStatsUI();

    // Increment active task pomodoro tally if selected
    if (activeFocusedTaskId) {
      const task = tasks.find((t) => t.id === activeFocusedTaskId);
      if (task) {
        task.pomodoroCount = (task.pomodoroCount || 0) + 1;
        saveTasks();
        renderTasks();
      }
    }

    showToast('Pomodoro session completed! Time for a breath 🌿', '✨');

    // Determine next break: Long break every 4 sessions
    const nextMode = sessionsCompleted % 4 === 0 ? 'longBreak' : 'shortBreak';
    switchMode(nextMode, settings.autoStartBreaks);
  } else {
    // Break finished
    showToast('Break is over! Ready to return to flow?', '💪');
    switchMode('pomodoro', settings.autoStartPomodoros);
  }
}

function advanceToNextSession(byUser = false) {
  if (timerMode === 'pomodoro') {
    const nextMode = (sessionsCompleted + 1) % 4 === 0 ? 'longBreak' : 'shortBreak';
    switchMode(nextMode, false);
    if (byUser) showToast('Skipped to break session', '⏭️');
  } else {
    switchMode('pomodoro', false);
    if (byUser) showToast('Skipped to focus session', '⏭️');
  }
}

function updateStatsUI() {
  const ratioText = document.getElementById('pomo-streak-text');
  const streakCount = sessionsCompleted % 4;
  ratioText.textContent = `${streakCount} / 4 Sessions`;

  const dots = document.querySelectorAll('.pomo-dot');
  dots.forEach((dot, index) => {
    dot.classList.toggle('completed', index < streakCount);
  });

  const totalMinsElem = document.getElementById('total-focus-mins');
  if (totalMinsElem) {
    totalMinsElem.textContent = totalFocusMinutes;
  }
}

function updateBadgeDurations() {
  document.getElementById('badge-pomodoro').textContent = `${settings.pomodoro}m`;
  document.getElementById('badge-shortBreak').textContent = `${settings.shortBreak}m`;
  document.getElementById('badge-longBreak').textContent = `${settings.longBreak}m`;
}

// Active Task Focus Selection
function setActiveFocusTask(taskId) {
  if (activeFocusedTaskId === taskId) {
    // Unselect
    activeFocusedTaskId = null;
    activeTaskPill.classList.remove('has-task');
    activeTaskText.textContent = 'Select a task to focus on';
    showToast('Unlinked task from timer', '🎯');
  } else {
    activeFocusedTaskId = taskId;
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      activeTaskPill.classList.add('has-task');
      activeTaskText.textContent = task.title;
      showToast(`Now focusing on: "${task.title}"`, '🎯');
    }
  }
  renderTasks();
}

// ==========================================
// 7. TO-DO LIST MANAGEMENT
// ==========================================
const taskForm = document.getElementById('task-form');
const taskInput = document.getElementById('task-input');
const taskPriority = document.getElementById('task-priority');
const taskList = document.getElementById('task-list');
const emptyState = document.getElementById('empty-state');
const filterButtons = document.querySelectorAll('.filter-pill');
const clearCompletedBtn = document.getElementById('clear-completed-btn');

function renderTasks() {
  taskList.innerHTML = '';

  const filteredTasks = tasks.filter((task) => {
    if (activeFilter === 'active') return !task.completed;
    if (activeFilter === 'completed') return task.completed;
    return true;
  });

  if (filteredTasks.length === 0) {
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
  }

  filteredTasks.forEach((task) => {
    const li = document.createElement('li');
    li.className = `task-item ${task.completed ? 'completed' : ''} ${
      activeFocusedTaskId === task.id ? 'is-focus-active' : ''
    }`;
    li.setAttribute('data-id', task.id);

    const isCurrentActive = activeFocusedTaskId === task.id;

    li.innerHTML = `
      <div class="task-left-section">
        <button class="custom-checkbox-btn" aria-label="Toggle task completed" title="${
          task.completed ? 'Mark uncompleted' : 'Mark completed'
        }">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </button>

        <div class="task-info-group">
          <span class="task-text">${escapeHtml(task.title)}</span>
          <div class="task-tags-row">
            <span class="task-category-tag pill-${task.category.toLowerCase()}">${getCategoryIcon(
      task.category
    )} ${escapeHtml(task.category)}</span>
            <span class="task-priority-tag priority-${task.priority}">${task.priority}</span>
            ${
              task.pomodoroCount > 0
                ? `<span class="task-pomo-tally" title="${task.pomodoroCount} focus sessions completed">🍅 ${task.pomodoroCount}</span>`
                : ''
            }
          </div>
        </div>
      </div>

      <div class="task-actions-group">
        <button class="btn-task-action btn-focus-task ${isCurrentActive ? 'active' : ''}" 
                title="${isCurrentActive ? 'Currently active focus' : 'Focus on this task'}" 
                aria-label="Set as active focus task">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="${
            isCurrentActive ? 'currentColor' : 'none'
          }" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="12" r="6"></circle>
            <circle cx="12" cy="12" r="2"></circle>
          </svg>
        </button>
        <button class="btn-task-action btn-delete-task" title="Delete task" aria-label="Delete task">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;

    // Event listeners
    const checkbox = li.querySelector('.custom-checkbox-btn');
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTaskCompletion(task.id);
    });

    const focusBtn = li.querySelector('.btn-focus-task');
    focusBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setActiveFocusTask(task.id);
    });

    const deleteBtn = li.querySelector('.btn-delete-task');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteTask(task.id);
    });

    taskList.appendChild(li);
  });

  updateTaskCountsAndProgress();
}

function getCategoryIcon(cat) {
  switch (cat) {
    case 'Work': return '💼';
    case 'Study': return '📚';
    case 'Personal': return '🌱';
    case 'Creative': return '🎨';
    default: return '📌';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function addTask(title, category, priority) {
  if (!title.trim()) return;

  const newTask = {
    id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    title: title.trim(),
    category: category || 'Work',
    priority: priority || 'medium',
    completed: false,
    pomodoroCount: 0,
    createdAt: Date.now(),
  };

  tasks.unshift(newTask);
  saveTasks();
  renderTasks();
  audio.playTick();
  showToast('Task added to list', '✨');
}

function toggleTaskCompletion(taskId) {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;

  task.completed = !task.completed;
  saveTasks();
  audio.playTick();

  // If completed, trigger subtle check
  if (task.completed) {
    showToast(`Completed "${task.title}"`, '🎉');
    // Check if ALL tasks are completed!
    const remainingActive = tasks.filter((t) => !t.completed).length;
    if (remainingActive === 0 && tasks.length > 0) {
      confetti.burst(90);
      showToast('Amazing! All tasks completed today! 🌟', '🏆');
    }
  }

  renderTasks();
}

function deleteTask(taskId) {
  const taskIndex = tasks.findIndex((t) => t.id === taskId);
  if (taskIndex === -1) return;

  const removedTitle = tasks[taskIndex].title;
  tasks.splice(taskIndex, 1);

  if (activeFocusedTaskId === taskId) {
    activeFocusedTaskId = null;
    activeTaskPill.classList.remove('has-task');
    activeTaskText.textContent = 'Select a task to focus on';
  }

  saveTasks();
  renderTasks();
  showToast(`Deleted "${removedTitle}"`, '🗑️');
}

function updateTaskCountsAndProgress() {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  const active = total - completed;

  // Filter count pills
  document.getElementById('count-all').textContent = total;
  document.getElementById('count-active').textContent = active;
  document.getElementById('count-completed').textContent = completed;

  // Summary badge & bar
  document.getElementById('tasks-count-badge').textContent = `${completed} / ${total} Done`;

  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  document.getElementById('task-progress-bar').style.width = `${percent}%`;
}

// ==========================================
// 8. SETTINGS MODAL LOGIC
// ==========================================
const settingsModal = document.getElementById('settings-modal');
const settingsBtn = document.getElementById('settings-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const resetSettingsDefaultsBtn = document.getElementById('reset-settings-defaults');
const testChimeBtn = document.getElementById('test-chime-btn');

function openSettingsModal() {
  document.getElementById('setting-pomodoro').value = settings.pomodoro;
  document.getElementById('setting-short-break').value = settings.shortBreak;
  document.getElementById('setting-long-break').value = settings.longBreak;
  document.getElementById('setting-auto-breaks').checked = settings.autoStartBreaks;
  document.getElementById('setting-auto-pomodoros').checked = settings.autoStartPomodoros;

  if (pianoTrackSelect) {
    const curTrack = localStorage.getItem(STORAGE_KEYS.PIANO_TRACK) || settings.pianoTrack || 'Assets/piano.mp3';
    pianoTrackSelect.value = curTrack;
  }
  if (pianoVolumeSlider) {
    const curVol = parseFloat(localStorage.getItem(STORAGE_KEYS.PIANO_VOLUME) ?? settings.pianoVolume ?? 0.5);
    pianoVolumeSlider.value = curVol;
    if (pianoVolDisplay) pianoVolDisplay.textContent = `${Math.round(curVol * 100)}%`;
  }

  settingsModal.classList.remove('hidden');
}

function closeSettingsModal() {
  settingsModal.classList.add('hidden');
}

function applySettings() {
  const pVal = parseInt(document.getElementById('setting-pomodoro').value, 10);
  const sVal = parseInt(document.getElementById('setting-short-break').value, 10);
  const lVal = parseInt(document.getElementById('setting-long-break').value, 10);

  settings.pomodoro = Math.max(1, Math.min(90, isNaN(pVal) ? 25 : pVal));
  settings.shortBreak = Math.max(1, Math.min(30, isNaN(sVal) ? 5 : sVal));
  settings.longBreak = Math.max(1, Math.min(60, isNaN(lVal) ? 15 : lVal));
  settings.autoStartBreaks = document.getElementById('setting-auto-breaks').checked;
  settings.autoStartPomodoros = document.getElementById('setting-auto-pomodoros').checked;

  if (pianoTrackSelect) {
    const newTrack = pianoTrackSelect.value;
    settings.pianoTrack = newTrack;
    localStorage.setItem(STORAGE_KEYS.PIANO_TRACK, newTrack);
    if (pianoAudio) {
      const wasPlaying = !pianoAudio.paused;
      if (pianoAudio.getAttribute('src') !== newTrack) {
        pianoAudio.src = newTrack;
        pianoAudio.load();
        if (wasPlaying) pianoAudio.play().catch(() => {});
      }
    }
  }
  if (pianoVolumeSlider) {
    const newVol = parseFloat(pianoVolumeSlider.value);
    settings.pianoVolume = newVol;
    localStorage.setItem(STORAGE_KEYS.PIANO_VOLUME, newVol.toString());
    if (pianoAudio) pianoAudio.volume = newVol;
  }

  saveSettings();
  updateBadgeDurations();

  // If timer is not running, adjust current duration
  if (!isRunning) {
    totalDuration = getDurationForMode(timerMode);
    timeRemaining = totalDuration;
    updateDisplay();
    updateProgressRing();
  }

  closeSettingsModal();
  showToast('Settings saved successfully', '⚙️');
}

// ==========================================
// 9. THEME & SOLO PIANO AMBIENCE CONTROLS
// ==========================================
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const soundToggleBtn = document.getElementById('sound-toggle-btn');
const soundIconOn = document.getElementById('sound-icon-on');
const soundIconOff = document.getElementById('sound-icon-off');
const ambientAudioBtn = document.getElementById('ambient-audio-btn');
const ambientBtnLabel = document.getElementById('ambient-btn-label');
const pianoAudio = document.getElementById('piano-audio');
const pianoTrackSelect = document.getElementById('piano-track-select');
const pianoVolumeSlider = document.getElementById('piano-volume-slider');
const pianoVolDisplay = document.getElementById('piano-vol-display');

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const target = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', target);
  localStorage.setItem(STORAGE_KEYS.THEME, target);
  audio.playTick();
  showToast(`Switched to ${target === 'dark' ? 'Cozy Dark' : 'Warm Soft Light'} mode`, target === 'dark' ? '🌙' : '☀️');
}

function updateSoundIcon() {
  if (soundEnabled) {
    soundIconOn.classList.remove('hidden');
    soundIconOff.classList.add('hidden');
  } else {
    soundIconOn.classList.add('hidden');
    soundIconOff.classList.remove('hidden');
  }
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, soundEnabled.toString());
  updateSoundIcon();
  if (soundEnabled) {
    audio.playTick();
    showToast('Sound effects enabled', '🔔');
  } else {
    showToast('Sound effects muted', '🔇');
  }
}

// Initialize Piano Audio player with saved track and volume
function initPianoAudio() {
  const savedTrack = localStorage.getItem(STORAGE_KEYS.PIANO_TRACK) || settings.pianoTrack || 'Assets/piano.mp3';
  const savedVol = parseFloat(localStorage.getItem(STORAGE_KEYS.PIANO_VOLUME) ?? settings.pianoVolume ?? 0.5);

  if (pianoAudio) {
    pianoAudio.volume = savedVol;
    // Set source directly to local audio file
    if (!pianoAudio.getAttribute('src') || pianoAudio.getAttribute('src') !== savedTrack) {
      pianoAudio.src = savedTrack;
    }
    pianoAudio.load();
  }

  if (pianoTrackSelect) pianoTrackSelect.value = savedTrack;
  if (pianoVolumeSlider) pianoVolumeSlider.value = savedVol;
  if (pianoVolDisplay) pianoVolDisplay.textContent = `${Math.round(savedVol * 100)}%`;
}

// Toggle Solo Piano Ambience playback
function togglePianoMusic() {
  if (!pianoAudio) return;

  if (pianoAudio.paused) {
    const playPromise = pianoAudio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          ambientAudioBtn.classList.add('active');
          if (ambientBtnLabel) ambientBtnLabel.textContent = 'Playing Piano 🎹';
          showToast('Solo Piano Ambience playing 🎹', '🎶');
        })
        .catch((err) => {
          console.warn('Audio playback error:', err);
          showToast('Click anywhere on the page to start audio', '⚠️');
        });
    }
  } else {
    pianoAudio.pause();
    ambientAudioBtn.classList.remove('active');
    if (ambientBtnLabel) ambientBtnLabel.textContent = 'Solo Piano Ambience';
    showToast('Solo Piano Ambience paused', '⏹️');
  }
}

// ==========================================
// 10. DATE & GREETING DISPLAY
// ==========================================
function updateDateAndGreeting() {
  const dateElem = document.getElementById('current-date');
  const greetingElem = document.getElementById('cozy-greeting');

  const now = new Date();
  const options = { weekday: 'short', month: 'short', day: 'numeric' };
  dateElem.textContent = now.toLocaleDateString(undefined, options);

  const hour = now.getHours();
  let greeting = 'Crafting a mindful day ✨';
  if (hour >= 5 && hour < 12) {
    greeting = 'Good morning, peaceful focus ☕';
  } else if (hour >= 12 && hour < 17) {
    greeting = 'Good afternoon, enter flow state 🌿';
  } else if (hour >= 17 && hour < 22) {
    greeting = 'Good evening, cozy wrap-up 🌙';
  } else {
    greeting = 'Late night quiet focus 🌌';
  }
  greetingElem.textContent = greeting;
}

// ==========================================
// 11. EVENT LISTENERS INITIALIZATION
// ==========================================
function setupEventListeners() {
  // Timer buttons
  playPauseBtn.addEventListener('click', () => {
    if (isRunning) pauseTimer();
    else startTimer();
  });

  resetBtn.addEventListener('click', resetTimer);
  skipBtn.addEventListener('click', skipTimer);

  // Timer Mode Tabs
  modeTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const mode = tab.dataset.mode;
      if (mode !== timerMode) {
        audio.playTick();
        switchMode(mode, false);
      }
    });
  });

  // Task Form Submit
  taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = taskInput.value;
    const catInput = document.querySelector('input[name="task-category"]:checked');
    const category = catInput ? catInput.value : 'Work';
    const priority = taskPriority.value;

    addTask(title, category, priority);
    taskInput.value = '';
    taskInput.focus();
  });

  // Filter Pills
  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterButtons.forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      activeFilter = btn.dataset.filter;
      audio.playTick();
      renderTasks();
    });
  });

  // Clear completed
  clearCompletedBtn.addEventListener('click', () => {
    const completedCount = tasks.filter((t) => t.completed).length;
    if (completedCount === 0) {
      showToast('No completed tasks to clear', 'ℹ️');
      return;
    }
    tasks = tasks.filter((t) => !t.completed);
    saveTasks();
    renderTasks();
    audio.playTick();
    showToast(`Cleared ${completedCount} completed task${completedCount > 1 ? 's' : ''}`, '🧹');
  });

  // Theme & Sound & Ambient Toggles
  themeToggleBtn.addEventListener('click', toggleTheme);
  soundToggleBtn.addEventListener('click', toggleSound);
  ambientAudioBtn.addEventListener('click', togglePianoMusic);

  // Live Piano Volume & Track listeners
  if (pianoVolumeSlider) {
    pianoVolumeSlider.addEventListener('input', (e) => {
      const vol = parseFloat(e.target.value);
      if (pianoAudio) pianoAudio.volume = vol;
      if (pianoVolDisplay) pianoVolDisplay.textContent = `${Math.round(vol * 100)}%`;
      localStorage.setItem(STORAGE_KEYS.PIANO_VOLUME, vol.toString());
    });
  }

  if (pianoTrackSelect) {
    pianoTrackSelect.addEventListener('change', (e) => {
      const newTrack = e.target.value;
      const wasPlaying = pianoAudio && !pianoAudio.paused;
      if (pianoAudio) {
        pianoAudio.src = newTrack;
        pianoAudio.load();
        if (wasPlaying) pianoAudio.play().catch(() => {});
      }
      localStorage.setItem(STORAGE_KEYS.PIANO_TRACK, newTrack);
      showToast('Piano track updated', '🎹');
    });
  }

  // Settings Modal Events
  settingsBtn.addEventListener('click', openSettingsModal);
  closeSettingsBtn.addEventListener('click', closeSettingsModal);
  saveSettingsBtn.addEventListener('click', applySettings);

  resetSettingsDefaultsBtn.addEventListener('click', () => {
    document.getElementById('setting-pomodoro').value = DEFAULT_SETTINGS.pomodoro;
    document.getElementById('setting-short-break').value = DEFAULT_SETTINGS.shortBreak;
    document.getElementById('setting-long-break').value = DEFAULT_SETTINGS.longBreak;
    document.getElementById('setting-auto-breaks').checked = DEFAULT_SETTINGS.autoStartBreaks;
    document.getElementById('setting-auto-pomodoros').checked = DEFAULT_SETTINGS.autoStartPomodoros;
    if (pianoTrackSelect) pianoTrackSelect.value = DEFAULT_SETTINGS.pianoTrack;
    if (pianoVolumeSlider) pianoVolumeSlider.value = DEFAULT_SETTINGS.pianoVolume;
    if (pianoVolDisplay) pianoVolDisplay.textContent = `${Math.round(DEFAULT_SETTINGS.pianoVolume * 100)}%`;
    audio.playTick();
    showToast('Defaults restored (Click save to apply)', '🔄');
  });

  testChimeBtn.addEventListener('click', () => {
    audio.playBellChime();
    showToast('Testing Tibetan singing bowl chime 🔔');
  });

  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      closeSettingsModal();
    }
  });

  // Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    // If typing in an input or select, skip shortcut
    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT' || activeEl.tagName === 'TEXTAREA');

    if (e.key === 'Escape') {
      if (!settingsModal.classList.contains('hidden')) {
        closeSettingsModal();
      }
      return;
    }

    if (isTyping) return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (isRunning) pauseTimer();
      else startTimer();
    } else if (e.key.toLowerCase() === 'r') {
      e.preventDefault();
      resetTimer();
    } else if (e.key.toLowerCase() === 's') {
      e.preventDefault();
      skipTimer();
    } else if (e.key === '/') {
      e.preventDefault();
      taskInput.focus();
    }
  });
}

// ==========================================
// 12. APP INITIALIZATION
// ==========================================
function initApp() {
  loadStorage();
  initPianoAudio();
  updateBadgeDurations();
  updateDateAndGreeting();
  updateStatsUI();

  // Set initial timer values
  totalDuration = getDurationForMode(timerMode);
  timeRemaining = totalDuration;
  updateDisplay();
  updateProgressRing();

  // Render initial tasks
  renderTasks();

  // Attach handlers
  setupEventListeners();

  // Refresh greeting every 10 minutes
  setInterval(updateDateAndGreeting, 600000);
}

// Bootstrap once DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
