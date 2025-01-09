chrome.storage.local.clear(); // Nettoie le stockage local
const TWITCH_USERNAME = "AymenZeR";

document.addEventListener('DOMContentLoaded', async () => {
  // Animation de démarrage
  const splashScreen = document.querySelector('.splash-screen');
  const neonLogo = document.querySelector('.neon-logo');
  const mainContent = document.querySelector('.main-content');
  const electricExplosion = document.querySelector('.electric-explosion');

  // Démarrer l'animation du logo néon
  setTimeout(() => {
    // Créer l'explosion électrique
    electricExplosion.style.animation = 'electricExplosion 0.5s ease-out';
    
    // Après l'explosion, cacher le splash screen et montrer le contenu principal
    setTimeout(() => {
      splashScreen.style.display = 'none';
      mainContent.classList.add('visible');
    }, 500);
  }, 1000);

  const statusDiv = document.getElementById('status');

  // Ajouter un écouteur pour les changements de stockage
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.streamData || changes.isLive) {
        const newStreamData = changes.streamData ? changes.streamData.newValue : null;
        const isLive = changes.isLive ? changes.isLive.newValue : null;
        
        if (newStreamData) {
          updateStreamInfo(newStreamData);
        } else {
          // Si on n'a que isLive qui change, récupérer les données existantes
          chrome.storage.local.get(['streamData'], (result) => {
            updateStreamInfo(result.streamData || { data: [] });
          });
        }
      }
    }
  });

  function updateStreamInfo(streamData) {
    const viewerCount = document.getElementById('viewerCount');
    const viewerContainer = document.getElementById('viewerContainer');
    const gameName = document.getElementById('gameName');
    const streamPreview = document.getElementById('streamPreview');
    const uptime = document.getElementById('uptime');
    const streamStatus = document.getElementById('streamStatus');
    const twitchLoginButton = document.getElementById('twitchLogin');
    
    console.log('Mise à jour des informations du stream:', streamData);

    // Vérifier si le stream est en ligne directement depuis les données
    const isStreamLive = streamData && streamData.data && streamData.data.length > 0;
    console.log('État du stream:', isStreamLive ? 'En ligne' : 'Hors ligne');

    // Vérifier l'état de connexion
    chrome.storage.local.get(['twitchUserToken'], (result) => {
      // Gestion du bouton de connexion
      if (result.twitchUserToken) {
        twitchLoginButton.textContent = '✓ Connecté';
        twitchLoginButton.classList.add('connected');
        twitchLoginButton.disabled = true;
      } else {
        twitchLoginButton.innerHTML = '<i class="fab fa-twitch"></i> Se connecter';
        twitchLoginButton.classList.remove('connected');
        twitchLoginButton.disabled = false;
      }

      // Mise à jour de l'interface en fonction du statut du stream
      if (isStreamLive) {
        const stream = streamData.data[0];
        console.log('Informations du stream:', stream);

        // Mettre à jour le statut
        streamStatus.textContent = 'LIVE';
        streamStatus.classList.remove('offline');
        streamStatus.classList.add('live');
        
        // Afficher les informations du stream
        viewerContainer.classList.remove('hidden');
        viewerCount.textContent = stream.viewer_count.toLocaleString();
        gameName.textContent = stream.game_name;
        gameName.classList.remove('offline');
        
        // Mettre à jour la preview
        const thumbnailUrl = stream.thumbnail_url
          .replace('{width}', '320')
          .replace('{height}', '180');
        streamPreview.src = thumbnailUrl;
        streamPreview.classList.remove('offline');
        
        // Calculer et afficher l'uptime
        const startTime = new Date(stream.started_at);
        const now = new Date();
        const diff = now - startTime;
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        uptime.textContent = `Uptime: ${hours}h${minutes.toString().padStart(2, '0')}`;
        uptime.classList.remove('offline');

        // Mettre à jour le stockage local avec le nouvel état
        chrome.storage.local.set({ 
          isLive: true,
          streamData: streamData
        });
      } else {
        console.log('Stream hors ligne - Mise à jour de l\'interface');
        // État offline
        streamStatus.textContent = 'OFFLINE';
        streamStatus.classList.remove('live');
        streamStatus.classList.add('offline');
        
        // Cacher les éléments
        viewerContainer.classList.add('hidden');
        gameName.classList.add('offline');
        streamPreview.classList.add('offline');
        uptime.classList.add('offline');
        
        // Nettoyer les contenus
        gameName.textContent = '';
        streamPreview.src = '';
        uptime.textContent = '';

        // Mettre à jour le stockage local avec le nouvel état
        chrome.storage.local.set({ 
          isLive: false,
          streamData: null
        });
      }
    });
  }

  function updateStatus() {
    chrome.storage.local.get(['streamData'], (result) => {
      console.log('Données récupérées du stockage:', result);
      updateStreamInfo(result.streamData || { data: [] });
    });
  }

  // Initialisation du statut lors du chargement de la popup
  updateStatus();

  const twitchLoginButton = document.getElementById('twitchLogin');
  
  // Fonction pour vérifier le statut initial
  async function checkInitialStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'checkTwitchStatus' });
      updateStreamInfo(response.streamData || { data: [] });
    } catch (error) {
      console.error('Erreur lors de la vérification initiale:', error);
    }
  }

  // Vérifier le statut au chargement
  await checkInitialStatus();

  // Gestionnaire de clic pour le bouton de connexion
  twitchLoginButton.addEventListener('click', async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'authenticateTwitch' });
      if (response && response.success) {
        console.log('Connexion Twitch réussie');
        await checkInitialStatus(); // Rafraîchir les informations après connexion
      } else {
        console.error('Échec de la connexion:', response?.error);
      }
    } catch (error) {
      console.error('Erreur de connexion:', error);
    }
  });
});