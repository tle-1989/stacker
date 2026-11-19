(() => {
  const { url, publishableKey } = window.stackerSupabase ?? {};
  const panel = document.querySelector('#leaderboard');
  const list = panel.querySelector('ol');
  const message = panel.querySelector('[role="status"]');
  const form = panel.querySelector('form');
  const name = form.querySelector('input');
  const save = form.querySelector('button');
  const storageKey = 'stacker-leaderboard-player';
  let player;
  let pendingScore;

  try {
    player = JSON.parse(localStorage.getItem(storageKey));
  } catch {
    // Storage may be blocked.
  }
  if (!player?.id) player = { id: crypto.randomUUID(), name: '' };
  name.value = player.name;

  async function rpc(functionName, args = {}) {
    const response = await fetch(url.replace(/\/$/, '') + '/rest/v1/rpc/' + functionName, {
      method: 'POST',
      headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
    if (!response.ok) throw new Error('Leaderboard request failed');
    return response;
  }

  async function refresh(emptyMessage = 'No scores yet.') {
    const scores = await (await rpc('stacker_top_scores')).json();
    window.dispatchEvent(new CustomEvent('stacker:leaderboard', { detail: scores.slice(0, 2) }));
    list.replaceChildren(...scores.map(({ player_name, score }) => {
      const row = document.createElement('li');
      row.textContent = player_name + ' · ' + score;
      return row;
    }));
    message.textContent = scores.length ? '' : emptyMessage;
  }

  if (!url || !publishableKey) {
    message.textContent = 'Leaderboard setup is pending.';
    return;
  }

  refresh().catch(() => {
    message.textContent = 'Leaderboard is unavailable right now.';
  });

  window.addEventListener('stacker:round-end', ({ detail: score }) => {
    if (score < 1) return;
    pendingScore = Math.max(pendingScore ?? 0, score);
    form.hidden = false;
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const displayName = name.value.trim();
    if (!displayName || !pendingScore || save.disabled) return;
    const score = pendingScore;
    save.disabled = true;
    message.textContent = 'Saving score…';
    try {
      await rpc('stacker_submit_score', {
        p_player_id: player.id,
        p_player_name: displayName,
        p_score: score
      });
      player.name = displayName;
      try {
        localStorage.setItem(storageKey, JSON.stringify(player));
      } catch {
        // The current session can still submit scores.
      }
      if (pendingScore === score) {
        pendingScore = undefined;
        form.hidden = true;
      }
    } catch {
      message.textContent = 'Score could not be saved. Try again.';
      return;
    } finally {
      save.disabled = false;
    }
    try {
      await refresh();
      message.textContent = 'Score submitted.';
    } catch {
      message.textContent = 'Score saved. Rankings are temporarily unavailable.';
    }
  });
})();
