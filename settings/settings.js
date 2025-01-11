// Configuration par défaut
const DEFAULT_SETTINGS = {
  liveNotif: true,
  liveSound: true,
  gameChangeNotif: true,
  gameChangeSound: false,
  subRenewalNotif: true,
  subRenewalSound: true,
  checkFrequency: 30
};

// Éléments DOM
const elements = {
  liveNotif: document.getElementById('liveNotif'),
  liveSoundIcon: document.getElementById('liveSoundIcon'),
  gameChangeNotif: document.getElementById('gameChangeNotif'),
  gameChangeSoundIcon: document.getElementById('gameChangeSoundIcon'),
  subRenewalNotif: document.getElementById('subRenewalNotif'),
  subRenewalSoundIcon: document.getElementById('subRenewalSoundIcon'),
  checkFrequency: document.getElementById('checkFrequency'),
  saveBtn: document.getElementById('saveBtn'),
  resetBtn: document.getElementById('resetBtn')
};

// Charger les paramètres
async function loadSettings() {
  try {
    const settings = await chrome.storage.local.get('settings');
    const currentSettings = settings.settings || DEFAULT_SETTINGS;

    // Mettre à jour l'interface
    elements.liveNotif.checked = currentSettings.liveNotif;
    updateSoundIcon(elements.liveSoundIcon, currentSettings.liveSound);
    elements.gameChangeNotif.checked = currentSettings.gameChangeNotif;
    updateSoundIcon(elements.gameChangeSoundIcon, currentSettings.gameChangeSound);
    elements.subRenewalNotif.checked = currentSettings.subRenewalNotif;
    updateSoundIcon(elements.subRenewalSoundIcon, currentSettings.subRenewalSound);
    elements.checkFrequency.value = currentSettings.checkFrequency.toString();
  } catch (error) {
    console.error('Erreur lors du chargement des paramètres:', error);
  }
}

// Sauvegarder les paramètres
async function saveSettings() {
  try {
    const settings = {
      liveNotif: elements.liveNotif.checked,
      liveSound: elements.liveSoundIcon.src.includes('sound-on'),
      gameChangeNotif: elements.gameChangeNotif.checked,
      gameChangeSound: elements.gameChangeSoundIcon.src.includes('sound-on'),
      subRenewalNotif: elements.subRenewalNotif.checked,
      subRenewalSound: elements.subRenewalSoundIcon.src.includes('sound-on'),
      checkFrequency: parseInt(elements.checkFrequency.value)
    };

    await chrome.storage.local.set({ settings });
    
    // Mettre à jour la fréquence de vérification
    chrome.runtime.sendMessage({ 
      action: 'updateCheckFrequency', 
      frequency: settings.checkFrequency 
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
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    await loadSettings();
    showSaveConfirmation('Paramètres réinitialisés !');
  } catch (error) {
    console.error('Erreur lors de la réinitialisation des paramètres:', error);
    alert('Erreur lors de la réinitialisation des paramètres');
  }
}

// Mettre à jour l'icône du son
function updateSoundIcon(iconElement, isEnabled) {
  iconElement.src = `../icons/sound-${isEnabled ? 'on' : 'off'}.png`;
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
    animation: fadeInOut 2s ease-in-out;
  `;

  document.body.appendChild(confirmation);
  setTimeout(() => confirmation.remove(), 2000);
}

// Gestionnaires d'événements
document.addEventListener('DOMContentLoaded', loadSettings);
elements.saveBtn.addEventListener('click', saveSettings);
elements.resetBtn.addEventListener('click', resetSettings);

// Gestionnaires pour les icônes de son
[elements.liveSoundIcon, elements.gameChangeSoundIcon, elements.subRenewalSoundIcon].forEach(icon => {
  icon.addEventListener('click', () => {
    const isEnabled = icon.src.includes('sound-on');
    updateSoundIcon(icon, !isEnabled);
  });
});

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