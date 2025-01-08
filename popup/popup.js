document.addEventListener('DOMContentLoaded', () => {
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
  }, 1000); // Attendre que l'animation du néon soit presque terminée

  const statusDiv = document.getElementById('status');
  const refreshButton = document.getElementById('refresh');
  const settingsButton = document.getElementById('settings'); // Sélection du bouton Paramètres

  const TWITCH_USERNAME = "AymenZeR"; // Assurez-vous que ce nom correspond à votre configuration

  // Fonction pour mettre à jour le statut
  function updateStatus() {
    chrome.storage.local.get(['lastYouTubeVideoId', 'isLive', 'lastTikTokVideoUrl', 'youtubeThumbnailUrl', 'twitchThumbnailUrl', 'tiktokThumbnailUrl'], (result) => {
      let status = '<ul>';
      
      // YouTube
      if (result.lastYouTubeVideoId) {
        console.log('YouTube data in popup:', result);
        const youtubeThumbnail = result.youtubeThumbnailUrl 
          ? `<img src="${result.youtubeThumbnailUrl}" alt="Miniature YouTube" class="thumbnail">` 
          : '';
        status += `<li>${youtubeThumbnail}Dernière vidéo YouTube: <a href="https://www.youtube.com/watch?v=${result.lastYouTubeVideoId}" target="_blank">Voir</a></li>`;
      } else {
        status += '<li>Aucune vidéo YouTube trouvée.</li>';
      }

      // Twitch
      if (result.isLive) {
        const twitchThumbnail = result.twitchThumbnailUrl 
          ? `<img src="${result.twitchThumbnailUrl}" alt="Miniature Twitch" class="thumbnail">` 
          : '';
        status += `<li>${twitchThumbnail}En direct sur Twitch: <a href="https://www.twitch.tv/${TWITCH_USERNAME}" target="_blank">Voir</a></li>`;
      } else {
        status += '<li>Non en direct sur Twitch.</li>';
      }

      // TikTok
      if (result.lastTikTokVideoUrl) {
        const tiktokThumbnail = result.tiktokThumbnailUrl 
          ? `<img src="${result.tiktokThumbnailUrl}" alt="Miniature TikTok" class="thumbnail">` 
          : '';
        status += `<li>${tiktokThumbnail}Dernière vidéo TikTok: <a href="${result.lastTikTokVideoUrl}" target="_blank">Voir</a></li>`;
      } else {
        status += '<li>Aucune vidéo TikTok trouvée.</li>';
      }

      status += '</ul>';
      statusDiv.innerHTML = status;
    });
  }

  // Gestion du clic sur le bouton Rafraîchir
  refreshButton.addEventListener('click', updateStatus);

  // Gestion du clic sur le bouton Paramètres
  settingsButton.addEventListener('click', () => {
    chrome.runtime.openOptionsPage(); // Ouvre la page des paramètres définie dans manifest.json
  });

  // Initialisation du statut lors du chargement de la popup
  updateStatus();

  function updateStreamInfo(streamData) {
    const viewerCount = document.getElementById('viewerCount');
    const gameName = document.getElementById('gameName');
    const streamPreview = document.getElementById('streamPreview');
    const uptime = document.getElementById('uptime');
    const twitchLoginButton = document.getElementById('twitchLogin');
    
    // Vérifier l'état de connexion
    chrome.storage.local.get(['twitchUserToken'], (result) => {
      if (result.twitchUserToken) {
        twitchLoginButton.textContent = '✓ Connecté';
        twitchLoginButton.classList.add('connected');
        twitchLoginButton.disabled = true;
      } else {
        twitchLoginButton.innerHTML = '<i class="fab fa-twitch"></i> Se connecter';
        twitchLoginButton.classList.remove('connected');
        twitchLoginButton.disabled = false;
      }
    });

    if (streamData && streamData.data && streamData.data.length > 0) {
      const stream = streamData.data[0];
      viewerCount.textContent = stream.viewer_count;
      gameName.textContent = stream.game_name;
      streamPreview.src = stream.thumbnail_url
        .replace('{width}', '320')
        .replace('{height}', '180');
      
      // Calculer l'uptime
      const startTime = new Date(stream.started_at);
      const now = new Date();
      const diff = now - startTime;
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      uptime.textContent = `Uptime: ${hours}h${minutes.toString().padStart(2, '0')}`;
    }
  }

  // Ajouter l'écouteur d'événements pour le bouton de connexion
  document.getElementById('twitchLogin').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'authenticateTwitch' })
      .then(response => {
        if (response && response.success) {
          console.log('Connexion Twitch réussie');
          updateStreamInfo();
        } else {
          console.error('Échec de la connexion:', response?.error);
        }
      })
      .catch(error => {
        console.error('Erreur de connexion:', error);
      });
  });
});