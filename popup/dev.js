// Attendre que le DOM soit entièrement chargé
document.addEventListener('DOMContentLoaded', () => {
  const checkYouTubeBtn = document.getElementById('checkYouTubeBtn');
  const checkTwitchBtn = document.getElementById('checkTwitchBtn');
  const checkTikTokBtn = document.getElementById('checkTikTokBtn');
  const checkSubscriptionBtn = document.getElementById('checkSubscriptionBtn');
  const viewStorageBtn = document.getElementById('viewStorageBtn');
  const storageOutput = document.getElementById('storageOutput');
  const viewLogsBtn = document.getElementById('viewLogsBtn');
  const logsOutput = document.getElementById('logsOutput');
  
  // Nouveaux boutons de test de notification
  const testYouTubeNotifBtn = document.getElementById('testYouTubeNotifBtn');
  const testTwitchNotifBtn = document.getElementById('testTwitchNotifBtn');
  const testTikTokNotifBtn = document.getElementById('testTikTokNotifBtn');

  // Ajouter les nouveaux éléments
  const quotaInfoBtn = document.getElementById('quotaInfoBtn');
  const quotaOutput = document.getElementById('quotaOutput');

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

  // Fonction pour formater les informations de quota
  function formatQuotaInfo(quotaInfo) {
    return `
### Quota YouTube

- **Quota quotidien total**: ${quotaInfo.quotaLimit} unités
- **Quota utilisé**: ${quotaInfo.quotaUsed} unités
- **Quota restant**: ${quotaInfo.quotaLimit - quotaInfo.quotaUsed} unités
- **Intervalle actuel**: ${quotaInfo.currentInterval} minutes
- **Requêtes restantes estimées**: ${Math.floor((quotaInfo.quotaLimit - quotaInfo.quotaUsed) / quotaInfo.searchCost)}
- **Coût par requête**: ${quotaInfo.searchCost} unités
- **Prochain reset**: ${quotaInfo.nextReset}
    `;
  }

  // Ajout des écouteurs d'événements pour les boutons existants
  checkYouTubeBtn.addEventListener('click', async () => {
    try {
      await sendMessage('checkYouTube');
      alert('Vérification YouTube déclenchée.');
    } catch (error) {
      console.error('Erreur lors de la vérification YouTube:', error);
      alert('Erreur lors de la vérification YouTube. Consultez la console pour plus de détails.');
    }
  });

  checkTwitchBtn.addEventListener('click', async () => {
    try {
      await sendMessage('checkTwitch');
      alert('Vérification Twitch déclenchée.');
    } catch (error) {
      console.error('Erreur lors de la vérification Twitch:', error);
      alert('Erreur lors de la vérification Twitch. Consultez la console pour plus de détails.');
    }
  });

  checkTikTokBtn.addEventListener('click', async () => {
    try {
      await sendMessage('checkTikTok');
      alert('Vérification TikTok déclenchée.');
    } catch (error) {
      console.error('Erreur lors de la vérification TikTok:', error);
      alert('Erreur lors de la vérification TikTok. Consultez la console pour plus de détails.');
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

  // Ajout des écouteurs d'événements pour les nouveaux boutons de test de notification
  testYouTubeNotifBtn.addEventListener('click', async () => {
    try {
      await sendMessage('testYouTubeNotification');
      alert('Notification YouTube de test déclenchée.');
    } catch (error) {
      console.error('Erreur lors du test de notification YouTube:', error);
      alert('Erreur lors du test de notification YouTube. Consultez la console pour plus de détails.');
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

  testTikTokNotifBtn.addEventListener('click', async () => {
    try {
      await sendMessage('testTikTokNotification');
      alert('Notification TikTok de test déclenchée.');
    } catch (error) {
      console.error('Erreur lors du test de notification TikTok:', error);
      alert('Erreur lors du test de notification TikTok. Consultez la console pour plus de détails.');
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

  // Ajouter l'écouteur pour le bouton de quota
  quotaInfoBtn?.addEventListener('click', async () => {
    try {
      const response = await sendMessage('getYouTubeQuotaInfo');
      if (response && response.success) {
        quotaOutput.innerHTML = formatQuotaInfo(response.data);
      } else {
        quotaOutput.textContent = 'Erreur lors de la récupération des informations de quota.';
      }
    } catch (error) {
      console.error('Erreur:', error);
      quotaOutput.textContent = `Erreur: ${error.message}`;
    }
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
      case 'testYouTubeNotification':
        chrome.notifications.create('testYouTube', {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon48.png'),
          title: 'Test Notification YouTube',
          message: 'Ceci est une notification de test pour YouTube.',
          buttons: [{ title: 'Regarder' }],
          requireInteraction: true
        }, (notificationId) => {
          if (chrome.runtime.lastError) {
            console.error('Erreur création notification de test YouTube:', chrome.runtime.lastError);
            addLog(`Erreur création notification test YouTube: ${chrome.runtime.lastError.message}`);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            addLog('Notification YouTube de test déclenchée.');
            sendResponse({ success: true });
          }
        });
        break;
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
      case 'testTikTokNotification':
        chrome.notifications.create('testTikTok', {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon48.png'),
          title: 'Test Notification TikTok',
          message: 'Ceci est une notification de test pour TikTok.',
          buttons: [{ title: 'Regarder' }],
          requireInteraction: true
        }, (notificationId) => {
          if (chrome.runtime.lastError) {
            console.error('Erreur création notification de test TikTok:', chrome.runtime.lastError);
            addLog(`Erreur création notification test TikTok: ${chrome.runtime.lastError.message}`);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            addLog('Notification TikTok de test déclenchée.');
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

