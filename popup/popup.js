// ===== Constantes et Configuration =====
const STORAGE_KEYS = {
  IS_LIVE: "isLive",
  TWITCH_DATA: "twitchData",
  LAST_CHECK: "lastCheck",
  SUB_INFO: "subInfo",
  TWITCH_CONNECTION: "twitchConnection"  // Nouvelle clé pour l'état de connexion
};

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
function updateStreamInfo(streamData) {
  if (!streamData) return;

  const viewerCount = document.getElementById("viewerCount");
  const viewerContainer = document.getElementById("viewerContainer");
  const gameName = document.getElementById("gameName");
  const streamPreview = document.getElementById("streamPreview");
  const uptime = document.getElementById("uptime");
  const streamStatus = document.getElementById("streamStatus");
  const streamDetailsDiv = document.getElementById("stream-details");

  // Vérifier si tous les éléments existent
  if (
    !viewerCount ||
    !viewerContainer ||
    !gameName ||
    !streamPreview ||
    !uptime ||
    !streamStatus ||
    !streamDetailsDiv
  ) {
    console.error("Certains éléments DOM sont manquants");
    return;
  }

  const isStreamLive =
    streamData && streamData.data && streamData.data.length > 0;

  if (isStreamLive) {
    const stream = streamData.data[0];

    // Mettre à jour le statut
    streamStatus.textContent = "🔴 EN DIRECT";
    streamStatus.classList.remove("offline");
    streamStatus.classList.add("live");

    // Calculer l'uptime
    const startTime = new Date(stream.started_at);
    const now = new Date();
    const diff = now - startTime;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);

    // Mettre à jour les détails du stream avec la nouvelle mise en page
    streamDetailsDiv.innerHTML = `
      <div style="position: relative;">
        <img src="${stream.thumbnail_url.replace('{width}', '320').replace('{height}', '180')}" 
             alt="Stream Thumbnail" 
             class="stream-preview">
        <span class="uptime" style="position: absolute; top: 8px; left: 8px;">
          ${hours}h${minutes.toString().padStart(2, "0")}
        </span>
      </div>
      <p class="title">${stream.title}</p>
      <div class="game-info">
        <img src="${stream.gameImageUrl || ''}" 
             alt="${stream.game_name}" 
             class="game-image"
             id="gameImage">
        <span>${stream.game_name}</span>
      </div>
      <p class="viewer-count">👥 ${stream.viewer_count.toLocaleString()} spectateurs</p>
    `;

    // Ajouter le gestionnaire d'événements pour l'image de la catégorie
    const gameImage = document.getElementById('gameImage');
    if (gameImage) {
      gameImage.addEventListener('error', function() {
        this.style.display = 'none';
      });
    }

    // Mettre à jour les autres éléments
    viewerContainer.classList.remove("hidden");
    viewerCount.textContent = stream.viewer_count.toLocaleString();
    gameName.textContent = stream.game_name;
    gameName.classList.remove("offline");
    uptime.classList.remove("offline");

  } else {
    // État offline
    streamStatus.textContent = "HORS LIGNE";
    streamStatus.classList.remove("live");
    streamStatus.classList.add("offline");

    // Nettoyer les détails du stream
    streamDetailsDiv.innerHTML = '';

    // Cacher les éléments
    viewerContainer.classList.add("hidden");
    gameName.classList.add("offline");
    streamPreview.classList.add("offline");
    uptime.classList.add("offline");
  }
}

// ===== Fonction de rafraîchissement des données =====
async function refreshData() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: "checkTwitchStatus",
    });
    if (response && response.streamData) {
      updateStreamInfo(response.streamData);
    }
  } catch (error) {
    console.error("Erreur lors du rafraîchissement des données:", error);
  }
}

// ===== Configuration de l'intervalle de rafraîchissement =====
const REFRESH_INTERVAL = 500;

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

  const statusDiv = document.getElementById('streamStatus');
  const joinButton = document.getElementById('joinStream');
  const streamDetailsDiv = document.getElementById('stream-details');

  function updatePopup(isLive, streamData) {
    if (isLive && streamData) {
      const startTime = new Date(streamData.started_at);
      const currentTime = new Date();
      const uptimeDiff = currentTime - startTime;
      const hours = Math.floor(uptimeDiff / (1000 * 60 * 60));
      const minutes = Math.floor((uptimeDiff % (1000 * 60 * 60)) / (1000 * 60));

      statusDiv.textContent = '🔴 EN DIRECT';
      
      if (streamDetailsDiv) {
        streamDetailsDiv.innerHTML = `
          <div style="position: relative;">
            <img src="${streamData.thumbnail_url.replace('{width}', '320').replace('{height}', '180')}" alt="Stream Thumbnail">
            <span class="uptime" style="position: absolute; top: 8px; left: 8px;">
              ${hours}h ${minutes}m
            </span>
          </div>
          <p class="title">${streamData.title}</p>
          <div class="game-info">
            <img src="${streamData.gameImageUrl || ''}" alt="${streamData.game_name}" class="game-image">
            <span>${streamData.game_name}</span>
          </div>
          <p class="viewer-count">👥 ${streamData.viewer_count.toLocaleString()} spectateurs</p>
        `;
      } else {
        console.error("Elément avec l'ID 'stream-details' introuvable dans le DOM.");
      }
      
      joinButton.style.display = 'block';
    } else {
      statusDiv.textContent = 'HORS LIGNE';
      
      if (streamDetailsDiv) {
        streamDetailsDiv.innerHTML = '';
      }
      
      joinButton.style.display = 'none';
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

  // ===== Gestion du bouton Rejoindre le Stream =====
  if (joinButton) {
    joinButton.addEventListener('click', function() {
      chrome.tabs.create({ url: `https://www.twitch.tv/AymenZeR` });
      console.log('Opening Twitch stream...');
    });
  } else {
    console.warn("Bouton Rejoindre le Stream introuvable.");
  }

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
      console.log("Création de l'élément subInfo"); // Log pour déboguer
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
