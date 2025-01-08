const YOUTUBE_CHANNEL_ID = "UCjvsS_pdoMNIK73E4iJfsmw"; // Remplacez par l'ID de la chaîne d'AymenZeR
const TWITCH_USERNAME = "AymenZeR";
const TIKTOK_USERNAME = "aymenkoreaplayer";
const TWITCH_CLIENT_ID = "8xiery290o0ioczddjogf337p1etp7";
const TWITCH_CLIENT_SECRET = "sz36mo8huivxyd3bqtbzhqq2ukkk7y"; // Ajoutez votre client_secret ici

const CHECK_INTERVAL = 60; // Vérification toutes les 60 secondes (à ajuster)

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

chrome.alarms.create('checkContent', { periodInMinutes: CHECK_INTERVAL / 60 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkContent') {
    await checkYouTube();
    await checkTwitch();
    await checkTikTok();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['checkFrequency'], (result) => {
    const frequency = result.checkFrequency || 5;
    chrome.alarms.create("checkAymenZeR", { periodInMinutes: frequency });
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (changes.checkFrequency) {
    chrome.alarms.create("checkAymenZeR", { periodInMinutes: changes.checkFrequency.newValue });
  }
});

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
      const thumbnailUrl = latestVideo.snippet.thumbnails.medium.url; // Utilisation de la version medium

      chrome.storage.local.get([STORAGE_KEYS.LAST_YOUTUBE_VIDEO_ID], (result) => {
        if (result[STORAGE_KEYS.LAST_YOUTUBE_VIDEO_ID] !== latestVideoId) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Nouvelle vidéo YouTube d\'AymenZeR !',
            message: latestVideoTitle,
            buttons: [{ title: 'Regarder' }],
            requireInteraction: true
          });
          
          chrome.storage.local.set({
            [STORAGE_KEYS.LAST_YOUTUBE_VIDEO_ID]: latestVideoId,
            'youtubeThumbnailUrl': thumbnailUrl
          }, () => {
            console.log('YouTube data stored:', {
              videoId: latestVideoId,
              thumbnailUrl: thumbnailUrl
            });
          });
        }
      });
    }
  } catch (error) {
    console.error("Erreur lors de la récupération des vidéos YouTube:", error);
  }
}

async function checkTwitch() {
  const clientId = TWITCH_CLIENT_ID;
  const clientSecret = TWITCH_CLIENT_SECRET;
  let isLive = false;

  try {
    // Étape 1 : Obtenir un jeton d'accès
    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials'
      })
    });
    
    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      throw new Error('Échec de récupération du jeton d\'accès Twitch.');
    }

    // Étape 2 : Requête API avec le jeton
    const streamResponse = await fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(TWITCH_USERNAME)}`, {
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });

    if (!streamResponse.ok) {
      throw new Error(`Erreur API Twitch: ${streamResponse.status}`);
    }

    const streamData = await streamResponse.json();

    if (streamData && streamData.data) {
      const wasLive = await getIsLive();
      isLive = streamData.data.length > 0;

      // Stocker les données du stream et l'état isLive
      chrome.storage.local.set({ 
        [STORAGE_KEYS.IS_LIVE]: isLive,
        'streamData': streamData // Ajout des données du stream
      });

      if (isLive && !wasLive) {
        const streamThumbnailUrl = streamData.data[0].thumbnail_url
          .replace("{width}", "320")
          .replace("{height}", "180");
        
        chrome.notifications.create({
          type: 'image',
          iconUrl: streamThumbnailUrl,
          imageUrl: streamThumbnailUrl,
          title: `${TWITCH_USERNAME} • maintenant`,
          message: `${TWITCH_USERNAME} - Je suis en live !\nRetrouvez moi en live dès maintenant sur ${streamData.data[0].game_name} !`,
          contextMessage: 'Special Events',
          priority: 2,
          buttons: [{ title: 'Regarder' }],
          requireInteraction: true,
          silent: false
        });
        
        chrome.storage.local.set({ 
          'twitchThumbnailUrl': streamThumbnailUrl
        });
      }
    }
  } catch (error) {
    console.error('Erreur lors de la vérification Twitch:', error);
  }
}

async function checkTikTok() {
  // ATTENTION : Web scraping - cette méthode peut casser si TikTok change son site
  const tiktokProfileUrl = `https://www.tiktok.com/@${TIKTOK_USERNAME}`;

  try {
    const response = await fetch(tiktokProfileUrl);
    const html = await response.text();

    // Analyser le HTML pour trouver la dernière vidéo (cela dépend de la structure de TikTok)
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const videoElement = doc.querySelector('a[href*="/video/"]'); // Exemple de sélecteur possible

    if (videoElement) {
      const videoUrl = `https://www.tiktok.com${videoElement.getAttribute('href')}`;
      const thumbnailElement = videoElement.querySelector('img');
      const thumbnailUrl = thumbnailElement ? thumbnailElement.src : '';

      chrome.storage.local.get([STORAGE_KEYS.LAST_TIKTOK_VIDEO_URL], (result) => {
        if (result[STORAGE_KEYS.LAST_TIKTOK_VIDEO_URL] !== videoUrl) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Nouvelle vidéo TikTok d\'AymenZeR !',
            message: 'Nouvelle vidéo TikTok est sortie.',
            buttons: [{ title: 'Regarder' }],
            requireInteraction: true,
            imageUrl: thumbnailUrl // Ajouter l'image de la miniature
          });
          chrome.storage.local.set({ 
            [STORAGE_KEYS.LAST_TIKTOK_VIDEO_URL]: videoUrl,
            'tiktokThumbnailUrl': thumbnailUrl // Stocker l'URL de la miniature
          });
        }
      });
    }
  } catch (error) {
    console.error("Erreur lors de la vérification de TikTok:", error);
  }
}

