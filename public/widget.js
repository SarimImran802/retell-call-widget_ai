(function () {
  const root = document.getElementById('retell-widget-root') || document.body;

  function createEl(tag, props, children) {
    const el = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (key) { el.setAttribute(key, props[key]); });
    if (children) children.forEach(function (child) { el.appendChild(child); });
    return el;
  }

  function setText(el, text) { el.textContent = text; }

  function createFloatingButton() {
    const btn = createEl('button', { id: 'retell-widget-floating-button', 'aria-label': 'Talk to us' }, []);
    setText(btn, '💬');
    return btn;
  }

  function createModal() {
    const backdrop = createEl('div', { id: 'retell-widget-modal-backdrop', role: 'dialog', 'aria-modal': 'true' }, []);
    const modal = createEl('div', { class: 'retell-widget-modal' }, []);

    const header = createEl('div', { class: 'retell-widget-header' }, []);
    const title = createEl('div', { class: 'retell-widget-title' }, []);
    setText(title, 'Talk to our AI agent');
    const close = createEl('button', { class: 'retell-widget-close', 'aria-label': 'Close' }, []);
    setText(close, '✕');
    header.appendChild(title);
    header.appendChild(close);

    const body = createEl('div', { class: 'retell-widget-body' }, []);

    const callSection = createEl('div', { class: 'retell-widget-section' }, []);
    const label = createEl('div', { class: 'retell-widget-label' }, []);
    setText(label, 'Web call status');
    const status = createEl('div', { class: 'retell-widget-status' }, []);
    setText(status, 'Idle');

    const actions = createEl('div', { class: 'retell-widget-actions' }, []);
    const startBtn = createEl('button', { class: 'retell-btn retell-btn-primary' }, []);
    setText(startBtn, 'Start Call');
    const stopBtn = createEl('button', { class: 'retell-btn retell-btn-danger', disabled: 'true' }, []);
    setText(stopBtn, 'End Call');

    actions.appendChild(startBtn);
    actions.appendChild(stopBtn);
    callSection.appendChild(label);
    callSection.appendChild(status);
    callSection.appendChild(actions);

    const powered = createEl('div', { class: 'retell-powered' }, []);
    setText(powered, 'Voice by Retell AI');

    body.appendChild(callSection);
    body.appendChild(powered);

    modal.appendChild(header);
    modal.appendChild(body);
    backdrop.appendChild(modal);

    return { backdrop: backdrop, close: close, status: status, startBtn: startBtn, stopBtn: stopBtn };
  }

  function getBackendUrl() {
    if (window.RFT_BACKEND_URL) return window.RFT_BACKEND_URL.replace(/\/$/, '');
    // Default to Vercel URL when embedded
    return 'https://retell-call-widget-ai.vercel.app';
  }

  function apiStartSession(userId) {
    var backend = getBackendUrl();
    var url = backend + '/api/retell/start';
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: userId }) }).then(function (r) { return r.json(); });
  }

  function startMedia() {
    return navigator.mediaDevices.getUserMedia({ audio: true });
  }

  function init() {
    const button = createFloatingButton();
    const modal = createModal();

    let mediaStream = null;
    let inCall = false;
    let sdkReady = false;

    function coerceGlobalFromKnownExports() {
      try {
        if (!window.RetellWebClient && window.retellClientJsSdk && window.retellClientJsSdk.RetellWebClient) {
          window.RetellWebClient = window.retellClientJsSdk.RetellWebClient;
        }
        if (!window.RetellWebClient && window.Retell && window.Retell.RetellWebClient) {
          window.RetellWebClient = window.Retell.RetellWebClient;
        }
        if (!window.RetellWebClient && window.RetellClient && window.RetellClient.RetellWebClient) {
          window.RetellWebClient = window.RetellClient.RetellWebClient;
        }
        return Boolean(window.RetellWebClient);
      } catch (e) { return false; }
    }

    function probeSdk() {
      const found = coerceGlobalFromKnownExports();
      sdkReady = found;
      if (!found) {
        console.log('SDK probe globals:', {
          hasWindow: typeof window !== 'undefined',
          retellClientJsSdk: !!(window.retellClientJsSdk),
          retellClientJsSdkKeys: window.retellClientJsSdk ? Object.keys(window.retellClientJsSdk) : [],
          Retell: !!(window.Retell),
          RetellClient: !!(window.RetellClient),
          RetellWebClient: !!(window.RetellWebClient)
        });
      }
      return found;
    }

    // Retry a few times in case SDK loads slightly after DOMContentLoaded
    (function retryUntilReady(attempt) {
      if (probeSdk() || attempt > 10) return;
      setTimeout(function(){ retryUntilReady(attempt + 1); }, 300);
    })(0);

    function resolveRetellCtor() {
      if (window.RetellWebClient) return { ctor: window.RetellWebClient, via: 'window.RetellWebClient' };
      if (window.Retell && window.Retell.RetellWebClient) return { ctor: window.Retell.RetellWebClient, via: 'window.Retell.RetellWebClient' };
      if (window.RetellClient && window.RetellClient.RetellWebClient) return { ctor: window.RetellClient.RetellWebClient, via: 'window.RetellClient.RetellWebClient' };
      if (window.retellClientJsSdk && window.retellClientJsSdk.RetellWebClient) return { ctor: window.retellClientJsSdk.RetellWebClient, via: 'window.retellClientJsSdk.RetellWebClient' };
      if (window.retellClientJsSdk && window.retellClientJsSdk.default && window.retellClientJsSdk.default.RetellWebClient) return { ctor: window.retellClientJsSdk.default.RetellWebClient, via: 'window.retellClientJsSdk.default.RetellWebClient' };
      return null;
    }

    button.addEventListener('click', function () {
      modal.backdrop.style.display = 'flex';
    });
    modal.close.addEventListener('click', function () {
      modal.backdrop.style.display = 'none';
    });

    var retellWebClient = null;

    modal.startBtn.addEventListener('click', function () {
      if (inCall) return;
      setText(modal.status, 'Starting...');
      modal.startBtn.disabled = true;
      apiStartSession('anonymous').then(function (resp) {
        console.log('start session response', resp);
        if (resp && resp.error) {
          console.error('Start session error:', resp);
          setText(modal.status, 'Server error');
          modal.startBtn.disabled = false;
          return;
        }
        if (resp && resp.access_token) {
          // If mock mode, just simulate success without calling SDK
          if (resp.mock) {
            inCall = true;
            setText(modal.status, 'Connected (mock)');
            modal.stopBtn.disabled = false;
            return;
          }
          // Ensure any known globals are coerced
          coerceGlobalFromKnownExports();
          var resolved = resolveRetellCtor();
          function useResolved(r){
            console.log('Using Retell SDK from', r.via);
            retellWebClient = new r.ctor();
            try {
              if (retellWebClient && typeof retellWebClient.on === 'function') {
                retellWebClient.on('call_started', function(){ console.log('retell: call_started'); });
                retellWebClient.on('call_ready', function(){ console.log('retell: call_ready'); });
                retellWebClient.on('call_ended', function(){ console.log('retell: call_ended'); });
                retellWebClient.on('agent_start_talking', function(){ console.log('retell: agent_start_talking'); });
                retellWebClient.on('agent_stop_talking', function(){ console.log('retell: agent_stop_talking'); });
                retellWebClient.on('error', function(err){ console.error('retell: error event', err); });
              }
            } catch(_) {}
          }
          if (!resolved) {
            // Final fallback: if UMD namespace exists, bind it
            if (window.retellClientJsSdk && window.retellClientJsSdk.RetellWebClient) {
              resolved = { ctor: window.retellClientJsSdk.RetellWebClient, via: 'window.retellClientJsSdk.RetellWebClient' };
              useResolved(resolved);
            } else {
              console.error('RetellWebClient is not available on window. Check the SDK script URL or global export.', err);
              setText(modal.status, 'SDK not loaded');
              modal.startBtn.disabled = false;
              return;
            }
          } else {
            useResolved(resolved);
          }
          return retellWebClient.startCall({ accessToken: resp.access_token }).then(function () {
            inCall = true;
            setText(modal.status, 'Connected');
            modal.stopBtn.disabled = false;
            if (retellWebClient && typeof retellWebClient.startAudioPlayback === 'function') {
              retellWebClient.startAudioPlayback().catch(function(e){ console.warn('startAudioPlayback failed', e); });
            }
          }).catch(function (e) {
            console.error('startCall failed:', e);
            setText(modal.status, 'Failed to start');
            modal.startBtn.disabled = false;
          });
        }
        setText(modal.status, 'Server not configured');
        modal.startBtn.disabled = false;
      }).catch(function () {
        setText(modal.status, 'Failed to start');
        modal.startBtn.disabled = false;
      });
    });

    modal.stopBtn.addEventListener('click', function () {
      if (!inCall) return;
      if (retellWebClient) retellWebClient.stopCall();
      inCall = false;
      setText(modal.status, 'Idle');
      modal.stopBtn.disabled = true;
      modal.startBtn.disabled = false;
    });

    root.appendChild(button);
    root.appendChild(modal.backdrop);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();


