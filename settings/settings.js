document.addEventListener('DOMContentLoaded', () => {
  const enableNotifications = document.getElementById('enableNotifications');
  const checkFrequency = document.getElementById('checkFrequency');
  const settingsForm = document.getElementById('settingsForm');

  // Charger les paramètres existants
  chrome.storage.local.get(['enableNotifications', 'checkFrequency'], (result) => {
    enableNotifications.checked = result.enableNotifications !== false;
    checkFrequency.value = result.checkFrequency || '5';
  });

  // Enregistrer les paramètres
  settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const settings = {
      enableNotifications: enableNotifications.checked,
      checkFrequency: parseInt(checkFrequency.value, 10)
    };
    chrome.storage.local.set(settings, () => {
      // Mettre à jour l'alarme avec la nouvelle fréquence
      chrome.alarms.create("checkAymenZeR", { periodInMinutes: settings.checkFrequency });
      alert('Paramètres enregistrés.');
    });
  });
});