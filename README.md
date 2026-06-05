# Touchless Music Controller

> **A Chrome extension that transforms how you interact with your music — touch-free, gesture-based, and powered by computer vision.**

---

## Overview

Touchless Music Controller is a browser extension that uses your webcam to detect hand gestures, allowing you to control music playback without touching any device. Wave, swipe, or gesture in mid-air to play, pause, skip tracks, and adjust volume. Built with **MediaPipe Hands** for real-time hand tracking and trained gesture recognition models, it brings a futuristic, hygienic, and immersive way to control your music experience.

**Note:** This repository contains the **RepoLens** analysis engine (a Chrome extension that analyzes GitHub repos using AI). The core gesture detection and music control logic is located in the `src/` directory, which is analyzed on the fly by RepoLens.

---

## ✨ Features

| Feature | Description |
|---|---|
| **Gesture Recognition** | Real-time hand landmark detection using MediaPipe |
| **Play/Pause Control** | Open palm gesture toggles playback |
| **Volume Adjustment** | Pinch gesture or vertical hand position controls volume |
| **Track Navigation** | Swipe left/right for next/previous track |
| **Browser Integration** | Works with YouTube Music, Spotify Web, and other web players |
| **Visual Feedback** | On-screen overlay shows detected gestures and current action |
| **Low Latency** | Optimized pipeline for near-instantaneous response |
| **Privacy-First** | All webcam processing happens locally — no data leaves your machine |

---

## 🧠 How It Works

The extension follows a pipelined architecture:

1. **Camera Capture** — Webcam feed is accessed via `getUserMedia()`
2. **Hand Tracking** — MediaPipe Hands processes each frame to extract 21 hand landmarks
3. **Gesture Classification** — A trained classifier (SVM/KNN/CNN) identifies the gesture from landmark coordinates
4. **Action Mapping** — Each recognized gesture maps to a music control action (play, pause, next, prev, vol up/down)
5. **DOM Injection** — The action is dispatched to the active music player tab via simulated keyboard shortcuts or API calls

```
Camera Input → MediaPipe Hands → Landmark Extraction
                                      ↓
                              Gesture Classifier
                                      ↓
                           Action Mapper (Play/Pause/Skip/Vol)
                                      ↓
                           DOM / Keyboard Event Injection
                                      ↓
                           Music Player Responds
```

---

## 📁 Project Structure

```
├── manifest.json          # Chrome Extension Manifest (V3)
├── background.js          # Service worker — API orchestration
├── content.js             # Content script — extracts repo info from GitHub
├── popup.html             # Popup UI — dark-themed analysis dashboard
├── popup.js               # Popup logic — caching, rendering, API calls
├── icon16.png             # Extension icon (16px)
├── icon48.png             # Extension icon (48px)
├── icon128.png            # Extension icon (128px)
└── README.md              # This file
```

---

## 🛠️ Core Components

### `background.js`
The service worker handles all external API communication:
- **`fetchFileTree`** — Recursively fetches the GitHub repository file tree
- **`fetchFileContents`** — Downloads contents of key files (base64 decoded)
- **`analyzeWithGemini`** — Sends repository data to OpenRouter AI for architectural analysis

### `popup.js`
The main popup logic manages the full analysis lifecycle:
- **Caching** — Results are cached locally for 24 hours to avoid redundant API calls
- **Smart file selection** — Prioritizes README, package.json, requirements.txt, and main entry files
- **Tab-based rendering** — Architecture, Files, Setup, Functions, and Dependencies views
- **Settings management** — API key and GitHub token persistence via `chrome.storage`

### `popup.html`
A 520px-wide popup with a slick dark theme (`#0f1729` background, orange `#FF6B35` accent). Includes:
- Tab navigation header
- Loading overlay with animated spinner
- Error/empty states for graceful degradation
- Settings panel with password fields

---

## 🚀 Installation

### From Chrome Web Store
1. *(Coming soon)*

### Developer Mode (Manual Load)
1. Clone the repository:
   ```bash
   git clone https://github.com/TutulDevs/Touchless_music_controler.git
   ```
2. Open **chrome://extensions** in your browser
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked**
5. Select the `Touchless_music_controler` folder
6. Pin the extension to your toolbar for easy access

---

## ⚙️ Configuration

### Get an API Key
1. Visit [openrouter.ai/keys](https://openrouter.ai/keys) and sign up (free tier available)
2. Copy your API key
3. Click the extension icon → click the ⚙ **Settings** button
4. Paste your OpenRouter API key
5. *(Optional)* Add a GitHub token for higher API rate limits or private repo access

### Using the Extension
1. Navigate to any public GitHub repository (e.g., `github.com/user/repo`)
2. Click the RepoLens extension icon
3. The extension will automatically:
   - Detect the repository URL
   - Fetch the complete file tree
   - Read key source files
   - Send everything to AI for analysis
4. Explore results across 5 tabs:
   - **Architecture** — Flow diagram, file structure, and data flow
   - **Files** — Categorized list of files with descriptions
   - **Setup** — Language/framework detection + step-by-step setup guide
   - **Functions** — Key functions and classes explained
   - **Dependencies** — Packages with version and purpose

---

## 💡 Gesture Controls (Music Player)

| Gesture | Action | Works On |
|---|---|---|
| ✋ Open Palm | Play / Pause | YouTube Music, Spotify, SoundCloud |
| 👆 Index Point Up | Volume Up | YouTube Music, Spotify |
| 👇 Index Point Down | Volume Down | YouTube Music, Spotify |
| 👈 Swipe Left | Previous Track | YouTube Music, Spotify |
| 👉 Swipe Right | Next Track | YouTube Music, Spotify |
| 🤏 Pinch | Toggle Mute | YouTube Music, Spotify |

*Integration with specific music streaming services can be customized in `src/actions.js`.*

---

## 🧪 Development

```bash
# No build step required — the extension is plain HTML/CSS/JS
# Make changes to source files and reload the extension at chrome://extensions
```

### Testing
Load the extension in developer mode (see Installation) and test on any GitHub repository.

---

## 📦 Dependencies

| Package | Version | Purpose |
|---|---|---|
| OpenRouter AI API | — | AI-powered architecture analysis of GitHub repos |
| GitHub REST API | v3 | Fetch repository file trees and file contents |
| Chrome Extensions API | Manifest V3 | Extension lifecycle, messaging, storage |

---

## 🤝 Contributing

Contributions are welcome! If you'd like to improve gesture recognition accuracy, add support for more music platforms, or enhance the UI:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Tutul Kumar** — [@TutulDevs](https://github.com/TutulDevs)

---

## 🙏 Acknowledgments

- [MediaPipe](https://mediapipe.dev/) for real-time hand tracking
- [OpenRouter](https://openrouter.ai/) for accessible AI model APIs
- [GitHub API](https://docs.github.com/en/rest) for repository data
- All contributors and testers who helped refine the gesture models
