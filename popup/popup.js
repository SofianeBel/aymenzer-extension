// ===== Constantes et Configuration =====
const STORAGE_KEYS = {
  IS_LIVE: "isLive",
  TWITCH_DATA: "twitchData",
  LAST_CHECK: "lastCheck",
  SUB_INFO: "subInfo",
  TWITCH_CONNECTION: "twitchConnection"
};

// ===== Système de gestion des erreurs et logs =====
const Logger = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  
  level: 1, // Niveau par défaut : INFO

  log(level, message, error = null) {
    if (level >= this.level) {
      const timestamp = new Date().toISOString();
      const prefix = ['DEBUG', 'INFO', 'WARN', 'ERROR'][level];
      console.log(`[${timestamp}] [${prefix}] ${message}`);
      if (error) {
        console.error(error);
      }
    }
  },

  debug(message) { this.log(this.DEBUG, message); },
  info(message) { this.log(this.INFO, message); },
  warn(message, error = null) { this.log(this.WARN, message, error); },
  error(message, error = null) { this.log(this.ERROR, message, error); }
};

// ===== Système de gestion du cache =====
const Cache = {
  storage: new Map(),

  set(key, value, ttl = 60000) { // TTL par défaut : 1 minute
    this.storage.set(key, {
      value,
      expiry: Date.now() + ttl
    });
    Logger.debug(`Cache: Set ${key} with TTL ${ttl}ms`);
  },

  get(key) {
    const item = this.storage.get(key);
    if (!item) {
      Logger.debug(`Cache: Miss for ${key}`);
      return null;
    }
    if (Date.now() > item.expiry) {
      Logger.debug(`Cache: Expired for ${key}`);
      this.storage.delete(key);
      return null;
    }
    Logger.debug(`Cache: Hit for ${key}`);
    return item.value;
  },

  clear() {
    this.storage.clear();
    Logger.debug('Cache: Cleared');
  }
};

