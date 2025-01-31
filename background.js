const TWITCH_USERNAME = "AymenZeR";
const TWITCH_CLIENT_ID = "8xiery290o0ioczddjogf337p1etp7";
const TWITCH_CLIENT_SECRET = "sz36mo8huivxyd3bqtbzhqq2ukkk7y";

// Configuration par défaut
const DEFAULT_CHECK_INTERVAL = 60; // Vérification toutes les 60 secondes

// Clés de stockage
const STORAGE_KEYS = {
  TWITCH_DATA: 'twitchData',
  LAST_CHECK: 'lastCheck',
  IS_LIVE: 'isLive',
  TWITCH_CONNECTION: 'twitchConnection'
};

// Configuration par défaut des paramètres
const DEFAULT_SETTINGS = {
  streamNotifications: true,
  notificationSound: 'default',
  checkFrequency: 60,
  autoRefresh: true,
  theme: 'dark',
  debugMode: false
};

// Ajout des constantes pour le scraping
const SCRAPING_STORAGE_KEY = 'web_subreddit_scraping';
const SCRAPING_SCRIPT_PATH = 'scraper_web_subreddit.py';

// Fonction principale pour configurer les alarmes
function setupAlarms(checkInterval = DEFAULT_CHECK_INTERVAL) {
  // Convertir l'intervalle en minutes (minimum 1 minute)
  const intervalInMinutes = Math.max(1, checkInterval / 60);
  
  console.log("Configuration des alarmes avec un intervalle de", intervalInMinutes, "minutes");
  
  // Supprimer toute alarme existante
  chrome.alarms.clearAll(() => {
    console.log("Alarmes précédentes supprimées");
    // Créer une nouvelle alarme
    chrome.alarms.create("checkTwitchStream", {
      delayInMinutes: 1, // Commencer après 1 minute
      periodInMinutes: intervalInMinutes
    });
    console.log("Nouvelle alarme créée");
    
    // Vérifier que l'alarme a bien été créée
    chrome.alarms.getAll((alarms) => {
      console.log("Alarmes actives après création:", alarms);
    });
  });
}

// Écouteur d'alarme principal
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "checkTwitchStream") {
    try {
      // Vérifier le temps écoulé depuis la dernière vérification
      const storage = await chrome.storage.local.get([STORAGE_KEYS.LAST_CHECK]);
      const now = Date.now();
      const lastCheck = storage[STORAGE_KEYS.LAST_CHECK]?.twitch || 0;
      const timeSinceLastCheck = now - lastCheck;
      
      // Ne vérifier que si au moins 1 minute s'est écoulée
      if (timeSinceLastCheck >= 60000) {
        await checkTwitch();
      }
    } catch (error) {
      console.error("Erreur lors de la vérification du stream:", error);
    }
  } else if (alarm.name === 'monitorTwitchToken') {
    monitorTwitchToken();
  }
});

// Lors de l'installation de l'extension
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.sync.set({
    extensionSettings: DEFAULT_SETTINGS
  });

  await chrome.storage.local.set({
    checkFrequency: DEFAULT_SETTINGS.checkFrequency,
    isLive: false,
  });

  // Configurer les alarmes
  setupAlarms(DEFAULT_SETTINGS.checkFrequency);

  // Configurer les notifications initiales
  updateNotificationSettings(DEFAULT_SETTINGS);

  // Vérification initiale
  checkTwitch().catch((error) => {
    console.error("Erreur lors de la vérification initiale:", error);
  });
});

