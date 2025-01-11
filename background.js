const YOUTUBE_CHANNEL_ID = "UCjvsS_pdoMNIK73E4iJfsmw";
const TWITCH_USERNAME = "aymenzer";
const TIKTOK_USERNAME = "aymenkoreaplayer";
const TWITCH_CLIENT_ID = "8xiery290o0ioczddjogf337p1etp7";
const TWITCH_CLIENT_SECRET = "sz36mo8huivxyd3bqtbzhqq2ukkk7y";

const CHECK_INTERVAL = 30; // Vérification toutes les 30 secondes pour les tests

const NOTIFICATION_TYPES = {
  YOUTUBE: 'YouTube',
  TWITCH: 'Twitch',
  TIKTOK: 'TikTok'
};

const STORAGE_KEYS = {
  LAST_YOUTUBE_VIDEO_ID: 'lastYouTubeVideoId',
  IS_LIVE: 'isLive',
  LAST_TIKTOK_VIDEO_URL: 'lastTikTokVideoUrl',
  YOUTUBE_DATA: 'youtubeData',
  TWITCH_DATA: 'twitchData',
  TIKTOK_DATA: 'tiktokData',
  LAST_CHECK: 'lastCheck'
};

const DEFAULT_ICON = 'icons/A_AE_neon_1.png';

const YOUTUBE_QUOTA_LIMIT = 10000; // Limite quotidienne de l'API YouTube
const SEARCH_QUOTA_COST = 100; // Coût d'une requête search.list
const MIN_CHECK_INTERVAL = 1; // Intervalle minimum en minutes
const MAX_CHECK_INTERVAL = 60; // Intervalle maximum en minutes

let dailyQuotaUsed = 0;
let lastQuotaReset = new Date();

function calculateYouTubeInterval() {
  // Réinitialiser le quota utilisé si c'est un nouveau jour
  const now = new Date();
  if (now.getDate() !== lastQuotaReset.getDate()) {
    dailyQuotaUsed = 0;
    lastQuotaReset = now;
  }

  // Calculer le quota restant
  const quotaRemaining = YOUTUBE_QUOTA_LIMIT - dailyQuotaUsed;
  
  // Calculer combien de requêtes nous pouvons encore faire aujourd'hui
  const remainingRequests = Math.floor(quotaRemaining / SEARCH_QUOTA_COST);
  
  // Calculer combien de minutes restent dans la journée
  const minutesInDay = 24 * 60;
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const remainingMinutes = minutesInDay - currentMinute;
  
  // Calculer l'intervalle optimal
  let newInterval = Math.ceil(remainingMinutes / remainingRequests);
  
  // S'assurer que l'intervalle reste dans les limites
  newInterval = Math.max(MIN_CHECK_INTERVAL, Math.min(newInterval, MAX_CHECK_INTERVAL));
  
  return newInterval;
}

async function updateYouTubeCheckInterval() {
  const newInterval = calculateYouTubeInterval();
  
  // Mettre à jour uniquement l'alarme YouTube
  await chrome.alarms.clear('checkYouTube');
  chrome.alarms.create('checkYouTube', {
    delayInMinutes: newInterval,
    periodInMinutes: newInterval
  });
  
  addLog(`Intervalle YouTube mis à jour: ${newInterval} minutes (Quota utilisé: ${dailyQuotaUsed})`);
  return newInterval;
}