// ===== Système de retry pour les appels réseau =====
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let retries = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      retries++;
      if (retries > maxRetries) {
        Logger.error('Max retries reached', error);
        throw error;
      }
      const delay = baseDelay * Math.pow(2, retries - 1);
      Logger.warn(`Retry ${retries}/${maxRetries} after ${delay}ms`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// ===== Fonction de mise à jour de l'interface utilisateur =====
function updateUIState(connectionData) {
  const connectBtn = document.getElementById('twitch-connect-btn');
  const disconnectBtn = document.getElementById('twitch-disconnect-btn');
  const subInfoDiv = document.getElementById('subInfo');

  if (!connectBtn || !disconnectBtn || !subInfoDiv) {
    console.error("Éléments UI manquants");
    return;
  }

  // Vérifier si connectionData est défini et valide
  if (!connectionData || typeof connectionData !== 'object') {
    // Premier lancement ou état déconnecté, pas besoin de log d'avertissement
    connectBtn.style.display = 'block';
    disconnectBtn.style.display = 'none';
    connectBtn.innerHTML = '<i class="fab fa-twitch"></i> Se connecter';
    
    updateSubscriptionInfo({
      isAuthenticated: false,
      isSubscribed: false,
      message: "Non connecté"
    });
    return;
  }

  // Vérifier si l'utilisateur est connecté
  const isConnected = Boolean(connectionData.isConnected);

  if (isConnected) {
    connectBtn.style.display = 'none';
    disconnectBtn.style.display = 'block';
    disconnectBtn.textContent = `✓ ${connectionData.username || 'Connecté'}`;
    
    // Mettre à jour les informations d'abonnement
    if (connectionData.subInfo) {
      updateSubscriptionInfo(connectionData.subInfo);
    } else {
      // Si pas d'info d'abonnement mais connecté
      updateSubscriptionInfo({
        isAuthenticated: true,
        isSubscribed: false,
        message: "Statut d'abonnement inconnu"
      });
    }
  } else {
    connectBtn.style.display = 'block';
    connectBtn.innerHTML = '<i class="fab fa-twitch"></i> Se connecter';
    disconnectBtn.style.display = 'none';
    
    // Réinitialiser les informations d'abonnement
    updateSubscriptionInfo({
      isAuthenticated: false,
      isSubscribed: false,
      message: "Non connecté"
    });
  }
}

// ===== Fonction de mise à jour des informations d'abonnement =====
function updateSubscriptionInfo(subData) {
  const subInfoElement = document.getElementById('subInfo');
  const nextPaymentDateElement = document.getElementById('nextPaymentDate');

  if (!subInfoElement) {
    console.error("Élément subInfo non trouvé");
    return;
  }

  // Vérifier si l'utilisateur est authentifié
  if (!subData.isAuthenticated) {
    subInfoElement.innerHTML = `
      <p class="sub-status not-authenticated">
        Non connecté à Twitch
      </p>
    `;
    subInfoElement.classList.remove('hidden');
    
    // Cacher l'élément de date de prochain paiement
    if (nextPaymentDateElement) {
      nextPaymentDateElement.classList.add('hidden');
    }
    
    return;
  }

  // Vérifier si l'utilisateur est abonné
  if (!subData.isSubscribed) {
    subInfoElement.innerHTML = `
      <p class="sub-status not-subscribed">
        Pas abonné à AymenZeR
      </p>
    `;
    subInfoElement.classList.remove('hidden');
    
    // Cacher l'élément de date de prochain paiement
    if (nextPaymentDateElement) {
      nextPaymentDateElement.classList.add('hidden');
    }
    
    return;
  }

  // Préparer le message du tier
  let tierMessage = `Abonné à ${subData.broadcaster_name} - ${subData.tierText}`;
  
  // Ajouter des informations sur le gifter si applicable
  if (subData.gifter) {
    tierMessage += ` (offert par ${subData.gifter.name})`;
  }

  // Mettre à jour l'élément d'information d'abonnement
  subInfoElement.innerHTML = `
    <p class="sub-status subscribed">
      ${tierMessage}
    </p>
    ${subData.plan_name ? `<p class="sub-plan">${subData.plan_name}</p>` : ''}
  `;

  // Cacher l'élément de date de prochain paiement
  if (nextPaymentDateElement) {
    nextPaymentDateElement.classList.add('hidden');
  }

  // Rendre l'élément visible
  subInfoElement.classList.remove('hidden');
}

// ===== Fonction de mise à jour des informations du stream =====
async function updateStreamInfo() {
  try {
    const streamStatus = document.getElementById('streamStatus');
    const streamDetailsDiv = document.getElementById('streamDetails');
    
    if (!streamStatus || !streamDetailsDiv) {
      Logger.error('Required DOM elements not found');
      return;
    }

    // Vérifier le cache d'abord
    const cachedData = Cache.get('streamInfo');
    if (cachedData) {
      updateUIWithData(cachedData);
      return;
    }

    const response = await retryWithBackoff(async () => {
      const result = await chrome.runtime.sendMessage({ action: 'checkTwitchStatus' });
      if (!result) throw new Error('No response from background script');
      return result;
    });

    // Mettre en cache les données
    Cache.set('streamInfo', response, 30000); // Cache pour 30 secondes
    updateUIWithData(response);

  } catch (error) {
    Logger.error('Failed to update stream info', error);
    showError('Une erreur est survenue lors de la mise à jour des informations du stream', () => updateStreamInfo());
  }
}

// Fonction pour mettre à jour l'UI avec les données
function updateUIWithData(data) {
  const streamStatus = document.getElementById('streamStatus');
  const streamDetailsDiv = document.getElementById('streamDetails');

  if (data.isLive) {
    Logger.info('Stream is live, updating UI');
    streamStatus.textContent = 'EN DIRECT';
    streamStatus.classList.add('live');
    streamDetailsDiv.style.display = 'block';
    
    // Mise à jour des détails du stream...
    updateStreamDetails(data);
  } else {
    Logger.info('Stream is offline');
    streamStatus.textContent = 'HORS LIGNE';
    streamStatus.classList.remove('live');
    streamDetailsDiv.style.display = 'none';
  }
}

// Fonction pour afficher les erreurs
function showError(message, retryCallback = null) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  
  const errorText = document.createElement('p');
  errorText.textContent = message;
  errorDiv.appendChild(errorText);

  if (retryCallback) {
    const retryButton = document.createElement('button');
    retryButton.className = 'retry-button';
    retryButton.innerHTML = '<i class="fas fa-sync-alt"></i> Réessayer';
    retryButton.onclick = () => {
      errorDiv.remove();
      retryCallback();
    };
    errorDiv.appendChild(retryButton);
  }

  const container = document.querySelector('.container');
  container.insertBefore(errorDiv, container.firstChild);
}