// Écouter les changements de fréquence de vérification
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "updateCheckFrequency":
      const newFrequency = request.frequency;
      chrome.storage.local.set({ checkFrequency: newFrequency });
      setupAlarms(newFrequency);
      sendResponse({ success: true });
      return true;

    case "getSubscriptionInfo":
      getSubscriptionInfo(request.broadcaster)
        .then(subData => {
          sendResponse({ success: true, subData });
        })
        .catch(error => {
          console.error("Erreur lors de la récupération des infos d'abonnement:", error);
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case "checkTwitchStatus":
      checkTwitch()
        .then(streamData => sendResponse({
          streamData,
          isLive: streamData && streamData.data && streamData.data.length > 0,
        }))
        .catch(error => sendResponse({ error: error.message }));
      return true;

    case "checkTwitch":
      checkTwitch()
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    case "testTwitchNotification":
      const testNotificationOptions = {
        type: "basic",
        iconUrl: DEFAULT_ICON,
        title: "Test Notification Twitch",
        message: "Ceci est une notification de test pour Twitch.",
        buttons: [{ title: "Regarder" }],
        requireInteraction: true,
        priority: 2,
        isFirstTime: true,
      };

      chrome.notifications.create(
        "testTwitch",
        testNotificationOptions,
        (notificationId) => {
          if (chrome.runtime.lastError) {
            console.error("Erreur détaillée de notification:", {
              errorMessage: chrome.runtime.lastError.message,
              notificationOptions: testNotificationOptions,
            });
            sendResponse({
              success: false,
              error: chrome.runtime.lastError.message,
              details: JSON.stringify(testNotificationOptions),
            });
          } else {
            console.log("Notification Twitch de test créée avec succès");
            sendResponse({ success: true, notificationId: notificationId });
          }
        }
      );
      return true;

    case "getLogs":
      chrome.storage.local.get(["logs"], (result) => {
        sendResponse({ logs: result.logs || [] });
      });
      return true;

    case "authenticateTwitch":
      authenticateTwitch()
        .then(response => sendResponse(response))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case "updateSettings":
      // Récupérer les paramètres actuels
      chrome.storage.sync.get('extensionSettings', (result) => {
        const currentSettings = result.extensionSettings || DEFAULT_SETTINGS;
        const newSettings = { ...currentSettings, ...request.settings };

        // Sauvegarder les nouveaux paramètres
        chrome.storage.sync.set({ extensionSettings: newSettings }, () => {
          // Ajuster les alarmes
          setupAlarms(newSettings.checkFrequency);

          // Gérer les notifications
          updateNotificationSettings(newSettings);

          // Mode débogage
          if (newSettings.debugMode) {
            debugLog('Paramètres mis à jour', newSettings);
          }

          // Propager le changement de thème
          chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
              chrome.tabs.sendMessage(tab.id, {
                action: 'applyTheme',
                theme: newSettings.theme
              });
            });
          });

          // Répondre au message
          sendResponse({ 
            success: true, 
            settings: newSettings,
            message: 'Paramètres mis à jour avec succès' 
          });
        });
      });
      return true;

    case "getSettings":
      // Récupérer les paramètres actuels
      chrome.storage.sync.get('extensionSettings', (result) => {
        const currentSettings = result.extensionSettings || DEFAULT_SETTINGS;
        sendResponse({ 
          success: true, 
          settings: currentSettings 
        });
      });
      return true;

    case "updateTheme":
      // Propager le changement de thème à toutes les fenêtres
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, {
            action: 'applyTheme',
            theme: request.theme
          });
        });
      });
      sendResponse({ success: true });
      return true;

    case "getTwitchUsername":
      chrome.storage.local.get('twitchUserToken', async (result) => {
        if (result.twitchUserToken) {
          try {
            // Valider le token avant de l'utiliser
            const validationResult = await validateTwitchToken(result.twitchUserToken);
            
            if (validationResult.valid) {
              sendResponse({ 
                success: true, 
                username: validationResult.userData.login 
              });
            } else {
              // Tenter de rafraîchir le token
              const refreshResult = await refreshTwitchToken();
              
              if (refreshResult.success) {
                // Nouveau token obtenu
                sendResponse({ 
                  success: true, 
                  username: refreshResult.userData.login 
                });
              } else {
                // Échec du rafraîchissement
                sendResponse({ 
                  success: false, 
                  error: 'Token invalide ou expiré' 
                });
              }
            }
          } catch (error) {
            sendResponse({ 
              success: false, 
              error: error.message 
            });
          }
        } else {
          sendResponse({ 
            success: false, 
            error: 'Non connecté à Twitch' 
          });
        }
      });
      return true;

    case "openSettings":
      chrome.tabs.create({ 
        url: chrome.runtime.getURL('settings/settings.html') 
      });
      sendResponse({ success: true });
      return true;

    case "testNotification":
      testNotification()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    default:
      console.error("Action inconnue:", request.action);
      sendResponse({ success: false, error: "Action inconnue" });
      return false;
  }
});