// chrome.alarms.create('checkContent', { periodInMinutes: CHECK_INTERVAL / 60 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkYouTube') {
    await checkYouTube();
  } else if (alarm.name === 'checkContent') {
    await checkTwitch();
    await checkTikTok();
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  // Créer des alarmes séparées pour chaque service
  const youtubeInterval = await updateYouTubeCheckInterval();
  
  chrome.alarms.create('checkContent', {
    delayInMinutes: 0.1,
    periodInMinutes: CHECK_INTERVAL / 60
  });
  
  chrome.storage.local.set({
    checkFrequency: CHECK_INTERVAL / 60,
    youtubeCheckInterval: youtubeInterval,
    logs: [],
    isLive: false
  });

  // Vérifier immédiatement l'état initial
  checkTwitch().catch(error => {
    console.error('Erreur lors de la vérification initiale:', error);
    addLog(`Erreur vérification initiale: ${error.message}`);
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.checkFrequency) {
    const newFrequency = changes.checkFrequency.newValue;
    if (typeof newFrequency === 'number' && newFrequency > 0) {
      chrome.alarms.create("checkContent", { 
        delayInMinutes: 0.1,
        periodInMinutes: newFrequency
      });
      addLog(`Fréquence de vérification mise à jour: ${newFrequency} minutes`);
    }
  }
});

// Fonction pour ajouter des logs
function addLog(message) {
  chrome.storage.local.get(['logs'], (result) => {
    const logs = result.logs || [];
    logs.push(`[${new Date().toLocaleString()}] ${message}`);
    chrome.storage.local.set({ logs });
  });
}

async function checkYouTube() {
  try {
    // Vérifier si on a des données récentes (moins de 5 minutes)
    const storage = await chrome.storage.local.get([STORAGE_KEYS.YOUTUBE_DATA, STORAGE_KEYS.LAST_CHECK]);
    const now = Date.now();
    const lastCheck = storage[STORAGE_KEYS.LAST_CHECK]?.youtube || 0;
    const timeSinceLastCheck = now - lastCheck;

    // Si les données ont moins de 5 minutes, les utiliser
    if (timeSinceLastCheck < 5 * 60 * 1000 && storage[STORAGE_KEYS.YOUTUBE_DATA]) {
      console.log('Utilisation des données YouTube en cache');
      return storage[STORAGE_KEYS.YOUTUBE_DATA];
    }

    // Sinon, faire une nouvelle requête
    dailyQuotaUsed += SEARCH_QUOTA_COST;
    
    const apiKey = "AIzaSyBmUowucx1T8o8hPLJjeXp9TO6vJ6tzmu4";
    const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${YOUTUBE_CHANNEL_ID}&order=date&type=video&key=${apiKey}`;

    const response = await fetch(apiUrl);
    const data = await response.json();

    // Sauvegarder les nouvelles données
    await chrome.storage.local.set({
      [STORAGE_KEYS.YOUTUBE_DATA]: data,
      [STORAGE_KEYS.LAST_CHECK]: {
        ...storage[STORAGE_KEYS.LAST_CHECK],
        youtube: now
      }
    });

    return data;
  } catch (error) {
    console.error('Erreur YouTube:', error);
    addLog(`Erreur YouTube: ${error.message}`);
    throw error;
  }
}

async function checkTwitch() {
  try {
    const storage = await chrome.storage.local.get([STORAGE_KEYS.TWITCH_DATA, STORAGE_KEYS.LAST_CHECK]);
    const now = Date.now();
    const lastCheck = storage[STORAGE_KEYS.LAST_CHECK]?.twitch || 0;
    const timeSinceLastCheck = now - lastCheck;

    if (timeSinceLastCheck < 5 * 60 * 1000 && storage[STORAGE_KEYS.TWITCH_DATA]) {
      console.log('Utilisation des données Twitch en cache');
      return storage[STORAGE_KEYS.TWITCH_DATA];
    }

    // Obtenir le token
    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials'
      })
    });
    
    if (!tokenResponse.ok) {
      throw new Error(`Erreur lors de la récupération du token: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    addLog('Token Twitch obtenu avec succès');

    // Vérifier le stream
    const streamResponse = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${TWITCH_USERNAME}`,
      {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      }
    );

    if (!streamResponse.ok) {
      throw new Error(`Erreur lors de la vérification du stream: ${streamResponse.status}`);
    }

    const streamData = await streamResponse.json();
    console.log('Données du stream:', streamData);
    
    const isLive = streamData.data && streamData.data.length > 0;
    const wasLive = await getIsLive();

    addLog(`État du stream: ${isLive ? 'En ligne' : 'Hors ligne'}`);
    
    await chrome.storage.local.set({
      [STORAGE_KEYS.TWITCH_DATA]: streamData,
      [STORAGE_KEYS.LAST_CHECK]: {
        ...storage[STORAGE_KEYS.LAST_CHECK],
        twitch: now
      }
    });

    if (isLive && !wasLive) {
      chrome.notifications.create(`Twitch_${Date.now()}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/A_AE_neon_1.png'),
        title: 'AymenZeR Notifier • maintenant',
        message: `🔴 En direct\n\n${streamData.data[0].title}\n\n🎮 ${streamData.data[0].game_name}\n👥 ${streamData.data[0].viewer_count.toLocaleString()} spectateurs`,
        contextMessage: 'Special Events',
        priority: 2,
        buttons: [
          { title: '▶️ Regarder le stream' },
          { title: '🔕 Ne plus afficher' }
        ],
        requireInteraction: true,
        silent: false
      });
      addLog(`Notification créée pour le stream de ${streamData.data[0].user_name}`);
    }

    return streamData;
  } catch (error) {
    console.error('Erreur Twitch:', error);
    addLog(`Erreur Twitch: ${error.message}`);
    throw error;
  }
}

