# YouTube Integration Setup Guide

## 🎬 How to Add Your Videos

### Step 1: Find Your Video IDs

1. Go to any YouTube video you want to add
2. Look at the URL: `https://youtube.com/watch?v=VIDEO_ID_HERE`
3. Copy the `VIDEO_ID_HERE` part (the text after `v=`)

**Example:**
- URL: `https://youtube.com/watch?v=dQw4w9WgXcQ`
- Video ID: `dQw4w9WgXcQ`

### Step 2: Edit youtube.js

Open `scripts/youtube.js` and add your videos to the `featuredVideos` array:

```javascript
featuredVideos: [
  { 
    id: 'YOUR_VIDEO_ID', 
    title: 'Video Title', 
    description: 'Short description of the video' 
  },
  { 
    id: 'ANOTHER_VIDEO_ID', 
    title: 'Another Video', 
    description: 'Another description' 
  },
  // Add more videos...
],
```

### Step 3: (Optional) Add Playlists

If you want to embed entire playlists:

1. Go to your playlist: `https://youtube.com/playlist?list=PLAYLIST_ID`
2. Copy the `PLAYLIST_ID` (the text after `list=`)
3. Add to the `playlists` array:

```javascript
playlists: [
  { 
    id: 'YOUR_PLAYLIST_ID', 
    title: 'Playlist Name', 
    description: 'Playlist description' 
  },
],
```

### Step 4: Update Channel Info

Update your channel information:

```javascript
channelName: 'Your Channel Name',
channelUrl: 'https://youtube.com/@your-channel',
```

### Step 5: Refresh!

Refresh your browser and scroll down to see your videos!

---

## 📋 Example Configuration

Here's a complete example:

```javascript
export const YOUTUBE_CONFIG = {
  channelName: 'th3scr1b3',
  channelUrl: 'https://youtube.com/@th3scr1b3',
  
  featuredVideos: [
    { 
      id: 'dQw4w9WgXcQ', 
      title: 'My First Track', 
      description: 'Official music video' 
    },
    { 
      id: 'jNQXAC9IVRw', 
      title: 'Behind The Scenes', 
      description: 'Studio session footage' 
    },
    { 
      id: 'kJQP7kiw5Fk', 
      title: 'Live Performance', 
      description: 'Live at The Venue' 
    },
  ],
  
  playlists: [
    { 
      id: 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf', 
      title: 'Full Album Playlist', 
      description: 'All tracks from my latest album' 
    },
  ],
  
  layout: {
    videosPerRow: 3,
    videoAspectRatio: '16/9',
    showDescriptions: true,
    enableLazyLoad: true  // Better performance!
  }
};
```

---

## 🎨 Features

✅ **Lazy Loading** - Videos only load when clicked (saves bandwidth)
✅ **Responsive Grid** - Looks great on all screen sizes
✅ **Hover Effects** - Smooth animations
✅ **YouTube Thumbnails** - Shows video thumbnail before clicking
✅ **Playlist Support** - Embed entire playlists
✅ **Autoplay** - Videos start automatically when clicked

---

## 💡 Tips

1. **Performance**: Keep `enableLazyLoad: true` for better performance
2. **Layout**: Adjust `videosPerRow` for different grid layouts
3. **Descriptions**: Set `showDescriptions: false` if you don't want descriptions
4. **Order**: Videos appear in the order you add them

---

## 🔧 Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `channelName` | string | Your channel name |
| `channelUrl` | string | Link to your channel |
| `featuredVideos` | array | List of video objects |
| `playlists` | array | List of playlist objects |
| `videosPerRow` | number | Grid columns (desktop) |
| `videoAspectRatio` | string | Video aspect ratio |
| `showDescriptions` | boolean | Show video descriptions |
| `enableLazyLoad` | boolean | Load videos on click |

---

## 🚀 Quick Start

**Just want to test it?** Add one video:

```javascript
featuredVideos: [
  { 
    id: 'dQw4w9WgXcQ', 
    title: 'Test Video', 
    description: 'This is a test' 
  },
],
```

Refresh and scroll down - you'll see it!

---

Need help? The YouTube section shows setup instructions if no videos are configured.