const NOTIFICATION_TYPES = {
  TWITCH: "Twitch",
};

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.checkFrequency) {
    const newFrequency = changes.checkFrequency.newValue;
    if (typeof newFrequency === "number" && newFrequency > 0) {
      chrome.alarms.create("checkContent", {
        delayInMinutes: 0.1,
        periodInMinutes: newFrequency,
      });
    }
  }
});

async function checkTwitch() {
  try {
    console.log("Début de checkTwitch");
    const storage = await chrome.storage.local.get([
      STORAGE_KEYS.TWITCH_DATA,
      STORAGE_KEYS.LAST_CHECK,
      STORAGE_KEYS.IS_LIVE,
      "lastStreamNotification",
      "firstTimeNotification",
    ]);

    console.log("État actuel:", {
      wasLive: storage[STORAGE_KEYS.IS_LIVE],
      lastCheck: storage[STORAGE_KEYS.LAST_CHECK]?.twitch,
      firstTimeNotification: storage.firstTimeNotification
    });

    const now = Date.now();
    const isFirstTimeNotification = !storage.firstTimeNotification;
    const lastCheck = storage[STORAGE_KEYS.LAST_CHECK]?.twitch || 0;
    const timeSinceLastCheck = now - lastCheck;
    const wasLive = storage[STORAGE_KEYS.IS_LIVE];

    // Utiliser le cache si disponible et récent
    if (timeSinceLastCheck < 5 * 60 * 1000 && storage[STORAGE_KEYS.TWITCH_DATA]) {
      console.log("Utilisation des données Twitch en cache");
      return storage[STORAGE_KEYS.TWITCH_DATA];
    }

    // Obtenir le token
    const tokenData = await getAccessToken();
    
    if (!tokenData) {
      throw new Error("Token d'accès manquant dans la réponse");
    }

    // Obtenir les informations du stream
    const streamResponse = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${TWITCH_USERNAME}`,
      {
        headers: {
          "Client-ID": TWITCH_CLIENT_ID,
          "Authorization": `Bearer ${tokenData}`,
          "Accept": "application/json"
        }
      }
    );

    if (!streamResponse.ok) {
      const errorText = await streamResponse.text();
      throw new Error(`Erreur API Twitch (${streamResponse.status}): ${errorText}`);
    }

    const streamData = await streamResponse.json();
    const isCurrentlyLive = streamData.data && streamData.data.length > 0;

    if (isCurrentlyLive) {
      console.log("Stream détecté en direct");
      // Récupérer les informations de l'utilisateur et du jeu en parallèle
      const [userData, gameData] = await Promise.all([
        fetch(`https://api.twitch.tv/helix/users?login=${TWITCH_USERNAME}`, {
          headers: {
            'Client-ID': TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${tokenData}`
          }
        }).then(response => response.json()),
        fetch(`https://api.twitch.tv/helix/games?id=${streamData.data[0].game_id}`, {
          headers: {
            'Client-ID': TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${tokenData}`
          }
        }).then(response => response.json())
      ]);

      // Enrichir les données du stream
      streamData.data[0] = {
        ...streamData.data[0],
        profileImageUrl: userData.data[0]?.profile_image_url,
        gameImageUrl: gameData.data[0]?.box_art_url?.replace('{width}', '138').replace('{height}', '190'),
        fetchedAt: now
      };

      // Vérifier si le stream vient de passer en direct
      if (!wasLive) {
        console.log("Changement d'état : le stream vient de passer en direct");
        // Récupérer les paramètres de notification
        const { extensionSettings } = await chrome.storage.sync.get('extensionSettings');
        console.log("Paramètres de notification:", extensionSettings);
        
        if (extensionSettings?.streamNotifications) {
          console.log("Création de la notification...");
          const stream = streamData.data[0];
          // Créer la notification
          chrome.notifications.create(
            "streamLive",
            {
              type: "basic",
              iconUrl: stream.profileImageUrl || DEFAULT_ICON,
              title: "Stream en direct !",
              message: `${TWITCH_USERNAME} est en direct : ${stream.title}`,
              buttons: [{ title: "Regarder" }],
              requireInteraction: true,
              priority: 2
            },
            (notificationId) => {
              if (chrome.runtime.lastError) {
                console.error("Erreur lors de la création de la notification:", chrome.runtime.lastError);
              } else {
                console.log("Notification créée avec succès, ID:", notificationId);
              }
            }
          );

          // Sauvegarder l'état de la notification
          await chrome.storage.local.set({
            lastStreamNotification: now,
            firstTimeNotification: true
          });
        }
      }
    }

    // Mettre à jour le stockage
    await chrome.storage.local.set({
      [STORAGE_KEYS.TWITCH_DATA]: streamData,
      [STORAGE_KEYS.LAST_CHECK]: { twitch: now },
      [STORAGE_KEYS.IS_LIVE]: isCurrentlyLive,
    });

    // Envoyer un message pour mettre à jour le popup
    chrome.runtime.sendMessage({ 
      message: "update_status", 
      isLive: isCurrentlyLive, 
      streamData: isCurrentlyLive ? streamData.data[0] : null 
    });

    return streamData;
  } catch (error) {
    console.error("Erreur dans checkTwitch:", error);
    throw error;
  }
}

async function checkSubscription() {
  try {
    const token = await chrome.storage.local.get("twitchUserToken");
    if (!token.twitchUserToken) {
      return;
    }

    const response = await fetch(
      `https://api.twitch.tv/helix/subscriptions/user?broadcaster_id=${TWITCH_USERNAME}`,
      {
        headers: {
          Authorization: `Bearer ${token.twitchUserToken}`,
          "Client-Id": TWITCH_CLIENT_ID,
        },
      }
    );

    const data = await response.json();
    if (data.data && data.data.length > 0) {
      const sub = data.data[0];
      const renewalDate = new Date(sub.expires_at);
      const today = new Date();
      const diffDays = Math.ceil((renewalDate - today) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        chrome.notifications.create(
          "twitchSubscriptionRenewal",
          {
            type: "basic",
            iconUrl: chrome.runtime.getURL("icons/icon48.png"),
            title: "Renouvellement d'abonnement Twitch",
            message: `Votre abonnement à ${TWITCH_USERNAME} sera renouvelé demain !`,
            buttons: [{ title: "Voir l'abonnement" }],
            requireInteraction: true,
          },
          (notificationId) => {
            if (chrome.runtime.lastError) {
              console.error(
                "Erreur création notification de renouvellement d'abonnement Twitch:",
                chrome.runtime.lastError
              );
            }
          }
        );
      }
    }
  } catch (error) {
    console.error("Erreur dans checkSubscription:", error);
  }
}

// Fonction pour récupérer l'état isLive du stockage
function getIsLive() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["isLive"], (result) => {
      resolve(result.isLive || false);
    });
  });
}