// ===== Fonction de rafraîchissement des données =====
const REFRESH_INTERVAL = 60000; // 60 secondes
let lastRefreshTime = 0;

async function refreshData() {
  const now = Date.now();
  if (now - lastRefreshTime < REFRESH_INTERVAL) {
    Logger.debug('Skipping refresh: too soon');
    return;
  }

  try {
    // Vérifier le cache d'abord
    const cachedData = await Cache.get('streamData');
    if (cachedData) {
      Logger.info('Using cached stream data');
      updateStreamInfo(cachedData);
      return;
    }

    // Si pas de cache, faire la requête
    const response = await chrome.runtime.sendMessage({
      action: "checkTwitchStatus"
    }).catch(error => {
      Logger.error('Background script communication error', error);
      throw new Error("Impossible de communiquer avec le background script");
    });

    if (response && response.streamData) {
      Logger.info('Stream data refreshed successfully');
      await Cache.set('streamData', response.streamData);
      updateStreamInfo(response.streamData);
      lastRefreshTime = now;
    }
  } catch (error) {
    Logger.error('Data refresh failed', error);
    const streamStatus = document.getElementById("streamStatus");
    const streamDetailsDiv = document.getElementById("stream-details");
    
    if (streamStatus && streamDetailsDiv) {
      streamStatus.textContent = "ERREUR";
      streamStatus.classList.remove("live");
      streamStatus.classList.add("offline");
      streamDetailsDiv.innerHTML = `
        <div class="error-message">
          <p>Impossible de rafraîchir les données.</p>
          <button onclick="refreshData()" class="retry-button">
            <i class="fas fa-sync-alt"></i> Réessayer
          </button>
        </div>
      `;
    }
  }
}

