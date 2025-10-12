// YouTube integration for th3scr1b3-hero
// Add your video IDs and playlists here

// ============================================================================
// CONFIGURATION - Add your YouTube content here
// ============================================================================

export const YOUTUBE_CONFIG = {
  // Your channel info
  channelName: 'th3scr1b3',
  channelUrl: 'https://youtube.com/@th3scr1b3', // Update with your actual channel
  
  // Featured videos - Add your video IDs here
  // To get video ID: from URL https://youtube.com/watch?v=VIDEO_ID
  featuredVideos: [
             {
       id: 'YUbsU0BRX-N4',
       title: 'FILTHY',
       description: 'MUSIC VIDEO'
     },
    // Example format - replace with your actual videos:
    // { id: 'dQw4w9WgXcQ', title: 'Video Title', description: 'Short description' },
  ],
  
  // Playlists - Add your playlist IDs here
  // To get playlist ID: from URL https://youtube.com/playlist?list=PLAYLIST_ID
  playlists: [
    // Example format:
    // { id: 'PLxxxxxx', title: 'Playlist Name', description: 'Playlist description' },
  ],
  
  // Layout options
  layout: {
    videosPerRow: 3, // Desktop
    videoAspectRatio: '16/9',
    showDescriptions: true,
    enableLazyLoad: true
  }
};

// ============================================================================
// YOUTUBE VIDEO GRID RENDERER
// ============================================================================

export function renderYouTubeGrid(container, config = YOUTUBE_CONFIG) {
  if (!container) return;
  
  const { featuredVideos, playlists, channelUrl, channelName, layout } = config;
  
  // Clear existing content
  container.innerHTML = '';
  
  // If no videos configured, show setup instructions
  if (!featuredVideos.length && !playlists.length) {
    container.innerHTML = `
      <div class="youtube-setup">
        <h3>🎬 Add Your YouTube Videos</h3>
        <p>Edit <code>scripts/youtube.js</code> to add your video IDs.</p>
        <ol style="text-align: left; max-width: 600px; margin: 20px auto;">
          <li>Find your YouTube video URL: <code>https://youtube.com/watch?v=VIDEO_ID</code></li>
          <li>Copy the VIDEO_ID part</li>
          <li>Add to the <code>featuredVideos</code> array in <code>youtube.js</code></li>
          <li>Refresh the page!</li>
        </ol>
        <a href="${channelUrl}" target="_blank" rel="noopener" class="youtube-channel-btn">
          Visit ${channelName} on YouTube →
        </a>
      </div>
    `;
    return;
  }
  
  const fragment = document.createDocumentFragment();
  
  // Featured Videos Section
  if (featuredVideos.length > 0) {
    const videosSection = document.createElement('div');
    videosSection.className = 'youtube-section';
    
    const heading = document.createElement('h3');
    heading.className = 'youtube-section__title';
    heading.textContent = '🎥 Featured Videos';
    videosSection.appendChild(heading);
    
    const grid = document.createElement('div');
    grid.className = 'youtube-grid';
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
      gap: 24px;
      margin-top: 20px;
    `;
    
    featuredVideos.forEach(video => {
      const card = createVideoCard(video, layout);
      grid.appendChild(card);
    });
    
    videosSection.appendChild(grid);
    fragment.appendChild(videosSection);
  }
  
  // Playlists Section
  if (playlists.length > 0) {
    const playlistsSection = document.createElement('div');
    playlistsSection.className = 'youtube-section';
    playlistsSection.style.marginTop = '48px';
    
    const heading = document.createElement('h3');
    heading.className = 'youtube-section__title';
    heading.textContent = '📚 Playlists';
    playlistsSection.appendChild(heading);
    
    const grid = document.createElement('div');
    grid.className = 'youtube-grid';
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
      gap: 24px;
      margin-top: 20px;
    `;
    
    playlists.forEach(playlist => {
      const card = createPlaylistCard(playlist, layout);
      grid.appendChild(card);
    });
    
    playlistsSection.appendChild(grid);
    fragment.appendChild(playlistsSection);
  }
  
  // Channel link
  if (channelUrl) {
    const channelLink = document.createElement('div');
    channelLink.style.cssText = 'margin-top: 48px; text-align: center;';
    channelLink.innerHTML = `
      <a href="${channelUrl}" target="_blank" rel="noopener" class="youtube-channel-btn">
        View Full Channel on YouTube →
      </a>
    `;
    fragment.appendChild(channelLink);
  }
  
  container.appendChild(fragment);
}

// ============================================================================
// VIDEO CARD COMPONENT
// ============================================================================