// Ajouter une fonction pour vérifier l'état des alarmes
function checkAlarms() {
  chrome.alarms.getAll((alarms) => {
    console.log("Alarmes actives:", alarms);
    alarms.forEach((alarm) => {
    });
  });
}

// Appeler checkAlarms au démarrage
checkAlarms();

async function authenticateTwitch() {
  const clientId = TWITCH_CLIENT_ID;
  const redirectUri = chrome.identity.getRedirectURL("oauth2");
  const scope = "user:read:email channel:read:subscriptions user:read:subscriptions";
  const state = generateRandomState(16);

  console.log("URL de redirection:", redirectUri);

  const authUrl =
    `https://id.twitch.tv/oauth2/authorize?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=token&` +
    `scope=${encodeURIComponent(scope)}&` +
    `state=${state}&` +
    `force_verify=true`;

  try {
    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true,
    });

    console.log("URL de réponse:", responseUrl);

    const url = new URL(responseUrl);
    const fragment = url.hash.substring(1);
    const params = new URLSearchParams(fragment);

    const accessToken = params.get("access_token");
    if (!accessToken) {
      throw new Error("Pas de token d'accès dans la réponse");
    }

    // Validate the token immediately after getting it
    try {
      const validateResponse = await fetch('https://id.twitch.tv/oauth2/validate', {
        headers: {
          'Authorization': `OAuth ${accessToken}`
        }
      });
      
      if (!validateResponse.ok) {
        throw new Error("Token invalide");
      }
      
      const validateData = await validateResponse.json();
      console.log("Token validé:", validateData);
    } catch (error) {
      throw new Error(`Erreur de validation du token: ${error.message}`);
    }

    // Sauvegarder le token
    await chrome.storage.local.set({
      twitchUserToken: accessToken,
      twitchTokenTimestamp: Date.now(),
    });

    return { success: true, token: accessToken };
  } catch (error) {
    console.error("Erreur d'authentification:", error);
    return { success: false, error: error.message };
  }
}

