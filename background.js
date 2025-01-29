const TWITCH_USERNAME = "AymenZeR";
const TWITCH_CLIENT_ID = "8xiery290o0ioczddjogf337p1etp7";
const TWITCH_CLIENT_SECRET = "sz36mo8huivxyd3bqtbzhqq2ukkk7y";

// Configuration par défaut
const DEFAULT_CHECK_INTERVAL = 60; // Vérification toutes les 60 secondes

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
  // Supprimer toute alarme existante
  chrome.alarms.clearAll(() => {
    // Créer une nouvelle alarme
    chrome.alarms.create("checkTwitchStream", {
      delayInMinutes: 0.1, // Petit délai initial
      periodInMinutes: checkInterval / 60, // Convertir secondes en minutes
    });

    // Log de débogage
    addLog(
      `Alarme Twitch configurée : vérification tous les ${checkInterval} secondes`
    );
  });
}

// Écouteur d'alarme principal
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "checkTwitchStream") {
    try {
      await checkTwitch();
    } catch (error) {
      console.error("Erreur lors de la vérification du stream:", error);
      addLog(`Erreur de vérification du stream : ${error.message}`);
    }
  }
});

// Lors de l'installation de l'extension
chrome.runtime.onInstalled.addListener(async () => {
  // Configuration initiale du stockage
  await chrome.storage.sync.set({
    extensionSettings: DEFAULT_SETTINGS
  });

  await chrome.storage.local.set({
    checkFrequency: DEFAULT_SETTINGS.checkFrequency,
    logs: [],
    isLive: false,
  });

  // Configurer les alarmes
  setupAlarms(DEFAULT_SETTINGS.checkFrequency);

  // Configurer les notifications initiales
  updateNotificationSettings(DEFAULT_SETTINGS);

  // Vérification initiale
  checkTwitch().catch((error) => {
    console.error("Erreur lors de la vérification initiale:", error);
    addLog(`Erreur vérification initiale: ${error.message}`);
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
      chrome.storage.local.get(
        [STORAGE_KEYS.TWITCH_DATA, STORAGE_KEYS.IS_LIVE],
        async (result) => {
          console.log("Données récupérées pour checkTwitchStatus:", result);

          if (result[STORAGE_KEYS.TWITCH_DATA]) {
            sendResponse({
              streamData: result[STORAGE_KEYS.TWITCH_DATA],
              isLive: result[STORAGE_KEYS.IS_LIVE],
            });
          } else {
            try {
              const streamData = await checkTwitch();
              sendResponse({
                streamData,
                isLive: streamData.data && streamData.data.length > 0,
              });
            } catch (error) {
              sendResponse({ error: error.message });
            }
          }
        }
      );
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
            addLog(`Erreur notification test complet: 
            - Message: ${chrome.runtime.lastError.message}
            - Options: ${JSON.stringify(testNotificationOptions)}`);
            sendResponse({
              success: false,
              error: chrome.runtime.lastError.message,
              details: JSON.stringify(testNotificationOptions),
            });
          } else {
            console.log("Notification Twitch de test créée avec succès");
            addLog("Notification de test Twitch créée avec succès");
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

    default:
      console.error("Action inconnue:", request.action);
      sendResponse({ success: false, error: "Action inconnue" });
      return false;
  }
});

const NOTIFICATION_TYPES = {
  TWITCH: "Twitch",
};

const STORAGE_KEYS = {
  IS_LIVE: "isLive",
  TWITCH_DATA: "twitchData",
  LAST_CHECK: "lastCheck",
};

const DEFAULT_ICON = "icons/A_AE_neon_1.png";

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.checkFrequency) {
    const newFrequency = changes.checkFrequency.newValue;
    if (typeof newFrequency === "number" && newFrequency > 0) {
      chrome.alarms.create("checkContent", {
        delayInMinutes: 0.1,
        periodInMinutes: newFrequency,
      });
      addLog(`Fréquence de vérification mise à jour: ${newFrequency} minutes`);
    }
  }
});

// Fonction pour ajouter des logs
function addLog(message) {
  chrome.storage.local.get(["logs"], (result) => {
    const logs = result.logs || [];
    logs.push(`[${new Date().toLocaleString()}] ${message}`);
    chrome.storage.local.set({ logs });
  });
}