function createVideoCard(video, layout) {
  const card = document.createElement('div');
  card.className = 'youtube-card';
  
  // Video embed container
  const embedContainer = document.createElement('div');
  embedContainer.className = 'youtube-embed';
  embedContainer.style.cssText = `
    position: relative;
    width: 100%;
    aspect-ratio: ${layout.videoAspectRatio};
    border-radius: 12px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.3);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  `;
  
  // Lazy load iframe or use lite-youtube for performance
  if (layout.enableLazyLoad) {
    // Create thumbnail with play button
    const thumbnail = document.createElement('div');
    thumbnail.className = 'youtube-thumbnail';
    thumbnail.style.cssText = `
      width: 100%;
      height: 100%;
      background: url(https://img.youtube.com/vi/${video.id}/maxresdefault.jpg) center/cover;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 200ms ease;
    `;
    
    const playButton = document.createElement('div');
    playButton.innerHTML = `
      <svg width="68" height="48" viewBox="0 0 68 48" style="opacity: 0.9;">
        <path d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z" fill="#f00"></path>
        <path d="M 45,24 27,14 27,34" fill="#fff"></path>
      </svg>
    `;
    playButton.style.cssText = 'filter: drop-shadow(0 4px 12px rgba(0,0,0,0.5));';
    
    thumbnail.appendChild(playButton);
    
    // Load iframe on click
    thumbnail.addEventListener('click', () => {
      const iframe = createIframe(video.id);
      embedContainer.innerHTML = '';
      embedContainer.appendChild(iframe);
    });
    
    thumbnail.addEventListener('mouseenter', () => {
      thumbnail.style.transform = 'scale(1.02)';
    });
    thumbnail.addEventListener('mouseleave', () => {
      thumbnail.style.transform = 'scale(1)';
    });
    
    embedContainer.appendChild(thumbnail);
  } else {
    // Load iframe immediately
    const iframe = createIframe(video.id);
    embedContainer.appendChild(iframe);
  }
  
  card.appendChild(embedContainer);
  
  // Video info
  if (video.title || (video.description && layout.showDescriptions)) {
    const info = document.createElement('div');
    info.className = 'youtube-card__info';
    info.style.cssText = 'padding: 16px 0;';
    
    if (video.title) {
      const title = document.createElement('h4');
      title.style.cssText = `
        font-size: 1rem;
        font-weight: 700;
        margin: 0 0 8px 0;
        color: var(--text);
      `;
      title.textContent = video.title;
      info.appendChild(title);
    }
    
    if (video.description && layout.showDescriptions) {
      const desc = document.createElement('p');
      desc.style.cssText = `
        font-size: 0.9rem;
        margin: 0;
        opacity: 0.8;
        color: var(--text-dim);
      `;
      desc.textContent = video.description;
      info.appendChild(desc);
    }
    
    card.appendChild(info);
  }
  
  return card;
}

// ============================================================================
// PLAYLIST CARD COMPONENT
// ============================================================================

function createPlaylistCard(playlist, layout) {
  const card = document.createElement('div');
  card.className = 'youtube-card youtube-card--playlist';
  
  const embedContainer = document.createElement('div');
  embedContainer.className = 'youtube-embed';
  embedContainer.style.cssText = `
    position: relative;
    width: 100%;
    aspect-ratio: ${layout.videoAspectRatio};
    border-radius: 12px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.3);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  `;
  
  // Playlist embed
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'width: 100%; height: 100%; border: 0;';
  iframe.src = `https://www.youtube.com/embed/videoseries?list=${playlist.id}`;
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  iframe.allowFullscreen = true;
  iframe.loading = 'lazy';
  
  embedContainer.appendChild(iframe);
  card.appendChild(embedContainer);
  
  // Playlist info
  if (playlist.title || (playlist.description && layout.showDescriptions)) {
    const info = document.createElement('div');
    info.className = 'youtube-card__info';
    info.style.cssText = 'padding: 16px 0;';
    
    if (playlist.title) {
      const title = document.createElement('h4');
      title.style.cssText = `
        font-size: 1rem;
        font-weight: 700;
        margin: 0 0 8px 0;
        color: var(--text);
      `;
      title.innerHTML = `📚 ${playlist.title}`;
      info.appendChild(title);
    }
    
    if (playlist.description && layout.showDescriptions) {
      const desc = document.createElement('p');
      desc.style.cssText = `
        font-size: 0.9rem;
        margin: 0;
        opacity: 0.8;
        color: var(--text-dim);
      `;
      desc.textContent = playlist.description;
      info.appendChild(desc);
    }
    
    card.appendChild(info);
  }
  
  return card;
}

// ============================================================================
// IFRAME CREATOR
// ============================================================================

function createIframe(videoId) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'width: 100%; height: 100%; border: 0;';
  iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  iframe.allowFullscreen = true;
  
  return iframe;
}