function generateRandomState(length) {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map((x) => charset[x % charset.length])
    .join("");
}

// Fonction pour convertir le tier Twitch en texte lisible
function convertTierToText(tier) {
  switch(tier) {
    case '1000': return 'Tier 1';
    case '2000': return 'Tier 2';
    case '3000': return 'Tier 3';
    default: return 'Tier Inconnu';
  }
}

// Ajouter cette nouvelle fonction pour récupérer les informations d'abonnement
async function getSubscriptionInfo(broadcasterLogin) {
  try {
    // Vérifier si on a un token utilisateur
    const storage = await chrome.storage.local.get(['twitchUserToken', 'twitchTokenTimestamp']);
    
    // Si pas de token, retourner un objet indiquant que l'utilisateur n'est pas connecté
    if (!storage.twitchUserToken) {
      return {
        isSubscribed: false,
        isAuthenticated: false,
        message: "Non connecté à Twitch"
      };
    }

    // Vérifier si le token n'est pas expiré (plus de 4 heures)
    const tokenAge = Date.now() - (storage.twitchTokenTimestamp || 0);
    if (tokenAge > 4 * 60 * 60 * 1000) { // 4 heures en millisecondes
      return {
        isSubscribed: false,
        isAuthenticated: false,
        message: "Token expiré, veuillez vous reconnecter"
      };
    }

    // D'abord, obtenir l'ID du broadcaster
    const broadcasterResponse = await fetch(
      `https://api.twitch.tv/helix/users?login=${broadcasterLogin}`,
      {
        headers: {
          'Authorization': `Bearer ${storage.twitchUserToken}`,
          'Client-Id': TWITCH_CLIENT_ID,
          'Accept': 'application/json'
        },
        mode: 'cors'
      }
    );

    if (!broadcasterResponse.ok) {
      const errorText = await broadcasterResponse.text();
      console.error("Erreur broadcaster response:", errorText);
      throw new Error(`Impossible de récupérer les informations du broadcaster: ${broadcasterResponse.status}`);
    }

    const broadcasterData = await broadcasterResponse.json();
    if (!broadcasterData.data || broadcasterData.data.length === 0) {
      throw new Error("Broadcaster non trouvé");
    }

    const broadcasterId = broadcasterData.data[0].id;
    console.log("Broadcaster ID obtenu:", broadcasterId);

    // Obtenir l'ID de l'utilisateur connecté
    const userResponse = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        'Authorization': `Bearer ${storage.twitchUserToken}`,
        'Client-Id': TWITCH_CLIENT_ID,
        'Accept': 'application/json'
      },
      mode: 'cors'
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error("Erreur user response:", errorText);
      throw new Error(`Impossible de récupérer les informations de l'utilisateur: ${userResponse.status}`);
    }

    const userData = await userResponse.json();
    if (!userData.data || userData.data.length === 0) {
      throw new Error("Impossible de récupérer l'ID de l'utilisateur");
    }

    const userId = userData.data[0].id;
    console.log("User ID obtenu:", userId);

    // Ensuite, vérifier l'abonnement avec les deux IDs
    const subResponse = await fetch(
      `https://api.twitch.tv/helix/subscriptions/user?broadcaster_id=${broadcasterId}&user_id=${userId}`,
      {
        headers: {
          'Authorization': `Bearer ${storage.twitchUserToken}`,
          'Client-Id': TWITCH_CLIENT_ID,
          'Accept': 'application/json'
        },
        mode: 'cors'
      }
    );

    if (!subResponse.ok) {
      const errorText = await subResponse.text();
      console.error("Erreur subscription response:", errorText);
      throw new Error(`Impossible de récupérer les informations d'abonnement: ${subResponse.status}`);
    }

    const subData = await subResponse.json();
    console.log("Données d'abonnement reçues:", subData);
    
    if (!subData.data || subData.data.length === 0) {
      return {
        isSubscribed: false,
        isAuthenticated: true
      };
    }

    const subscription = subData.data[0];
    return {
      isSubscribed: true,
      isAuthenticated: true,
      tier: subscription.tier,
      tierText: convertTierToText(subscription.tier),
      end_date: new Date(subscription.expires_at || Date.now() + (30 * 24 * 60 * 60 * 1000)),
      broadcaster_name: subscription.broadcaster_name,
      plan_name: subscription.plan_name,
      // Ajouter des informations sur le gift si disponible
      gifter: subscription.gifter_name ? {
        name: subscription.gifter_name,
        message: `Abonnement offert par ${subscription.gifter_name}`
      } : null
    };

  } catch (error) {
    console.error("Erreur détaillée dans getSubscriptionInfo:", error);
    
    // Retourner un objet avec plus d'informations en cas d'erreur
    return {
      isSubscribed: false,
      isAuthenticated: false,
      message: error.message
    };
  }
}

