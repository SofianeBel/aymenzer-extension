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

  function updateStreamInfo(streamData) {
    const viewerCount = document.getElementById('viewerCount');
    const viewerContainer = document.getElementById('viewerContainer');
    const gameName = document.getElementById('gameName');
    const streamPreview = document.getElementById('streamPreview');
    const uptime = document.getElementById('uptime');
    const streamStatus = document.getElementById('streamStatus');
    const twitchLoginButton = document.getElementById('twitchLogin');
    
    // Vérifier l'état de connexion
    chrome.storage.local.get(['twitchUserToken', 'isLive'], (result) => {
      if (result.twitchUserToken) {
        twitchLoginButton.textContent = '✓ Connecté';
        twitchLoginButton.classList.add('connected');
        twitchLoginButton.disabled = true;
      } else {
        twitchLoginButton.innerHTML = '<i class="fab fa-twitch"></i> Se connecter';
        twitchLoginButton.classList.remove('connected');
        twitchLoginButton.disabled = false;
      }

      // Gérer l'état online/offline
      if (result.isLive && streamData.data && streamData.data.length > 0) {
        const stream = streamData.data[0];
        
        // Mettre à jour le statut et les éléments visuels
        streamStatus.textContent = 'LIVE';
        streamStatus.classList.remove('offline');
        streamStatus.classList.add('live');
        
        // Afficher les informations de stream
        viewerContainer.classList.remove('hidden');
        viewerCount.textContent = stream.viewer_count;
        gameName.textContent = stream.game_name;
        gameName.classList.remove('offline');
        
        // Afficher la preview
        streamPreview.src = stream.thumbnail_url
          .replace('{width}', '320')
          .replace('{height}', '180');
        streamPreview.classList.remove('offline');
        
        // Calculer et afficher l'uptime
        const startTime = new Date(stream.started_at);
        const now = new Date();
        const diff = now - startTime;
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        uptime.textContent = `Uptime: ${hours}h${minutes.toString().padStart(2, '0')}`;
        uptime.classList.remove('offline');
      } else {
        // État offline
        streamStatus.textContent = 'OFFLINE';
        streamStatus.classList.remove('live');
        streamStatus.classList.add('offline');
        
        // Cacher les éléments non pertinents
        viewerContainer.classList.add('hidden');
        gameName.classList.add('offline');
        streamPreview.classList.add('offline');
        uptime.classList.add('offline');
        
        // Nettoyer les contenus
        gameName.textContent = '';
        streamPreview.src = '';
      }
    });
  }

  function updateStatus() {
    chrome.storage.local.get(['lastYouTubeVideoId', 'isLive', 'lastTikTokVideoUrl', 'youtubeThumbnailUrl', 'twitchThumbnailUrl', 'tiktokThumbnailUrl', 'streamData'], (result) => {
      if (result.isLive && result.streamData) {
        updateStreamInfo(result.streamData);
      } else {
        updateStreamInfo({ data: [] }); // Pour afficher l'état offline
      }
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