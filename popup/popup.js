document.addEventListener('DOMContentLoaded', () => {
  function updateStreamInfo() {
    chrome.storage.local.get(['streamData'], (result) => {
      if (result.streamData) {
        const {
          thumbnail_url,
          viewer_count,
          game_name,
          started_at,
          user_name
        } = result.streamData;

        // Mise à jour de la miniature
        document.getElementById('streamThumbnail').src = thumbnail_url
          .replace('{width}', '300')
          .replace('{height}', '160');

        // Mise à jour du nombre de spectateurs
        document.getElementById('viewerCount').textContent = viewer_count;

        // Mise à jour du nom du jeu
        document.getElementById('gameName').textContent = game_name;

        // Calcul de l'uptime
        const startTime = new Date(started_at);
        const now = new Date();
        const duration = now - startTime;
        const hours = Math.floor(duration / (1000 * 60 * 60));
        const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
        document.getElementById('uptime').textContent = 
          `Uptime: ${hours}h${minutes.toString().padStart(2, '0')}`;

        // Mise à jour des liens
        document.getElementById('watchButton').href = 
          `https://twitch.tv/${user_name}`;
        document.getElementById('gameButton').textContent = game_name;
      }
    });
  }

  // Mise à jour initiale et toutes les 30 secondes
  updateStreamInfo();
  setInterval(updateStreamInfo, 30000);
});