// Gestion du clic sur la notification
chrome.notifications.onButtonClicked.addListener(function(notificationId, buttonIndex) {
  if (buttonIndex === 0) {
    chrome.notifications.clear(notificationId);
    chrome.storage.local.get(['lastYouTubeVideoId', 'isLive', 'lastTikTokVideoUrl'], (result) => {
      if (notificationId.includes(NOTIFICATION_TYPES.YOUTUBE)) {
        const videoId = result[STORAGE_KEYS.LAST_YOUTUBE_VIDEO_ID];
        if (videoId) {
          window.open(`https://www.youtube.com/watch?v=${videoId}`);
        }
      } else if (notificationId.includes(NOTIFICATION_TYPES.TWITCH)) {
        if (result[STORAGE_KEYS.IS_LIVE]) {
          window.open(`https://www.twitch.tv/${TWITCH_USERNAME}`);
        }
      } else if (notificationId.includes(NOTIFICATION_TYPES.TIKTOK)) {
        const videoUrl = result[STORAGE_KEYS.LAST_TIKTOK_VIDEO_URL];
        if (videoUrl) {
          window.open(videoUrl);
        }
      }
    });
  }
});

// Fonction pour obtenir l'état précédent de live
function getIsLive() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.IS_LIVE], (result) => {
      resolve(result[STORAGE_KEYS.IS_LIVE] || false);
    });
  });
}

async function authenticateTwitch() {
  try {
    const redirectURL = chrome.identity.getRedirectURL();
    const clientId = TWITCH_CLIENT_ID;
    const scopes = 'user:read:subscriptions';
    
    // Ajout des paramètres nécessaires pour Twitch OAuth
    const authUrl = `https://id.twitch.tv/oauth2/authorize?` +
      `client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectURL)}` +
      `&response_type=token` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&force_verify=true`;
    
    console.log('URL d\'authentification:', authUrl);
    
    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    });
    
    console.log('URL de réponse:', responseUrl);
    
    if (responseUrl) {
      const hash = new URL(responseUrl).hash;
      const accessToken = new URLSearchParams(hash.substr(1)).get('access_token');
      
      if (accessToken) {
        // Vérifier que le token est valide
        const validateResponse = await fetch('https://id.twitch.tv/oauth2/validate', {
          headers: {
            'Authorization': `OAuth ${accessToken}`
          }
        });
        
        if (validateResponse.ok) {
          chrome.storage.local.set({ 'twitchUserToken': accessToken });
          return accessToken;
        }
      }
    }
    throw new Error('Échec de l\'authentification');
  } catch (error) {
    console.error('Erreur d\'authentification Twitch:', error);
    return null;
  }
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
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Renouvellement d\'abonnement Twitch',
          message: `Votre abonnement à ${TWITCH_USERNAME} sera renouvelé demain !`,
          buttons: [{ title: 'Voir l\'abonnement' }],
          requireInteraction: true
        });
      }
    }
  } catch (error) {
    console.error('Erreur lors de la vérification de l\'abonnement:', error);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'authenticateTwitch') {
    authenticateTwitch()
      .then(token => {
        if (token) {
          sendResponse({ success: true, token });
        } else {
          sendResponse({ success: false, error: 'Échec de l\'authentification' });
        }
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Indique que nous allons envoyer une réponse de manière asynchrone
  }
});