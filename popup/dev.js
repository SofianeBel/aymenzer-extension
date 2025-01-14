// Attendre que le DOM soit entièrement chargé
document.addEventListener('DOMContentLoaded', () => {
  const checkTwitchBtn = document.getElementById('checkTwitchBtn');
  const checkSubscriptionBtn = document.getElementById('checkSubscriptionBtn');
  const viewStorageBtn = document.getElementById('viewStorageBtn');
  const storageOutput = document.getElementById('storageOutput');
  const viewLogsBtn = document.getElementById('viewLogsBtn');
  const logsOutput = document.getElementById('logsOutput');
  
  // Nouveaux boutons de test de notification
  const testTwitchNotifBtn = document.getElementById('testTwitchNotifBtn');

  // Ajouter les nouveaux éléments


  // Fonction pour envoyer un message au background script
  function sendMessage(action) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  }







  checkTwitchBtn.addEventListener('click', async () => {
    try {
      await sendMessage('checkTwitch');
      alert('Vérification Twitch déclenchée.');
    } catch (error) {
      console.error('Erreur lors de la vérification Twitch:', error);
      alert('Erreur lors de la vérification Twitch. Consultez la console pour plus de détails.');
    }
  });

  checkSubscriptionBtn.addEventListener('click', async () => {
    try {
      await sendMessage('checkSubscription');
      alert('Vérification des abonnements Twitch déclenchée.');
    } catch (error) {
      console.error('Erreur lors de la vérification des abonnements Twitch:', error);
      alert('Erreur lors de la vérification des abonnements Twitch. Consultez la console pour plus de détails.');
    }
  });



  testTwitchNotifBtn.addEventListener('click', async () => {
    try {
      await sendMessage('testTwitchNotification');
      alert('Notification Twitch de test déclenchée.');
    } catch (error) {
      console.error('Erreur lors du test de notification Twitch:', error);
      alert('Erreur lors du test de notification Twitch. Consultez la console pour plus de détails.');
    }
  });



  viewStorageBtn.addEventListener('click', () => {
    chrome.storage.local.get(null, (data) => {
      storageOutput.textContent = JSON.stringify(data, null, 2);
    });
  });

  viewLogsBtn.addEventListener('click', () => {
    // Récupérer les logs depuis le stockage ou une méthode spécifique
    chrome.runtime.sendMessage({ action: 'getLogs' }, (response) => {
      if (response && response.logs) {
        logsOutput.textContent = response.logs.join('\n');
      } else {
        logsOutput.textContent = 'Aucun log disponible.';
      }
    });
  });





  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
      case 'testTwitchNotification':
        chrome.notifications.create('testTwitch', {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon48.png'),
          title: 'Test Notification Twitch',
          message: 'Ceci est une notification de test pour Twitch.',
          buttons: [{ title: 'Regarder' }],
          requireInteraction: true,
          silent: false
        }, (notificationId) => {
          if (chrome.runtime.lastError) {
            console.error('Erreur création notification de test Twitch:', chrome.runtime.lastError);
            addLog(`Erreur création notification test Twitch: ${chrome.runtime.lastError.message}`);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            addLog('Notification Twitch de test déclenchée.');
            sendResponse({ success: true });
          }
        });
        break;
      
      case 'getLogs':
        chrome.storage.local.get(['logs'], (result) => {
          sendResponse({ logs: result.logs || [] });
        });
        break;
      default:
        sendResponse({ success: false, error: 'Action inconnue.' });
    }
    return true; // Indique que la réponse sera envoyée de manière asynchrone
  });

}); 

