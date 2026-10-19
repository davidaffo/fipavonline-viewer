const UPDATE_INTERVAL = 30 * 60 * 1000;

export function initAppUpdates(registerSW) {
  const banner = document.querySelector('#app-update-banner');
  const install = document.querySelector('#app-update-install');
  const check = document.querySelector('#app-update-check');
  const status = document.querySelector('#app-update-status');
  let registration, ready = false, checking = false, updating = false;

  function render() {
    banner.hidden = !ready;
    install.disabled = updating;
    install.textContent = updating ? 'Aggiorno…' : 'Aggiorna ora';
    check.disabled = checking || updating || !registration;
    check.textContent = updating ? 'Aggiorno…' : checking ? 'Controllo…' : ready ? 'Aggiorna ora' : 'Controlla aggiornamenti';
  }

  async function checkForUpdate(visible = false) {
    if (!registration || checking || updating) return;
    if (registration.waiting) {
      ready = true;
      render();
      return;
    }
    if (!navigator.onLine) {
      if (visible) status.textContent = 'Sei offline: controllo non disponibile.';
      return;
    }
    checking = true;
    render();
    try {
      await registration.update();
      if (registration.waiting) ready = true;
      if (visible) status.textContent = ready ? 'È disponibile una nuova versione dell’app.' : registration.installing ? 'Nuova versione in preparazione…' : 'Controllo completato: stai usando l’ultima versione.';
    } catch (error) {
      console.warn('Impossibile controllare gli aggiornamenti.', error);
      if (visible) status.textContent = 'Controllo aggiornamenti non riuscito. Riprova tra poco.';
    } finally {
      checking = false;
      render();
    }
  }

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      ready = true;
      status.textContent = 'È disponibile una nuova versione dell’app.';
      render();
    },
    onRegisteredSW(_url, nextRegistration) {
      registration = nextRegistration;
      render();
      void checkForUpdate();
    },
    onRegisterError(error) {
      console.warn('Controllo aggiornamenti PWA non disponibile.', error);
      status.textContent = 'Controllo aggiornamenti non disponibile in questo browser.';
    },
  });

  async function installUpdate() {
    if (updating) return;
    if (!navigator.onLine) {
      status.textContent = 'Sei offline: riconnettiti per aggiornare l’app.';
      return;
    }
    updating = true;
    render();
    try {
      await updateSW(true);
    } catch (error) {
      console.warn('Aggiornamento app non riuscito.', error);
      updating = false;
      status.textContent = 'Aggiornamento non riuscito. Riprova tra poco.';
      render();
    }
  }

  install.onclick = installUpdate;
  check.onclick = () => ready ? installUpdate() : checkForUpdate(true);
  const checkSilently = () => {
    if (!document.hidden) void checkForUpdate();
  };
  window.addEventListener('online', checkSilently);
  document.addEventListener('visibilitychange', checkSilently);
  window.setInterval(checkSilently, UPDATE_INTERVAL);
  render();
}
