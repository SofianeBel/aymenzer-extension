// Configuration par défaut
const DEFAULT_SETTINGS = {
  streamNotifications: true,
  notificationSound: 'default',
  checkFrequency: 30,
  autoRefresh: false,
  theme: 'dark',
  debugMode: false
};

// Éléments DOM
const elements = {
  streamNotifications: document.getElementById('stream-notifications'),
  notificationSound: document.getElementById('notification-sound'),
  checkFrequency: document.getElementById('check-frequency'),
  autoRefresh: document.getElementById('auto-refresh'),
  themeSelect: document.getElementById('theme-select'),
  debugMode: document.getElementById('debug-mode'),
  saveBtn: document.getElementById('save-settings'),
  resetBtn: document.getElementById('reset-settings')
};

// Éléments DOM pour la connexion Twitch
const twitchElements = {
  username: document.getElementById('twitch-username'),
  connectBtn: document.getElementById('twitch-connect-btn'),
  disconnectBtn: document.getElementById('twitch-disconnect-btn')
};

// Charger les paramètres
async function loadSettings() {
  try {
    const { settings } = await chrome.storage.sync.get('settings');
    const currentSettings = settings || DEFAULT_SETTINGS;

    // Mettre à jour l'interface
    elements.streamNotifications.checked = currentSettings.streamNotifications;
    elements.notificationSound.value = currentSettings.notificationSound;
    elements.checkFrequency.value = currentSettings.checkFrequency.toString();
    elements.autoRefresh.checked = currentSettings.autoRefresh;
    elements.themeSelect.value = currentSettings.theme;
    elements.debugMode.checked = currentSettings.debugMode;

    // Mettre à jour le thème
    document.documentElement.setAttribute('data-theme', currentSettings.theme);
  } catch (error) {
    console.error('Erreur lors du chargement des paramètres:', error);
  }
}

// Sauvegarder les paramètres
async function saveSettings() {
  try {
    const settings = {
      streamNotifications: elements.streamNotifications.checked,
      notificationSound: elements.notificationSound.value,
      checkFrequency: parseInt(elements.checkFrequency.value),
      autoRefresh: elements.autoRefresh.checked,
      theme: elements.themeSelect.value,
      debugMode: elements.debugMode.checked
    };

    await chrome.storage.sync.set({ settings });
    
    // Mettre à jour le thème
    document.documentElement.setAttribute('data-theme', settings.theme);

    // Envoyer un message au background script pour mettre à jour les paramètres
    chrome.runtime.sendMessage({ 
      action: 'updateSettings', 
      settings: settings 
    });

    showSaveConfirmation();
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des paramètres:', error);
    alert('Erreur lors de la sauvegarde des paramètres');
  }
}

// Réinitialiser les paramètres
async function resetSettings() {
  try {
    await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
    await loadSettings();
    showSaveConfirmation('Paramètres réinitialisés !');
  } catch (error) {
    console.error('Erreur lors de la réinitialisation des paramètres:', error);
    alert('Erreur lors de la réinitialisation des paramètres');
  }
}

// Afficher une confirmation de sauvegarde
function showSaveConfirmation(message = 'Paramètres sauvegardés !') {
  const confirmation = document.createElement('div');
  confirmation.textContent = message;
  confirmation.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: #4CAF50;
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    z-index: 1000;
    animation: fadeInOut 2s ease-in-out;
  `;

  document.body.appendChild(confirmation);
  setTimeout(() => confirmation.remove(), 2000);
}

// Gestionnaires d'événements
document.addEventListener('DOMContentLoaded', loadSettings);
elements.saveBtn.addEventListener('click', saveSettings);
elements.resetBtn.addEventListener('click', resetSettings);

// Gestionnaire de changement de thème
elements.themeSelect.addEventListener('change', () => {
  const selectedTheme = elements.themeSelect.value;
  document.documentElement.setAttribute('data-theme', selectedTheme);
});

// Vérifier le statut de connexion Twitch au chargement
async function checkTwitchConnectionStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getTwitchUsername' });
    
    if (response.success) {
      // Connecté
      twitchElements.username.textContent = response.username;
      twitchElements.connectBtn.style.display = 'none';
      twitchElements.disconnectBtn.style.display = 'inline-block';
    } else {
      // Non connecté
      twitchElements.username.textContent = 'Non connecté';
      twitchElements.connectBtn.style.display = 'inline-block';
      twitchElements.disconnectBtn.style.display = 'none';
    }
  } catch (error) {
    console.error('Erreur lors de la vérification du statut Twitch:', error);
    twitchElements.username.textContent = 'Erreur de connexion';
  }
}

// Gestionnaire de connexion Twitch
async function connectTwitch() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'authenticateTwitch' });
    
    if (response.success) {
      await checkTwitchConnectionStatus();
      showSaveConfirmation('Connexion Twitch réussie !');
    } else {
      alert(`Erreur de connexion : ${response.error}`);
    }
  } catch (error) {
    console.error('Erreur de connexion Twitch:', error);
    alert('Impossible de se connecter à Twitch');
  }
}

// Gestionnaire de déconnexion Twitch
async function disconnectTwitch() {
  try {
    // Supprimer le token Twitch du stockage local
    await chrome.storage.local.remove('twitchUserToken');
    await chrome.storage.local.remove('twitchTokenTimestamp');
    
    await checkTwitchConnectionStatus();
    showSaveConfirmation('Déconnexion Twitch réussie');
  } catch (error) {
    console.error('Erreur de déconnexion Twitch:', error);
    alert('Impossible de se déconnecter de Twitch');
  }
}

// Ajouter les écouteurs d'événements pour la connexion Twitch
twitchElements.connectBtn.addEventListener('click', connectTwitch);
twitchElements.disconnectBtn.addEventListener('click', disconnectTwitch);

// Vérifier le statut de connexion au chargement
document.addEventListener('DOMContentLoaded', checkTwitchConnectionStatus);

// Ajouter du CSS pour l'animation
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeInOut {
    0% { opacity: 0; transform: translate(-50%, 20px); }
    15% { opacity: 1; transform: translate(-50%, 0); }
    85% { opacity: 1; transform: translate(-50%, 0); }
    100% { opacity: 0; transform: translate(-50%, -20px); }
  }
`;
document.head.appendChild(style);