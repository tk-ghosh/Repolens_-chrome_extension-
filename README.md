# 🕵️ RepoLens — GitHub Repository Architecture Analyzer

> **A Chrome extension that instantly analyzes any public GitHub repository and delivers a clear architectural breakdown — powered by AI.**

Stop digging through unfamiliar repos. RepoLens fetches the file tree, reads key source files, and sends everything to an AI (via OpenRouter) which returns a structured analysis: architecture flow, file roles, setup instructions, key functions, and dependencies — all inside a clean popup.

---

## ✨ Features

| Feature | Description |
|---|---|
| **One-Click Analysis** | Click the extension icon on any GitHub repo — analysis starts automatically |
| **AI-Powered Insights** | Uses OpenRouter AI (Gemini, Claude, GPT) to understand repo architecture |
| **5 Analysis Views** | Architecture Flow, Files, Setup Guide, Functions, Dependencies |
| **Auto File Tree** | Fetches the complete GitHub repo file tree via the GitHub API |
| **Smart File Reading** | Automatically selects and reads the 5 most important files (README, package.json, main entry points, etc.) |
| **24-Hour Caching** | Avoids redundant API calls — caches results locally for a full day |
| **Dark Theme UI** | Sleek dark-mode popup with orange accent (`#FF6B35`) |
| **Graceful Error Handling** | Clear error states, loading spinners, and empty-state fallbacks |
| **Settings Panel** | Save your OpenRouter API key and optional GitHub token |
| **Manifest V3** | Built on the latest Chrome extension platform |
| **Keyboard Navigable** | Tab-based navigation for quick switching between views |

---

## 📸 Screenshots

*(Add screenshots of the extension popup here)*

---

## 🧠 How It Works

```
You visit a GitHub repo → Click RepoLens icon
                              │
                    ┌─────────▼─────────┐
                    │  content.js        │
                    │  Extracts owner/   │
                    │  repo from URL     │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │  background.js     │
                    │  Fetches file tree │
                    │  via GitHub API    │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │  popup.js          │
                    │  Selects key files │
                    │  Reads contents    │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │  OpenRouter AI     │
                    │  Analyzes &        │
                    │  returns JSON      │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Renders 5 Tabs   │
                    │  Architecture │ Files │ Setup │ Functions │ Dependencies │
                    └───────────────────┘
```

---

## 📁 Project Structure

```
RepoLens/
├── manifest.json          # Chrome Extension Manifest (V3)
├── background.js          # Service Worker — API orchestration
├── content.js             # Content Script — extracts repo info
├── popup.html             # Popup UI (520px, dark theme)
├── popup.js               # Popup Logic — caching, AI, rendering
├── icon16.png             # Extension icon (16px)
├── icon48.png             # Extension icon (48px)
├── icon128.png            # Extension icon (128px)
└── README.md              # This file
```

---

## 🗂️ File-by-File Breakdown

### `manifest.json`
The extension manifest (Manifest V3). Declares:
- **Permissions:** `activeTab`, `scripting`, `storage`
- **Host permissions:** `api.github.com`, `openrouter.ai`, `generativelanguage.googleapis.com`
- **Content script:** Injects `content.js` on all `github.com/*/*` pages
- **Service worker:** `background.js` handles all API calls

### `background.js`
The service worker — acts as an API proxy:
- **`handleFetchFileTree`** — Calls `GET /repos/{owner}/{repo}/git/trees/HEAD?recursive=1` on GitHub API
- **`handleFetchFileContents`** — Fetches individual file contents via `GET /repos/{owner}/{repo}/contents/{path}`, base64-decodes them, limits to 3000 chars each
- **`handleAnalyzeWithGemini`** — Sends the prompt with file tree + contents to OpenRouter API (`/v1/chat/completions`), parses JSON from the AI response

### `content.js`
Minimal content script — listens for a `getRepoInfo` message from the popup and parses the current GitHub URL to extract `owner` and `repo`.

### `popup.html`
A 520px-wide popup with embedded CSS. Features:
- **Header:** Logo (`RL` icon) + RepoLens text + Settings gear button
- **Tab bar:** Architecture | Files | Setup | Functions | Dependencies
- **Tab content areas** (5 panels)
- **Loading overlay** with animated spinner and progress messages
- **Error state** with retry button
- **"Not a repo" state** when user isn't on GitHub
- **"No API key" state** with shortcut to settings
- **Settings panel** with password fields for API key + GitHub token
- **Cache badge** showing when results were last cached, with a re-analyze button

### `popup.js`
The main logic file (~576 lines). Key functions:

| Function | Role |
|---|---|
| `startAnalysis()` | Orchestrates the full pipeline: fetch tree → fetch contents → AI → render |
| `getRepoFromUrl()` | Resolves the current active tab's URL via `chrome.tabs.query` |
| `fetchFileTree()` | Filters tree to blob-only entries, caps at 200 files, classifies types |
| `fetchKeyFileContents()` | Smart selection — prioritizes README, package.json, requirements.txt, then main entry files, then other typed files |
| `analyzeWithGemini()` | Builds a structured prompt asking for specific JSON output, sends to background |
| `renderArchitecture()` | Shows repo header, architecture diagram, file categorization (INPUT/CORE/OUTPUT), and data flow |
| `renderFiles()` | Lists all analyzed files with their roles |
| `renderSetup()` | Shows detected language/framework/package manager + numbered setup steps |
| `renderFunctions()` | Lists key functions/classes with explanations |
| `renderDependencies()` | Shows dependencies with versions and purposes |
| `checkCacheAndAnalyze()` | Checks local storage for cached analysis (< 24h old) |
| `saveToCache()` | Persists analysis to `chrome.storage.local` |

