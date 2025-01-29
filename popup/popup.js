// ===== Constantes et Configuration =====
const STORAGE_KEYS = {
  IS_LIVE: "isLive",
  TWITCH_DATA: "twitchData",
  LAST_CHECK: "lastCheck",
  SUB_INFO: "subInfo",
};

// ===== Fonction de mise à jour des informations du stream =====
function updateStreamInfo(streamData) {
  if (!streamData) return;

  const viewerCount = document.getElementById("viewerCount");
  const viewerContainer = document.getElementById("viewerContainer");
  const gameName = document.getElementById("gameName");
  const streamPreview = document.getElementById("streamPreview");
  const uptime = document.getElementById("uptime");
  const streamStatus = document.getElementById("streamStatus");

  // Vérifier si tous les éléments existent
  if (
    !viewerCount ||
    !viewerContainer ||
    !gameName ||
    !streamPreview ||
    !uptime ||
    !streamStatus
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

    // Mettre à jour les informations du stream
    viewerContainer.classList.remove("hidden");
    viewerCount.textContent = stream.viewer_count.toLocaleString();
    gameName.textContent = stream.game_name;
    gameName.classList.remove("offline");

    // Mettre à jour la preview
    const thumbnailUrl = stream.thumbnail_url
      .replace("{width}", "320")
      .replace("{height}", "180");
    streamPreview.src = thumbnailUrl;
    streamPreview.classList.remove("offline");

    // Calculer et afficher l'uptime
    const startTime = new Date(stream.started_at);
    const now = new Date();
    const diff = now - startTime;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    uptime.textContent = `Uptime: ${hours}h${minutes
      .toString()
      .padStart(2, "0")}`;
    uptime.classList.remove("offline");
  } else {
    // État offline
    streamStatus.textContent = "HORS LIGNE";
    streamStatus.classList.remove("live");
    streamStatus.classList.add("offline");

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
      const [streamResponse, subResponse] = await Promise.all([
        chrome.runtime.sendMessage({ action: "checkTwitchStatus" }),
        chrome.runtime.sendMessage({ 
          action: "getSubscriptionInfo",
          broadcaster: "aymenzer"
        })
      ]);

      if (streamResponse && streamResponse.streamData) {
        updateStreamInfo(streamResponse.streamData);
      }

      // Gérer les différents cas de réponse de l'abonnement
      if (subResponse) {
        if (subResponse.success && subResponse.subData) {
          updateSubscriptionInfo(subResponse.subData);
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
    twitchLoginButton.addEventListener("click", async () => {
      try {
        const response = await chrome.runtime.sendMessage({
          action: "authenticateTwitch",
        });
        if (response.success) {
          console.log("Connexion Twitch réussie", response);
          twitchLoginButton.textContent = "✓ Connecté";
          twitchLoginButton.classList.add("connected");
          twitchLoginButton.disabled = true;

          // Rafraîchir les informations après connexion
          await checkInitialStatus();
        } else {
          console.error("Échec de la connexion:", response.error);
          alert(`Échec de la connexion : ${response.error}`);
        }
      } catch (error) {
        console.error("Erreur de connexion:", error);
        alert("Une erreur est survenue lors de la connexion.");
      }
    });
  } else {
    console.warn("Bouton de connexion Twitch introuvable.");
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
            <img src="${streamData.gameImageUrl}" alt="${streamData.game_name}" class="game-image">
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

  // Fonction pour mettre à jour l'affichage des informations d'abonnement
  function updateSubscriptionInfo(subData) {
    const subInfoElement = document.getElementById('subInfo');
    const nextPaymentDateElement = document.getElementById('nextPaymentDate');

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
});