// ===== Gestionnaire principal du chargement de la page =====
document.addEventListener("DOMContentLoaded", async () => {
  // ===== Animation de démarrage =====
  const splashScreen = document.querySelector(".splash-screen");
  const neonLogo = document.querySelector(".neon-logo");
  const mainContent = document.querySelector(".main-content");
  const electricExplosion = document.querySelector(".electric-explosion");

  // Animation du logo néon
  setTimeout(() => {
    electricExplosion.style.animation = "electricExplosion 0.5s ease-out";
    setTimeout(() => {
      splashScreen.style.display = "none";
      mainContent.classList.add("visible");
    }, 500);
  }, 1000);

  // ===== Initialiser les éléments d'abonnement =====
  initializeSubscriptionElements();

  // ===== Initialisation de l'interface au premier lancement =====
  const initialConnectBtn = document.getElementById('twitch-connect-btn');
  const initialDisconnectBtn = document.getElementById('twitch-disconnect-btn');
  const initialSubInfoDiv = document.getElementById('subInfo');

  if (initialConnectBtn && initialDisconnectBtn && initialSubInfoDiv) {
    // État par défaut au premier lancement
    initialConnectBtn.style.display = 'block';
    initialDisconnectBtn.style.display = 'none';
    initialConnectBtn.innerHTML = '<i class="fab fa-twitch"></i> Se connecter';
    
    // Initialiser l'état de l'abonnement
    updateSubscriptionInfo({
      isAuthenticated: false,
      isSubscribed: false,
      message: "Non connecté"
    });
  }

  // ===== Charger l'état depuis le stockage =====
  try {
    const storedData = await chrome.storage.local.get([
      'twitchUserToken',
      'twitchConnectionStatus',
      'twitchUsername',
      STORAGE_KEYS.TWITCH_CONNECTION
    ]);

    // Si nous avons des données de connexion stockées, les utiliser
    if (storedData[STORAGE_KEYS.TWITCH_CONNECTION] && 
        storedData.twitchUserToken && 
        storedData.twitchConnectionStatus) {
      console.log("Données de connexion trouvées, restauration de l'état");
      updateUIState(storedData[STORAGE_KEYS.TWITCH_CONNECTION]);
      
      // Vérifier si le token est toujours valide
      await checkTwitchConnectionStatus();
    } else {
      console.log("Premier lancement ou non connecté");
    }
  } catch (error) {
    console.error("Erreur lors du chargement de l'état initial:", error);
  }

  // ===== Écouteur des changements de stockage =====
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local") {
      console.log("Changements dans le stockage local:", changes);

      if (changes[STORAGE_KEYS.TWITCH_DATA]) {
        const newStreamData = changes[STORAGE_KEYS.TWITCH_DATA].newValue;
        console.log("Nouvelles données de stream:", newStreamData);
        updateStreamInfo(newStreamData);
      }

      if (changes[STORAGE_KEYS.IS_LIVE]) {
        const isLive = changes[STORAGE_KEYS.IS_LIVE].newValue;
        console.log("Nouvel état live:", isLive);
      }

      if (changes[STORAGE_KEYS.TWITCH_CONNECTION]) {
        const connectionData = changes[STORAGE_KEYS.TWITCH_CONNECTION].newValue;
        updateUIState(connectionData);
      }
    }
  });

  // ===== Fonction de mise à jour du statut =====
  function updateStatus() {
    chrome.storage.local.get(
      [STORAGE_KEYS.TWITCH_DATA, STORAGE_KEYS.IS_LIVE],
      (result) => {
        console.log("Données récupérées du stockage:", result);

        // Utiliser les données Twitch stockées
        if (result[STORAGE_KEYS.TWITCH_DATA]) {
          updateStreamInfo(result[STORAGE_KEYS.TWITCH_DATA]);
        } else {
          updateStreamInfo({ data: [] });
        }
      }
    );
  }

  // ===== Fonction de vérification du statut initial =====
  async function checkInitialStatus() {
    try {
      // Charger d'abord l'état de connexion depuis le stockage local
      const storedData = await chrome.storage.local.get([
        'twitchUserToken',
        'twitchConnectionStatus',
        'twitchUsername',
        STORAGE_KEYS.TWITCH_CONNECTION
      ]);

      // Si nous avons des données de connexion stockées, les utiliser immédiatement
      if (storedData[STORAGE_KEYS.TWITCH_CONNECTION]) {
        updateUIState(storedData[STORAGE_KEYS.TWITCH_CONNECTION]);
      }

      // Ensuite, vérifier le statut actuel
      const [streamResponse, subResponse] = await Promise.all([
        chrome.runtime.sendMessage({ action: "checkTwitchStatus" }),
        chrome.runtime.sendMessage({ 
          action: "getSubscriptionInfo",
          broadcaster: "aymenzer"
        })
      ]);

      // Mettre à jour les informations du stream
      if (streamResponse && streamResponse.streamData) {
        updateStreamInfo(streamResponse.streamData);
      }

      // Mettre à jour les informations d'abonnement
      if (subResponse) {
        if (subResponse.success && subResponse.subData) {
          // Créer un nouvel objet de connexion avec les données mises à jour
          const connectionData = {
            isConnected: true,
            username: storedData.twitchUsername,
            timestamp: Date.now(),
            subInfo: subResponse.subData
          };

          // Sauvegarder les données mises à jour
          await chrome.storage.local.set({
            [STORAGE_KEYS.TWITCH_CONNECTION]: connectionData
          });

          // Mettre à jour l'interface
          updateUIState(connectionData);
        } else {
          // En cas d'erreur ou de non-authentification
          updateSubscriptionInfo({
            isAuthenticated: false,
            isSubscribed: false,
            message: subResponse.error || "Impossible de récupérer les informations d'abonnement"
          });
        }
      }
    } catch (error) {
      console.error("Erreur lors de la vérification initiale:", error);
      updateSubscriptionInfo({
        isAuthenticated: false,
        isSubscribed: false,
        message: "Erreur de connexion"
      });
    }
  }

  // ===== Initialisation et configuration =====
  updateStatus();
  await checkInitialStatus();

  // ===== Gestion du bouton de connexion Twitch =====
  const twitchLoginButton = document.getElementById("twitchLogin");
  if (twitchLoginButton) {
    console.warn("L'ancien bouton de connexion Twitch est déprécié. Utilisez twitch-connect-btn à la place.");
  }

  // ===== Configuration du rafraîchissement automatique =====
  setInterval(refreshData, REFRESH_INTERVAL);

  // ===== Écouteur des changements dans le stockage =====
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local") {
      for (let key in changes) {
        if (key === STORAGE_KEYS.TWITCH_DATA || key === STORAGE_KEYS.IS_LIVE) {
          const newData = changes[key].newValue;
          if (key === STORAGE_KEYS.TWITCH_DATA) {
            updateStreamInfo(newData);
          }
        }
      }
    }
  });

  function updatePopup(isLive, streamData) {
    // Utiliser les IDs qui existent déjà dans le code
    const statusDiv = document.getElementById('streamStatus');
    const streamDetailsDiv = document.getElementById('stream-details');

    // Vérifier si les éléments existent
    if (!statusDiv) {
      console.error("Élément streamStatus non trouvé");
      return;
    }

    if (!streamDetailsDiv) {
      console.error("Élément stream-details non trouvé");
      return;
    }

    if (isLive && streamData && streamData.data && streamData.data[0]) {
      const stream = streamData.data[0];
      const startTime = new Date(stream.started_at);
      const uptimeDiff = new Date() - startTime;
      const hours = Math.floor(uptimeDiff / (1000 * 60 * 60));
      const minutes = Math.floor((uptimeDiff % (1000 * 60 * 60)) / (1000 * 60));

      statusDiv.textContent = '🔴 EN DIRECT';
      statusDiv.classList.remove('offline');
      statusDiv.classList.add('live');
      
      // Créer le HTML avec des vérifications de sécurité
      const thumbnailUrl = stream.thumbnail_url 
        ? stream.thumbnail_url.replace('{width}', '320').replace('{height}', '180')
        : '';
      
      const gameImageUrl = stream.gameImageUrl || '';
      const gameName = stream.game_name || 'Jeu inconnu';
      const title = stream.title || '';
      const viewerCount = stream.viewer_count || 0;

      streamDetailsDiv.innerHTML = `
        <div style="position: relative;">
          ${thumbnailUrl ? `<img src="${thumbnailUrl}" alt="Stream Thumbnail" class="stream-preview">` : ''}
          <span class="uptime" style="position: absolute; top: 8px; left: 8px;">
            ${hours}h${minutes.toString().padStart(2, "0")}
          </span>
        </div>
        <p class="title">${title}</p>
        <div class="game-info">
          ${gameImageUrl ? `<img src="${gameImageUrl}" alt="${gameName}" class="game-image" id="gameImage">` : ''}
          <span>${gameName}</span>
        </div>
        <p class="viewer-count">👥 ${viewerCount.toLocaleString()} spectateurs</p>
      `;

      // Ajouter le gestionnaire d'événements pour l'image de la catégorie
      const gameImage = document.getElementById('gameImage');
      if (gameImage) {
        gameImage.addEventListener('error', function() {
          this.style.display = 'none';
        });
      }
    } else {
      statusDiv.textContent = 'HORS LIGNE';
      statusDiv.classList.remove('live');
      statusDiv.classList.add('offline');
      
      streamDetailsDiv.innerHTML = '';
    }
  }

  // Get initial status from background script
  chrome.runtime.sendMessage({ action: "checkTwitchStatus" }, function(response) {
    if (response && response.isLive) {
      updatePopup(response.isLive, response.streamData);
    } else {
      updatePopup(false, null);
    }
  });

  // Listen for status updates from the background script
  chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
      if (request.message === "update_status") {
        updatePopup(request.isLive, request.streamData);
      }
    }
  );

  // Initialiser la structure des éléments d'abonnement
  function initializeSubscriptionElements() {
    const subscriptionDetailsDiv = document.getElementById('subscription-details');
    if (!subscriptionDetailsDiv) {
      console.error("Élément subscription-details non trouvé");
      return;
    }

    // Créer l'élément subInfo s'il n'existe pas déjà
    let subInfoDiv = document.getElementById('subInfo');
    if (!subInfoDiv) {
      subInfoDiv = document.createElement('div');
      subInfoDiv.id = 'subInfo';
      subInfoDiv.classList.add('sub-info', 'hidden');
      subscriptionDetailsDiv.appendChild(subInfoDiv);
    }
  }

  // Appeler l'initialisation au chargement
  initializeSubscriptionElements();

  // Ajouter ou mettre à jour le style CSS
  const subInfoStyle = document.createElement('style');
  subInfoStyle.textContent = `
    .sub-info {
      margin-top: 10px;
      padding: 8px;
      background: rgba(145, 70, 255, 0.1);
      border-radius: 4px;
      border: 1px solid rgba(145, 70, 255, 0.3);
    }

    .sub-status {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }

    .sub-icon {
      font-size: 1.2em;
    }

    .sub-text {
      color: #9146FF;
      font-weight: 500;
    }

    .gift-badge {
      background: rgba(145, 70, 255, 0.2);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.9em;
    }

    .sub-time {
      font-size: 0.9em;
      color: #666;
      margin-bottom: 4px;
    }

    .sub-details {
      font-size: 0.9em;
      color: #666;
    }

    .hidden {
      display: none;
    }
  `;
  document.head.appendChild(subInfoStyle);

  // Gestion du bouton Paramètres
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', function() {
      // Ouvrir la page des paramètres dans un nouvel onglet
      chrome.tabs.create({ 
        url: chrome.runtime.getURL('settings/settings.html') 
      });
    });
  } else {
    console.warn('Bouton Paramètres non trouvé');
  }

  // Fonction modifiée de gestion de la connexion
  async function handleTwitchLogin() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "authenticateTwitch"
      });
      if (response.success) {
        console.log("Connexion Twitch réussie", response);
        
        // Sauvegarder l'état de connexion
        const connectionData = {
          isConnected: true,
          username: response.username,
          timestamp: Date.now()
        };
        
        // Sauvegarder à la fois dans le stockage local standard et notre stockage personnalisé
        await chrome.storage.local.set({ 
          twitchUserToken: response.token,
          twitchConnectionStatus: true,
          twitchUsername: response.username,
          [STORAGE_KEYS.TWITCH_CONNECTION]: connectionData 
        });

        // Mettre à jour l'interface
        updateUIState(connectionData);

        // Rafraîchir les informations
        await checkInitialStatus();
      } else {
        console.error("Échec de la connexion:", response.error);
        alert(`Échec de la connexion : ${response.error}`);
      }
    } catch (error) {
      console.error("Erreur de connexion:", error);
      alert("Une erreur est survenue lors de la connexion.");
    }
  }

  // Fonction modifiée de gestion de la déconnexion
  async function handleTwitchLogout() {
    try {
      // Supprimer toutes les données de connexion
      await chrome.storage.local.remove([
        'twitchUserToken',
        'twitchTokenTimestamp',
        'twitchConnectionStatus',
        'twitchUsername',
        STORAGE_KEYS.TWITCH_CONNECTION
      ]);

      // Mettre à jour l'interface
      updateUIState({ isConnected: false });
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
      alert("Une erreur est survenue lors de la déconnexion.");
    }
  }

  // Initialisation des écouteurs d'événements
  const connectBtn = document.getElementById('twitch-connect-btn');
  const disconnectBtn = document.getElementById('twitch-disconnect-btn');

  if (connectBtn) {
    connectBtn.addEventListener('click', handleTwitchLogin);
  }

  if (disconnectBtn) {
    disconnectBtn.addEventListener('click', handleTwitchLogout);
  }

  // Vérifier l'état de connexion au chargement
  await checkTwitchConnectionStatus();

  // Rafraîchissement périodique du statut
  setInterval(async () => {
    await checkTwitchConnectionStatus();
  }, 30000); // Vérifier toutes les 30 secondes
});