async function checkTikTok() {
  // Votre implémentation pour TikTok
}

async function checkSubscription() {
  try {
    const token = await chrome.storage.local.get('twitchUserToken');
    if (!token.twitchUserToken) {
      return;
    }

    const response = await fetch(`https://api.twitch.tv/helix/subscriptions/user?broadcaster_id=${TWITCH_USERNAME}`, {
      headers: {
        'Authorization': `Bearer ${token.twitchUserToken}`,
        'Client-Id': TWITCH_CLIENT_ID
      }
    });

    const data = await response.json();
    if (data.data && data.data.length > 0) {
      const sub = data.data[0];
      const renewalDate = new Date(sub.expires_at);
      const today = new Date();
      const diffDays = Math.ceil((renewalDate - today) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        chrome.notifications.create('twitchSubscriptionRenewal', {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon48.png'),
          title: 'Renouvellement d\'abonnement Twitch',
          message: `Votre abonnement à ${TWITCH_USERNAME} sera renouvelé demain !`,
          buttons: [{ title: 'Voir l\'abonnement' }],
          requireInteraction: true
        }, (notificationId) => {
          if (chrome.runtime.lastError) {
            console.error('Erreur création notification de renouvellement d\'abonnement Twitch:', chrome.runtime.lastError);
            addLog(`Erreur création notification renouvellement Twitch: ${chrome.runtime.lastError.message}`);
          } else {
            addLog('Notification renouvellement abonnement Twitch déclenchée.');
          }
        });
      }
    }
  } catch (error) {
    console.error('Erreur dans checkSubscription:', error);
    addLog(`Erreur checkSubscription: ${error.message}`);
  }
}

// Fonction pour récupérer l'état isLive du stockage
function getIsLive() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['isLive'], (result) => {
      resolve(result.isLive || false);
    });
  });
}

// Ajouter une fonction pour vérifier l'état des alarmes
function checkAlarms() {
  chrome.alarms.getAll((alarms) => {
    console.log('Alarmes actives:', alarms);
    addLog(`Nombre d'alarmes actives: ${alarms.length}`);
    alarms.forEach(alarm => {
      addLog(`Alarme ${alarm.name}: prochaine exécution dans ${Math.round((alarm.scheduledTime - Date.now()) / 1000)} secondes`);
    });
  });
}

