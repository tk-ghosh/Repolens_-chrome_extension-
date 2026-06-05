const LOADING_MSGS = [
  "Fetching repository structure...",
  "Reading key files...",
  "Analyzing with AI...",
  "Building architecture map..."
];

let analysisData = null;
let currentRepo = null;

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initSettings();
  initRetry();

  document.getElementById('reanalyzeBtn').addEventListener('click', () => {
    hideCacheBadge();
    startAnalysis();
  });

  const keyBtn = document.getElementById('openSettingsBtn');
  if (keyBtn) keyBtn.addEventListener('click', () => showSettings(true));

  chrome.storage.local.get('geminiApiKey', ({ geminiApiKey }) => {
    if (!geminiApiKey) {
      showNoKey();
      return;
    }
    checkCacheAndAnalyze();
  });
});

function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });
}

function initSettings() {
  document.getElementById('settingsBtn').addEventListener('click', () => showSettings(true));
  document.getElementById('settingsClose').addEventListener('click', () => showSettings(false));

  chrome.storage.local.get(['geminiApiKey', 'githubToken'], ({ geminiApiKey, githubToken }) => {
    if (geminiApiKey) document.getElementById('apiKeyInput').value = geminiApiKey;
    if (githubToken) document.getElementById('githubTokenInput').value = githubToken;
  });

  document.getElementById('saveKeyBtn').addEventListener('click', () => {
    const apiKey = document.getElementById('apiKeyInput').value.trim();
    const githubToken = document.getElementById('githubTokenInput').value.trim();
    chrome.storage.local.set({ geminiApiKey: apiKey, githubToken }, () => {
      const el = document.getElementById('saveSuccess');
      el.classList.add('show');
      setTimeout(() => el.classList.remove('show'), 2000);
    });
  });
}

function initRetry() {
  document.getElementById('retryBtn').addEventListener('click', () => {
    hideCacheBadge();
    startAnalysis();
  });
}

function showSettings(show) {
  document.getElementById('settingsPanel').classList.toggle('show', show);
}

function showLoading(msgIndex = 0) {
  document.getElementById('loadingOverlay').classList.add('show');
  document.getElementById('loadingMsg').textContent = LOADING_MSGS[Math.min(msgIndex, LOADING_MSGS.length - 1)];
}

function updateLoadingMsg(msgIndex) {
  document.getElementById('loadingMsg').textContent = LOADING_MSGS[Math.min(msgIndex, LOADING_MSGS.length - 1)];
}

function hideLoading() {
  document.getElementById('loadingOverlay').classList.remove('show');
}

function showError(msg, detail = '') {
  hideLoading();
  hideCacheBadge();
  document.getElementById('errorText').textContent = msg;
  document.getElementById('errorDetail').textContent = detail;
  document.getElementById('errorState').classList.add('show');
}

function hideError() {
  document.getElementById('errorState').classList.remove('show');
}

function showNoKey() {
  document.getElementById('notRepo').classList.remove('show');
  document.getElementById('errorState').classList.remove('show');
  hideLoading();
  document.getElementById('noKey').classList.add('show');
}

function showNotRepo() {
  document.getElementById('noKey').classList.remove('show');
  document.getElementById('errorState').classList.remove('show');
  hideLoading();
  hideCacheBadge();
  document.getElementById('notRepo').classList.add('show');
}

