const TWITCH_USERNAME = "talmo";
const TWITCH_CLIENT_ID = "8xiery290o0ioczddjogf337p1etp7";
const TWITCH_CLIENT_SECRET = "sz36mo8huivxyd3bqtbzhqq2ukkk7y";

// Configuration par défaut
const DEFAULT_CHECK_INTERVAL = 60; // Vérification toutes les 60 secondes

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
  await chrome.storage.local.set({
    checkFrequency: DEFAULT_CHECK_INTERVAL,
    logs: [],
    isLive: false,
  });

  // Configurer les alarmes
  setupAlarms();

  // Vérification initiale
  checkTwitch().catch((error) => {
    console.error("Erreur lors de la vérification initiale:", error);
    addLog(`Erreur vérification initiale: ${error.message}`);
  });
});

// Écouter les changements de fréquence de vérification
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateCheckFrequency") {
    const newFrequency = request.frequency;

    // Mettre à jour la fréquence dans le stockage local
    chrome.storage.local.set({ checkFrequency: newFrequency });

    // Reconfigurer les alarmes
    setupAlarms(newFrequency);

    sendResponse({ success: true });
    return true;
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

    if (
      timeSinceLastCheck < 5 * 60 * 1000 &&
      storage[STORAGE_KEYS.TWITCH_DATA]
    ) {
      console.log("Utilisation des données Twitch en cache");
      return storage[STORAGE_KEYS.TWITCH_DATA];
    }

    // Obtenir le token
    const tokenResponse = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        grant_type: "client_credentials",
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(
        `Erreur lors de la récupération du token: ${tokenResponse.status}`
      );
    }

    const tokenData = await tokenResponse.json();
    addLog("Token Twitch obtenu avec succès");

    // Vérifier le stream
    const streamResponse = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${TWITCH_USERNAME}`,
      {
        headers: {
          "Client-ID": TWITCH_CLIENT_ID,
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      }
    );

    if (!streamResponse.ok) {
      throw new Error(
        `Erreur lors de la vérification du stream: ${streamResponse.status}`
      );
    }

    const streamData = await streamResponse.json();
    console.log("Données du stream:", streamData);

    const isLive = streamData.data && streamData.data.length > 0;
    const wasLive = await getIsLive();

    // Mettre à jour l'état isLive dans le stockage
    await chrome.storage.local.set({
      [STORAGE_KEYS.TWITCH_DATA]: streamData,
      [STORAGE_KEYS.IS_LIVE]: isLive,
      [STORAGE_KEYS.LAST_CHECK]: {
        ...storage[STORAGE_KEYS.LAST_CHECK],
        twitch: now,
      },
    });

    // Vérifier si c'est un nouveau stream différent du dernier stream notifié
    const currentStreamId = isLive ? streamData.data[0].id : null;
    const lastNotifiedStreamId = storage.lastStreamNotification;

    // Logs détaillés sur l'état du stream
    addLog(`État du stream:`);
    addLog(`- Stream en direct : ${isLive}`);
    addLog(`- Était en direct précédemment : ${wasLive}`);
    addLog(`- ID du stream actuel : ${currentStreamId}`);
    addLog(`- ID du dernier stream notifié : ${lastNotifiedStreamId}`);

    // Conditions pour envoyer une notification
    const shouldSendNotification =
      isLive && // Le stream est en ligne
      !wasLive && // Le stream n'était pas en ligne avant
      currentStreamId !== lastNotifiedStreamId; // L'ID du stream est différent du dernier stream notifié

    addLog(`Conditions pour notification :`);
    addLog(`- Doit envoyer notification : ${shouldSendNotification}`);

    if (shouldSendNotification) {
      const notificationOptions = {
        type: "basic",
        iconUrl: chrome.runtime.getURL("icons/A_AE_neon_1.png"),
        title: "AymenZeR Notifier • maintenant",
        message: `🔴 En direct\n\n${streamData.data[0].title}\n\n🎮 ${
          streamData.data[0].game_name
        }\n👥 ${streamData.data[0].viewer_count.toLocaleString()} spectateurs`,
        contextMessage: "Special Events",
        priority: 2,
        buttons: [
          { title: "▶️ Regarder le stream" },
          { title: "🔕 Ne plus afficher" },
        ],
        requireInteraction: true,
        silent: false,
      };

      chrome.notifications.create(
        `Twitch_${Date.now()}`,
        notificationOptions,
        (notificationId) => {
          addLog(`Notification créée :`);
          addLog(`- ID de notification : ${notificationId}`);

          // Marquer le stream actuel comme notifié
          chrome.storage.local.set(
            {
              lastStreamNotification: currentStreamId,
              firstTimeNotification: true,
            },
            () => {
              addLog(`Stockage mis à jour :`);
              addLog(`- Dernier stream notifié : ${currentStreamId}`);
              addLog(`- Première notification : true`);
            }
          );
        }
      );

      addLog(
        `Notification créée pour le stream de ${streamData.data[0].user_name}`
      );
    }

    return streamData;
  } catch (error) {
    console.error("Erreur Twitch:", error);
    addLog(`Erreur Twitch: ${error.message}`);
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkTwitchStatus") {
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
    return true; // Important pour l'async
  }
  switch (request.action) {
    case "checkTwitch":
      checkTwitch()
        .then(() => sendResponse({ success: true }))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
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
          console.log(
            "Tentative de création de notification:",
            testNotificationOptions
          );

          if (chrome.runtime.lastError) {
            console.error("Erreur détaillée de notification:", {
              errorMessage: chrome.runtime.lastError.message,
              notificationOptions: testNotificationOptions,
            });

            // Log plus détaillé
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
      authenticateTwitch().then(sendResponse);
      return true;

    default:
      console.error("Action inconnue:", request.action);
      sendResponse({ success: false, error: "Action inconnue" });
      return false;
  }
});

async function authenticateTwitch() {
  const clientId = TWITCH_CLIENT_ID;
  const redirectUri = chrome.identity.getRedirectURL("oauth2");
  const scope = "user:read:email user:read:subscriptions";
  const state = generateRandomState(16);

  console.log("URL de redirection:", redirectUri); // Pour vérification

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