// Suppression de l'alarme de scraping mensuel
chrome.alarms.clearAll();

// Fonction pour mettre à jour les paramètres de notification
function updateNotificationSettings(settings) {
  // Configurer les notifications en fonction des paramètres
  if (settings.streamNotifications) {
    // Les notifications sont déjà gérées par les écouteurs globaux
    console.log('Notifications activées');
  } else {
    console.log('Notifications désactivées');
  }

  // Gérer le son des notifications
  switch (settings.notificationSound) {
    case 'default':
      // Utiliser le son par défaut
      break;
    case 'twitch':
      // Charger un son personnalisé Twitch
      break;
    case 'none':
      // Désactiver le son
      break;
  }
}

// Gestionnaires des notifications
const notificationHandlers = {
  // Gestionnaire de clic sur les notifications
  onClick: (notificationId) => {
    if (notificationId === "streamLive") {
      chrome.tabs.create({ 
        url: `https://www.twitch.tv/${TWITCH_USERNAME}` 
      });
    }
  },

  // Gestionnaire de clic sur les boutons de notification
  onButtonClick: (notificationId, buttonIndex) => {
    if (notificationId === "streamLive" && buttonIndex === 0) {
      chrome.tabs.create({ 
        url: `https://www.twitch.tv/${TWITCH_USERNAME}` 
      });
    }
  }
};

// Enregistrer les gestionnaires
chrome.notifications.onClicked.addListener(notificationHandlers.onClick);
chrome.notifications.onButtonClicked.addListener(notificationHandlers.onButtonClick);

// Fonction de débogage améliorée
function debugLog(message, settings) {
  if (settings.debugMode) {
    console.log(`[DEBUG] ${message}`);
  }
}

// Charger les paramètres au démarrage
chrome.storage.sync.get('extensionSettings', (result) => {
  const settings = result.extensionSettings || DEFAULT_SETTINGS;
  setupAlarms(settings.checkFrequency);
});

// Fonction pour gérer l'auto-refresh si activé
function handleAutoRefresh(settings) {
  if (settings.autoRefresh) {
    // Implémenter la logique d'actualisation automatique
    chrome.tabs.query({ url: `https://www.twitch.tv/${TWITCH_USERNAME}` }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.reload(tabs[0].id);
      }
    });
  }
}

// Ajouter une fonction de vérification des paramètres
function validateSettings(settings) {
  const validatedSettings = { ...DEFAULT_SETTINGS };
  
  // Valider chaque paramètre
  validatedSettings.streamNotifications = !!settings.streamNotifications;
  validatedSettings.notificationSound = 
    ['default', 'twitch', 'none'].includes(settings.notificationSound) 
      ? settings.notificationSound 
      : DEFAULT_SETTINGS.notificationSound;
  
  validatedSettings.checkFrequency = 
    settings.checkFrequency > 0 
      ? Math.min(settings.checkFrequency, 600) // Limiter à 10 minutes max
      : DEFAULT_SETTINGS.checkFrequency;
  
  validatedSettings.autoRefresh = !!settings.autoRefresh;
  validatedSettings.theme = 
    ['dark', 'light', 'neon'].includes(settings.theme) 
      ? settings.theme 
      : DEFAULT_SETTINGS.theme;
  
  validatedSettings.debugMode = !!settings.debugMode;

  return validatedSettings;
}

// Fonction pour valider le token Twitch
async function validateTwitchToken(token) {
  try {
    const validateResponse = await fetch('https://id.twitch.tv/oauth2/validate', {
      headers: {
        'Authorization': `OAuth ${token}`
      }
    });
    
    if (!validateResponse.ok) {
      // Token invalide
      return { 
        valid: false, 
        error: 'Token invalide ou expiré' 
      };
    }
    
    const validateData = await validateResponse.json();
    
    // Vérifier la validité du token
    const isValid = validateData.expires_in > 0 && 
                    validateData.client_id === TWITCH_CLIENT_ID;
    
    return {
      valid: isValid,
      userData: {
        login: validateData.login,
        user_id: validateData.user_id,
        expires_in: validateData.expires_in,
        scopes: validateData.scopes
      }
    };
  } catch (error) {
    console.error('Erreur de validation du token:', error);
    return { 
      valid: false, 
      error: `Erreur de validation: ${error.message}` 
    };
  }
}