---

## 🚀 Installation

### From Chrome Web Store
*(Coming soon)*

### Developer Mode (Manual Load)
1. Clone the repo:
   ```bash
   git clone https://github.com/TutulDevs/repolens.git
   ```
2. Open **chrome://extensions** in your browser
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Select the `repolens` folder
6. Pin RepoLens to your toolbar

---

## ⚙️ Configuration

### 1. Get an OpenRouter API Key
- Visit [openrouter.ai/keys](https://openrouter.ai/keys)
- Sign up (free tier available with daily credits)
- Copy your API key

### 2. Configure the Extension
1. Navigate to any GitHub repository page
2. Click the RepoLens icon in your toolbar
3. Click the **⚙ Settings** button (top-right of popup)
4. Paste your OpenRouter API key
5. *(Optional)* Add a **GitHub personal access token** for:
   - Higher API rate limits (60 → 5000 req/hr)
   - Access to private repositories
6. Click **Save**

### 3. Analyze Any Repo
1. Go to any GitHub repo (e.g., `github.com/facebook/react`)
2. Click the RepoLens icon
3. Wait ~5-15 seconds while it:
   - Fetches the file tree
   - Reads key files
   - Sends to AI for analysis
4. Explore the 5 tabs!

---

## 📋 Analysis Tabs Explained

### 🏗️ Architecture Tab
- **Repo header** with owner/name, summary, language, framework, file count
- **Architecture Flow** — ASCII diagram showing the project's pipeline
- **File Structure** — Files grouped as INPUT / CORE / OUTPUT
- **Data Flow** — Arrow-based flow showing how data moves through the system

### 📄 Files Tab
A clean list of analyzed files with:
- File name
- Project-specific description of what the file does

### 🔧 Setup Tab
- **Detected tags** — Language, Framework, Package Manager
- **Install command** (e.g., `npm install`, `pip install -r requirements.txt`)
- **Run command**
- **Numbered setup steps** for getting started

### ⚡ Functions Tab
Lists key functions and classes found in the repository, each with a detailed explanation of their purpose within the project.

### 📦 Dependencies Tab
Shows detected packages with:
- Package name & version
- Project-specific purpose description

---

## 🧪 Development

```bash
# No build step required — it's plain HTML/CSS/JS
# Edit files directly, then reload at chrome://extensions
```

### Making Changes
1. Edit the relevant file (`popup.js`, `popup.html`, `background.js`, `content.js`)
2. Go to `chrome://extensions`
3. Click the **↻ Reload** button on RepoLens
4. Click the extension icon to test

---

## 🌐 API Reference

### GitHub REST API v3
- **GET** `/repos/{owner}/{repo}/git/trees/HEAD?recursive=1` — Fetch complete file tree
- **GET** `/repos/{owner}/{repo}/contents/{path}` — Fetch individual file content

### OpenRouter API
- **POST** `/api/v1/chat/completions` — Send analysis prompt to AI
- Uses `openrouter/auto` model selection with `free-models-only` preset

---

## 🔒 Privacy

- **No data leaves your browser** except:
  - Repository metadata sent to GitHub API (public data)
  - File tree + file contents sent to OpenRouter for AI analysis
  - Your API keys are stored locally in `chrome.storage.local`
- **No tracking, no analytics, no third-party cookies**
- **OpenRouter API key never sent anywhere except OpenRouter**

---

## 🐛 Troubleshooting

| Problem | Solution |
|---|---|
| "Not a GitHub repository" | Navigate to a repo URL like `github.com/user/repo` |
| "API key required" | Open Settings (⚙) and add your OpenRouter API key |
| "Failed to fetch" | The repo may be empty or the GitHub API rate-limited. Add a GitHub token in Settings. |
| "AI analysis failed" | The AI may have returned malformed JSON. Click Retry. |
| "Cached" badge showing | Results from the last 24h — click "Re-analyze" for fresh analysis |

---

## 🛣️ Roadmap

- [ ] **Multi-model support** — Choose between Gemini, Claude, GPT models
- [ ] **Export analysis** — Download as Markdown or JSON
- [ ] **Compare repos** — Side-by-side architecture comparison
- [ ] **Custom prompts** — Let users ask specific questions about the repo
- [ ] **Chrome Web Store release**
- [ ] **Firefox / Edge support**
- [ ] **Dark/light theme toggle**
- [ ] **i18n support**

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. Fork the repository
2. Create a feature branch:
   ```bash
   git checkout -b feature/your-awesome-feature
   ```
3. Commit your changes:
   ```bash
   git commit -m "Add your awesome feature"
   ```
4. Push to your branch:
   ```bash
   git push origin feature/your-awesome-feature
   ```
5. Open a Pull Request

### Development Guidelines
- Follow the existing code style (no comments, concise patterns)
- Test on at least 3 different GitHub repos before submitting
- Keep the popup under 520px width
- Maintain graceful error/loading/empty states

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Tutul Kumar ghosh** — [@TUTUL](https://github.com/tk-ghosh)

---

## 🙏 Acknowledgments

- [OpenRouter](https://openrouter.ai/) — Accessible AI model API with free tier
- [GitHub API](https://docs.github.com/en/rest) — Repository data access
- [Chrome Extensions Documentation](https://developer.chrome.com/docs/extensions/) — Manifest V3 platform

---

*Made with ❤️ for developers who want to understand code faster.*
