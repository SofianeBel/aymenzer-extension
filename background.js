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
  LAST_TIKTOK_VIDEO_URL: 'lastTikTokVideoUrl'
};

const DEFAULT_ICON = 'icons/A_AE_neon_1.png';

// chrome.alarms.create('checkContent', { periodInMinutes: CHECK_INTERVAL / 60 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkContent') {
    console.log('Alarme déclenchée:', new Date().toLocaleString());
    addLog(`Vérification périodique démarrée`);
    
    try {
      await checkYouTube();
      await checkTwitch();
      await checkTikTok();
      addLog(`Vérification périodique terminée`);
    } catch (error) {
      console.error('Erreur lors des vérifications:', error);
      addLog(`Erreur lors des vérifications: ${error.message}`);
    }
  }
});

chrome.runtime.onInstalled.addListener(() => {
  // Créer l'alarme avec un délai initial et une période
  chrome.alarms.create("checkContent", { 
    delayInMinutes: 0.1,  // Démarrer après 6 secondes
    periodInMinutes: CHECK_INTERVAL / 60  // Période en minutes
  });
  
  // Initialiser le stockage
  chrome.storage.local.set({
    checkFrequency: CHECK_INTERVAL / 60,
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
  const apiKey = "AIzaSyBmUowucx1T8o8hPLJjeXp9TO6vJ6tzmu4"; 
  const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${YOUTUBE_CHANNEL_ID}&order=date&type=video&key=${apiKey}`;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.items && data.items.length > 0) {
      const latestVideo = data.items[0];
      const latestVideoId = latestVideo.id.videoId;
      const latestVideoTitle = latestVideo.snippet.title;
      const thumbnailUrl = latestVideo.snippet.thumbnails.medium.url;

      chrome.storage.local.get([STORAGE_KEYS.LAST_YOUTUBE_VIDEO_ID], (result) => {
        if (result[STORAGE_KEYS.LAST_YOUTUBE_VIDEO_ID] !== latestVideoId) {
          // Télécharger la miniature avant de créer la notification
          fetch(thumbnailUrl)
            .then(response => response.blob())
            .then(blob => {
              const reader = new FileReader();
              reader.onloadend = function() {
                chrome.notifications.create(`YouTube_${latestVideoId}`, {
                  type: 'image',
                  iconUrl: chrome.runtime.getURL('icons/A_AE_neon_1.png'),
                  imageUrl: thumbnailUrl,
                  title: 'AymenZeR Notifier • maintenant',
                  message: `📺 Nouvelle vidéo\n\n${latestVideoTitle}`,
                  contextMessage: 'Special Events',
                  priority: 2,
                  buttons: [
                    { title: '▶️ Regarder la vidéo' },
                    { title: '🔕 Ne plus afficher' }
                  ],
                  requireInteraction: true,
                  silent: false
                }, (notificationId) => {
                  if (chrome.runtime.lastError) {
                    console.error('Erreur lors de la création de la notification YouTube:', chrome.runtime.lastError);
                    addLog(`Erreur création notification YouTube: ${chrome.runtime.lastError.message}`);
                  } else {
                    addLog(`Notification YouTube créée: ${notificationId}`);
                  }
                });
              }
              reader.readAsDataURL(blob);
            })
            .catch(error => {
              console.error('Erreur lors du téléchargement de la miniature:', error);
              // Utiliser une icône par défaut en cas d'échec
              chrome.notifications.create(`YouTube_${latestVideoId}`, {
                type: 'basic',
                iconUrl: DEFAULT_ICON,
                title: 'Nouvelle vidéo YouTube d\'AymenZeR !',
                message: latestVideoTitle,
                buttons: [{ title: 'Regarder' }],
                requireInteraction: true
              });
            });

          chrome.storage.local.set({
            [STORAGE_KEYS.LAST_YOUTUBE_VIDEO_ID]: latestVideoId,
            'youtubeThumbnailUrl': thumbnailUrl
          }, () => {
            console.log('YouTube data stored:', {
              videoId: latestVideoId,
              thumbnailUrl: thumbnailUrl
            });
            addLog(`Nouvelle vidéo YouTube détectée: ${latestVideoTitle}`);
          });
        }
      });
    }
  } catch (error) {
    console.error("Erreur lors de la récupération des vidéos YouTube:", error);
    addLog(`Erreur YouTube: ${error.message}`);
  }
}

async function checkTwitch() {
  addLog(`Début de la vérification Twitch pour ${TWITCH_USERNAME}`);
  console.log('Démarrage checkTwitch:', new Date().toLocaleString());
  
  try {
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
      isLive: isLive,
      streamData: streamData
    });

    if (isLive && !wasLive) {
      chrome.notifications.create(`Twitch_${Date.now()}`, {
        type: 'image',
        iconUrl: chrome.runtime.getURL('icons/A_AE_neon_1.png'),
        imageUrl: streamData.data[0].thumbnail_url.replace("{width}", "320").replace("{height}", "180"),
        title: 'AymenZeR Notifier • maintenant',
        message: `${streamData.data[0].title}\n\n🎮 ${streamData.data[0].game_name}\n👥 ${streamData.data[0].viewer_count.toLocaleString()} spectateurs`,
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
  } catch (error) {
    console.error('Erreur dans checkTwitch:', error);
    addLog(`Erreur Twitch: ${error.message}`);
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

    default:
      sendResponse({ success: false, error: 'Action inconnue.' });
      return false;
  }
});