// Appeler checkAlarms au démarrage
checkAlarms();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkTwitchStatus') {
    chrome.storage.local.get([STORAGE_KEYS.TWITCH_DATA], async (result) => {
      if (result[STORAGE_KEYS.TWITCH_DATA]) {
        sendResponse({ streamData: result[STORAGE_KEYS.TWITCH_DATA] });
      } else {
        try {
          const streamData = await checkTwitch();
          sendResponse({ streamData });
        } catch (error) {
          sendResponse({ error: error.message });
        }
      }
    });
    return true; // Important pour l'async
  }
  switch (request.action) {
    case 'checkYouTube':
      checkYouTube().then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'checkTwitch':
      checkTwitch().then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'checkTikTok':
      checkTikTok().then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

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
      return true;

    case 'testTwitchNotification':
      const testNotificationOptions = {
        type: 'basic',
        iconUrl: DEFAULT_ICON,
        title: 'Test Notification Twitch',
        message: 'Ceci est une notification de test pour Twitch.',
        buttons: [{ title: 'Regarder' }],
        requireInteraction: true,
        priority: 2  // Augmenter la priorité
      };

      chrome.notifications.create('testTwitch', testNotificationOptions, (notificationId) => {
        console.log('Tentative de création de notification:', testNotificationOptions);
        
        if (chrome.runtime.lastError) {
          console.error('Erreur détaillée de notification:', {
            errorMessage: chrome.runtime.lastError.message,
            notificationOptions: testNotificationOptions
          });
          
          // Log plus détaillé
          addLog(`Erreur notification test complet: 
            - Message: ${chrome.runtime.lastError.message}
            - Options: ${JSON.stringify(testNotificationOptions)}`);
          
          sendResponse({ 
            success: false, 
            error: chrome.runtime.lastError.message,
            details: JSON.stringify(testNotificationOptions)
          });
        } else {
          console.log('Notification Twitch de test créée avec succès');
          addLog('Notification de test Twitch créée avec succès');
          sendResponse({ success: true, notificationId: notificationId });
        }
      });
      return true;

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
      return true;

    case 'getLogs':
      chrome.storage.local.get(['logs'], (result) => {
        sendResponse({ logs: result.logs || [] });
      });
      return true;

    case 'getYouTubeQuotaInfo':
      const now = new Date();
      const nextReset = new Date(lastQuotaReset);
      nextReset.setDate(nextReset.getDate() + 1);
      nextReset.setHours(0, 0, 0, 0);

      sendResponse({
        success: true,
        data: {
          quotaLimit: YOUTUBE_QUOTA_LIMIT,
          quotaUsed: dailyQuotaUsed,
          searchCost: SEARCH_QUOTA_COST,
          currentInterval: calculateYouTubeInterval(),
          nextReset: nextReset.toLocaleString()
        }
      });
      return true;

    case 'authenticateTwitch':
      authenticateTwitch().then(sendResponse);
      return true;
    
    default:
      console.error('Action inconnue:', request.action);
      sendResponse({ success: false, error: 'Action inconnue' });
      return false;
  }
});

async function authenticateTwitch() {
  const clientId = TWITCH_CLIENT_ID;
  const redirectUri = chrome.identity.getRedirectURL('oauth2');
  const scope = 'user:read:email user:read:subscriptions';
  const state = generateRandomState(16);

  console.log('URL de redirection:', redirectUri); // Pour vérification

  const authUrl = `https://id.twitch.tv/oauth2/authorize?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=token&` +
    `scope=${encodeURIComponent(scope)}&` +
    `state=${state}&` +
    `force_verify=true`;

  try {
    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    });

    console.log('URL de réponse:', responseUrl);

    const url = new URL(responseUrl);
    const fragment = url.hash.substring(1);
    const params = new URLSearchParams(fragment);

    const accessToken = params.get('access_token');
    if (!accessToken) {
      throw new Error('Pas de token d\'accès dans la réponse');
    }

    // Sauvegarder le token
    await chrome.storage.local.set({
      twitchUserToken: accessToken,
      twitchTokenTimestamp: Date.now()
    });

    return { success: true, token: accessToken };
  } catch (error) {
    console.error('Erreur d\'authentification:', error);
    return { success: false, error: error.message };
  }
}

function generateRandomState(length) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map(x => charset[x % charset.length])
    .join('');
}