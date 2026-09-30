# 🌸 FocusFlow — Cozy Pomodoro Timer & Aesthetic Task Manager

**FocusFlow** is a modern, cozy, minimalist dark/soft-mode web application inspired by productivity workspaces like LifeAt and Flocus. Built with vanilla HTML5, modern CSS with glassmorphism, and vanilla JavaScript.

---
    
## ✨ Features & Highlights

### 1. ⏱️ Pomodoro Timer Module
- **Modes**: Pomodoro (25 min), Short Break (5 min), Long Break (15 min) with custom duration settings.
- **Circular SVG Progress Ring**: Real-time smooth stroke animation with glowing gradient strokes.
- **Linked Active Task**: Click the target icon on any task to bind it directly to the Pomodoro timer countdown.
- **Accurate Timing**: Drift-free timestamp delta calculation (`Date.now()`).
- **Session Streak Tracker**: Tracks your 4-cycle Pomodoro streak and total minutes focused today.
- **Audio & Celebrations**: Gentle Tibetan Singing Bowl chime synthesized with the **Web Audio API** and celebratory confetti burst when sessions wrap up!

### 2. 📝 Aesthetic To-Do List Module
- **Quick Task Addition**: Category pills (*Work*, *Study*, *Personal*, *Creative*) and priority tags (*High*, *Medium*, *Low*). Press <kbd>Enter</kbd> to add instantly.
- **Completion & Progress Tracking**: Animated checkboxes with smooth strikethrough effects and dynamic completion progress bar.
- **Filter Tabs**: Toggle between *All*, *Active*, and *Completed* tasks with live count badges.
- **Confetti Milestone**: When all tasks for the day are finished, an automated celebratory confetti shower triggers.
- **Local Persistence**: Tasks, timer stats, and configurations are automatically saved in browser `localStorage`.

### 3. 🎨 Aesthetic UI / UX Polish
- **Glassmorphism & Ambient Glow**: Frosted glass panels (`backdrop-filter: blur(24px)`), smooth border accents, and background glow orbs.
- **Dual Themes**: Toggle between **Cozy Charcoal Dark** (`#121318`) and **Warm Sand Light** (`#F6F4EE`) mode.
- **Solo Piano Ambience Player**: Built-in HTML5 player using local high-quality solo piano recordings (`Assets/piano.mp3` & `piano-music.mp3`) with seamless looping, live volume control, and track switching in Settings.
- **Synthesized Tibetan Bell Chime**: Soothing harmonic singing bowl chime on session completion.
- **Live Dynamic Greeting**: Greets you according to the time of day (*morning*, *afternoon*, *evening*, *late night*).

### 4. ⌨️ Keyboard Shortcuts
- <kbd>Space</kbd> — Start / Pause Pomodoro Timer
- <kbd>R</kbd> — Reset current session
- <kbd>S</kbd> — Skip to next session
- <kbd>/</kbd> — Quick focus on task input field
- <kbd>Esc</kbd> — Close settings dialog

---

## 🚀 How to Run Locally

You can run FocusFlow in any web browser:

1. **Directly open the file**:
   Double click [index.html](file:///c:/Users/Fiza_B/Documents/New%20folder/To-Do-List-Pomodoro-App/index.html) in your browser.

2. **Using a local development server**:
   ```bash
   # In terminal:
   python -m http.server 8080
   ```
   Then open [http://localhost:8080](http://localhost:8080) in your web browser.

---

## 📁 File Structure

- [index.html](file:///c:/Users/Fiza_B/Documents/New%20folder/To-Do-List-Pomodoro-App/index.html) — Semantic HTML5 markup, SVG gradients & rings, glassmorphic cards, settings modal.
- [style.css](file:///c:/Users/Fiza_B/Documents/New%20folder/To-Do-List-Pomodoro-App/style.css) — Custom CSS variables, glassmorphic design system, typography, animations, dark/light themes.
- [app.js](file:///c:/Users/Fiza_B/Documents/New%20folder/To-Do-List-Pomodoro-App/app.js) — Web Audio API harmonic chime & rain synthesizer, timer engine, task manager, confetti canvas, and local storage.
