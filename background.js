chrome.runtime.onInstalled.addListener(() => {
  console.log('RepoLens background service worker ready.');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { action } = request;

  if (action === 'fetchFileTree') {
    handleFetchFileTree(request, sendResponse);
    return true;
  }

  if (action === 'fetchFileContents') {
    handleFetchFileContents(request, sendResponse);
    return true;
  }

  if (action === 'analyzeWithGemini') {
    handleAnalyzeWithGemini(request, sendResponse);
    return true;
  }
});

async function handleFetchFileTree(request, sendResponse) {
  const { owner, repo, githubToken } = request;
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`;
  const headers = { 'Accept': 'application/vnd.github+json' };
  if (githubToken) headers['Authorization'] = `token ${githubToken}`;

  console.log('[bg] Fetching file tree:', url);
  try {
    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      sendResponse({ error: `GitHub API returned ${resp.status}: ${resp.statusText}` });
      return;
    }
    const data = await resp.json();
    console.log('[bg] File tree fetched, entries:', data.tree?.length);
    sendResponse({ data });
  } catch (err) {
    console.error('[bg] fetchFileTree error:', err);
    sendResponse({ error: err.message });
  }
}

async function handleFetchFileContents(request, sendResponse) {
  const { owner, repo, filePaths, githubToken } = request;
  const headers = { 'Accept': 'application/vnd.github+json' };
  if (githubToken) headers['Authorization'] = `token ${githubToken}`;

  const results = [];
  for (const filePath of filePaths) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
    console.log('[bg] Fetching file:', url);
    try {
      const resp = await fetch(url, { headers });
      if (resp.ok) {
        const data = await resp.json();
        if (data.content) {
          const decoded = atob(data.content.replace(/\n/g, ''));
          results.push({ path: filePath, content: decoded.substring(0, 3000) });
        }
      }
    } catch (err) {
      console.error('[bg] fetchFileContents error for', filePath, err);
    }
  }
  console.log('[bg] Fetched', results.length, 'file contents');
  sendResponse({ data: results });
}

async function handleAnalyzeWithGemini(request, sendResponse) {
  const { prompt, apiKey } = request;
  const url = 'https://openrouter.ai/api/v1/chat/completions';

  console.log('[bg] Sending to OpenRouter, prompt length:', prompt.length);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Or-Preset': 'free-models-only'
      },
      body: JSON.stringify({
        model: 'openrouter/auto',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error('[bg] OpenRouter error:', resp.status, errBody);
      sendResponse({ error: `OpenRouter API error (${resp.status}): ${errBody}` });
      return;
    }

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) {
      sendResponse({ error: 'Empty response from OpenRouter API' });
      return;
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      sendResponse({ error: 'Could not parse JSON from AI response' });
      return;
    }

    console.log('[bg] AI analysis successful');
    sendResponse({ data: JSON.parse(jsonMatch[0]) });
  } catch (err) {
    console.error('[bg] analyzeWithGemini error:', err);
    sendResponse({ error: err.message });
  }
}