function getRepoFromUrl() {
  return new Promise(resolve => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (!tabs || !tabs[0]) { resolve(null); return; }
      const url = tabs[0].url || '';
      const match = url.match(/github\.com\/([^/]+)\/([^/?#]+)/);
      if (match) {
        const repo = match[2].replace(/\/?$/, '');
        if (repo && match[1]) {
          resolve({ owner: match[1], repo });
        } else {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });
  });
}

async function startAnalysis() {
  console.log('[popup] startAnalysis begin');
  hideError();
  document.getElementById('noKey').classList.remove('show');
  document.getElementById('notRepo').classList.remove('show');

  const repoInfo = await getRepoFromUrl();
  if (!repoInfo) {
    console.log('[popup] Not a GitHub repo');
    showNotRepo();
    return;
  }

  currentRepo = repoInfo;
  showLoading(0);

  try {
    const apiKey = await getApiKey();
    if (!apiKey) { showNoKey(); return; }

    console.log('[popup] Step 1: Fetching file tree');
    updateLoadingMsg(1);
    let fileTree;
    try {
      fileTree = await fetchFileTree(repoInfo.owner, repoInfo.repo);
    } catch (fetchErr) {
      console.error('[popup] fetchFileTree failed:', fetchErr);
      showError('Failed to fetch repository structure', fetchErr.message);
      return;
    }
    if (!fileTree || fileTree.length === 0) {
      showError('Could not fetch repository files', 'The repository may be empty or inaccessible.');
      return;
    }
    console.log('[popup] File tree fetched, files:', fileTree.length);

    window.__fileTree = fileTree;

    console.log('[popup] Step 2: Fetching key file contents');
    updateLoadingMsg(2);
    let fileContents;
    try {
      fileContents = await fetchKeyFileContents(repoInfo.owner, repoInfo.repo, fileTree);
    } catch (contentErr) {
      console.error('[popup] fetchKeyFileContents failed:', contentErr);
      showError('Failed to fetch file contents', contentErr.message);
      return;
    }
    console.log('[popup] File contents fetched:', fileContents.length);

    console.log('[popup] Step 3: Analyzing with AI');
    updateLoadingMsg(3);
    let analysis;
    try {
      analysis = await analyzeWithGemini(fileTree, fileContents, apiKey);
    } catch (aiErr) {
      console.error('[popup] analyzeWithGemini failed:', aiErr);
      showError('AI analysis failed', aiErr.message);
      return;
    }
    console.log('[popup] Analysis complete');

    analysisData = analysis;
    saveToCache(repoInfo.owner, repoInfo.repo, analysis, fileTree);
    renderAnalysis(analysis, repoInfo);
    hideLoading();
  } catch (err) {
    console.error('[popup] Unexpected error in startAnalysis:', err);
    showError('Analysis failed', err.message || 'An unexpected error occurred.');
  }
}

function getApiKey() {
  return new Promise(resolve => {
    chrome.storage.local.get('geminiApiKey', ({ geminiApiKey }) => {
      resolve(geminiApiKey || null);
    });
  });
}

function sendBgMessage(action, payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action, ...payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response?.error) {
        reject(new Error(response.error));
      } else {
        resolve(response.data);
      }
    });
  });
}

function getStoredItems(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

function getCacheKey(owner, repo) {
  return `cache_${owner}_${repo}`;
}

async function checkCacheAndAnalyze() {
  const repoInfo = await getRepoFromUrl();
  if (!repoInfo) {
    showNotRepo();
    return;
  }
  currentRepo = repoInfo;

  const cacheKey = getCacheKey(repoInfo.owner, repoInfo.repo);
  chrome.storage.local.get(cacheKey, (result) => {
    const cached = result[cacheKey];
    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < 24 * 60 * 60 * 1000) {
        analysisData = cached.data;
        window.__fileTree = cached.fileTree || [];
        renderAnalysis(cached.data, repoInfo);
        showCacheBadge(age);
        return;
      }
    }
    startAnalysis();
  });
}