// Fonction de vérification du statut de connexion Twitch
async function checkTwitchConnectionStatus() {
  try {
    const { 
      twitchUserToken, 
      twitchConnectionStatus, 
      twitchUsername 
    } = await chrome.storage.local.get([
      'twitchUserToken', 
      'twitchConnectionStatus', 
      'twitchUsername'
    ]);

    // Si pas de token ou pas de statut de connexion, considérer comme déconnecté
    if (!twitchUserToken || !twitchConnectionStatus) {
      console.log("Aucun token ou statut de connexion trouvé");
      await handleTokenInvalidation();
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({ action: 'getTwitchUsername' });
      
      if (response && response.success) {
        // Sauvegarder l'état de connexion
        const connectionData = {
          isConnected: true,
          username: response.username || twitchUsername,
          timestamp: Date.now()
        };
        
        // Récupérer les informations d'abonnement
        try {
          const subResponse = await chrome.runtime.sendMessage({ 
            action: "getSubscriptionInfo",
            broadcaster: "aymenzer"
          });

          if (subResponse && subResponse.success && subResponse.subData) {
            connectionData.subInfo = subResponse.subData;
          }
        } catch (subError) {
          console.error("Erreur lors de la récupération des informations d'abonnement:", subError);
        }

        // Sauvegarder l'état dans le stockage local
        await chrome.storage.local.set({ 
          [STORAGE_KEYS.TWITCH_CONNECTION]: connectionData 
        });

        // Mettre à jour l'interface
        updateUIState(connectionData);
      } else {
        console.log("Échec de la vérification du nom d'utilisateur");
        await handleTokenInvalidation();
      }
    } catch (error) {
      console.error("Erreur lors de la vérification du nom d'utilisateur:", error);
      await handleTokenInvalidation();
    }
  } catch (error) {
    console.error('Erreur lors de la vérification du statut Twitch:', error);
    await handleTokenInvalidation();
  }
}

// Fonction de gestion de l'invalidation du token
async function handleTokenInvalidation() {
  try {
    // Supprimer les informations de connexion stockées
    await chrome.storage.local.remove([
      'twitchUserToken',
      'twitchTokenTimestamp',
      'twitchConnectionStatus',
      'twitchUsername',
      STORAGE_KEYS.TWITCH_CONNECTION
    ]);

    // Mettre à jour l'interface
    updateUIState({ isConnected: false });
  } catch (error) {
    console.error("Erreur lors de l'invalidation du token:", error);
  }
}