async function checkTwitch() {
  try {
    const storage = await chrome.storage.local.get([
      STORAGE_KEYS.TWITCH_DATA,
      STORAGE_KEYS.LAST_CHECK,
      "lastStreamNotification",
      "firstTimeNotification",
    ]);

    const now = Date.now();
    const isFirstTimeNotification = !storage.firstTimeNotification;
    const lastCheck = storage[STORAGE_KEYS.LAST_CHECK]?.twitch || 0;
    const timeSinceLastCheck = now - lastCheck;

    // Logs de débogage pour comprendre l'état initial
    addLog(`Début de checkTwitch() - Détails de l'état:`);
    addLog(`- Première notification : ${isFirstTimeNotification}`);
    addLog(
      `- Dernier stream notifié : ${storage.lastStreamNotification || "Aucun"}`
    );
    addLog(
      `- Temps depuis dernière vérification : ${
        timeSinceLastCheck / 1000
      } secondes`
    );

    // Utiliser le cache si disponible et récent
    if (
      timeSinceLastCheck < 5 * 60 * 1000 &&
      storage[STORAGE_KEYS.TWITCH_DATA]
    ) {
      console.log("Utilisation des données Twitch en cache");
      return storage[STORAGE_KEYS.TWITCH_DATA];
    }

    // Obtenir le token avec gestion d'erreur améliorée
    let tokenResponse;
    try {
      tokenResponse = await fetch("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json"
        },
        body: new URLSearchParams({
          client_id: TWITCH_CLIENT_ID,
          client_secret: TWITCH_CLIENT_SECRET,
          grant_type: "client_credentials",
        }),
        mode: "cors"
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        addLog(`Erreur token Twitch: Status ${tokenResponse.status}, Response: ${errorText}`);
        throw new Error(`Erreur token Twitch (${tokenResponse.status}): ${errorText}`);
      }
    } catch (error) {
      addLog(`Erreur fetch token Twitch: ${error.message}`);
      throw new Error(`Erreur lors de la récupération du token: ${error.message}`);
    }

    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      addLog("Token d'accès manquant dans la réponse");
      throw new Error("Token d'accès manquant dans la réponse");
    }

    // Obtenir les informations du stream
    const streamResponse = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${TWITCH_USERNAME}`,
      {
        headers: {
          "Client-ID": TWITCH_CLIENT_ID,
          "Authorization": `Bearer ${tokenData.access_token}`,
          "Accept": "application/json"
        },
        mode: "cors"
      }
    );

    if (!streamResponse.ok) {
      const errorText = await streamResponse.text();
      addLog(`Erreur API Twitch: Status ${streamResponse.status}, Response: ${errorText}`);
      throw new Error(`Erreur API Twitch (${streamResponse.status}): ${errorText}`);
    }

    const streamData = await streamResponse.json();

    // Mettre à jour le stockage
    await chrome.storage.local.set({
      [STORAGE_KEYS.TWITCH_DATA]: streamData,
      [STORAGE_KEYS.LAST_CHECK]: { twitch: now },
      [STORAGE_KEYS.IS_LIVE]: streamData.data && streamData.data.length > 0,
    });

    return streamData;
  } catch (error) {
    addLog(`Erreur dans checkTwitch: ${error.message}`);
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
              addLog(
                `Erreur création notification renouvellement Twitch: ${chrome.runtime.lastError.message}`
              );
            } else {
              addLog(
                "Notification renouvellement abonnement Twitch déclenchée."
              );
            }
          }
        );
      }
    }
  } catch (error) {
    console.error("Erreur dans checkSubscription:", error);
    addLog(`Erreur checkSubscription: ${error.message}`);
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
    addLog(`Nombre d'alarmes actives: ${alarms.length}`);
    alarms.forEach((alarm) => {
      addLog(
        `Alarme ${alarm.name}: prochaine exécution dans ${Math.round(
          (alarm.scheduledTime - Date.now()) / 1000
        )} secondes`
      );
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
    addLog(`Erreur getSubscriptionInfo: ${error.message}`);
    
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
    // Activer les notifications
    chrome.notifications.onClicked.addListener(handleNotificationClick);
  } else {
    // Désactiver les notifications
    chrome.notifications.onClicked.removeListener(handleNotificationClick);
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

// Gestionnaire de clic sur les notifications
function handleNotificationClick(notificationId) {
  // Ouvrir le stream Twitch ou effectuer une action spécifique
  chrome.tabs.create({ 
    url: `https://www.twitch.tv/${TWITCH_USERNAME}` 
  });
}

// Fonction de débogage améliorée
function debugLog(message, settings) {
  if (settings.debugMode) {
    console.log(`[DEBUG] ${message}`);
    addLog(message);
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
        addLog(`Token Twitch automatiquement rafraîchi`);
      } else {
        addLog(`Échec du rafraîchissement automatique du token: ${refreshResult.error}`);
      }
    }
  } catch (error) {
    console.error('Erreur lors de la surveillance du token:', error);
    addLog(`Erreur de surveillance du token: ${error.message}`);
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