function showCacheBadge(ageMs) {
  const seconds = Math.floor(ageMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  let label;
  if (hours > 0) label = `${hours} hour${hours > 1 ? 's' : ''} ago`;
  else if (minutes > 0) label = `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  else label = 'just now';

  document.getElementById('cacheLabel').textContent = `Cached • ${label}`;
  document.getElementById('cacheBadge').classList.add('show');
}

function hideCacheBadge() {
  document.getElementById('cacheBadge').classList.remove('show');
}

function saveToCache(owner, repo, data, fileTree) {
  const cacheKey = getCacheKey(owner, repo);
  chrome.storage.local.set({
    [cacheKey]: { data, fileTree, timestamp: Date.now() }
  });
}

async function fetchFileTree(owner, repo) {
  console.log('[popup] fetchFileTree starting for', owner, repo);
  const { githubToken } = await getStoredItems('githubToken');
  const raw = await sendBgMessage('fetchFileTree', { owner, repo, githubToken });
  const tree = raw.tree || [];
  console.log('[popup] fetchFileTree got', tree.length, 'entries');
  const files = tree
    .filter(item => item.type === 'blob')
    .map(item => ({
      path: item.path,
      name: item.path.split('/').pop(),
      type: getFileType(item.path)
    }));
  return files.length > 1000 ? files.slice(0, 200) : files;
}

function getFileType(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  const types = {
    py: 'py', js: 'js', ts: 'js', jsx: 'js', tsx: 'js',
    json: 'json', yaml: 'json', yml: 'json',
    md: 'md',
    html: 'html', css: 'css', scss: 'css',
    c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
    java: 'java', rs: 'rs', go: 'go', rb: 'rb', php: 'php',
    toml: 'json', cfg: 'json', ini: 'json'
  };
  return types[ext] || 'other';
}

async function fetchKeyFileContents(owner, repo, fileTree) {
  console.log('[popup] fetchKeyFileContents starting');
  const priorityFiles = [
    'README.md', 'package.json', 'requirements.txt', 'go.mod',
    'Cargo.toml', 'pom.xml', 'build.gradle', 'composer.json'
  ];

  const mainEntryCandidates = ['main.py', 'index.js', 'app.py', 'server.js', 'main.go', 'index.ts', 'app.ts', 'cli.py', 'main.rs', 'lib.rs'];

  const selectedFiles = [];
  const addedPaths = new Set();

  for (const pf of priorityFiles) {
    if (selectedFiles.length >= 5) break;
    const found = fileTree.find(f => f.path === pf || f.path.endsWith('/' + pf));
    if (found && !addedPaths.has(found.path)) {
      selectedFiles.push(found);
      addedPaths.add(found.path);
    }
  }

  for (const mc of mainEntryCandidates) {
    if (selectedFiles.length >= 5) break;
    const found = fileTree.find(f => f.name === mc && !addedPaths.has(f.path));
    if (found) {
      selectedFiles.push(found);
      addedPaths.add(found.path);
    }
  }

  if (selectedFiles.length < 5) {
    for (const f of fileTree) {
      if (selectedFiles.length >= 5) break;
      if (!addedPaths.has(f.path) && f.type !== 'other') {
        selectedFiles.push(f);
        addedPaths.add(f.path);
      }
    }
  }

  const { githubToken } = await getStoredItems('githubToken');
  const filePaths = selectedFiles.map(f => f.path);
  console.log('[popup] Requesting', filePaths.length, 'file contents from background');
  const contents = await sendBgMessage('fetchFileContents', { owner, repo, filePaths, githubToken });
  console.log('[popup] Got', contents.length, 'file contents');
  return contents;
}

async function analyzeWithGemini(fileTree, fileContents, apiKey) {
  console.log('[popup] analyzeWithGemini starting');
  const treeStr = fileTree.map(f => f.path).join('\n');
  const contentsStr = fileContents.map(fc =>
    `--- ${fc.path} ---\n${fc.content}`
  ).join('\n\n');

  const prompt = `Analyze this GitHub repository and return a JSON response with exactly this structure:
{
  "repo_summary": "one paragraph about what this project does",
  "main_language": "primary programming language",
  "framework": "main framework used or null",
  "architecture_flow": "entry_point -> module1 -> module2 -> output (as text)",
  "architecture_diagram": "Analyze this repository and create a vertical flow diagram showing what this project does from start to finish. Show: - Where does the project START (input/entry) - What PROCESSING steps happen in order - What is the final RESULT/OUTPUT. Use actual names from the repo. Each step on its OWN LINE. Use │ and ▼ between steps. Use ├── for sub-steps. Maximum 25 lines. Never use box characters.",
  "file_categorization": [{"name": "folder or module name", "category": "INPUT/CORE/OUTPUT"}], (max 12 items, 3 categories INPUT/CORE/OUTPUT, rules: Show file structure in 3 groups: INPUT: documentation, config, environment files. CORE: all main source folders and important files. OUTPUT: build, dist, deployment files. Rules: - OUTPUT section is required, never skip it. - If no output folder exists, show deployment/docker files in OUTPUT)",
  "how_files_connect": "2-3 sentence summary of how files connect",
  "package_manager": "detected package manager or null",
  "files": [{"name": "filename", "role": "project-specific description of what this exact file does in this project (must be detailed, not generic)"}],
  "setup_steps": ["step 1", "step 2", "step 3"],
  "install_command": "npm install or pip install -r requirements.txt etc",
  "run_command": "how to run the project",
  "key_functions": [{"name": "function/class name", "explanation": "what this specific function/class does in this project, be detailed and project-specific"}],
  "dependencies": [{"name": "package name", "version": "version", "purpose": "what it is used for specifically in THIS project, not a generic library description"}]
}

Repository file tree:
${treeStr}

Key file contents:
${contentsStr}`;

  console.log('[popup] Sending prompt to background (length:', prompt.length, ')');
  const analysis = await sendBgMessage('analyzeWithGemini', { prompt, apiKey });
  console.log('[popup] AI analysis completed');
  return analysis;
}

function renderAnalysis(analysis, repoInfo) {
  renderArchitecture(analysis, repoInfo);
  renderFiles(analysis);
  renderSetup(analysis);
  renderFunctions(analysis);
  renderDependencies(analysis);

  const firstTab = document.querySelector('.tab[data-tab="tab-arch"]');
  if (firstTab) firstTab.click();
}

function getFileDot(type) {
  const dots = { py: 'dot-blue', js: 'dot-yellow', json: 'dot-green', md: 'dot-red' };
  return dots[type] || 'dot-gray';
}

function getFileIcon(name) {
  return name.includes('.') ? '📄' : '📁';
}

function renderArchitecture(analysis, repoInfo) {
  const container = document.getElementById('tab-arch');
  const fileTree = window.__fileTree || [];

  // SECTION A: Architecture Diagram
  let diagram = analysis.architecture_diagram || 'No diagram generated.';
  // Post-process: split by inline separators into multiple lines
  diagram = diagram.split(/ \| /g).join('\n');
  diagram = diagram.split(/\|▼/g).join('\n▼');
  diagram = diagram.split(/\| ▼/g).join('\n  ▼');
  const archHtml = `<div class="section-title">🏗️ Architecture Flow</div>
    <div class="arch-diagram">${diagram}</div>`;

  // SECTION B: File Categorization (INPUT / CORE / OUTPUT)
  const cats = analysis.file_categorization || [];
  let catHtml = '';
  if (cats.length > 0) {
    const inputFiles = cats.filter(c => c.category === 'INPUT').map(c => c.name);
    const coreFiles = cats.filter(c => c.category === 'CORE').map(c => c.name);
    const outputFiles = cats.filter(c => c.category === 'OUTPUT').map(c => c.name);

    let lines = [];
    if (inputFiles.length > 0) {
      lines.push('📥 INPUT');
      inputFiles.forEach(f => lines.push('  └── ' + f));
      lines.push('');
    }
    if (coreFiles.length > 0) {
      lines.push('⚙️ CORE');
      coreFiles.forEach((f, i) => {
        const arrow = coreFiles[i + 1] ? `──► ${coreFiles[i + 1]}` : '';
        lines.push(`  └── ${f} ${arrow}`);
      });
      lines.push('');
    }
    if (outputFiles.length > 0) {
      lines.push('📤 OUTPUT');
      outputFiles.forEach(f => lines.push('  └── ' + f));
    }

    catHtml = `<div class="section-title">📂 File Structure</div>
      <div class="arch-diagram">${lines.join('<br>')}</div>`;
  } else {
    // Fallback to standard tree if no categorization
    const treeHtml = fileTree.slice(0, 50).map(f => {
      const depth = f.path.split('/').length - 1;
      const indent = '  '.repeat(depth);
      const dotClass = getFileDot(f.type || getFileType(f.path));
      return `<span class="tree-indent">${indent}</span><span class="tree-dot ${dotClass}"></span><span class="tree-icon">${getFileIcon(f.name)}</span>&nbsp;<span class="tree-name">${f.name}</div>`;
    }).join('<br>');
    const treeMore = fileTree.length > 50
      ? `<br><span style="color:#64748b;font-style:italic;">... and ${fileTree.length - 50} more files</span>`
      : '';
    catHtml = `<div class="section-title">📂 File Structure</div>
      <div class="arch-diagram">${treeHtml}${treeMore}</div>`;
  }

  // SECTION C: Data Flow
  const flowParts = (analysis.architecture_flow || 'N/A').split('->').map((part, i) =>
    i === 0
      ? `<strong>${part.trim()}</strong>`
      : `<span class="flow-arrow">→</span> <strong>${part.trim()}</strong>`
  ).join('');
  const flowHtml = `<div class="section-title">🔄 Data Flow</div>
    <div class="flow-box">${flowParts}</div>`;

  container.innerHTML = `
    <div class="repo-header">
      <div class="repo-name">${repoInfo.owner}/${repoInfo.repo}</div>
      <div class="repo-desc">${analysis.repo_summary || ''}</div>
      <div class="repo-meta">
        <span class="repo-meta-item"><strong>Language:</strong> ${analysis.main_language || 'N/A'}</span>
        <span class="repo-meta-item"><strong>Framework:</strong> ${analysis.framework || 'None detected'}</span>
        <span class="repo-meta-item"><strong>Files:</strong> ${fileTree.length}</span>
      </div>
    </div>
    ${archHtml}
    ${catHtml}
    ${flowHtml}
  `;
}

function renderFiles(analysis) {
  const container = document.getElementById('tab-files');
  const files = analysis.files || [];
  if (files.length === 0) {
    container.innerHTML = '<div class="empty-state">No file information available.</div>';
    return;
  }

  container.innerHTML = `<div class="file-list-simple">${files.map(f =>
    `<div class="file-row">
      <div class="file-row-name">${f.name}</div>
      <div class="file-row-desc">${f.role || ''}</div>
    </div>`
  ).join('')}</div>`;
}

function renderSetup(analysis) {
  const container = document.getElementById('tab-setup');
  const steps = analysis.setup_steps || [];
  const installCmd = analysis.install_command;
  const runCmd = analysis.run_command;

  const installHtml = installCmd
    ? `<div class="setup-step"><div class="step-num"><span style="font-size:16px;">⬇</span></div><div class="step-text">${installCmd}</div></div>`
    : '';
  const runHtml = runCmd
    ? `<div class="setup-step"><div class="step-num"><span style="font-size:16px;">▶</span></div><div class="step-text">${runCmd}</div></div>`
    : '';
  const stepsHtml = steps.length > 0
    ? steps.map((step, i) => `<div class="setup-step"><div class="step-num">${i + 1}</div><div class="step-text">${step}</div></div>`).join('')
    : '<div class="empty-state">No setup instructions generated.</div>';

  container.innerHTML = `
    <div class="section-title">🎯 Detected</div>
    <div class="setup-detect">
      <span class="detect-tag"><strong>Language:</strong> ${analysis.main_language || 'N/A'}</span>
      <span class="detect-tag"><strong>Framework:</strong> ${analysis.framework || 'None'}</span>
      <span class="detect-tag"><strong>Package Manager:</strong> ${analysis.package_manager || 'Not detected'}</span>
    </div>
    <div class="section-title">📋 Setup Guide</div>
    <div class="setup-guide">${installHtml}${runHtml}${stepsHtml}</div>
  `;
}

function renderFunctions(analysis) {
  const container = document.getElementById('tab-functions');
  const funcs = analysis.key_functions || [];
  if (funcs.length === 0) {
    container.innerHTML = '<div class="empty-state">No functions found in this repository</div>';
    return;
  }
  container.innerHTML = `<div class="func-list">${funcs.map(f =>
    `<div class="func-card"><div class="func-name">${f.name}</div><div class="func-explain">${f.explanation || ''}</div></div>`
  ).join('')}</div>`;
}

function renderDependencies(analysis) {
  const container = document.getElementById('tab-deps');
  const deps = analysis.dependencies || [];
  if (deps.length === 0) {
    container.innerHTML = '<div class="empty-state">No dependencies found in this repository</div>';
    return;
  }
  container.innerHTML = `<div class="dep-list">${deps.map(d =>
    `<div class="dep-card">
      <div class="dep-left">
        <span class="dep-name">${d.name}</span>
        <span class="dep-version">${d.version || ''}</span>
        <div class="dep-purpose">${d.purpose || ''}</div>
      </div>
    </div>`
  ).join('')}</div>`;
}