// Fonction pour rafraîchir le token Twitch
async function refreshTwitchToken() {
  try {
    // Récupérer le token actuel et son timestamp
    const storage = await chrome.storage.local.get(['twitchUserToken', 'twitchTokenTimestamp']);
    
    if (!storage.twitchUserToken) {
      throw new Error('Aucun token existant');
    }
    
    // Valider le token actuel
    const validationResult = await validateTwitchToken(storage.twitchUserToken);
    
    if (validationResult.valid) {
      // Token encore valide, pas besoin de le rafraîchir
      return {
        success: true,
        token: storage.twitchUserToken,
        message: 'Token toujours valide'
      };
    }
    
    // Lancer le flux d'authentification pour obtenir un nouveau token
    const authResult = await authenticateTwitch();
    
    if (!authResult.success) {
      throw new Error('Échec de la réauthentification');
    }
    
    return {
      success: true,
      token: authResult.token,
      message: 'Token rafraîchi avec succès'
    };
  } catch (error) {
    console.error('Erreur lors du rafraîchissement du token:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Ajouter une fonction pour surveiller et rafraîchir automatiquement le token
async function monitorTwitchToken() {
  try {
    const storage = await chrome.storage.local.get(['twitchUserToken', 'twitchTokenTimestamp']);
    
    if (!storage.twitchUserToken) return;
    
    const tokenAge = Date.now() - (storage.twitchTokenTimestamp || 0);
    const TOKEN_REFRESH_THRESHOLD = 3 * 24 * 60 * 60 * 1000; // 3 jours
    
    if (tokenAge > TOKEN_REFRESH_THRESHOLD) {
      const refreshResult = await refreshTwitchToken();
      
      if (refreshResult.success) {
        console.log(`Token Twitch automatiquement rafraîchi`);
      } else {
        console.log(`Échec du rafraîchissement automatique du token: ${refreshResult.error}`);
      }
    }
  } catch (error) {
    console.error('Erreur lors de la surveillance du token:', error);
  }
}

// Planifier la surveillance du token
chrome.alarms.create('monitorTwitchToken', {
  periodInMinutes: 60 * 24, // Toutes les 24 heures
});

// Écouteur d'alarme pour la surveillance du token
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'monitorTwitchToken') {
    monitorTwitchToken();
  }
});

// Fonction pour obtenir un token d'accès
async function getAccessToken() {
  try {
    // Vérifier d'abord si nous avons un token utilisateur valide
    const storage = await chrome.storage.local.get(['twitchUserToken']);
    if (storage.twitchUserToken) {
      // Valider le token utilisateur
      const validationResult = await validateTwitchToken(storage.twitchUserToken);
      if (validationResult.valid) {
        return storage.twitchUserToken;
      }
    }

    // Si pas de token utilisateur valide, obtenir un token client
    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials'
      })
    });

    if (!tokenResponse.ok) {
      throw new Error(`Erreur lors de l'obtention du token: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  } catch (error) {
    console.error('Erreur dans getAccessToken:', error);
    throw error;
  }
}

// Fonction pour tester les notifications
async function testNotification() {
  console.log("Test de notification...");
  const { extensionSettings } = await chrome.storage.sync.get('extensionSettings');
  console.log("Paramètres actuels:", extensionSettings);

  chrome.notifications.create(
    "testNotification",
    {
      type: "basic",
      iconUrl: DEFAULT_ICON,
      title: "Test de Notification",
      message: "Ceci est un test de notification. Si vous voyez ceci, les notifications fonctionnent !",
      buttons: [{ title: "OK" }],
      requireInteraction: true,
      priority: 2
    },
    (notificationId) => {
      if (chrome.runtime.lastError) {
        console.error("Erreur lors du test de notification:", chrome.runtime.lastError);
      } else {
        console.log("Notification de test créée avec succès, ID:", notificationId);
      }
    }
  );
}
