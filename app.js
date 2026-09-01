// ═══════════════════════════════════════════════════
//  VYNL — YouTube Music Player
// ═══════════════════════════════════════════════════

// ─── CONFIG ──────────────────────────────────────────
// 1. Go to https://console.cloud.google.com/
// 2. Create a project → Enable "YouTube Data API v3"
const YT_API_KEY = 'AIzaSyABJb_oyDXK1mPhwfeIhY_nmBvmd0-lIs0';

// ─── STATE ────────────────────────────────────────────
let ytPlayer = null;
let ytReady = false;
let pendingTrackIndex = null;
let currentTracks = [];
let currentIdx = -1;
let currentMoodKey = 'chill'; // tracks which mood is active
let isPlaying = false;
let progressTimer = null;

// ─── USER ACCOUNT & CLOUD PROFILE STATE (ROADMAP PHASE 0/4) ───
let userProfile = {
  username: 'ankit',
  avatar: 'logo_cat.jpg',
  bio: 'Curating late-night lofi & dreamy soundscapes',
  stats: {
    moodsCreated: 4
  }
};
try {
  const rawProf = localStorage.getItem('vynl_user_profile');
  if (rawProf) userProfile = { ...userProfile, ...JSON.parse(rawProf) };
} catch (e) {}

let moodHistory = [];
try {
  const rawHist = localStorage.getItem('vynl_mood_history');
  if (rawHist) moodHistory = JSON.parse(rawHist);
  else {
    moodHistory = [
      { mood: '2AM in the Rain', emoji: '🌧️', time: 'Today, 2:14 AM' },
      { mood: 'Midnight Drive', emoji: '🚗', time: 'Yesterday' },
      { mood: 'Lofi Study Chill', emoji: '🌙', time: '2 days ago' },
      { mood: 'Cosmic Supernova', emoji: '💥', time: '3 days ago' }
    ];
  }
} catch (e) {
  moodHistory = [];
}

// ─── VYNL+ PREMIUM TIER STATE ─────────────────────────
let isVynlPlus = localStorage.getItem('vynl_plus_active') === 'true';
let vynlPlusPlan = localStorage.getItem('vynl_plus_plan') || 'monthly_99';
let selectedPlanTier = 'monthly_99';
let userBoards = [];
try {
  const raw = localStorage.getItem('vynl_user_boards');
  userBoards = raw ? JSON.parse(raw) : [
    {
      id: 'b_sample_1',
      name: 'Midnight Drive',
      desc: 'Dreamy • Late Night • Nostalgic',
      emoji: '🌙',
      tracks: [
        { videoId: 'DWcJFNfaw9c', title: 'Deep Focus Ambient Lofi Study Beats', channel: 'Lofi Records', duration: '3:40', thumbnail: 'https://i.ytimg.com/vi/DWcJFNfaw9c/hqdefault.jpg' },
        { videoId: '5qap5aO4i9A', title: 'Lofi Beats for Chill', channel: 'Lofi Girl', duration: '3:45', thumbnail: 'https://i.ytimg.com/vi/5qap5aO4i9A/hqdefault.jpg' },
        { videoId: 'R2472_7K5uA', title: 'SLOW DANCING IN THE DARK', channel: 'Joji', duration: '3:29', thumbnail: 'https://i.ytimg.com/vi/R2472_7K5uA/hqdefault.jpg' }
      ]
    }
  ];
} catch (e) {
  userBoards = [];
}
let activeBoardId = null;
let activeThemeKey = 'cosmic';
let activeParticleMode = 'meteors';
let trackToAddToBoard = null;
let boardToShare = null;
let karaokeProState = {
  vocalCut: false,
  pitchShift: 0,
  bassBoost: false,
  spatialAudio: false,
  micActive: false,
  teleprompter: false
};
let micStream = null;
let audioFilterNode = null;

// ─── MOOD DATABASE ────────────────────────────────────
// Each mood maps to a YouTube search query + display info
const MOODS = {
  chill: {
    name: 'Chill Vibes', emoji: '🌊',
    subtitle: 'Mellow sounds for a laid-back mood',
    query: 'lofi hip hop chill beats relax',
    overlay: 'linear-gradient(135deg, rgba(30,18,5,0.75), rgba(12,7,2,0.85))',
    keywords: ['chill', 'calm', 'relax', 'peaceful', 'cozy', 'mellow', 'slow', 'lazy', 'soft', 'serene', 'coffee', 'rainy', 'rain', 'hazy', 'sunday', 'afternoon', 'easy', 'still', 'quiet'],
  },
  happy: {
    name: 'Pure Joy', emoji: '☀️',
    subtitle: 'Uplifting tracks for your happy mood',
    query: 'happy upbeat pop songs feel good hits',
    overlay: 'linear-gradient(135deg, rgba(50,30,0,0.40), rgba(70,40,0,0.30))',
    keywords: ['happy', 'joy', 'excited', 'euphoric', 'good', 'great', 'amazing', 'wonderful', 'fun', 'bright', 'sunny', 'festival', 'elated', 'cheerful', 'celebrate', 'dancing', 'smile'],
  },
  melancholic: {
    name: 'Blue Hour', emoji: '🌧️',
    subtitle: 'Songs that understand your sadness',
    query: 'sad emotional indie songs heartbreak',
    overlay: 'linear-gradient(135deg, rgba(5,5,25,0.50), rgba(10,10,45,0.40))',
    keywords: ['sad', 'melancholic', 'heartbroken', 'lonely', 'miss', 'empty', 'numb', 'blue', 'tears', 'cry', 'lost', 'hurt', 'pain', 'grief', 'sorrow', 'down', 'depressed', 'low', 'broken'],
  },
  energetic: {
    name: 'Full Power', emoji: '⚡',
    subtitle: 'High-octane tracks for your energy',
    query: 'high energy workout hype rap rock music',
    overlay: 'linear-gradient(135deg, rgba(40,10,0,0.45), rgba(60,15,0,0.35))',
    keywords: ['energy', 'angry', 'rage', 'aggressive', 'powerful', 'hype', 'pump', 'workout', 'run', 'gym', 'beast', 'fire', 'intense', 'fast', 'hard', 'loud', 'motivate', 'grind', 'hustle'],
  },
  romantic: {
    name: 'Tender Nights', emoji: '🌹',
    subtitle: 'Soft sounds for loving moments',
    query: 'romantic love songs R&B slow jams',
    overlay: 'linear-gradient(135deg, rgba(40,0,25,0.45), rgba(60,0,35,0.35))',
    keywords: ['love', 'romantic', 'romance', 'heart', 'kiss', 'darling', 'sweet', 'tender', 'intimate', 'adore', 'crush', 'together', 'date', 'candle', 'rose', 'longing', 'desire'],
  },
  focus: {
    name: 'Flow State', emoji: '🎯',
    subtitle: 'Instrumental music for deep work',
    query: 'focus study concentration instrumental music no lyrics',
    overlay: 'linear-gradient(135deg, rgba(0,20,30,0.48), rgba(0,35,50,0.38))',
    keywords: ['focus', 'study', 'work', 'concentrate', 'productive', 'flow', 'clarity', 'think', 'code', 'write', 'discipline', 'mindful', 'clear', 'goal', 'deep', 'calm work'],
  },
  dreamy: {
    name: 'Dream State', emoji: '🌙',
    subtitle: 'Ethereal soundscapes for a dreamy mood',
    query: 'dreamy ethereal ambient indie music shoegaze',
    overlay: 'linear-gradient(135deg, rgba(20,0,45,0.45), rgba(35,0,65,0.35))',
    keywords: ['dream', 'dreamy', 'float', 'ethereal', 'haze', 'cloud', 'surreal', 'mystic', 'magic', 'cosmic', 'stars', 'night', 'twilight', 'fantasy', 'wonder', 'hypnotic', 'trance'],
  },
  dark: {
    name: 'Dark Matter', emoji: '🖤',
    subtitle: 'Brooding sounds for a dark mood',
    query: 'dark alternative post punk gothic rock music',
    overlay: 'linear-gradient(135deg, rgba(5,5,10,0.55), rgba(15,5,15,0.45))',
    keywords: ['dark', 'goth', 'shadow', 'void', 'cold', 'gothic', 'haunted', 'sinister', 'eerie', 'grim', 'brooding', 'bleak', 'desolate', 'moody', 'black', 'metal', 'punk', 'raw'],
  },
  sad: {
    name: 'Melancholy', emoji: '🌧️',
    subtitle: 'Songs that understand your sadness',
    query: 'sad emotional indie songs heartbreak slow',
    overlay: 'linear-gradient(135deg, rgba(5,5,25,0.50), rgba(10,10,45,0.40))',
    keywords: ['sad', 'melancholy', 'melancholic', 'heartbroken', 'lonely', 'miss', 'cry', 'pain'],
  },
  party: {
    name: 'Party Vibe', emoji: '🎉',
    subtitle: 'High-octane bangers and dance anthems',
    query: 'dance party hits club electronic pop bangers',
    overlay: 'linear-gradient(135deg, rgba(60,0,50,0.45), rgba(80,0,70,0.35))',
    keywords: ['party', 'dance', 'club', 'banger', 'electro', 'edm', 'disco', 'house', 'rave'],
  },
  workout: {
    name: 'Workout Boost', emoji: '💪',
    subtitle: 'Adrenaline pumps for maximum energy',
    query: 'workout motivation gym hype music fitness bass',
    overlay: 'linear-gradient(135deg, rgba(50,15,0,0.45), rgba(70,20,0,0.35))',
    keywords: ['workout', 'gym', 'fitness', 'run', 'cardio', 'pump', 'beast', 'lift'],
  },
  sleep: {
    name: 'Sleep & Lofi', emoji: '🌙',
    subtitle: 'Calm ambient sounds for deep rest',
    query: 'sleep music ambient lofi relaxing rain sounds',
    overlay: 'linear-gradient(135deg, rgba(5,15,30,0.5), rgba(10,25,50,0.4))',
    keywords: ['sleep', 'bedtime', 'night', 'rest', 'soothe', 'ambient', 'rain', 'lullaby'],
  },
  nostalgic: {
    name: 'Golden Past', emoji: '📼',
    subtitle: 'A warm trip through sounds of the past',
    query: '80s 90s nostalgic pop hits classic songs',
    overlay: 'linear-gradient(135deg, rgba(40,25,10,0.45), rgba(55,35,12,0.35))',
    keywords: ['nostalgic', 'nostalgia', 'memory', 'remember', 'past', 'vintage', 'old', 'retro', 'throwback', '80s', '90s', 'classic', 'golden', 'polaroid', 'cassette', 'hometown', 'miss'],
  },
};

// ─── CURATED FALLBACK PLAYLISTS ────────────────────────
// Embeddable YouTube music videos per mood for 100% reliable playback
const FALLBACK_TRACKS = {
  chill: [
    { videoId: 'jfKfPfyJRdk', title: 'lofi hip hop radio', channel: 'Lofi Girl', duration: '3:30', thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg' },
    { videoId: '5qap5aO4i9A', title: 'Lofi Beats for Chill', channel: 'Lofi Girl', duration: '3:45', thumbnail: 'https://i.ytimg.com/vi/5qap5aO4i9A/hqdefault.jpg' },
    { videoId: '7NOSDKb0HlU', title: 'Chillhop Essentials Autumn Vibes', channel: 'Chillhop Music', duration: '4:12', thumbnail: 'https://i.ytimg.com/vi/7NOSDKb0HlU/hqdefault.jpg' },
    { videoId: 'R2472_7K5uA', title: 'SLOW DANCING IN THE DARK', channel: 'Joji', duration: '3:29', thumbnail: 'https://i.ytimg.com/vi/R2472_7K5uA/hqdefault.jpg' },
    { videoId: 'uelHwf8o7_U', title: 'Banana Pancakes', channel: 'Jack Johnson', duration: '3:10', thumbnail: 'https://i.ytimg.com/vi/uelHwf8o7_U/hqdefault.jpg' },
    { videoId: 'ru0K8uYEZWw', title: 'Better Together', channel: 'Jack Johnson', duration: '3:27', thumbnail: 'https://i.ytimg.com/vi/ru0K8uYEZWw/hqdefault.jpg' },
    { videoId: 'KUmZp8pR1uc', title: 'Sunset Lover', channel: 'Petit Biscuit', duration: '3:36', thumbnail: 'https://i.ytimg.com/vi/KUmZp8pR1uc/hqdefault.jpg' },
    { videoId: 'M-kBMXIeHwk', title: 'No One', channel: 'Alicia Keys', duration: '4:13', thumbnail: 'https://i.ytimg.com/vi/M-kBMXIeHwk/hqdefault.jpg' },
    { videoId: 'h5EofwRzit0', title: 'Cigarette Daydreams', channel: 'Cage the Elephant', duration: '3:25', thumbnail: 'https://i.ytimg.com/vi/h5EofwRzit0/hqdefault.jpg' },
    { videoId: 'SFZeZlj1bG8', title: 'Put It All on Me', channel: 'Ed Sheeran', duration: '3:46', thumbnail: 'https://i.ytimg.com/vi/SFZeZlj1bG8/hqdefault.jpg' },
    { videoId: 'ktvTqknDobU', title: 'Ripple', channel: 'Norah Jones', duration: '4:10', thumbnail: 'https://i.ytimg.com/vi/ktvTqknDobU/hqdefault.jpg' },
    { videoId: 'dh3bleXmVMk', title: 'Coffee Lofi Chill', channel: 'Lofi Hip Hop', duration: '3:55', thumbnail: 'https://i.ytimg.com/vi/dh3bleXmVMk/hqdefault.jpg' },
  ],
  energetic: [
    { videoId: '7wtfhZwyrYY', title: 'Believer', channel: 'Imagine Dragons', duration: '3:24', thumbnail: 'https://i.ytimg.com/vi/7wtfhZwyrYY/hqdefault.jpg' },
    { videoId: '4NRXx6U8ABQ', title: 'Blinding Lights', channel: 'The Weeknd', duration: '3:20', thumbnail: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg' },
    { videoId: 'FGBhQbmMx20', title: 'One More Time', channel: 'Daft Punk', duration: '5:20', thumbnail: 'https://i.ytimg.com/vi/FGBhQbmMx20/hqdefault.jpg' },
    { videoId: 'nfWlot6h_JM', title: 'Shake It Off', channel: 'Taylor Swift', duration: '3:39', thumbnail: 'https://i.ytimg.com/vi/nfWlot6h_JM/hqdefault.jpg' },
    { videoId: 'hT_nvWreIhg', title: 'Counting Stars', channel: 'OneRepublic', duration: '4:17', thumbnail: 'https://i.ytimg.com/vi/hT_nvWreIhg/hqdefault.jpg' },
    { videoId: 'lp-EgvDkiTE', title: 'Stronger', channel: 'Kanye West', duration: '5:11', thumbnail: 'https://i.ytimg.com/vi/lp-EgvDkiTE/hqdefault.jpg' },
    { videoId: 'lWA2pjMjpBs', title: 'Thunder', channel: 'Imagine Dragons', duration: '3:07', thumbnail: 'https://i.ytimg.com/vi/lWA2pjMjpBs/hqdefault.jpg' },
    { videoId: 'OPf0YbXqDm0', title: 'HUMBLE.', channel: 'Kendrick Lamar', duration: '2:57', thumbnail: 'https://i.ytimg.com/vi/OPf0YbXqDm0/hqdefault.jpg' },
    { videoId: 'YqeW9_5kURI', title: 'Uptown Funk', channel: 'Mark Ronson ft Bruno Mars', duration: '4:30', thumbnail: 'https://i.ytimg.com/vi/YqeW9_5kURI/hqdefault.jpg' },
    { videoId: 'IaYsHMbvdUk', title: 'Shut Up and Dance', channel: 'WALK THE MOON', duration: '3:18', thumbnail: 'https://i.ytimg.com/vi/IaYsHMbvdUk/hqdefault.jpg' },
    { videoId: 'CevxZvSJLk8', title: 'Roar', channel: 'Katy Perry', duration: '3:42', thumbnail: 'https://i.ytimg.com/vi/CevxZvSJLk8/hqdefault.jpg' },
  ],
  focus: [
    { videoId: 'DWcJFNfaw9c', title: 'Deep Focus Ambient Lofi Study Beats', channel: 'Lofi Records', duration: '3:40', thumbnail: 'https://i.ytimg.com/vi/DWcJFNfaw9c/hqdefault.jpg' },
    { videoId: 'UDVtMYqUA4U', title: 'Interstellar Main Theme', channel: 'Hans Zimmer', duration: '4:56', thumbnail: 'https://i.ytimg.com/vi/UDVtMYqUA4U/hqdefault.jpg' },
    { videoId: 'FjHGZj2IjBk', title: 'Nuvole Bianche', channel: 'Ludovico Einaudi', duration: '5:55', thumbnail: 'https://i.ytimg.com/vi/FjHGZj2IjBk/hqdefault.jpg' },
    { videoId: '4To_YhLxbFI', title: 'Comptine d un autre ete', channel: 'Yann Tiersen', duration: '2:22', thumbnail: 'https://i.ytimg.com/vi/4To_YhLxbFI/hqdefault.jpg' },
    { videoId: 'Fv7gB7s2B3g', title: 'Experience', channel: 'Ludovico Einaudi', duration: '5:14', thumbnail: 'https://i.ytimg.com/vi/Fv7gB7s2B3g/hqdefault.jpg' },
    { videoId: 'hHW1oY26kxQ', title: 'Time', channel: 'Hans Zimmer', duration: '4:35', thumbnail: 'https://i.ytimg.com/vi/hHW1oY26kxQ/hqdefault.jpg' },
    { videoId: '77ZozI0rw7w', title: 'Weightless', channel: 'Marconi Union', duration: '8:09', thumbnail: 'https://i.ytimg.com/vi/77ZozI0rw7w/hqdefault.jpg' },
    { videoId: 'pVE92TNDwUk', title: 'Gymnopedie No.1', channel: 'Erik Satie Piano', duration: '3:30', thumbnail: 'https://i.ytimg.com/vi/pVE92TNDwUk/hqdefault.jpg' },
    { videoId: 'uxOIn4rJETo', title: 'A Moment Apart', channel: 'ODESZA', duration: '5:12', thumbnail: 'https://i.ytimg.com/vi/uxOIn4rJETo/hqdefault.jpg' },
    { videoId: 'tpWBqh6hiYs', title: 'Forest Walk Lofi Study Mix', channel: 'Chillhop Music', duration: '3:55', thumbnail: 'https://i.ytimg.com/vi/tpWBqh6hiYs/hqdefault.jpg' },
  ],
  melancholic: [
    { videoId: 'V1Pl8CzNzCw', title: 'lovely', channel: 'Billie Eilish and Khalid', duration: '3:20', thumbnail: 'https://i.ytimg.com/vi/V1Pl8CzNzCw/hqdefault.jpg' },
    { videoId: 'KtlgYxa6BMU', title: 'The Night We Met', channel: 'Lord Huron', duration: '3:28', thumbnail: 'https://i.ytimg.com/vi/KtlgYxa6BMU/hqdefault.jpg' },
    { videoId: 'kZT55VQFLCU', title: 'Skinny Love', channel: 'Bon Iver', duration: '3:58', thumbnail: 'https://i.ytimg.com/vi/kZT55VQFLCU/hqdefault.jpg' },
    { videoId: 'UuMDGAkrCLA', title: 'Holocene', channel: 'Bon Iver', duration: '5:37', thumbnail: 'https://i.ytimg.com/vi/UuMDGAkrCLA/hqdefault.jpg' },
    { videoId: 'oBIG9iUblrM', title: 'Another Love', channel: 'Tom Odell', duration: '4:00', thumbnail: 'https://i.ytimg.com/vi/oBIG9iUblrM/hqdefault.jpg' },
    { videoId: 'F86kBaZgNco', title: 'Smother', channel: 'Daughter', duration: '4:19', thumbnail: 'https://i.ytimg.com/vi/F86kBaZgNco/hqdefault.jpg' },
    { videoId: 'tS4_yoFEUUc', title: 'Breathe 2 AM', channel: 'Anna Nalick', duration: '4:10', thumbnail: 'https://i.ytimg.com/vi/tS4_yoFEUUc/hqdefault.jpg' },
    { videoId: 'EsGc9P0aCB0', title: 'Motion Sickness', channel: 'Phoebe Bridgers', duration: '3:35', thumbnail: 'https://i.ytimg.com/vi/EsGc9P0aCB0/hqdefault.jpg' },
    { videoId: 'lP-kZGmyZSE', title: 'Lua', channel: 'Bright Eyes', duration: '3:48', thumbnail: 'https://i.ytimg.com/vi/lP-kZGmyZSE/hqdefault.jpg' },
  ],
  sad: [
    { videoId: 'V1Pl8CzNzCw', title: 'lovely', channel: 'Billie Eilish and Khalid', duration: '3:20', thumbnail: 'https://i.ytimg.com/vi/V1Pl8CzNzCw/hqdefault.jpg' },
    { videoId: 'KtlgYxa6BMU', title: 'The Night We Met', channel: 'Lord Huron', duration: '3:28', thumbnail: 'https://i.ytimg.com/vi/KtlgYxa6BMU/hqdefault.jpg' },
    { videoId: 'oBIG9iUblrM', title: 'Another Love', channel: 'Tom Odell', duration: '4:00', thumbnail: 'https://i.ytimg.com/vi/oBIG9iUblrM/hqdefault.jpg' },
    { videoId: 'lFJFDHBWznU', title: 'someone like you', channel: 'Adele', duration: '4:45', thumbnail: 'https://i.ytimg.com/vi/lFJFDHBWznU/hqdefault.jpg' },
    { videoId: 'TBKMsNR3nTA', title: 'When I Was Your Man', channel: 'Bruno Mars', duration: '3:33', thumbnail: 'https://i.ytimg.com/vi/TBKMsNR3nTA/hqdefault.jpg' },
    { videoId: 'Usz3HNsFZ9U', title: 'Fix You', channel: 'Coldplay', duration: '4:54', thumbnail: 'https://i.ytimg.com/vi/Usz3HNsFZ9U/hqdefault.jpg' },
    { videoId: 'RBumgq5yVrA', title: 'Let Her Go', channel: 'Passenger', duration: '4:14', thumbnail: 'https://i.ytimg.com/vi/RBumgq5yVrA/hqdefault.jpg' },
    { videoId: '4RWbySBIhFc', title: 'The Sound of Silence', channel: 'Simon and Garfunkel', duration: '3:05', thumbnail: 'https://i.ytimg.com/vi/4RWbySBIhFc/hqdefault.jpg' },
    { videoId: 'oVWEb4ORS_Q', title: 'drivers license', channel: 'Olivia Rodrigo', duration: '4:02', thumbnail: 'https://i.ytimg.com/vi/oVWEb4ORS_Q/hqdefault.jpg' },
    { videoId: 'AJsTBqhBbFg', title: 'Skinny Love', channel: 'Birdy', duration: '3:44', thumbnail: 'https://i.ytimg.com/vi/AJsTBqhBbFg/hqdefault.jpg' },
  ],
  happy: [
    { videoId: 'ZbZSe6N_BXs', title: 'Happy', channel: 'Pharrell Williams', duration: '3:53', thumbnail: 'https://i.ytimg.com/vi/ZbZSe6N_BXs/hqdefault.jpg' },
    { videoId: 'UqyT8IEBkvY', title: '24K Magic', channel: 'Bruno Mars', duration: '3:46', thumbnail: 'https://i.ytimg.com/vi/UqyT8IEBkvY/hqdefault.jpg' },
    { videoId: 'ru0K8uYEZWw', title: 'Better Together', channel: 'Jack Johnson', duration: '3:27', thumbnail: 'https://i.ytimg.com/vi/ru0K8uYEZWw/hqdefault.jpg' },
    { videoId: 'YqeW9_5kURI', title: 'Uptown Funk', channel: 'Mark Ronson ft Bruno Mars', duration: '4:30', thumbnail: 'https://i.ytimg.com/vi/YqeW9_5kURI/hqdefault.jpg' },
    { videoId: 'nfWlot6h_JM', title: 'Shake It Off', channel: 'Taylor Swift', duration: '3:39', thumbnail: 'https://i.ytimg.com/vi/nfWlot6h_JM/hqdefault.jpg' },
    { videoId: 'NUsoVlDFqZg', title: 'Good as Hell', channel: 'Lizzo', duration: '2:39', thumbnail: 'https://i.ytimg.com/vi/NUsoVlDFqZg/hqdefault.jpg' },
    { videoId: 'gRYZijLZvSQ', title: 'Walking on Sunshine', channel: 'Katrina and the Waves', duration: '3:58', thumbnail: 'https://i.ytimg.com/vi/gRYZijLZvSQ/hqdefault.jpg' },
    { videoId: 'OPChBqBGBaI', title: 'Dont Stop Me Now', channel: 'Queen', duration: '3:29', thumbnail: 'https://i.ytimg.com/vi/OPChBqBGBaI/hqdefault.jpg' },
    { videoId: 'CEvXFHzPmMg', title: 'Lovely Day', channel: 'Bill Withers', duration: '4:15', thumbnail: 'https://i.ytimg.com/vi/CEvXFHzPmMg/hqdefault.jpg' },
    { videoId: 'kYtGl1dX5qI', title: 'Cant Stop the Feeling', channel: 'Justin Timberlake', duration: '3:56', thumbnail: 'https://i.ytimg.com/vi/kYtGl1dX5qI/hqdefault.jpg' },
  ],
  romantic: [
    { videoId: '2Vv-BfVoq4g', title: 'Perfect', channel: 'Ed Sheeran', duration: '4:23', thumbnail: 'https://i.ytimg.com/vi/2Vv-BfVoq4g/hqdefault.jpg' },
    { videoId: '450p7goxZqg', title: 'All of Me', channel: 'John Legend', duration: '4:29', thumbnail: 'https://i.ytimg.com/vi/450p7goxZqg/hqdefault.jpg' },
    { videoId: 'a4zFPA1gNLk', title: 'Thinking Out Loud', channel: 'Ed Sheeran', duration: '4:41', thumbnail: 'https://i.ytimg.com/vi/a4zFPA1gNLk/hqdefault.jpg' },
    { videoId: 'TB54dZkzZOY', title: 'Die For You', channel: 'The Weeknd', duration: '4:20', thumbnail: 'https://i.ytimg.com/vi/TB54dZkzZOY/hqdefault.jpg' },
    { videoId: 'ApXoWvfEYVU', title: 'At Last', channel: 'Etta James', duration: '2:59', thumbnail: 'https://i.ytimg.com/vi/ApXoWvfEYVU/hqdefault.jpg' },
    { videoId: 'LjhCEhWiKXk', title: 'Just the Two of Us', channel: 'Bill Withers', duration: '3:47', thumbnail: 'https://i.ytimg.com/vi/LjhCEhWiKXk/hqdefault.jpg' },
    { videoId: 'ub747pprmJ4', title: 'Cant Help Falling in Love', channel: 'Elvis Presley', duration: '3:00', thumbnail: 'https://i.ytimg.com/vi/ub747pprmJ4/hqdefault.jpg' },
    { videoId: 'nJqWcg5ep1Y', title: 'Make You Feel My Love', channel: 'Adele', duration: '3:32', thumbnail: 'https://i.ytimg.com/vi/nJqWcg5ep1Y/hqdefault.jpg' },
    { videoId: 'LnHoqJfhRdw', title: 'My Girl', channel: 'The Temptations', duration: '2:43', thumbnail: 'https://i.ytimg.com/vi/LnHoqJfhRdw/hqdefault.jpg' },
    { videoId: 'qHm9MG9xw1o', title: 'Endless Love', channel: 'Diana Ross and Lionel Richie', duration: '4:26', thumbnail: 'https://i.ytimg.com/vi/qHm9MG9xw1o/hqdefault.jpg' },
  ],
  dreamy: [
    { videoId: 'RBtlPT23PTM', title: 'Space Song', channel: 'Beach House', duration: '5:20', thumbnail: 'https://i.ytimg.com/vi/RBtlPT23PTM/hqdefault.jpg' },
    { videoId: 'DX3U7K5Wadw', title: 'Midnight City', channel: 'M83', duration: '4:03', thumbnail: 'https://i.ytimg.com/vi/DX3U7K5Wadw/hqdefault.jpg' },
    { videoId: 'dh_1qMDgDqI', title: 'Youth', channel: 'Daughter', duration: '4:33', thumbnail: 'https://i.ytimg.com/vi/dh_1qMDgDqI/hqdefault.jpg' },
    { videoId: 'BoNkMIZtEPo', title: 'Do I Wanna Know', channel: 'Arctic Monkeys', duration: '4:32', thumbnail: 'https://i.ytimg.com/vi/BoNkMIZtEPo/hqdefault.jpg' },
    { videoId: 'xZpFBzyFKAs', title: 'Intro', channel: 'The XX', duration: '2:07', thumbnail: 'https://i.ytimg.com/vi/xZpFBzyFKAs/hqdefault.jpg' },
    { videoId: 'rKJqVYHkGCM', title: 'Crystallized', channel: 'The XX', duration: '3:26', thumbnail: 'https://i.ytimg.com/vi/rKJqVYHkGCM/hqdefault.jpg' },
    { videoId: 'jNQXAC9IVRw', title: 'No Surprises', channel: 'Radiohead', duration: '3:50', thumbnail: 'https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg' },
    { videoId: 'y8AWFf7EAc4', title: 'Breathe', channel: 'Telepopmusik', duration: '3:55', thumbnail: 'https://i.ytimg.com/vi/y8AWFf7EAc4/hqdefault.jpg' },
    { videoId: 'pnmQo0c_JFQ', title: 'Be Still', channel: 'The Killers', duration: '4:31', thumbnail: 'https://i.ytimg.com/vi/pnmQo0c_JFQ/hqdefault.jpg' },
    { videoId: 'lmc21V-zBq0', title: 'Saturn', channel: 'Stevie Wonder', duration: '4:47', thumbnail: 'https://i.ytimg.com/vi/lmc21V-zBq0/hqdefault.jpg' },
  ],
  dark: [
    { videoId: 'hXCKLJGLBEs', title: 'Lovesong', channel: 'The Cure', duration: '3:28', thumbnail: 'https://i.ytimg.com/vi/hXCKLJGLBEs/hqdefault.jpg' },
    { videoId: 'aGSKrC7dKlY', title: 'Enjoy The Silence', channel: 'Depeche Mode', duration: '4:16', thumbnail: 'https://i.ytimg.com/vi/aGSKrC7dKlY/hqdefault.jpg' },
    { videoId: 'u9Dg-g7t2l4', title: 'Creep', channel: 'Radiohead', duration: '3:58', thumbnail: 'https://i.ytimg.com/vi/u9Dg-g7t2l4/hqdefault.jpg' },
    { videoId: 'BTnqjbarBEk', title: 'Black', channel: 'Pearl Jam', duration: '5:42', thumbnail: 'https://i.ytimg.com/vi/BTnqjbarBEk/hqdefault.jpg' },
    { videoId: 'vgk-lA12FBk', title: 'Paint It Black', channel: 'The Rolling Stones', duration: '3:24', thumbnail: 'https://i.ytimg.com/vi/vgk-lA12FBk/hqdefault.jpg' },
    { videoId: 'R_LY3NqSvIE', title: 'The Sound of Silence', channel: 'Disturbed', duration: '4:07', thumbnail: 'https://i.ytimg.com/vi/R_LY3NqSvIE/hqdefault.jpg' },
    { videoId: 'Vt4CEfMLTgI', title: 'Mad World', channel: 'Gary Jules', duration: '3:08', thumbnail: 'https://i.ytimg.com/vi/Vt4CEfMLTgI/hqdefault.jpg' },
    { videoId: 'kXYiU_JCYtU', title: 'Numb', channel: 'Linkin Park', duration: '3:05', thumbnail: 'https://i.ytimg.com/vi/kXYiU_JCYtU/hqdefault.jpg' },
    { videoId: 'w-0TEJMJOhk', title: 'Black Hole Sun', channel: 'Soundgarden', duration: '5:19', thumbnail: 'https://i.ytimg.com/vi/w-0TEJMJOhk/hqdefault.jpg' },
    { videoId: 'eVTXPUF4Oz4', title: 'Darkness', channel: 'Eminem', duration: '5:59', thumbnail: 'https://i.ytimg.com/vi/eVTXPUF4Oz4/hqdefault.jpg' },
  ],
  party: [
    { videoId: 'TUVcZfQe-Kw', title: 'Levitating', channel: 'Dua Lipa', duration: '3:23', thumbnail: 'https://i.ytimg.com/vi/TUVcZfQe-Kw/hqdefault.jpg' },
    { videoId: 'ebXbLFg0Iz8', title: 'Summer', channel: 'Calvin Harris', duration: '3:54', thumbnail: 'https://i.ytimg.com/vi/ebXbLFg0Iz8/hqdefault.jpg' },
    { videoId: 'AJtDXIazrMo', title: 'Dont You Worry Child', channel: 'Swedish House Mafia', duration: '3:45', thumbnail: 'https://i.ytimg.com/vi/AJtDXIazrMo/hqdefault.jpg' },
    { videoId: 'fRh_vgS2dFE', title: 'Sorry', channel: 'Justin Bieber', duration: '3:20', thumbnail: 'https://i.ytimg.com/vi/fRh_vgS2dFE/hqdefault.jpg' },
    { videoId: 'OPChBqBGBaI', title: 'Dont Stop Me Now', channel: 'Queen', duration: '3:29', thumbnail: 'https://i.ytimg.com/vi/OPChBqBGBaI/hqdefault.jpg' },
    { videoId: 'MY2TSSNEpNg', title: 'Lean On', channel: 'Major Lazer and DJ Snake', duration: '2:55', thumbnail: 'https://i.ytimg.com/vi/MY2TSSNEpNg/hqdefault.jpg' },
    { videoId: 'yh-HuAA5S_M', title: 'Animals', channel: 'Martin Garrix', duration: '3:53', thumbnail: 'https://i.ytimg.com/vi/yh-HuAA5S_M/hqdefault.jpg' },
    { videoId: 'PT2_F-1esPk', title: 'Titanium', channel: 'David Guetta ft Sia', duration: '4:05', thumbnail: 'https://i.ytimg.com/vi/PT2_F-1esPk/hqdefault.jpg' },
    { videoId: 'uB1D9wWxd2w', title: 'Wake Me Up', channel: 'Avicii', duration: '3:32', thumbnail: 'https://i.ytimg.com/vi/uB1D9wWxd2w/hqdefault.jpg' },
    { videoId: 'IIumaR2RCg8', title: 'Somebody That I Used to Know', channel: 'Gotye', duration: '4:04', thumbnail: 'https://i.ytimg.com/vi/IIumaR2RCg8/hqdefault.jpg' },
  ],
  workout: [
    { videoId: '_1x7X0nn_-o', title: 'Till I Collapse', channel: 'Eminem', duration: '4:57', thumbnail: 'https://i.ytimg.com/vi/_1x7X0nn_-o/hqdefault.jpg' },
    { videoId: 'btPJPFnesV4', title: 'Eye of the Tiger', channel: 'Survivor', duration: '4:05', thumbnail: 'https://i.ytimg.com/vi/btPJPFnesV4/hqdefault.jpg' },
    { videoId: 'lp-EgvDkiTE', title: 'Stronger', channel: 'Kanye West', duration: '5:11', thumbnail: 'https://i.ytimg.com/vi/lp-EgvDkiTE/hqdefault.jpg' },
    { videoId: 'OPf0YbXqDm0', title: 'HUMBLE.', channel: 'Kendrick Lamar', duration: '2:57', thumbnail: 'https://i.ytimg.com/vi/OPf0YbXqDm0/hqdefault.jpg' },
    { videoId: '7wtfhZwyrYY', title: 'Believer', channel: 'Imagine Dragons', duration: '3:24', thumbnail: 'https://i.ytimg.com/vi/7wtfhZwyrYY/hqdefault.jpg' },
    { videoId: 'hT_nvWreIhg', title: 'Counting Stars', channel: 'OneRepublic', duration: '4:17', thumbnail: 'https://i.ytimg.com/vi/hT_nvWreIhg/hqdefault.jpg' },
    { videoId: 'gCYcHz2k5x0', title: 'Run the World Girls', channel: 'Beyonce', duration: '3:57', thumbnail: 'https://i.ytimg.com/vi/gCYcHz2k5x0/hqdefault.jpg' },
    { videoId: 'qMxX-QOV9tI', title: 'Power', channel: 'Kanye West', duration: '4:52', thumbnail: 'https://i.ytimg.com/vi/qMxX-QOV9tI/hqdefault.jpg' },
    { videoId: 'v2H4l9RpkwM', title: 'Numb Encore', channel: 'Linkin Park and Jay-Z', duration: '3:26', thumbnail: 'https://i.ytimg.com/vi/v2H4l9RpkwM/hqdefault.jpg' },
    { videoId: 'IaYsHMbvdUk', title: 'Shut Up and Dance', channel: 'WALK THE MOON', duration: '3:18', thumbnail: 'https://i.ytimg.com/vi/IaYsHMbvdUk/hqdefault.jpg' },
  ],
  sleep: [
    { videoId: '1ZYbU82GVz4', title: 'Deep Sleep Music Ambient Soundscape', channel: 'Relaxing Music', duration: '5:00', thumbnail: 'https://i.ytimg.com/vi/1ZYbU82GVz4/hqdefault.jpg' },
    { videoId: 'mPZkdNFkNps', title: 'Rain Sounds for Sleep', channel: 'Relaxing Rain', duration: '4:30', thumbnail: 'https://i.ytimg.com/vi/mPZkdNFkNps/hqdefault.jpg' },
    { videoId: '77ZozI0rw7w', title: 'Weightless', channel: 'Marconi Union', duration: '8:09', thumbnail: 'https://i.ytimg.com/vi/77ZozI0rw7w/hqdefault.jpg' },
    { videoId: 'FjHGZj2IjBk', title: 'Nuvole Bianche', channel: 'Ludovico Einaudi', duration: '5:55', thumbnail: 'https://i.ytimg.com/vi/FjHGZj2IjBk/hqdefault.jpg' },
    { videoId: 'pVE92TNDwUk', title: 'Gymnopedie No.1', channel: 'Erik Satie Piano', duration: '3:30', thumbnail: 'https://i.ytimg.com/vi/pVE92TNDwUk/hqdefault.jpg' },
    { videoId: 'jfKfPfyJRdk', title: 'lofi hip hop radio', channel: 'Lofi Girl', duration: '3:30', thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg' },
    { videoId: 'inpok4MKVLM', title: 'Clair de Lune', channel: 'Debussy Piano', duration: '5:20', thumbnail: 'https://i.ytimg.com/vi/inpok4MKVLM/hqdefault.jpg' },
    { videoId: 'p9QiHZWnPYM', title: 'Canon in D', channel: 'Johann Pachelbel', duration: '4:58', thumbnail: 'https://i.ytimg.com/vi/p9QiHZWnPYM/hqdefault.jpg' },
    { videoId: 'lFJFDHBWznU', title: 'Someone Like You', channel: 'Adele', duration: '4:45', thumbnail: 'https://i.ytimg.com/vi/lFJFDHBWznU/hqdefault.jpg' },
    { videoId: 'Usz3HNsFZ9U', title: 'Fix You', channel: 'Coldplay', duration: '4:54', thumbnail: 'https://i.ytimg.com/vi/Usz3HNsFZ9U/hqdefault.jpg' },
  ],
  nostalgic: [
    { videoId: 'djV11Xbc914', title: 'Take On Me', channel: 'a-ha', duration: '3:47', thumbnail: 'https://i.ytimg.com/vi/djV11Xbc914/hqdefault.jpg' },
    { videoId: 'Zi_XLOBDo_Y', title: 'Billie Jean', channel: 'Michael Jackson', duration: '4:55', thumbnail: 'https://i.ytimg.com/vi/Zi_XLOBDo_Y/hqdefault.jpg' },
    { videoId: 'OPChBqBGBaI', title: 'Dont Stop Me Now', channel: 'Queen', duration: '3:29', thumbnail: 'https://i.ytimg.com/vi/OPChBqBGBaI/hqdefault.jpg' },
    { videoId: 'VcjzHMhBtf0', title: 'Africa', channel: 'Toto', duration: '4:55', thumbnail: 'https://i.ytimg.com/vi/VcjzHMhBtf0/hqdefault.jpg' },
    { videoId: 'vt1Cy7YZKbA', title: 'Dreams', channel: 'Fleetwood Mac', duration: '4:18', thumbnail: 'https://i.ytimg.com/vi/vt1Cy7YZKbA/hqdefault.jpg' },
    { videoId: 'gRYZijLZvSQ', title: 'Walking on Sunshine', channel: 'Katrina and the Waves', duration: '3:58', thumbnail: 'https://i.ytimg.com/vi/gRYZijLZvSQ/hqdefault.jpg' },
    { videoId: 'CdqoNKCCt7A', title: 'Here Comes the Sun', channel: 'The Beatles', duration: '3:05', thumbnail: 'https://i.ytimg.com/vi/CdqoNKCCt7A/hqdefault.jpg' },
    { videoId: 'LO2rMKWFXZA', title: 'Livin on a Prayer', channel: 'Bon Jovi', duration: '4:09', thumbnail: 'https://i.ytimg.com/vi/LO2rMKWFXZA/hqdefault.jpg' },
    { videoId: 'fJ9rUzIMcZQ', title: 'Bohemian Rhapsody', channel: 'Queen', duration: '5:55', thumbnail: 'https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg' },
    { videoId: 'M-kBMXIeHwk', title: 'No One', channel: 'Alicia Keys', duration: '4:13', thumbnail: 'https://i.ytimg.com/vi/M-kBMXIeHwk/hqdefault.jpg' },
    { videoId: 'btPJPFnesV4', title: 'Eye of the Tiger', channel: 'Survivor', duration: '4:05', thumbnail: 'https://i.ytimg.com/vi/btPJPFnesV4/hqdefault.jpg' },
  ]
};

function getMoodFallbackTracks(moodKey) {
  const tracks = FALLBACK_TRACKS[moodKey] || FALLBACK_TRACKS.chill;
  return tracks.map(t => ({
    videoId: t.videoId,
    title: t.title,
    channel: t.channel,
    thumbnail: t.thumbnail,
    duration: t.duration,
    isOfficial: true,
  }));
}

// ─── BACKGROUND IMAGES ──────────────────────────────

// Direct Unsplash CDN URLs — hand-picked per mood, no API key, no redirects.
// Format: photo-ID?fit=crop&w=1920&h=1080&q=85
const MOOD_IMAGES = {
  chill: [
    'https://images.unsplash.com/photo-1493314894560-5c412a56c17c?fit=crop&w=1920&h=1080&q=85', // lofi desk rain
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?fit=crop&w=1920&h=1080&q=85', // laptop cozy
    'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?fit=crop&w=1920&h=1080&q=85', // coffee window
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?fit=crop&w=1920&h=1080&q=85', // foggy mountain
    'https://images.unsplash.com/photo-1515002246390-7bf7789c0246?fit=crop&w=1920&h=1080&q=85', // rain drops
  ],
  happy: [
    'https://images.unsplash.com/photo-1490750967868-88df5691cc9e?fit=crop&w=1920&h=1080&q=85', // sunflowers
    'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?fit=crop&w=1920&h=1080&q=85', // orange flowers
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?fit=crop&w=1920&h=1080&q=85', // colorful balloons
    'https://images.unsplash.com/photo-1523712999610-f77fbcfc3843?fit=crop&w=1920&h=1080&q=85', // sunbeams forest
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?fit=crop&w=1920&h=1080&q=85', // friends laughing
  ],
  melancholic: [
    'https://images.unsplash.com/photo-1501999635878-71cb5379c2d8?fit=crop&w=1920&h=1080&q=85', // rain window
    'https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?fit=crop&w=1920&h=1080&q=85', // foggy street
    'https://images.unsplash.com/photo-1473773508845-188df298d2d1?fit=crop&w=1920&h=1080&q=85', // rainy city
    'https://images.unsplash.com/photo-1516912481808-3406841bd33c?fit=crop&w=1920&h=1080&q=85', // lone figure fog
    'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?fit=crop&w=1920&h=1080&q=85', // autumn leaves
  ],
  energetic: [
    'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?fit=crop&w=1920&h=1080&q=85', // concert lights
    'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?fit=crop&w=1920&h=1080&q=85', // stage lights
    'https://images.unsplash.com/photo-1549060279-7e168fcee0c2?fit=crop&w=1920&h=1080&q=85', // gym workout
    'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?fit=crop&w=1920&h=1080&q=85', // running energy
    'https://images.unsplash.com/photo-1540575467063-178a50c2df87?fit=crop&w=1920&h=1080&q=85', // festival crowd
  ],
  romantic: [
    'https://images.unsplash.com/photo-1518621736915-f3b1c41bfd00?fit=crop&w=1920&h=1080&q=85', // red roses
    'https://images.unsplash.com/photo-1515041219749-89347f6b50f8?fit=crop&w=1920&h=1080&q=85', // candle bokeh
    'https://images.unsplash.com/photo-1474552226712-ac0f0961a954?fit=crop&w=1920&h=1080&q=85', // sunset couple
    'https://images.unsplash.com/photo-1478145787956-f9a7c000ff2c?fit=crop&w=1920&h=1080&q=85', // wine glasses
    'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?fit=crop&w=1920&h=1080&q=85', // couple walk
  ],
  focus: [
    'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?fit=crop&w=1920&h=1080&q=85', // clean desk
    'https://images.unsplash.com/photo-1524758631624-e2822e304c36?fit=crop&w=1920&h=1080&q=85', // minimal workspace
    'https://images.unsplash.com/photo-1497366216548-37526070297c?fit=crop&w=1920&h=1080&q=85', // library books
    'https://images.unsplash.com/photo-1456324504439-367cee3b3c32?fit=crop&w=1920&h=1080&q=85', // white desk minimal
    'https://images.unsplash.com/photo-1519046904884-53103b34b206?fit=crop&w=1920&h=1080&q=85', // mountain clarity
  ],
  dreamy: [
    'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?fit=crop&w=1920&h=1080&q=85', // milky way stars
    'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?fit=crop&w=1920&h=1080&q=85', // purple aurora
    'https://images.unsplash.com/photo-1507908708918-778587c9e563?fit=crop&w=1920&h=1080&q=85', // dreamy clouds
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?fit=crop&w=1920&h=1080&q=85', // misty mountains
    'https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?fit=crop&w=1920&h=1080&q=85', // night sky cosmos
  ],
  dark: [
    'https://images.unsplash.com/photo-1477346611705-65d1883cee1e?fit=crop&w=1920&h=1080&q=85', // dark forest
    'https://images.unsplash.com/photo-1504701954957-2010ec3bcec1?fit=crop&w=1920&h=1080&q=85', // dark abstract
    'https://images.unsplash.com/photo-1531306728370-e2ebd9d7bb99?fit=crop&w=1920&h=1080&q=85', // gothic night
    'https://images.unsplash.com/photo-1475274047050-1d0c0975c63e?fit=crop&w=1920&h=1080&q=85', // stormy dark
    'https://images.unsplash.com/photo-1518562180175-34a163b1a9a6?fit=crop&w=1920&h=1080&q=85', // dark moody
  ],
  sad: [
    'https://images.unsplash.com/photo-1501999635878-71cb5379c2d8?fit=crop&w=1920&h=1080&q=85',
    'https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?fit=crop&w=1920&h=1080&q=85',
  ],
  party: [
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?fit=crop&w=1920&h=1080&q=85',
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?fit=crop&w=1920&h=1080&q=85',
  ],
  workout: [
    'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?fit=crop&w=1920&h=1080&q=85',
    'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?fit=crop&w=1920&h=1080&q=85',
  ],
  sleep: [
    'https://images.unsplash.com/photo-1511295742362-92c96b124e52?fit=crop&w=1920&h=1080&q=85',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?fit=crop&w=1920&h=1080&q=85',
  ],
  nostalgic: [
    'https://images.unsplash.com/photo-1533134486753-c833f0ed4866?fit=crop&w=1920&h=1080&q=85', // vintage cassette
    'https://images.unsplash.com/photo-1516223725307-6f76b9ec8742?fit=crop&w=1920&h=1080&q=85', // old camera
    'https://images.unsplash.com/photo-1458682625221-3a45f8a844c7?fit=crop&w=1920&h=1080&q=85', // retro neon
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?fit=crop&w=1920&h=1080&q=85', // vintage record
    'https://images.unsplash.com/photo-1524678606370-a47ad25cb82a?fit=crop&w=1920&h=1080&q=85', // polaroid photos
  ],
};

// Rotation counter so each track advances to the next image
const bgRotation = {};

// Crossfades a new image into the background with a smooth opacity transition
function loadBgImage(src) {
  const bgImg = document.getElementById('bgImg');
  if (!bgImg) return;

  bgImg.style.transition = 'opacity 0.3s ease';
  bgImg.style.opacity = '0';

  const tmp = new Image();
  tmp.onload = () => {
    setTimeout(() => {
      bgImg.src = src;
      bgImg.style.transition = 'opacity 1.5s ease';
      bgImg.style.opacity = '1';
    }, 300);
  };
  tmp.onerror = () => {
    // Image failed — stay dark, don't break the app
    console.warn('Background image failed to load:', src);
  };
  tmp.src = src;
}

// Pick the next image in rotation for the given mood
function nextMoodImage(moodKey) {
  const imgs = MOOD_IMAGES[moodKey];
  if (!imgs) return null;
  const i = (bgRotation[moodKey] || 0) % imgs.length;
  bgRotation[moodKey] = i + 1;
  return imgs[i];
}

// ─── TYPING SOUND GENERATOR ─────────────────────────────────
let typingAudioEl = null;
let typingTimeout = null;

function playTypingSound() {
  try {
    if (!typingAudioEl) {
      typingAudioEl = new Audio('typing_sound.webm');
      typingAudioEl.volume = 0.5;
      typingAudioEl.loop = true;
    }
    
    if (typingAudioEl.paused) {
      typingAudioEl.play().catch(e => {});
    }
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      typingAudioEl.pause();
    }, 150); // Pause shortly after last keystroke
  } catch (e) {}
}

function initTypingSoundListeners() {
  const attach = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('keydown', (e) => {
      // Play typing sound on character input, backspace, space, delete
      if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Space') {
        playTypingSound();
      }
    });
  };
  attach('moodInput');
  attach('songSearchInput');
}

// ─── DYNAMIC METEOR SHOWER & COSMIC SHOOTING STARS CANVAS ──────────
let rainCanvas, rainCtx, meteors = [], cosmicStars = [], rainAnimId = null;

function initRainCanvas() {
  if (rainAnimId) {
    cancelAnimationFrame(rainAnimId);
    rainAnimId = null;
  }

  rainCanvas = document.getElementById('rainCanvas');
  if (!rainCanvas) return;
  rainCtx = rainCanvas.getContext('2d', { alpha: true, desynchronized: true });

  function resize() {
    rainCanvas.width = window.innerWidth;
    rainCanvas.height = window.innerHeight;
  }
  resize();
  window.removeEventListener('resize', resize);
  window.addEventListener('resize', resize, { passive: true });

  const angleRad = Math.PI / 4; 
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);

  function createMeteor() {
    const length = Math.random() * 80 + 50;
    const speed = Math.random() * 3.5 + 4.0;
    const thickness = Math.random() * 1.2 + 1.0;
    const isCyan = Math.random() < 0.6;

    let x, y;
    if (Math.random() < 0.5) {
      x = Math.random() * (window.innerWidth + 300) - 150;
      y = -length - Math.random() * 80;
    } else {
      x = -length - Math.random() * 80;
      y = Math.random() * window.innerHeight * 0.6;
    }

    return {
      x: x,
      y: y,
      length: length,
      speed: speed,
      thickness: thickness,
      color: isCyan ? 'rgba(80, 220, 255, 0.75)' : 'rgba(232, 185, 106, 0.75)'
    };
  }

  // Lightweight particle pools for 60fps/120fps
  const meteorCount = Math.min(12, Math.floor(window.innerWidth / 120));
  meteors = [];
  for (let i = 0; i < meteorCount; i++) {
    meteors.push(createMeteor());
  }

  cosmicStars = [];
  const starCount = Math.min(45, Math.floor(window.innerWidth / 35));
  for (let i = 0; i < starCount; i++) {
    cosmicStars.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.2 + 0.5,
      alpha: Math.random() * 0.6 + 0.2,
      dAlpha: (Math.random() * 0.008 + 0.003) * (Math.random() < 0.5 ? 1 : -1)
    });
  }

  function renderMeteors() {
    if (!rainCtx) return;
    rainCtx.clearRect(0, 0, rainCanvas.width, rainCanvas.height);

    // 1. Lightweight Ambient Stars (Single batch draw)
    rainCtx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    rainCtx.beginPath();
    for (let i = 0; i < cosmicStars.length; i++) {
      let star = cosmicStars[i];
      star.alpha += star.dAlpha;
      if (star.alpha > 0.8 || star.alpha < 0.15) {
        star.dAlpha = -star.dAlpha;
      }
      rainCtx.moveTo(star.x + star.r, star.y);
      rainCtx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    }
    rainCtx.fill();

    // 2. Ultra-Fast Meteor Trails (No shadowBlur, No gradient allocations)
    for (let i = 0; i < meteors.length; i++) {
      let m = meteors[i];
      const tailX = m.x - m.length * cosA;
      const tailY = m.y - m.length * sinA;

      rainCtx.beginPath();
      rainCtx.strokeStyle = m.color;
      rainCtx.lineWidth = m.thickness;
      rainCtx.lineCap = 'round';
      rainCtx.moveTo(tailX, tailY);
      rainCtx.lineTo(m.x, m.y);
      rainCtx.stroke();

      // Meteor Head
      rainCtx.beginPath();
      rainCtx.arc(m.x, m.y, m.thickness + 0.5, 0, Math.PI * 2);
      rainCtx.fillStyle = '#ffffff';
      rainCtx.fill();

      m.x += m.speed * cosA;
      m.y += m.speed * sinA;

      if (m.x > rainCanvas.width + m.length || m.y > rainCanvas.height + m.length) {
        meteors[i] = createMeteor();
      }
    }

    rainAnimId = requestAnimationFrame(renderMeteors);
  }

  renderMeteors();
}





// ─── MOOD DETECTION ──────────────────────────────────
function detectMood(text) {
  if (!text.trim()) return 'chill';
  const lower = text.toLowerCase();
  let best = 'chill', bestScore = 0;
  for (const [key, mood] of Object.entries(MOODS)) {
    let score = 0;
    for (const kw of mood.keywords) {
      if (lower.includes(kw)) score += kw.includes(' ') ? 4 : 2;
    }
    if (score > bestScore) { bestScore = score; best = key; }
  }
  return best;
}

// ─── TITLE SANITIZER & OFFICIAL FILTER ───────────────
// Cleans YouTube title clutter: "(Official Music Video)", "[Official Audio]", etc.
function sanitizeTrackInfo(rawTitle, rawChannel) {
  let title = rawTitle || '';
  let channel = (rawChannel || '').replace(/ - Topic$/i, '').replace(/VEVO$/i, '').trim();

  // Strip common YouTube clutter
  title = title
    .replace(/[\(\[\{]\s*(official\s*(music\s*)?(video|audio|visualizer|lyric\s*video|hd)?|4k|hd|1080p|explicit)\s*[\)\]\}]/gi, '')
    .replace(/official\s*(music\s*)?(video|audio|lyric\s*video)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // If title is "Artist - Song", separate them
  if (title.includes(' - ')) {
    const parts = title.split(' - ');
    if (parts.length >= 2) {
      if (!channel || channel.toLowerCase().includes('topic')) {
        channel = parts[0].trim();
      }
      title = parts.slice(1).join(' - ').trim();
    }
  }

  return { title: title || rawTitle, channel: channel || rawChannel };
}

// Check if item is from an official source and not fan content
function isOfficialTrack(item) {
  const title = (item.snippet?.title || '').toLowerCase();
  const channel = (item.snippet?.channelTitle || '').toLowerCase();

  // Exclude fan uploads, covers, tutorials, reactions
  const forbidden = [
    'cover', 'reaction', 'tutorial', 'karaoke', 'instrumental cover',
    '8d audio', 'fan made', 'fanmade', 'mashup', 'slowed', 'reverb',
    'speed up', 'nightcore', 'how to play', 'guitar lesson'
  ];

  for (const word of forbidden) {
    if (title.includes(word)) return false;
  }

  return true;
}

// ─── DURATION PARSER & FETCH ──────────────────────────
function parseISODuration(iso) {
  if (!iso) return '3:30';
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '3:30';
  const hours = parseInt(match[1] || 0);
  const mins = parseInt(match[2] || 0);
  const secs = parseInt(match[3] || 0);

  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

async function fetchTrackDurations(videoIds) {
  if (!videoIds || !videoIds.length) return {};
  try {
    const url = 'https://www.googleapis.com/youtube/v3/videos?' + new URLSearchParams({
      part: 'contentDetails',
      id: videoIds.join(','),
      key: YT_API_KEY,
    });
    const res = await fetch(url);
    const data = await res.json();
    const map = {};
    if (data.items) {
      data.items.forEach(item => {
        map[item.id] = parseISODuration(item.contentDetails?.duration);
      });
    }
    return map;
  } catch (e) {
    return {};
  }
}

// ─── YOUTUBE DATA API SEARCH (OFFICIAL MUSIC ONLY) ────
async function searchYouTube(query) {
  const fetchFromYT = async (q, category = '10') => {
    const params = {
      part: 'snippet',
      q: q,
      type: 'video',
      videoEmbeddable: 'true',
      maxResults: '50',
      safeSearch: 'none',
      key: YT_API_KEY,
    };
    if (category) params.videoCategoryId = category;

    const url = 'https://www.googleapis.com/youtube/v3/search?' + new URLSearchParams(params);
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) {
      console.warn('YouTube API Error:', data.error);
      throw new Error(data.error.message || 'YouTube API request failed');
    }
    return data.items || [];
  };

  let rawItems = [];

  // Stage 1: Official music audio/video search
  try {
    rawItems = await fetchFromYT(`${query} official music video OR audio`, '10');
  } catch (e) {
    if (e.message.includes('quota') || e.message.includes('API key')) throw e;
  }

  // Stage 2: Direct query search in music category if Stage 1 yields 0 items
  if (!rawItems.length) {
    try {
      rawItems = await fetchFromYT(query, '10');
    } catch (e) {
      if (e.message.includes('quota') || e.message.includes('API key')) throw e;
    }
  }

  // Stage 3: Broad query search fallback
  if (!rawItems.length) {
    try {
      rawItems = await fetchFromYT(query, '');
    } catch (e) {
      if (e.message.includes('quota') || e.message.includes('API key')) throw e;
    }
  }

  // Filter valid playable items
  let filtered = rawItems.filter(item => item.id?.videoId && isOfficialTrack(item));
  if (!filtered.length) {
    filtered = rawItems.filter(item => item.id?.videoId);
  }

  // Fetch exact song durations for all items
  const videoIds = filtered.map(item => item.id.videoId);
  const durationMap = await fetchTrackDurations(videoIds);

  return filtered.map(item => {
    item._duration = durationMap[item.id.videoId] || '3:30';
    return item;
  });
}

// ─── YOUTUBE IFRAME PLAYER ────────────────────────────
function initYTPlayer() {
  if (ytPlayer) return;
  if (!window.YT || !window.YT.Player) return;

  const playerVars = {
    autoplay: 1,
    controls: 0,         // Hide YouTube playback control bar
    disablekb: 1,        // Disable keyboard shortcuts on iframe
    fs: 0,               // Disable native fullscreen button
    iv_load_policy: 3,   // Disable annotations & popups
    modestbranding: 1,   // Hide YouTube branding logo
    rel: 0,              // Hide unrelated suggested videos
    showinfo: 0,         // Hide video title bar
    autohide: 1,         // Hide controls when playing
    cc_load_policy: 0,   // Disable closed captions by default
    enablejsapi: 1,
    playsinline: 1
  };


  if (window.location.protocol.startsWith('http')) {
    playerVars.origin = window.location.origin;
  }

  try {
    ytPlayer = new YT.Player('ytPlayer', {
      width: '100%',
      height: '100%',
      playerVars: playerVars,
      events: {
        onReady: () => {
          console.log('YouTube Player Ready');
          ytReady = true;
          if (pendingTrackIndex !== null) {
            playTrack(pendingTrackIndex);
            pendingTrackIndex = null;
          }
        },
        onStateChange: onPlayerStateChange,
        onError: onPlayerError,
      },
    });
  } catch (e) {
    console.error('YT.Player init error:', e);
  }
}

window.onYouTubeIframeAPIReady = function () {
  console.log('onYouTubeIframeAPIReady fired');
  initYTPlayer();
};

function ensureYTPlayerInit() {
  if (ytReady && ytPlayer) return;
  if (window.YT && window.YT.Player) {
    initYTPlayer();
  }
}

function onPlayerError(event) {
  console.warn('YouTube Player error code:', event.data);
  // Auto-advance to next track if video is restricted/unplayable (codes 101, 150, 100, 2, 5)
  if (currentTracks && currentTracks.length > 1) {
    console.log('Skipping unplayable video to next track...');
    setTimeout(() => goNext(), 500);
  }
}

function enforceHDQuality() {
  if (!ytPlayer || !ytReady) return;
  try {
    if (typeof ytPlayer.setPlaybackQuality === 'function') {
      ytPlayer.setPlaybackQuality('hd1080');
    }
    if (typeof ytPlayer.setSuggestedQuality === 'function') {
      ytPlayer.setSuggestedQuality('hd1080');
    }
  } catch (e) {}
}

function updateRainCanvasVisibility() {
  const rainEl = document.getElementById('rainCanvas');
  if (!rainEl) return;

  if (isPlaying || currentMediaMode === 'artwork' || currentMediaMode === 'video') {
    rainEl.style.opacity = '0';
  } else {
    rainEl.style.opacity = '1';
  }
}

function onPlayerStateChange(event) {
  const s = YT.PlayerState;
  if (event.data === s.PLAYING) {
    isPlaying = true;
    enforceHDQuality();
    syncPlayPauseIcon();
    startProgressTick();
    updateRainCanvasVisibility();
  } else if (event.data === s.PAUSED) {
    isPlaying = false;
    syncPlayPauseIcon();
    clearInterval(progressTimer);
    updateRainCanvasVisibility();
  } else if (event.data === s.ENDED) {
    isPlaying = false;
    clearInterval(progressTimer);
    updateRainCanvasVisibility();
    if (isLoopActive) {
      if (typeof ytPlayer.seekTo === 'function') ytPlayer.seekTo(0);
      if (typeof ytPlayer.playVideo === 'function') ytPlayer.playVideo();
    } else {
      goNext();
    }
  } else if (event.data === s.CUED || event.data === -1) {
    if (isPlaying && ytPlayer && typeof ytPlayer.playVideo === 'function') {
      try {
        ytPlayer.playVideo();
        enforceHDQuality();
      } catch (e) {}
    }
  }
}




function syncPlayPauseIcon() {
  const playIcon = document.getElementById('playIcon');
  const pauseIcon = document.getElementById('pauseIcon');
  const centerPlayIcon = document.getElementById('centerPlayIcon');
  const centerPauseIcon = document.getElementById('centerPauseIcon');
  const centerPlayBtn = document.getElementById('centerPlayBtn');
  const videoOverlay = document.getElementById('videoPlayOverlay');

  if (playIcon) playIcon.classList.toggle('hidden', isPlaying);
  if (pauseIcon) pauseIcon.classList.toggle('hidden', !isPlaying);

  if (centerPlayIcon) centerPlayIcon.classList.toggle('hidden', isPlaying);
  if (centerPauseIcon) centerPauseIcon.classList.toggle('hidden', !isPlaying);

  if (centerPlayBtn) {
    centerPlayBtn.setAttribute('title', isPlaying ? 'Click to Pause Music Video' : 'Click to Play Music Video');
  }

  if (videoOverlay) {
    videoOverlay.classList.toggle('paused-state', !isPlaying);
  }
}

function triggerPlayRipple() {
  const ripple = document.getElementById('videoStatusRipple');
  if (!ripple) return;
  ripple.classList.remove('hidden');
  ripple.style.animation = 'none';
  ripple.offsetHeight; // trigger reflow
  ripple.style.animation = 'playRippleAnim 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards';
  setTimeout(() => {
    ripple.classList.add('hidden');
  }, 600);
}

// ─── LYRICS & ARTIST BIO INTEGRATION ─────────────────

// Clean artist and track names for high-accuracy lyrics search
function cleanLyricsQuery(title, artist) {
  let cleanArtist = (artist || '')
    .replace(/ - Topic$/i, '')
    .replace(/VEVO$/i, '')
    .replace(/Official Channel$/i, '')
    .replace(/Official YouTube Channel$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  let cleanTitle = (title || '')
    .replace(/\(Official (Music )?Video.*?\)/gi, '')
    .replace(/\[Official (Music )?Video.*?\]/gi, '')
    .replace(/\(Official Audio.*?\)/gi, '')
    .replace(/\[Official Audio.*?\]/gi, '')
    .replace(/\(Lyric Video.*?\)/gi, '')
    .replace(/\[Lyric Video.*?\]/gi, '')
    .replace(/\(HD\)/gi, '')
    .replace(/\[HD\]/gi, '')
    .replace(/\(4K\)/gi, '')
    .replace(/\[4K\]/gi, '')
    .replace(/\(Remastered.*?\)/gi, '')
    .replace(/\[Remastered.*?\]/gi, '')
    .replace(/\(feat\..*?\)/gi, '')
    .replace(/\[feat\..*?\]/gi, '')
    .replace(/ft\..*/gi, '')
    .replace(/feat\..*/gi, '')
    .replace(/[\(\[\{].*?[\)\]\}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { cleanTitle: cleanTitle || title, cleanArtist: cleanArtist || artist };
}


// Global state for synced lyrics
let currentSyncedLyrics = [];

// Parse LRCLIB synced LRC format: "[00:12.34] Lyric line text"
function parseLrc(lrcText) {
  if (!lrcText) return [];
  const lines = lrcText.split('\n');
  const result = [];
  const timeReg = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

  for (const line of lines) {
    const match = timeReg.exec(line);
    if (match) {
      const mins = parseInt(match[1]);
      const secs = parseInt(match[2]);
      const ms = parseInt(match[3]);
      const time = mins * 60 + secs + (ms > 99 ? ms / 1000 : ms / 100);
      const text = line.replace(timeReg, '').trim();
      if (text) result.push({ time, text });
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

// Generate estimated synced lyrics checkpoints if exact timestamps are not in LRCLIB
function generateEstimatedSyncedLyrics(plainText) {
  if (!plainText) return [];
  const rawLines = plainText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (!rawLines.length) return [];

  const totalDur = (ytPlayer && typeof ytPlayer.getDuration === 'function') ? (ytPlayer.getDuration() || 200) : 200;
  const startSec = 5;
  const endSec = Math.max(startSec + 10, totalDur - 10);
  const totalSpan = endSec - startSec;
  const step = totalSpan / rawLines.length;

  return rawLines.map((text, idx) => ({
    time: startSec + (idx * step),
    text: text
  }));
}

// Render parsed synced lyrics into BOTH drawer and Spotify Karaoke View
function renderSyncedLyrics(syncedArray) {
  const container = document.getElementById('lyricsContent');
  const karaokeBox = document.getElementById('karaokeLyricsContainer');
  if (!syncedArray || !syncedArray.length) return false;

  // Insert ♪ musical note interlude markers where time gap between lines > 5.5s
  const processedItems = [];
  for (let i = 0; i < syncedArray.length; i++) {
    const cur = syncedArray[i];
    processedItems.push(cur);

    if (i < syncedArray.length - 1) {
      const next = syncedArray[i + 1];
      if (next.time - cur.time > 5.5) {
        processedItems.push({
          time: cur.time + 3.0,
          text: '♪',
          isNote: true
        });
      }
    }
  }

  currentSyncedLyrics = processedItems;

  const drawerHtml = syncedArray.map((item, idx) => `
    <p class="lyric-line" data-index="${idx}" data-time="${item.time}">${item.text}</p>
  `).join('');

  const karaokeHtml = processedItems.map((item, idx) => `
    <p class="karaoke-line ${item.isNote ? 'karaoke-note-line' : ''}" data-index="${idx}" data-time="${item.time}">${item.text}</p>
  `).join('');

  if (container) container.innerHTML = drawerHtml;
  if (karaokeBox) karaokeBox.innerHTML = karaokeHtml;

  // Click line to seek song to that timestamp
  const seekHandler = (el) => {
    const t = parseFloat(el.dataset.time);
    if (ytPlayer && ytReady && typeof ytPlayer.seekTo === 'function') {
      ytPlayer.seekTo(t, true);
    }
  };

  document.querySelectorAll('.lyric-line, .karaoke-line').forEach(el => {
    el.addEventListener('click', () => seekHandler(el));
  });

  return true;
}

// Local Synced Lyrics Database for Popular Tracks
const POPULAR_SYNCED_LYRICS_DB = {
  "yellow": [
    { time: 14, text: "Look at the stars, look how they shine for you" },
    { time: 21, text: "And everything you do, yeah they were all yellow" },
    { time: 29, text: "I came along, I wrote a song for you" },
    { time: 36, text: "And all the things you do, and it was called Yellow" },
    { time: 44, text: "So then I took my turn, oh what a thing to have done" },
    { time: 52, text: "And it was all yellow" },
    { time: 61, text: "Your skin, oh yeah, your skin and bones" },
    { time: 68, text: "Turn into something beautiful" },
    { time: 76, text: "And you know, for you I'd bleed myself dry" },
    { time: 84, text: "For you I'd bleed myself dry" },
    { time: 99, text: "I swam across, I jumped across for you" },
    { time: 106, text: "Oh what a thing to do, 'cause you were all yellow" },
    { time: 114, text: "I drew a line, I drew a line for you" },
    { time: 121, text: "Oh what a thing to do, and it was all yellow" },
    { time: 130, text: "Your skin, oh yeah, your skin and bones" },
    { time: 137, text: "Turn into something beautiful" },
    { time: 145, text: "And you know, for you I'd bleed myself dry" },
    { time: 153, text: "For you I'd bleed myself dry..." }
  ],
  "shape of you": [
    { time: 7, text: "The club isn't the best place to find a lover so the bar is where I go" },
    { time: 11, text: "Me and my friends at the table doing shots, drinking fast and then we talk slow" },
    { time: 15, text: "Come over and start a conversation with just me, and trust me I'll give it a chance now" },
    { time: 19, text: "Take my hand, stop, put Van the Man on the jukebox and then we start to dance" },
    { time: 23, text: "And now I'm singing like: Girl, you know I want your love" },
    { time: 27, text: "Your love was handcrafted for somebody like me" },
    { time: 31, text: "Come on now, follow my lead" },
    { time: 33, text: "I may be crazy, don't mind me, say" },
    { time: 35, text: "Boy, let's not talk too much, grab on my waist and put that body on me" },
    { time: 39, text: "Come on now, follow my lead, come, come on now, follow my lead" },
    { time: 43, text: "I'm in love with the shape of you" },
    { time: 47, text: "We push and pull like a magnet do" },
    { time: 51, text: "Although my heart is falling too" },
    { time: 55, text: "I'm in love with your body" },
    { time: 59, text: "Last night you were in my room, and now my bedsheets smell like you" },
    { time: 63, text: "Every day discovering something brand new" },
    { time: 67, text: "I'm in love with your body!" }
  ],
  "blinding lights": [
    { time: 27, text: "I've been tryna call" },
    { time: 30, text: "I've been on my own for long enough" },
    { time: 34, text: "Maybe you can show me how to love, maybe" },
    { time: 41, text: "I'm going through withdrawals" },
    { time: 44, text: "You don't even have to do too much" },
    { time: 48, text: "You can turn me on with just a touch, baby" },
    { time: 54, text: "I look around and Sin City's cold and empty" },
    { time: 58, text: "No one's around to judge me" },
    { time: 61, text: "I can't see clearly when you're gone" },
    { time: 66, text: "I said, ooh, I'm blinded by the lights" },
    { time: 73, text: "No, I can't sleep until I feel your touch" },
    { time: 80, text: "I said, ooh, I'm drowning in the night" },
    { time: 87, text: "Oh, when I'm like this, you're the one I trust!" }
  ],
  "starboy": [
    { time: 15, text: "I'm tryna put you in the worst mood, ah" },
    { time: 18, text: "P1 cleaner than your church shoes, ah" },
    { time: 22, text: "Milli point two just to hurt you, ah" },
    { time: 25, text: "All Red Lamb' just to tease you, ah" },
    { time: 29, text: "None of these toys on lease too, ah" },
    { time: 33, text: "Made your whole year in a week too, yah" },
    { time: 36, text: "Main bitch out your league too, ah" },
    { time: 40, text: "Side bitch out of your league too, ah" },
    { time: 43, text: "Look what you'done! I'm a motherfuckin' Starboy" },
    { time: 50, text: "Look what you've done! I'm a motherfuckin' Starboy" }
  ],
  "as it was": [
    { time: 9, text: "Come on, Harry, we wanna say goodnight to you" },
    { time: 16, text: "Holdin' me back, gravity's holdin' me back" },
    { time: 24, text: "I want you to hold out the palm of your hand, why don't we leave it at that?" },
    { time: 32, text: "Nothin' to say, when everything gets in the way" },
    { time: 40, text: "You know it's not the same as it was" },
    { time: 44, text: "In this world, it's just us, you know it's not the same as it was" },
    { time: 52, text: "In this world, it's just us, you know it's not the same as it was" }
  ],
  "levitating": [
    { time: 13, text: "If you wanna run away with me, I know a galaxy and I can take you for a ride" },
    { time: 21, text: "I had a premonition that we fell into a rhythm where the music don't stop for life" },
    { time: 28, text: "Glitter in the sky, glitter in my eyes, shining just the way I like" },
    { time: 36, text: "If you're feeling like you need a little bit of company, you met me at the perfect time" },
    { time: 44, text: "You want me, I want you, baby" },
    { time: 48, text: "My sugarboo, I'm levitating!" }
  ]
};


const LOFI_INSTRUMENTAL_SYNCED_LYRICS = [
  { time: 6, text: "♪ (Soothing Lo-Fi Vinyl Ambience)" },
  { time: 16, text: "♪ (Soft Piano Melody & Warm Rain Rhythms)" },
  { time: 28, text: "♪ (Relaxing Chill Beats - Sing Along & Vibe)" },
  { time: 42, text: "♪ (Gentle Bass Resonance)" },
  { time: 58, text: "♪ (Analog Tape Hiss & Warm Candlelight Vibes)" },
  { time: 74, text: "♪ (Floating Soft Harmonies)" },
  { time: 92, text: "♪ (Deep Focus & Cozy Mind Escape)" },
  { time: 110, text: "♪ (Soothing Acoustic Decay)" },
  { time: 130, text: "♪ (Rain & Vinyl Needle Scratch)" },
  { time: 150, text: "♪ (Peaceful Evening Harmony)" }
];

function generateRhythmicKaraokeLines(title, artist) {
  const dur = (ytPlayer && typeof ytPlayer.getDuration === 'function') ? (ytPlayer.getDuration() || 180) : 180;
  const lines = [
    `♪ (Intro — ${artist || 'VYNL Music'})`,
    `[Verse 1] Sing along to ${title}`,
    `Feel the rhythm in the music flow...`,
    `Every beat brings the mood to life`,
    `♪ (Instrumental Bridge & Harmony)`,
    `[Chorus] ${title}`,
    `Sing it out loud, let the sound resonate...`,
    `Golden melodies filling the air`,
    `♪ (Guitar & Synthesizer Solo)`,
    `[Verse 2] ${artist || 'VYNL Vibe'}`,
    `Lost in the groove of the sound...`,
    `[Chorus] ${title}`,
    `Sing along with the music!`,
    `♪ (Outro — Smooth Fade)`
  ];

  const step = Math.max(8, Math.floor((dur - 10) / lines.length));
  return lines.map((text, idx) => ({
    time: 5 + (idx * step),
    text: text
  }));
}

// Fetch lyrics using multi-tier fallback (Local DB -> LRCLIB synced -> LRCLIB search -> OVH API -> Rhythmic Generator)
async function fetchLyrics(title, artist) {
  const lyricsContent = document.getElementById('lyricsContent');
  const songTitleEl = document.getElementById('lyricsSongTitle');
  const artistNameEl = document.getElementById('lyricsArtistName');
  const geniusLink = document.getElementById('geniusDirectLink');

  const karaokeTitle = document.getElementById('karaokeTitle');
  const karaokeArtist = document.getElementById('karaokeArtist');
  const karaokeBox = document.getElementById('karaokeLyricsContainer');
  const karaokeThumb = document.getElementById('karaokeAlbumThumb');

  currentSyncedLyrics = [];

  const { cleanTitle, cleanArtist } = cleanLyricsQuery(title, artist);

  if (songTitleEl) songTitleEl.textContent = title;
  if (artistNameEl) artistNameEl.textContent = artist;
  if (karaokeTitle) karaokeTitle.textContent = title;
  if (karaokeArtist) karaokeArtist.textContent = artist;

  // Sync album cover to karaoke header if available
  const playerThumb = document.getElementById('playerAlbumThumb');
  if (karaokeThumb && playerThumb && playerThumb.src) {
    karaokeThumb.src = playerThumb.src;
    karaokeThumb.classList.remove('hidden');
  }

  const geniusSearchUrl = `https://genius.com/search?q=${encodeURIComponent(cleanArtist + ' ' + cleanTitle)}`;
  if (geniusLink) geniusLink.href = geniusSearchUrl;

  if (lyricsContent) lyricsContent.textContent = 'Loading synced lyrics...';
  if (karaokeBox) karaokeBox.innerHTML = '<p class="karaoke-line active">Loading lyrics for Sing Along...</p>';

  const lowTitle = cleanTitle.toLowerCase();

  // Tier 1: Local Synced Lyrics Database Match
  for (const key in POPULAR_SYNCED_LYRICS_DB) {
    if (lowTitle.includes(key)) {
      currentSyncedLyrics = POPULAR_SYNCED_LYRICS_DB[key];
      if (renderSyncedLyrics(currentSyncedLyrics)) return;
    }
  }

  // Tier 2: Check for Lo-Fi / Instrumental / Chill Vibe tracks
  if (lowTitle.includes('lofi') || lowTitle.includes('chill') || lowTitle.includes('instrumental') || lowTitle.includes('synthwave') || lowTitle.includes('ambient') || lowTitle.includes('rain')) {
    currentSyncedLyrics = LOFI_INSTRUMENTAL_SYNCED_LYRICS;
    if (renderSyncedLyrics(currentSyncedLyrics)) return;
  }

  // Tier 3: Try LRCLIB exact match API
  try {
    const res1 = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtist)}&track_name=${encodeURIComponent(cleanTitle)}`);
    if (res1.ok) {
      const data1 = await res1.json();
      if (data1.syncedLyrics) {
        currentSyncedLyrics = parseLrc(data1.syncedLyrics);
        if (currentSyncedLyrics.length && renderSyncedLyrics(currentSyncedLyrics)) return;
      }
      if (data1.plainLyrics) {
        currentSyncedLyrics = generateEstimatedSyncedLyrics(data1.plainLyrics);
        if (currentSyncedLyrics.length && renderSyncedLyrics(currentSyncedLyrics)) return;
      }
    }
  } catch (e) { }

  // Tier 4: Fallback to LRCLIB fuzzy search query
  try {
    const res2 = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(cleanArtist + ' ' + cleanTitle)}`);
    if (res2.ok) {
      const data2 = await res2.json();
      if (Array.isArray(data2) && data2.length > 0) {
        const item = data2.find(x => x.syncedLyrics || x.plainLyrics) || data2[0];
        if (item.syncedLyrics) {
          currentSyncedLyrics = parseLrc(item.syncedLyrics);
          if (currentSyncedLyrics.length && renderSyncedLyrics(currentSyncedLyrics)) return;
        }
        if (item.plainLyrics) {
          currentSyncedLyrics = generateEstimatedSyncedLyrics(item.plainLyrics);
          if (currentSyncedLyrics.length && renderSyncedLyrics(currentSyncedLyrics)) return;
        }
      }
    }
  } catch (e) { }

  // Tier 5: Fallback to OVH Free Lyrics API
  try {
    const res3 = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`);
    if (res3.ok) {
      const data3 = await res3.json();
      if (data3.lyrics) {
        currentSyncedLyrics = generateEstimatedSyncedLyrics(data3.lyrics);
        if (currentSyncedLyrics.length && renderSyncedLyrics(currentSyncedLyrics)) return;
      }
    }
  } catch (e) { }

  // Tier 6: Guaranteed Rhythmic Synced Karaoke Generator
  currentSyncedLyrics = generateRhythmicKaraokeLines(cleanTitle, cleanArtist);
  renderSyncedLyrics(currentSyncedLyrics);
}

// Fetch artist summary from Wikipedia API
async function fetchArtistBio(artistName, trackThumbnail) {
  const bioSection = document.getElementById('artistBioSection');
  const nameEl = document.getElementById('artistName');
  const bioTextEl = document.getElementById('artistBioText');
  const avatarEl = document.getElementById('artistAvatar');
  const geniusBtn = document.getElementById('geniusLink');

  if (!artistName || artistName === '—' || !bioSection) return;

  bioSection.classList.remove('hidden');
  if (nameEl) nameEl.textContent = artistName;
  if (avatarEl) avatarEl.src = trackThumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?fit=crop&w=120&h=120&q=80';
  if (bioTextEl) bioTextEl.textContent = `Loading bio for ${artistName}...`;

  if (geniusBtn) {
    geniusBtn.href = `https://genius.com/search?q=${encodeURIComponent(artistName)}`;
  }

  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(artistName)}`);
    if (!res.ok) throw new Error('Bio not found');
    const data = await res.json();

    if (data.extract && bioTextEl) {
      bioTextEl.textContent = data.extract;
    } else if (bioTextEl) {
      bioTextEl.textContent = `${artistName} is an official featured artist on YouTube Music. Explore their full lyrics and song annotations on Genius.com.`;
    }
    if (data.thumbnail?.source && avatarEl) {
      avatarEl.src = data.thumbnail.source;
    }
  } catch (e) {
    if (bioTextEl) {
      bioTextEl.textContent = `${artistName} is an official featured creator on YouTube Music. Listen to their official releases and view Genius annotations.`;
    }
  }
}

// Immersive Video Mode Helpers
function enableImmersiveMode() {
  document.body.classList.add('immersive-mode');
  const btnText = document.querySelector('.hub-btn-text');
  if (btnText) btnText.textContent = 'Show Dashboard / Vibe Menu';
}

function disableImmersiveMode() {
  document.body.classList.remove('immersive-mode');
  document.body.classList.remove('show-hud');
  const btnText = document.querySelector('.hub-btn-text');
  if (btnText) btnText.textContent = 'Dashboard & Vibe Menu';
}

function toggleImmersiveMode() {
  if (document.body.classList.contains('immersive-mode')) {
    disableImmersiveMode();
  } else {
    enableImmersiveMode();
  }
}

// ─── OFFICIAL SQUARE ALBUM COVER ART API ───────────────
const albumCoverCache = {};

async function getOfficialAlbumCover(title, artist, fallbackUrl = 'vinyl.jpg') {
  const cleanArtist = (artist || '').replace(/ - Topic$/i, '').replace(/VEVO$/i, '').replace(/Official Channel$/i, '').trim();
  const cleanTitle = (title || '')
    .replace(/\(feat\..*?\)/gi, '')
    .replace(/\[feat\..*?\]/gi, '')
    .replace(/ft\..*/gi, '')
    .replace(/feat\..*/gi, '')
    .replace(/[\(\[\{].*?[\)\]\}]/g, '')
    .trim();

  const cacheKey = `${cleanArtist}-${cleanTitle}`.toLowerCase();
  if (albumCoverCache[cacheKey]) return albumCoverCache[cacheKey];

  try {
    const query = `${cleanArtist} ${cleanTitle}`.trim();
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=1`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0 && data.results[0].artworkUrl100) {
        // Upgrade 100x100 to 600x600 HD square album cover art!
        const hiresCover = data.results[0].artworkUrl100.replace('100x100bb.jpg', '600x600bb.jpg');
        albumCoverCache[cacheKey] = hiresCover;
        return hiresCover;
      }
    }
  } catch (e) {
    console.warn('iTunes album cover fetch note:', e);
  }

  albumCoverCache[cacheKey] = fallbackUrl || 'vinyl.jpg';
  return fallbackUrl || 'vinyl.jpg';
}

// ─── MOOD BACKGROUND IMAGERY ENGINE ─────────────────
const MOOD_BACKGROUNDS = {
  chill: 'cosmic_supernova_bg.jpg',
  mew: 'bg_pixel_mew.jpg',
  psychedelic: 'bg_tame_impala_waves.jpg',
  lofi: 'bg_night_cat.jpg',
  happy: 'bg_goldfish_art.jpg',
  focus: 'bg_pixel_star_grid.jpg',
  sad: 'pinterest_cherry_blossom.png',
  energetic: 'bg_solar_flare.jpg',
  party: 'bg_anime_crt.jpg',
  workout: 'pinterest_pixel_forest.png',
  romantic: 'pinterest_pixel_galaxy.png',
  sleep: 'pixel_stars.png',
  default: 'cosmic_supernova_bg.jpg'
};




function updateBackground(moodKey) {
  const bgImg = document.getElementById('bgImg');
  if (!bgImg) return;

  if (currentMediaMode === 'artwork') {
    updateArtworkCanvasDisplay();
    return;
  }

  const key = (moodKey || 'chill').toLowerCase();
  const url = MOOD_BACKGROUNDS[key] || MOOD_BACKGROUNDS['default'];
  bgImg.src = url;
  bgImg.classList.remove('artwork-mode');
  bgImg.style.opacity = '1';

  const bgOverlay = document.getElementById('bgOverlay');
  if (bgOverlay) {
    bgOverlay.style.background = 'radial-gradient(circle at 40% 60%, rgba(60,32,5,0.45) 0%, rgba(8,5,2,0.82) 100%)';
  }
}


// ─── PLAYBACK CONTROLS ────────────────────────────────
function playTrack(index) {
  const track = currentTracks[index];
  if (!track) return;

  ensureYTPlayerInit();

  if (!ytReady || !ytPlayer || typeof ytPlayer.loadVideoById !== 'function') {
    pendingTrackIndex = index;
    if (window.YT && window.YT.Player && !ytPlayer) {
      initYTPlayer();
    }
    return;
  }

  currentIdx = index;
  try {
    ytPlayer.loadVideoById({
      videoId: track.videoId
    });
    if (typeof ytPlayer.unMute === 'function') ytPlayer.unMute();
    const volumeSlider = document.getElementById('volumeSlider');
    const currentVol = volumeSlider ? parseInt(volumeSlider.value) : 80;
    if (typeof ytPlayer.setVolume === 'function') ytPlayer.setVolume(currentVol > 0 ? currentVol : 80);
    if (typeof ytPlayer.playVideo === 'function') ytPlayer.playVideo();
  } catch (e) {
    console.warn('Error loading video by ID:', e);
  }

  isPlaying = true;
  syncPlayPauseIcon();

  // Update player bar, karaoke cover & reveal video when about to play
  document.getElementById('playerTitle').textContent = track.title;
  document.getElementById('playerChannel').textContent = track.channel;

  const thumbEl = document.getElementById('playerAlbumThumb');
  const karaokeThumb = document.getElementById('karaokeAlbumThumb');
  const initialThumb = track.albumCover || track.thumbnail || 'vinyl.jpg';

  if (thumbEl) thumbEl.src = initialThumb;
  if (karaokeThumb) {
    karaokeThumb.src = initialThumb;
    karaokeThumb.classList.remove('hidden');
  }

  // Fetch official square album cover art (iTunes HD 600x600)
  getOfficialAlbumCover(track.title, track.channel, initialThumb).then(officialCover => {
    track.albumCover = officialCover;
    if (thumbEl) thumbEl.src = officialCover;
    if (karaokeThumb) karaokeThumb.src = officialCover;

    const activeRecThumb = document.querySelector(`.recs-item[data-index="${index}"] .recs-thumb`);
    if (activeRecThumb) activeRecThumb.src = officialCover;

    const artistAvatar = document.getElementById('artistAvatar');
    if (artistAvatar) artistAvatar.src = officialCover;
  });

  document.getElementById('playerBar').classList.remove('hidden');

  const videoWrap = document.getElementById('ytVideoWrap');
  if (videoWrap && currentMediaMode === 'video') videoWrap.classList.remove('hidden');

  if (currentMediaMode === 'artwork') {
    updateArtworkCanvasDisplay();
  }

  const videoOverlay = document.getElementById('videoPlayOverlay');
  if (videoOverlay) videoOverlay.classList.remove('hidden');

  // Ensure mood background image is visible
  const bgImg = document.getElementById('bgImg');
  if (bgImg) bgImg.style.opacity = '1';

  // Highlight active row in Recommendations Dropdown
  document.querySelectorAll('.recs-item').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });

  // 🎨 Update background image to current mood
  updateBackground(currentMoodKey);

  // 🎤 Fetch lyrics and artist bio
  fetchLyrics(track.title, track.channel);
  fetchArtistBio(track.channel, track.thumbnail);

  startProgressTick();
}

// ─── SAVED SONGS LOCALSTORAGE LIBRARY ENGINE ──────────────
let savedTracks = [];

function loadSavedTracks() {
  try {
    const raw = localStorage.getItem('VYNL_SAVED_SONGS');
    if (raw) savedTracks = JSON.parse(raw);
    else savedTracks = [];
  } catch (e) {
    savedTracks = [];
  }
  updateSavedBadgeCount();
}

function saveSavedTracks() {
  try {
    localStorage.setItem('VYNL_SAVED_SONGS', JSON.stringify(savedTracks));
  } catch (e) { }
  updateSavedBadgeCount();
}

function updateSavedBadgeCount() {
  const badge = document.getElementById('savedCountBadge');
  const sub = document.getElementById('savedSubtitle');
  const clearBtn = document.getElementById('clearSavedBtn');
  const shuffleSavedBtn = document.getElementById('shuffleSavedBtn');
  const count = savedTracks.length;

  if (badge) badge.textContent = count;
  if (sub) sub.textContent = `${count} saved track${count === 1 ? '' : 's'} in your offline library.`;
  if (clearBtn) clearBtn.classList.toggle('hidden', count === 0);
  if (shuffleSavedBtn) shuffleSavedBtn.classList.toggle('hidden', count === 0);

  updatePlayerBarHeartIcon();
}

// ─── SHUFFLE PLAYBACK ENGINE ────────────────────────────
let isShuffleActive = false;

function toggleShuffleMode(forceState) {
  if (typeof forceState === 'boolean') {
    isShuffleActive = forceState;
  } else {
    isShuffleActive = !isShuffleActive;
  }
  updateShuffleUI();
}

function updateShuffleUI() {
  const shuffleBtn = document.getElementById('shuffleBtn');
  const shuffleSavedBtn = document.getElementById('shuffleSavedBtn');

  if (shuffleBtn) {
    shuffleBtn.classList.toggle('active-mode', isShuffleActive);
    shuffleBtn.setAttribute('title', isShuffleActive ? 'Shuffle Mode: ON (Click to turn off)' : 'Shuffle Mode: OFF (Click to turn on)');
  }

  if (shuffleSavedBtn) {
    if (isShuffleActive) {
      shuffleSavedBtn.textContent = '🔀 Shuffle ON';
      shuffleSavedBtn.classList.add('shuffle-active');
    } else {
      shuffleSavedBtn.textContent = '🔀 Shuffle Play';
      shuffleSavedBtn.classList.remove('shuffle-active');
    }
  }
}

function playNextShuffleTrack() {
  if (!currentTracks || !currentTracks.length) return;

  if (currentTracks.length === 1) {
    playTrack(0);
    return;
  }

  let nextIdx;
  do {
    nextIdx = Math.floor(Math.random() * currentTracks.length);
  } while (nextIdx === currentIdx && currentTracks.length > 1);

  playTrack(nextIdx);
}

function isTrackSaved(videoId) {
  if (!videoId) return false;
  return savedTracks.some(t => t.videoId === videoId);
}

function toggleSaveTrack(track) {
  if (!track || !track.videoId) return;
  const idx = savedTracks.findIndex(t => t.videoId === track.videoId);
  if (idx !== -1) {
    savedTracks.splice(idx, 1);
  } else {
    savedTracks.unshift({
      videoId: track.videoId,
      title: track.title,
      channel: track.channel,
      thumbnail: track.thumbnail || track.albumCover || `https://i.ytimg.com/vi/${track.videoId}/hqdefault.jpg`,
      duration: track.duration || '3:30',
      savedAt: Date.now()
    });
  }
  saveSavedTracks();
  renderSavedLibrary();
  renderTrackList(currentTracks);
}

function updatePlayerBarHeartIcon() {
  const btn = document.getElementById('playerHeartBtn');
  if (!btn) return;
  const currentTrack = currentTracks[currentIdx];
  if (currentTrack && isTrackSaved(currentTrack.videoId)) {
    btn.innerHTML = '<span class="heart-icon active" title="Remove from Saved Library">❤️</span>';
  } else {
    btn.innerHTML = '<span class="heart-icon" title="Save to Library">🤍</span>';
  }
}

function renderSavedLibrary() {
  const listEl = document.getElementById('savedTrackList');
  if (!listEl) return;

  if (!savedTracks.length) {
    listEl.innerHTML = `
      <div class="empty-saved-hint">
        <p style="font-size: 1.15rem; color: #f5dfa0; font-weight: 700; margin-bottom: 8px;">❤️ Your Saved Library is empty</p>
        <p style="font-size: 0.9rem; color: #a8916a;">Click the heart icon (❤️) on any song card or player bar to save your favorite tracks for instant access anytime!</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = savedTracks.map((t, i) => `
    <div class="track-item saved-item" data-index="${i}">
      <span class="track-num">${i + 1}</span>
      <img class="track-thumb" src="${t.thumbnail}" alt="${t.title}" loading="lazy" />
      <div class="track-meta">
        <div class="track-title">${t.title}</div>
        <div class="track-channel">${t.channel} <span class="verified-tag">✓</span></div>
      </div>
      <span class="track-duration">${t.duration || '3:30'}</span>
      <div class="track-actions">
        <button class="track-play-btn" title="Play Track">▶</button>
        <button class="track-board-btn outline-btn small-btn" title="Add to Music Board" data-index="${i}">+ Board</button>
        <button class="track-remove-btn" title="Remove from Saved">💔</button>
      </div>
    </div>
  `).join('');

  listEl.querySelectorAll('.saved-item').forEach(el => {
    const idx = parseInt(el.dataset.index);
    const itemTrack = savedTracks[idx];

    const playBtn = el.querySelector('.track-play-btn');
    if (playBtn) {
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playTrackFromSaved(idx);
      });
    }

    const boardBtn = el.querySelector('.track-board-btn');
    if (boardBtn) {
      boardBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openAddToBoardModal(itemTrack);
      });
    }

    const removeBtn = el.querySelector('.track-remove-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSaveTrack(itemTrack);
      });
    }

    el.addEventListener('click', (e) => {
      if (e.target.closest('.track-remove-btn') || e.target.closest('.track-board-btn')) return;
      playTrackFromSaved(idx);
    });
  });
}

function playTrackFromSaved(savedIndex) {
  if (!savedTracks[savedIndex]) return;
  currentTracks = [...savedTracks];
  currentIdx = savedIndex;
  renderTrackList(currentTracks);
  ensureYTPlayerInit();
  playTrack(savedIndex);
}

function renderTrackList(tracks) {
  const recsBtn = document.getElementById('recsDropdownBtn');
  const recsCount = document.getElementById('recsCount');
  const recsList = document.getElementById('recsList');
  const resultsTrackList = document.getElementById('resultsTrackList');

  if (recsCount) recsCount.textContent = tracks.length;
  if (recsBtn) recsBtn.classList.remove('hidden');

  if (recsList) {
    recsList.innerHTML = tracks.map((t, i) => `
      <div class="recs-item ${i === currentIdx ? 'active' : ''}" data-index="${i}">
        <span class="recs-num">${i + 1}</span>
        <img class="recs-thumb" src="${t.thumbnail}" alt="" loading="lazy" />
        <div class="recs-info">
          <div class="recs-title">${t.title}</div>
          <div class="recs-channel">${t.channel} <span class="recs-verified">✓</span></div>
        </div>
        <span class="recs-duration">${t.duration || '3:30'}</span>
        <button class="track-board-mini-btn" title="Add to Music Board" data-index="${i}">➕</button>
        <button class="track-save-mini-btn" title="Save Track" data-index="${i}">
          ${isTrackSaved(t.videoId) ? '❤️' : '🤍'}
        </button>
      </div>
    `).join('');

    recsList.querySelectorAll('.recs-item').forEach(el => {
      const idx = parseInt(el.dataset.index);
      el.addEventListener('click', (e) => {
        if (e.target.closest('.track-save-mini-btn') || e.target.closest('.track-board-mini-btn')) return;
        playTrack(idx);
        document.getElementById('recsDropdownMenu')?.classList.add('hidden');
      });

      const boardBtn = el.querySelector('.track-board-mini-btn');
      if (boardBtn) {
        boardBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openAddToBoardModal(tracks[idx]);
        });
      }

      const saveBtn = el.querySelector('.track-save-mini-btn');
      if (saveBtn) {
        saveBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleSaveTrack(tracks[idx]);
        });
      }
    });

    tracks.forEach((t, i) => {
      getOfficialAlbumCover(t.title, t.channel, t.thumbnail).then(cover => {
        t.albumCover = cover;
        const el = document.querySelector(`.recs-item[data-index="${i}"] .recs-thumb`);
        if (el) el.src = cover;
      });
    });
  }

  if (resultsTrackList) {
    resultsTrackList.innerHTML = tracks.map((t, i) => `
      <div class="track-item ${i === currentIdx ? 'active' : ''}" data-index="${i}">
        <span class="track-num">${i + 1}</span>
        <img class="track-thumb" src="${t.thumbnail}" alt="${t.title}" loading="lazy" />
        <div class="track-meta">
          <div class="track-title">${t.title}</div>
          <div class="track-channel">${t.channel} <span class="verified-tag">✓</span></div>
        </div>
        <span class="track-duration">${t.duration || '3:30'}</span>
        <div class="track-actions">
          <button class="track-play-btn" title="Play Track">▶</button>
          <button class="track-board-btn outline-btn small-btn" title="Add to Music Board" data-index="${i}">+ Board</button>
          <button class="track-save-btn" title="Save to Library" data-index="${i}">
            ${isTrackSaved(t.videoId) ? '❤️' : '🤍'}
          </button>
        </div>
      </div>
    `).join('');

    resultsTrackList.querySelectorAll('.track-item').forEach(el => {
      const idx = parseInt(el.dataset.index);
      el.addEventListener('click', (e) => {
        if (e.target.closest('.track-save-btn') || e.target.closest('.track-board-btn')) return;
        playTrack(idx);
      });

      const boardBtn = el.querySelector('.track-board-btn');
      if (boardBtn) {
        boardBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openAddToBoardModal(tracks[idx]);
        });
      }

      const saveBtn = el.querySelector('.track-save-btn');
      if (saveBtn) {
        saveBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleSaveTrack(tracks[idx]);
        });
      }
    });
  }

  updatePlayerBarHeartIcon();
}

function togglePlay() {
  if (!currentTracks || currentTracks.length === 0) {
    generatePlaylist();
    return;
  }
  if (currentIdx === -1 && currentTracks.length > 0) {
    playTrack(0);
    return;
  }

  ensureYTPlayerInit();

  if (!ytPlayer || !ytReady) {
    if (window.YT && window.YT.Player) {
      initYTPlayer();
    }
    console.warn('YouTube player not ready yet.');
    return;
  }

  let state = -1;
  if (typeof ytPlayer.getPlayerState === 'function') {
    try {
      state = ytPlayer.getPlayerState();
    } catch (e) {
      console.warn('Could not read player state:', e);
    }
  }

  if (state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING) {
    if (typeof ytPlayer.pauseVideo === 'function') {
      ytPlayer.pauseVideo();
    }
    isPlaying = false;
  } else {
    if (typeof ytPlayer.unMute === 'function') ytPlayer.unMute();
    if (typeof ytPlayer.playVideo === 'function') {
      ytPlayer.playVideo();
    }
    isPlaying = true;
  }

  syncPlayPauseIcon();
  triggerPlayRipple();
}

// ─── LOOP PLAYBACK ENGINE ───────────────────────────────
let isLoopActive = false;

function toggleLoopMode() {
  isLoopActive = !isLoopActive;
  const loopBtn = document.getElementById('loopBtn');
  if (loopBtn) {
    loopBtn.classList.toggle('active-mode', isLoopActive);
    loopBtn.setAttribute('title', isLoopActive ? 'Loop Mode: ON (Click to turn off)' : 'Loop Mode: OFF (Click to turn on)');
  }
}

function goNext() {
  if (!currentTracks || currentTracks.length === 0) return;
  if (isShuffleActive) {
    playNextShuffleTrack();
    return;
  }
  const next = (currentIdx + 1) % currentTracks.length;
  playTrack(next);
}

function goPrev() {
  if (!currentTracks || currentTracks.length === 0) return;
  let curTime = 0;
  try {
    if (ytPlayer && ytReady && typeof ytPlayer.getCurrentTime === 'function') {
      curTime = ytPlayer.getCurrentTime() || 0;
    }
  } catch (e) {}

  if (curTime > 3) {
    try {
      if (ytPlayer && typeof ytPlayer.seekTo === 'function') {
        ytPlayer.seekTo(0, true);
        return;
      }
    } catch (e) {}
  }
  const prev = (currentIdx - 1 + currentTracks.length) % currentTracks.length;
  playTrack(prev);
}

function seekTo(fraction) {
  if (!ytPlayer || !ytReady) return;
  try {
    const dur = (typeof ytPlayer.getDuration === 'function') ? ytPlayer.getDuration() : 0;
    if (dur && typeof ytPlayer.seekTo === 'function') {
      ytPlayer.seekTo(fraction * dur, true);
    }
  } catch (e) {
    console.warn('Seek error:', e);
  }
}

function updateSyncedLyricsHighlight(curTime) {
  if (!currentSyncedLyrics || !currentSyncedLyrics.length) return;

  let activeIdx = -1;
  for (let i = 0; i < currentSyncedLyrics.length; i++) {
    if (curTime >= currentSyncedLyrics[i].time) {
      activeIdx = i;
    } else {
      break;
    }
  }

  // Update Drawer lines if present
  const dContainer = document.getElementById('lyricsContent');
  if (dContainer) {
    const dLines = dContainer.querySelectorAll('.lyric-line');
    dLines.forEach((line, idx) => {
      if (idx === activeIdx) {
        if (!line.classList.contains('active')) {
          line.classList.add('active');
          line.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        line.classList.remove('active');
      }
    });
  }

  // Update Spotify Karaoke View lines
  const kContainer = document.getElementById('karaokeLyricsContainer');
  if (kContainer) {
    const kLines = kContainer.querySelectorAll('.karaoke-line');
    kLines.forEach((line, idx) => {
      if (idx === activeIdx) {
        if (!line.classList.contains('active')) {
          line.classList.add('active');
          line.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        line.classList.remove('active');
      }
    });
  }
}

function startProgressTick() {
  clearInterval(progressTimer);
  progressTimer = setInterval(() => {
    if (!ytPlayer || !ytReady) return;
    let cur = 0, dur = 0;
    try {
      if (typeof ytPlayer.getCurrentTime === 'function') cur = ytPlayer.getCurrentTime() || 0;
      if (typeof ytPlayer.getDuration === 'function') dur = ytPlayer.getDuration() || 0;
    } catch (e) {
      return;
    }

    if (dur) {
      const pct = Math.min(100, Math.max(0, (cur / dur) * 100));
      const fillEl = document.getElementById('progressFill');
      const curEl = document.getElementById('currentTime');
      const totalEl = document.getElementById('totalTime');
      if (fillEl) fillEl.style.width = pct + '%';
      if (curEl) curEl.textContent = fmtSec(cur);
      if (totalEl) totalEl.textContent = fmtSec(dur);
      updateSyncedLyricsHighlight(cur);
    }
  }, 100); // High-frequency 10Hz tick for real-time accurate lyrics sync
}


// ─── UI HELPERS ───────────────────────────────────────
function fmtSec(sec) {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ─── HERO NATURAL LANGUAGE MOOD GENERATOR (ROADMAP PHASE 0/3) ─────
async function generatePlaylist() {
  const input = document.getElementById('moodInput').value.trim();
  const activeEl = document.querySelector('.mood-chip.active');

  let moodKey = 'chill', customQuery, generatedTitle = '', generatedEmoji = '🎵', generatedDesc = '';

  if (input) {
    // Natural Language Conversational Prompt Parsing
    moodKey = detectMood(input);
    const mood = MOODS[moodKey] || MOODS.chill;
    customQuery = input + ' ' + mood.query;

    // Synthesize Creative Board Title & Aesthetic Subtitle
    const lower = input.toLowerCase();
    if (lower.includes('rain') || lower.includes('2am') || lower.includes('2 am') || lower.includes('night') && lower.includes('rain')) {
      generatedTitle = '🌧️ 2AM IN THE RAIN';
      generatedEmoji = '🌧️';
      generatedDesc = 'Mood: Nostalgic • Melancholic • Dreamy';
    } else if (lower.includes('drive') || lower.includes('highway') || lower.includes('car')) {
      generatedTitle = '🚗 MIDNIGHT HIGHWAY DRIVE';
      generatedEmoji = '🚗';
      generatedDesc = 'Mood: Dreamy • Late Night • Synthwave';
    } else if (lower.includes('tokyo') || lower.includes('cafe') || lower.includes('coffee')) {
      generatedTitle = '☕ RAINY TOKYO CAFE';
      generatedEmoji = '☕';
      generatedDesc = 'Mood: Cozy • Instrumental • Lo-Fi';
    } else if (lower.includes('miss') || lower.includes('breakup') || lower.includes('alone') || lower.includes('heart')) {
      generatedTitle = '💔 AFTER THE BREAKUP';
      generatedEmoji = '💔';
      generatedDesc = 'Mood: Bittersweet • Emotional • Cinematic';
    } else if (lower.includes('code') || lower.includes('coding') || lower.includes('coder') || lower.includes('hack')) {
      generatedTitle = '⚡ 3AM CYBER CODER';
      generatedEmoji = '⚡';
      generatedDesc = 'Mood: Darksynth • Cyberpunk • Deep Flow';
    } else if (lower.includes('gym') || lower.includes('workout') || lower.includes('pr') || lower.includes('pump')) {
      generatedTitle = '💪 OVERDRIVE GYM PR';
      generatedEmoji = '💪';
      generatedDesc = 'Mood: High Energy • Phonk • Bass Boost';
    } else {
      const words = input.split(' ').slice(0, 4).join(' ').toUpperCase();
      generatedTitle = `${mood.emoji} ${words}`;
      generatedEmoji = mood.emoji;
      generatedDesc = `Mood: ${mood.name} • Personalized Vibe`;
    }

    addMoodHistory(generatedTitle, generatedEmoji);
  } else if (activeEl) {
    moodKey = activeEl.dataset.mood;
    const mood = MOODS[moodKey] || MOODS.chill;
    generatedTitle = `${mood.emoji} ${mood.name.toUpperCase()}`;
    generatedEmoji = mood.emoji;
    generatedDesc = mood.subtitle;
    addMoodHistory(mood.name, mood.emoji);
  } else {
    moodKey = 'chill';
    const mood = MOODS.chill;
    generatedTitle = '🌊 CHILL SANCTUARY';
    generatedEmoji = '🌊';
    generatedDesc = 'Mood: Laid-back • Mellow Sounds';
  }

  const mood = MOODS[moodKey] || MOODS.chill;
  const query = customQuery || mood.query;

  // Loading state
  const btn = document.getElementById('generateBtn');
  const txt = document.getElementById('generateBtnText');
  const spn = document.getElementById('generateSpinner');

  if (btn) btn.disabled = true;
  if (txt) txt.classList.add('hidden');
  if (spn) spn.classList.remove('hidden');

  try {
    let rawItems = [];
    try {
      rawItems = await searchYouTube(query);
    } catch (err) {
      console.warn('YouTube search API note (using mood fallbacks):', err);
    }

    if (!rawItems || !rawItems.length) {
      currentTracks = getMoodFallbackTracks(moodKey);
    } else {
      currentTracks = rawItems.map(item => {
        const info = sanitizeTrackInfo(item.snippet?.title, item.snippet?.channelTitle);
        const vId = item.id.videoId;
        const albumCover = item.snippet?.thumbnails?.maxres?.url ||
                           item.snippet?.thumbnails?.high?.url ||
                           item.snippet?.thumbnails?.standard?.url ||
                           item.snippet?.thumbnails?.medium?.url ||
                           `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`;
        return {
          videoId: vId,
          title: info.title,
          channel: info.channel,
          thumbnail: albumCover,
          duration: item._duration || '3:30',
          isOfficial: true,
        };
      });
    }

    currentIdx = 0;
    currentMoodKey = moodKey;

    // Update results header
    const rEmoji = document.getElementById('resultsEmoji');
    const rTitle = document.getElementById('resultsTitle');
    const rSub = document.getElementById('resultsSubtitle');
    if (rEmoji) rEmoji.textContent = generatedEmoji;
    if (rTitle) rTitle.textContent = generatedTitle;
    if (rSub) rSub.textContent = generatedDesc;

    renderTrackList(currentTracks);
    updateBackground(moodKey);

    // Switch view
    document.getElementById('inputSection')?.classList.add('hidden');
    document.getElementById('resultsSection')?.classList.remove('hidden');

    // Auto-play first track
    ensureYTPlayerInit();
    playTrack(0);

    showToast(`✨ Generated board "${generatedTitle}"!`);
  } catch (err) {
    console.error('Playlist generation fallback:', err);
    currentTracks = getMoodFallbackTracks(moodKey);
    currentIdx = 0;
    renderTrackList(currentTracks);
    playTrack(0);
  } finally {
    if (btn) btn.disabled = false;
    if (txt) txt.classList.remove('hidden');
    if (spn) spn.classList.add('hidden');
  }
}

// ─── SEARCH AUTO-COMPLETE RECOMMENDATIONS ENGINE ─────
const POPULAR_SUGGESTIONS = [
  "Blinding Lights — The Weeknd",
  "Shape of You — Ed Sheeran",
  "Yellow — Coldplay",
  "Starboy — The Weeknd",
  "As It Was — Harry Styles",
  "Stay — Justin Bieber & The Kid LAROI",
  "Perfect — Ed Sheeran",
  "Someone Like You — Adele",
  "Counting Stars — OneRepublic",
  "Heat Waves — Glass Animals",
  "Sweater Weather — The Neighbourhood",
  "Sunset Lover — Petit Biscuit",
  "Lofi Hip Hop Radio Beats",
  "Levitating — Dua Lipa",
  "Save Your Tears — The Weeknd",
  "Bad Habits — Ed Sheeran",
  "Flowers — Miley Cyrus",
  "Vampire — Olivia Rodrigo",
  "Cruel Summer — Taylor Swift",
  "Anti-Hero — Taylor Swift",
  "Watermelon Sugar — Harry Styles",
  "Drivers License — Olivia Rodrigo",
  "Another Love — Tom Odell",
  "Believer — Imagine Dragons",
  "Demons — Imagine Dragons",
  "Radioactive — Imagine Dragons",
  "Riptide — Vance Joy",
  "Shallow — Lady Gaga & Bradley Cooper",
  "Take Me to Church — Hozier",
  "Lucid Dreams — Juice WRLD",
  "Sad! — XXXTENTACION",
  "Stressed Out — Twenty One Pilots"
];

function getInstantSuggestions(query) {
  if (!query || !query.trim()) return [];
  const q = query.trim().toLowerCase();

  const localMatches = POPULAR_SUGGESTIONS.filter(item => item.toLowerCase().includes(q));
  if (localMatches.length) return localMatches.slice(0, 7);

  return [
    `${query} official music video`,
    `${query} official audio`,
    `${query} live performance`,
    `${query} acoustic version`,
    `${query} lofi remix`
  ];
}

function instantLiveSearch(query) {
  if (!query || !query.trim()) return;
  const lowerQ = query.trim().toLowerCase();
  let matched = [];

  Object.values(FALLBACK_TRACKS).forEach(list => {
    list.forEach(t => {
      const tTitle = t.title.toLowerCase();
      const tChannel = t.channel.toLowerCase();
      if (tTitle.includes(lowerQ) || tChannel.includes(lowerQ) || lowerQ.includes(tTitle) || lowerQ.includes(tChannel)) {
        if (!matched.some(m => m.videoId === t.videoId)) {
          matched.push(t);
        }
      }
    });
  });

  if (matched.length > 0) {
    currentTracks = matched.map(t => ({
      videoId: t.videoId,
      title: t.title,
      channel: t.channel,
      thumbnail: t.thumbnail,
      duration: t.duration || '3:30',
      isOfficial: true,
    }));

    renderTrackList(currentTracks);
  }
}

async function fetchSearchSuggestions(query) {
  if (!query || query.trim().length === 0) return [];
  const q = query.trim();

  // 1. Try Invidious CORS search autocomplete
  try {
    const res = await fetch(`https://invidious.io/api/v1/search/suggestions?q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.suggestions && data.suggestions.length) {
        return data.suggestions.slice(0, 7);
      }
    }
  } catch (e) { }

  // 2. Try AllOrigins CORS proxy for Google/YouTube autocomplete
  try {
    const res2 = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent('https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=' + q)}`);
    if (res2.ok) {
      const json = await res2.json();
      const parsed = JSON.parse(json.contents);
      if (Array.isArray(parsed) && Array.isArray(parsed[1]) && parsed[1].length) {
        return parsed[1].slice(0, 7);
      }
    }
  } catch (e) { }

  return getInstantSuggestions(q);
}

function highlightMatch(text, query) {
  if (!query) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<strong>$1</strong>');
}

function renderSearchSuggestions(suggestions, query) {
  const dropdown = document.getElementById('searchSuggestionsDropdown');
  if (!dropdown) return;

  if (!suggestions || !suggestions.length) {
    dropdown.classList.add('hidden');
    dropdown.innerHTML = '';
    selectedSuggestionIdx = -1;
    return;
  }

  selectedSuggestionIdx = -1;
  dropdown.innerHTML = suggestions.map((item, i) => `
    <div class="suggestion-item" data-index="${i}" data-value="${item}">
      <span class="suggestion-icon">🔍</span>
      <span class="suggestion-text">${highlightMatch(item, query)}</span>
    </div>
  `).join('');

  dropdown.classList.remove('hidden');

  dropdown.querySelectorAll('.suggestion-item').forEach(el => {
    el.addEventListener('click', () => {
      const val = el.dataset.value;
      const input = document.getElementById('songSearchInput');
      if (input) input.value = val;
      dropdown.classList.add('hidden');
      searchSongDirectly();
    });
  });
}

// ─── DIRECT SONG SEARCH ──────────────────────────────
async function searchSongDirectly() {
  const input = document.getElementById('songSearchInput');
  const query = input ? input.value.trim() : '';

  if (!query) {
    if (input) {
      input.focus();
      input.style.borderColor = '#ff4444';
      setTimeout(() => input.style.borderColor = '', 1800);
    }
    return;
  }

  const btn = document.getElementById('songSearchBtn');
  const txt = document.getElementById('songSearchBtnText') || document.getElementById('btnText');
  const spn = document.getElementById('songSearchSpinner') || document.getElementById('btnSpinner');

  if (btn) btn.disabled = true;
  if (txt) txt.classList.add('hidden');
  if (spn) spn.classList.remove('hidden');

  try {
    let items = [];
    try {
      items = await searchYouTube(query);
    } catch (err) {
      console.warn('Direct search API note (using fallback search):', err);
    }

    if (!items || !items.length) {
      // Search all fallback tracks for matching title or channel
      const lowerQ = query.toLowerCase();
      let matched = [];
      Object.values(FALLBACK_TRACKS).forEach(list => {
        list.forEach(t => {
          const tTitle = t.title.toLowerCase();
          const tChannel = t.channel.toLowerCase();
          if (tTitle.includes(lowerQ) || tChannel.includes(lowerQ) || lowerQ.includes(tTitle) || lowerQ.includes(tChannel)) {
            matched.push(t);
          }
        });
      });

      if (!matched.length) {
        // Fallback to chill playlist if no direct matches
        matched = getMoodFallbackTracks('chill');
      }

      currentTracks = matched.map(t => ({
        videoId: t.videoId,
        title: t.title,
        channel: t.channel,
        thumbnail: t.thumbnail,
        duration: t.duration || '3:30',
        isOfficial: true,
      }));
    } else {
      currentTracks = items.map(item => {
        const info = sanitizeTrackInfo(item.snippet?.title, item.snippet?.channelTitle);
        const vId = item.id.videoId;
        const albumCover = item.snippet?.thumbnails?.maxres?.url ||
                           item.snippet?.thumbnails?.high?.url ||
                           item.snippet?.thumbnails?.standard?.url ||
                           item.snippet?.thumbnails?.medium?.url ||
                           `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`;
        return {
          videoId: vId,
          title: info.title,
          channel: info.channel,
          thumbnail: albumCover,
          duration: item._duration || '3:30',
          isOfficial: true,
        };
      });
    }

    currentIdx = 0;

    // Update results header safely
    const rEmoji = document.getElementById('resultsEmoji');
    const rTitle = document.getElementById('resultsTitle');
    const rSub = document.getElementById('resultsSubtitle');
    if (rEmoji) rEmoji.textContent = '🔍';
    if (rTitle) rTitle.textContent = 'Search Results';
    if (rSub) rSub.textContent = `Showing songs matching "${query}"`;

    renderTrackList(currentTracks);

    // Switch view
    document.getElementById('inputSection')?.classList.add('hidden');
    document.getElementById('searchSection')?.classList.add('hidden');
    document.getElementById('resultsSection')?.classList.remove('hidden');

    // Auto-play first track immediately
    ensureYTPlayerInit();
    playTrack(0);

  } catch (err) {
    console.error('Direct search error:', err);
    currentTracks = getMoodFallbackTracks('chill');
    currentIdx = 0;
    renderTrackList(currentTracks);
    playTrack(0);
  } finally {
    if (btn) btn.disabled = false;
    if (txt) txt.classList.remove('hidden');
    if (spn) spn.classList.add('hidden');
  }
}

// ─── SONG & ARTIST SPOTLIGHT MODAL ────────────────────
async function openSongInfoModal() {
  const currentTrack = currentTracks[currentIdx];
  if (!currentTrack) return;

  const modal = document.getElementById('songInfoModal');
  const modalArt = document.getElementById('modalAlbumArt');
  const modalTitle = document.getElementById('modalSongTitle');
  const modalArtist = document.getElementById('modalArtistName');
  const modalDuration = document.getElementById('modalDurationTag');
  const modalBio = document.getElementById('modalArtistBio');
  const modalStory = document.getElementById('modalSongStory');
  const geniusLink = document.getElementById('modalGeniusLink');
  const ytLink = document.getElementById('modalYtLink');

  if (modalTitle) modalTitle.textContent = currentTrack.title;
  if (modalArtist) modalArtist.innerHTML = `${currentTrack.channel} <span class="verified-tag">✓ Verified Creator</span>`;
  if (modalDuration) modalDuration.textContent = `Duration: ${currentTrack.duration || '3:30'}`;

  const coverUrl = currentTrack.albumCover || currentTrack.thumbnail || 'vinyl.jpg';
  if (modalArt) modalArt.src = coverUrl;

  if (geniusLink) {
    geniusLink.href = `https://genius.com/search?q=${encodeURIComponent(currentTrack.channel + ' ' + currentTrack.title)}`;
  }
  if (ytLink) {
    ytLink.href = `https://www.youtube.com/watch?v=${currentTrack.videoId}`;
  }

  if (modalBio) modalBio.textContent = `Loading information for ${currentTrack.channel}...`;
  if (modalStory) modalStory.textContent = `Loading track annotations for "${currentTrack.title}"...`;

  if (modal) modal.classList.remove('hidden');

  // 1. Fetch Artist Summary from Wikipedia REST API
  try {
    const resBio = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(currentTrack.channel)}`);
    if (resBio.ok) {
      const dataBio = await resBio.json();
      if (dataBio.extract && modalBio) {
        modalBio.textContent = dataBio.extract;
      } else if (modalBio) {
        modalBio.textContent = `${currentTrack.channel} is an official featured artist and creator on YouTube Music and global streaming platforms.`;
      }
    }
  } catch (e) {
    if (modalBio) {
      modalBio.textContent = `${currentTrack.channel} is an official featured creator on YouTube Music. Explore lyrics and discography on Genius.`;
    }
  }

  // 2. Fetch Track / Album details from iTunes Search API
  try {
    const resITunes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(currentTrack.channel + ' ' + currentTrack.title)}&entity=song&limit=1`);
    if (resITunes.ok) {
      const dataITunes = await resITunes.json();
      if (dataITunes.results && dataITunes.results.length > 0) {
        const item = dataITunes.results[0];
        const releaseYear = item.releaseDate ? new Date(item.releaseDate).getFullYear() : '2024';
        const genreName = item.primaryGenreName || 'Pop / Rock / Music';
        const collectionName = item.collectionName || `${currentTrack.title} - Single`;

        const genreTag = document.getElementById('modalGenreTag');
        const yearTag = document.getElementById('modalYearTag');
        if (genreTag) genreTag.textContent = genreName;
        if (yearTag) yearTag.textContent = `Released: ${releaseYear}`;

        if (modalStory) {
          modalStory.textContent = `"${currentTrack.title}" is featured on the official album "${collectionName}". Primary Genre: ${genreName}. Release Date: ${releaseYear}. Published by ${item.artistName || currentTrack.channel}.`;
        }
      } else if (modalStory) {
        modalStory.textContent = `"${currentTrack.title}" by ${currentTrack.channel} is an official release on YouTube Music. Listen to full high-definition stereo audio and explore lyrics on Genius.com.`;
      }
    }
  } catch (e) {
    if (modalStory) {
      modalStory.textContent = `"${currentTrack.title}" by ${currentTrack.channel} is an official release on YouTube Music.`;
    }
  }
}

// ─── MEDIA VIEW SWITCHER ENGINE (ARTWORK COVER VS VIDEO) ──
let currentMediaMode = 'video';

function syncArtworkColors(imageUrl) {
  if (!imageUrl) return;

  const img = new Image();
  img.crossOrigin = 'Anonymous';
  img.src = imageUrl;

  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 32;
      canvas.height = 32;

      ctx.drawImage(img, 0, 0, 32, 32);
      const imgData = ctx.getImageData(0, 0, 32, 32).data;

      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      let maxSat = -1, vibrantR = 240, vibrantG = 176, vibrantB = 64;

      for (let i = 0; i < imgData.length; i += 16) {
        const r = imgData[i];
        const g = imgData[i + 1];
        const b = imgData[i + 2];
        const a = imgData[i + 3];

        if (a < 128) continue;

        rSum += r;
        gSum += g;
        bSum += b;
        count++;

        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;

        if (sat > maxSat && maxC > 30 && minC < 230) {
          maxSat = sat;
          vibrantR = r;
          vibrantG = g;
          vibrantB = b;
        }
      }

      if (count > 0) {
        const avgR = Math.round(rSum / count);
        const avgG = Math.round(gSum / count);
        const avgB = Math.round(bSum / count);

        const mainR = maxSat > 0.15 ? vibrantR : avgR;
        const mainG = maxSat > 0.15 ? vibrantG : avgG;
        const mainB = maxSat > 0.15 ? vibrantB : avgB;

        const artWrap = document.getElementById('albumArtCanvasWrap');
        if (artWrap) {
          artWrap.style.setProperty('--art-glow-color', `rgba(${mainR}, ${mainG}, ${mainB}, 0.6)`);
          artWrap.style.setProperty('--art-title-glow', `rgba(${mainR}, ${mainG}, ${mainB}, 0.5)`);
          artWrap.style.setProperty('--art-ambient-bg', `radial-gradient(circle at center, rgba(${mainR}, ${mainG}, ${mainB}, 0.42) 0%, rgba(${Math.round(mainR * 0.15)}, ${Math.round(mainG * 0.15)}, ${Math.round(mainB * 0.15)}, 0.88) 65%, rgba(6, 4, 8, 0.96) 100%)`);
        }

        const bgOverlay = document.getElementById('bgOverlay');
        if (bgOverlay && currentMediaMode === 'artwork') {
          bgOverlay.style.background = `radial-gradient(circle at 50% 50%, rgba(${mainR}, ${mainG}, ${mainB}, 0.35) 0%, rgba(8, 5, 2, 0.82) 100%)`;
        }
      }
    } catch (err) {
      console.warn('Could not extract image palette due to CORS:', err);
    }
  };
}

// ─── MEDIA VIEW SWITCHER ENGINE (ARTWORK COVER VS VIDEO) ──



function setMediaMode(mode) {
  currentMediaMode = mode;

  const btnArt = document.getElementById('viewArtworkBtn');
  const btnVideo = document.getElementById('viewVideoBtn');
  const artWrap = document.getElementById('albumArtCanvasWrap');
  const videoWrap = document.getElementById('ytVideoWrap');
  const bgImg = document.getElementById('bgImg');

  if (mode === 'artwork') {
    if (btnArt) btnArt.classList.add('active');
    if (btnVideo) btnVideo.classList.remove('active');

    if (artWrap) artWrap.classList.remove('hidden');
    if (videoWrap) videoWrap.classList.add('hidden');

    if (bgImg) bgImg.classList.add('artwork-mode');

    updateArtworkCanvasDisplay();
  } else {
    if (btnVideo) btnVideo.classList.add('active');
    if (btnArt) btnArt.classList.remove('active');

    if (artWrap) artWrap.classList.add('hidden');
    if (videoWrap) videoWrap.classList.remove('hidden');

    if (bgImg) bgImg.classList.remove('artwork-mode');

    // Restore mood background image when leaving artwork mode
    updateBackground(currentMoodKey);
  }

  updateRainCanvasVisibility();
}


function updateArtworkCanvasDisplay() {
  const currentTrack = currentTracks[currentIdx];
  if (!currentTrack) return;

  const displayImg = document.getElementById('albumArtDisplayImg');
  const labelImg = document.getElementById('albumArtCenterLabelImg');
  const songTitleEl = document.getElementById('albumArtSongTitle');
  const artistNameEl = document.getElementById('albumArtArtistName');
  const bgImg = document.getElementById('bgImg');

  const coverUrl = currentTrack.albumCover || currentTrack.thumbnail || 'vinyl.jpg';

  if (displayImg) displayImg.src = coverUrl;
  if (labelImg) labelImg.src = coverUrl;
  if (songTitleEl) songTitleEl.textContent = currentTrack.title;
  if (artistNameEl) artistNameEl.textContent = currentTrack.channel;

  if (currentMediaMode === 'artwork') {
    if (bgImg) {
      bgImg.src = coverUrl;
      bgImg.classList.add('artwork-mode');
      bgImg.style.opacity = '1';
    }
    syncArtworkColors(coverUrl);
  }

  getOfficialAlbumCover(currentTrack.title, currentTrack.channel, coverUrl).then(hiresCover => {
    if (displayImg) displayImg.src = hiresCover;
    if (labelImg) labelImg.src = hiresCover;

    if (currentMediaMode === 'artwork') {
      if (bgImg) {
        bgImg.src = hiresCover;
      }
      syncArtworkColors(hiresCover);
    }
  });
}


// ─── INIT ─────────────────────────────────────────────
function init() {
  loadSavedTracks();

  // Initialize YT Player if YouTube IFrame API is already loaded
  if (window.YT && window.YT.Player) {
    initYTPlayer();
  }

  // Pre-load default playlist so music player and recommendations are ready immediately
  currentTracks = getMoodFallbackTracks('chill');
  currentIdx = 0;
  currentMoodKey = 'chill';
  renderTrackList(currentTracks);

  // Periodically check if YouTube API finishes loading
  setInterval(ensureYTPlayerInit, 1000);

  // Show banner if API key not configured
  if (YT_API_KEY === 'YOUR_YOUTUBE_API_KEY_HERE') {
    document.getElementById('setupBanner').classList.remove('hidden');
  }

  // Spacious Media View Switcher Listeners (Artwork vs Video)
  const btnArt = document.getElementById('viewArtworkBtn');
  const btnVideo = document.getElementById('viewVideoBtn');

  if (btnArt) {
    btnArt.addEventListener('click', () => setMediaMode('artwork'));
  }
  if (btnVideo) {
    btnVideo.addEventListener('click', () => setMediaMode('video'));
  }







  // ─── 5-TAB NAVIGATION SYSTEM (MOOD, ADVANCED MOOD AI, SEARCH, BOARDS, SAVED) ───
  const tabMood = document.getElementById('tabMood');
  const tabMoodAi = document.getElementById('tabMoodAi');
  const tabSearch = document.getElementById('tabSearch');
  const tabBoards = document.getElementById('tabBoards');
  const tabSaved = document.getElementById('tabSaved');

  const inputSec = document.getElementById('inputSection');
  const moodAiSec = document.getElementById('moodAiSection');
  const searchSec = document.getElementById('searchSection');
  const boardsSec = document.getElementById('boardsSection');
  const resultsSec = document.getElementById('resultsSection');
  const savedSec = document.getElementById('savedSection');

  function resetAllTabsAndSections() {
    [tabMood, tabMoodAi, tabSearch, tabBoards, tabSaved].forEach(t => t?.classList.remove('active'));
    [inputSec, moodAiSec, searchSec, boardsSec, resultsSec, savedSec].forEach(s => s?.classList.add('hidden'));
    document.getElementById('boardDetailsView')?.classList.add('hidden');
    document.getElementById('boardsGrid')?.classList.remove('hidden');
  }

  if (tabMood) {
    tabMood.addEventListener('click', () => {
      resetAllTabsAndSections();
      tabMood.classList.add('active');
      inputSec?.classList.remove('hidden');
    });
  }

  if (tabMoodAi) {
    tabMoodAi.addEventListener('click', () => {
      resetAllTabsAndSections();
      tabMoodAi.classList.add('active');
      moodAiSec?.classList.remove('hidden');
    });
  }

  if (tabSearch) {
    tabSearch.addEventListener('click', () => {
      resetAllTabsAndSections();
      tabSearch.classList.add('active');
      searchSec?.classList.remove('hidden');
      const sInput = document.getElementById('songSearchInput');
      if (sInput) sInput.focus();
    });
  }

  if (tabBoards) {
    tabBoards.addEventListener('click', () => {
      resetAllTabsAndSections();
      tabBoards.classList.add('active');
      boardsSec?.classList.remove('hidden');
      renderBoardsGrid();
    });
  }

  if (tabSaved) {
    tabSaved.addEventListener('click', () => {
      resetAllTabsAndSections();
      tabSaved.classList.add('active');
      savedSec?.classList.remove('hidden');
      renderSavedLibrary();
    });
  }

  // Clear Saved Songs Button
  const clearSavedBtn = document.getElementById('clearSavedBtn');
  if (clearSavedBtn) {
    clearSavedBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all saved songs from your library?')) {
        savedTracks = [];
        saveSavedTracks();
        renderSavedLibrary();
      }
    });
  }

  // Shuffle Saved Songs Button
  const shuffleSavedBtn = document.getElementById('shuffleSavedBtn');
  if (shuffleSavedBtn) {
    shuffleSavedBtn.addEventListener('click', () => {
      if (!savedTracks.length) return;
      currentTracks = [...savedTracks];
      renderTrackList(currentTracks);
      toggleShuffleMode(true);
      ensureYTPlayerInit();
      playNextShuffleTrack();
    });
  }

  // Lower player bar Shuffle Toggle Button
  const shuffleBtn = document.getElementById('shuffleBtn');
  if (shuffleBtn) {
    shuffleBtn.addEventListener('click', () => {
      toggleShuffleMode();
    });
  }

  // Lower player bar Heart Save button
  const playerHeartBtn = document.getElementById('playerHeartBtn');
  if (playerHeartBtn) {
    playerHeartBtn.addEventListener('click', () => {
      if (currentTracks[currentIdx]) {
        toggleSaveTrack(currentTracks[currentIdx]);
      }
    });
  }

  // Direct Song Search Listeners with Autocomplete Recommendations
  const songSearchBtn = document.getElementById('songSearchBtn');
  const songSearchInput = document.getElementById('songSearchInput');
  const searchDropdown = document.getElementById('searchSuggestionsDropdown');

  if (songSearchBtn) {
    songSearchBtn.addEventListener('click', () => {
      if (searchDropdown) searchDropdown.classList.add('hidden');
      searchSongDirectly();
    });
  }

  if (songSearchInput) {
    songSearchInput.addEventListener('input', (e) => {
      const val = e.target.value;

      if (!val.trim()) {
        if (searchDropdown) searchDropdown.classList.add('hidden');
        return;
      }

      // ⚡ INSTANT 0-MS REACTION: Render local suggestions & live search results immediately on keystroke
      const instantSuggestions = getInstantSuggestions(val);
      renderSearchSuggestions(instantSuggestions, val);
      instantLiveSearch(val);

      // Async fetch for extended online suggestions
      fetchSearchSuggestions(val).then(extended => {
        if (songSearchInput.value === val && extended && extended.length) {
          renderSearchSuggestions(extended, val);
        }
      });
    });

    songSearchInput.addEventListener('keydown', (e) => {
      const items = searchDropdown ? searchDropdown.querySelectorAll('.suggestion-item') : [];

      if (e.key === 'ArrowDown') {
        if (!items.length) return;
        e.preventDefault();
        selectedSuggestionIdx = (selectedSuggestionIdx + 1) % items.length;
        items.forEach((item, idx) => {
          item.classList.toggle('selected', idx === selectedSuggestionIdx);
        });
        if (items[selectedSuggestionIdx]) {
          songSearchInput.value = items[selectedSuggestionIdx].dataset.value;
        }
      } else if (e.key === 'ArrowUp') {
        if (!items.length) return;
        e.preventDefault();
        selectedSuggestionIdx = (selectedSuggestionIdx - 1 + items.length) % items.length;
        items.forEach((item, idx) => {
          item.classList.toggle('selected', idx === selectedSuggestionIdx);
        });
        if (items[selectedSuggestionIdx]) {
          songSearchInput.value = items[selectedSuggestionIdx].dataset.value;
        }
      } else if (e.key === 'Enter') {
        if (searchDropdown) searchDropdown.classList.add('hidden');
        searchSongDirectly();
      } else if (e.key === 'Escape') {
        if (searchDropdown) searchDropdown.classList.add('hidden');
      }
    });

    songSearchInput.addEventListener('focus', () => {
      if (songSearchInput.value.trim() && searchDropdown && searchDropdown.children.length) {
        searchDropdown.classList.remove('hidden');
      }
    });
  }

  // Click outside closes suggestion dropdown
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-bar-wrap') && searchDropdown) {
      searchDropdown.classList.add('hidden');
    }
  });

  // Generate button
  const genBtn = document.getElementById('generateBtn');
  if (genBtn) genBtn.addEventListener('click', generatePlaylist);

  // Ctrl+Enter shortcut
  const moodInp = document.getElementById('moodInput');
  if (moodInp) {
    moodInp.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') generatePlaylist();
    });
  }


  // Story Mood Prompt Chips
  document.querySelectorAll('.story-prompt-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const promptText = chip.dataset.prompt;
      const moodInp = document.getElementById('moodInput');
      if (moodInp) {
        moodInp.value = promptText;
        generatePlaylist();
      }
    });
  });

  // Mood chips — toggle active, clear textarea, AND generate playlist immediately
  document.querySelectorAll('.mood-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.mood-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentMoodKey = chip.dataset.mood;
      updateBackground(chip.dataset.mood);
      document.getElementById('moodInput').value = '';
      generatePlaylist();
    });
  });

  // Recommendations Dropdown Menu Toggle (Always accessible overlaying above video)
  const recsDropdownBtn = document.getElementById('recsDropdownBtn');
  const recsDropdownMenu = document.getElementById('recsDropdownMenu');
  const closeRecsBtn = document.getElementById('closeRecsBtn');

  if (recsDropdownBtn && recsDropdownMenu) {
    recsDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // If current tracks list is empty, generate playlist automatically
      if (!currentTracks || currentTracks.length === 0) {
        generatePlaylist();
      }

      const isOpening = recsDropdownMenu.classList.contains('hidden');
      recsDropdownMenu.classList.toggle('hidden');

      if (isOpening) {
        document.body.classList.add('recs-open', 'show-hud');
      } else {
        document.body.classList.remove('recs-open');
      }
    });

    if (closeRecsBtn) {
      closeRecsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        recsDropdownMenu.classList.add('hidden');
        document.body.classList.remove('recs-open');
      });
    }

    document.addEventListener('click', (e) => {
      if (!recsDropdownMenu.contains(e.target) && !recsDropdownBtn.contains(e.target)) {
        recsDropdownMenu.classList.add('hidden');
        document.body.classList.remove('recs-open');
      }
    });

    recsDropdownMenu.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  // Dashboard & Immersive Video Mode Toggle
  const toggleDashBtn = document.getElementById('toggleDashboardBtn');
  if (toggleDashBtn) {
    toggleDashBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleImmersiveMode();
    });
  }

  // Fullscreen Video Toggle Helper
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn('Fullscreen error:', err);
      });
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  }

  // Fullscreen Video Toggle Button
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      toggleFullscreen();
    });
  }


  // Mouse hover reveals bottom playerBar HUD in Immersive Video Mode
  let hudHideTimeout;
  document.addEventListener('mousemove', (e) => {
    if (!document.body.classList.contains('immersive-mode')) return;
    const windowH = window.innerHeight;
    if (e.clientY > windowH - 120 || e.clientY < 75) {
      document.body.classList.add('show-hud');
      clearTimeout(hudHideTimeout);
      hudHideTimeout = setTimeout(() => {
        document.body.classList.remove('show-hud');
      }, 3500);
    }
  });

  // Player controls
  const pBtn = document.getElementById('playBtn');
  if (pBtn) pBtn.addEventListener('click', togglePlay);
  const nBtn = document.getElementById('nextBtn');
  if (nBtn) nBtn.addEventListener('click', goNext);
  const prBtn = document.getElementById('prevBtn');
  if (prBtn) prBtn.addEventListener('click', goPrev);


  // Center Music Video Play Overlay Controls
  const centerPlayBtn = document.getElementById('centerPlayBtn');
  if (centerPlayBtn) {
    centerPlayBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlay();
    });
  }

  const videoPlayOverlay = document.getElementById('videoPlayOverlay');
  if (videoPlayOverlay) {
    videoPlayOverlay.addEventListener('click', () => {
      togglePlay();
    });
  }

  // Album thumbnail click opens Song & Artist Info Modal
  const playerAlbumThumb = document.getElementById('playerAlbumThumb');
  const songInfoModal = document.getElementById('songInfoModal');
  const closeSongInfoBtn = document.getElementById('closeSongInfoBtn');
  const songInfoBackdrop = document.getElementById('songInfoBackdrop');

  if (playerAlbumThumb) {
    playerAlbumThumb.style.cursor = 'pointer';
    playerAlbumThumb.setAttribute('title', 'Click to view Song & Artist Info');
    playerAlbumThumb.addEventListener('click', (e) => {
      e.stopPropagation();
      openSongInfoModal();
    });
  }

  if (closeSongInfoBtn && songInfoModal) {
    closeSongInfoBtn.addEventListener('click', () => {
      songInfoModal.classList.add('hidden');
    });
  }

  if (songInfoBackdrop && songInfoModal) {
    songInfoBackdrop.addEventListener('click', () => {
      songInfoModal.classList.add('hidden');
    });
  }

  // Global Keyboard Shortcuts (Space for Play/Pause, F for Fullscreen)
  document.addEventListener('keydown', (e) => {
    const active = document.activeElement;
    const tag = active ? active.tagName.toLowerCase() : '';
    const isInput = tag === 'input' || tag === 'textarea' || (active && active.isContentEditable);

    if (isInput) return;

    // F key -> Toggle Fullscreen Application Mode
    if (e.code === 'KeyF' || e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      toggleFullscreen();
      return;
    }

    // Spacebar -> Play/Pause Toggle
    if (e.code === 'Space' || e.key === ' ') {
      if (tag === 'button') return;
      e.preventDefault();
      togglePlay();
    }
  });

  // ─── VYNL LOGO RIGHT-CLICK CUSTOM CONTEXT MENU ───────
  const headerLogo = document.querySelector('.header-logo');
  const contextMenu = document.getElementById('vynlContextMenu');

  if (headerLogo && contextMenu) {
    headerLogo.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const x = Math.min(e.clientX, window.innerWidth - 245);
      const y = Math.min(e.clientY, window.innerHeight - 210);

      contextMenu.style.left = `${x}px`;
      contextMenu.style.top = `${y}px`;
      contextMenu.classList.remove('hidden');
    });

    document.addEventListener('click', () => {
      if (contextMenu) contextMenu.classList.add('hidden');
    });

    document.addEventListener('contextmenu', (e) => {
      if (!e.target.closest('.header-logo')) {
        if (contextMenu) contextMenu.classList.add('hidden');
      }
    });

    // Option 1: Open VYNL in New Tab
    document.getElementById('ctxOpenNewTab')?.addEventListener('click', (e) => {
      e.stopPropagation();
      contextMenu.classList.add('hidden');
      window.open(window.location.href, '_blank');
      showToast('🚀 Opened VYNL in a new tab!');
    });

    // Option 2: Open Current Song on YouTube in New Tab
    document.getElementById('ctxOpenCurrentSong')?.addEventListener('click', (e) => {
      e.stopPropagation();
      contextMenu.classList.add('hidden');
      const track = currentTracks[currentIdx];
      if (track && track.videoId) {
        window.open(`https://www.youtube.com/watch?v=${track.videoId}`, '_blank');
        showToast(`🎵 Opening "${track.title}" on YouTube...`);
      } else {
        window.open('https://music.youtube.com', '_blank');
      }
    });

    // Option 3: Open Genius Song Lyrics in New Tab
    document.getElementById('ctxOpenLyrics')?.addEventListener('click', (e) => {
      e.stopPropagation();
      contextMenu.classList.add('hidden');
      const track = currentTracks[currentIdx];
      if (track) {
        const q = encodeURIComponent(`${track.title} ${track.channel}`);
        window.open(`https://genius.com/search?q=${q}`, '_blank');
        showToast(`🎤 Opening Genius lyrics...`);
      }
    });

    // Option 4: Copy App Link to Clipboard
    document.getElementById('ctxCopyLink')?.addEventListener('click', (e) => {
      e.stopPropagation();
      contextMenu.classList.add('hidden');
      navigator.clipboard.writeText(window.location.href).then(() => {
        showToast('🔗 Link copied to clipboard!');
      }).catch(() => {
        showToast('🔗 App Link: ' + window.location.href);
      });
    });
  }

  // Toast Notification Helper
  function showToast(msg) {
    const container = document.getElementById('vynlToastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'vynl-toast';
    toast.textContent = msg;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(12px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2400);
  }


  // Progress bar seek
  const pTrack = document.getElementById('progressTrack');
  if (pTrack) {
    pTrack.addEventListener('click', e => {
      const r = e.currentTarget.getBoundingClientRect();
      seekTo((e.clientX - r.left) / r.width);
    });
  }


  // Volume Management Controls
  const volumeSlider = document.getElementById('volumeSlider');
  const volumeMuteBtn = document.getElementById('volumeMuteBtn');
  const volumeIcon = document.getElementById('volumeIcon');
  let lastVolume = 80;

  if (volumeSlider) {
    volumeSlider.addEventListener('input', e => {
      const val = parseInt(e.target.value);
      if (ytPlayer && ytReady && typeof ytPlayer.setVolume === 'function') {
        ytPlayer.setVolume(val);
      }
      if (volumeIcon) {
        if (val === 0) volumeIcon.textContent = '🔇';
        else if (val < 50) volumeIcon.textContent = '🔉';
        else volumeIcon.textContent = '🔊';
      }
      lastVolume = val > 0 ? val : lastVolume;
    });
  }

  if (volumeMuteBtn) {
    volumeMuteBtn.addEventListener('click', () => {
      if (!ytPlayer || !ytReady) return;
      const isMuted = typeof ytPlayer.isMuted === 'function' ? ytPlayer.isMuted() : false;
      if (isMuted) {
        ytPlayer.unMute();
        if (volumeSlider) volumeSlider.value = lastVolume;
        if (volumeIcon) volumeIcon.textContent = lastVolume < 50 ? '🔉' : '🔊';
      } else {
        ytPlayer.mute();
        if (volumeSlider) volumeSlider.value = 0;
        if (volumeIcon) volumeIcon.textContent = '🔇';
      }
    });
  }

  // Spotify Fullscreen Karaoke Toggle
  const openKaraokeBtn = document.getElementById('openKaraokeBtn');
  const exitKaraokeBtn = document.getElementById('exitKaraokeBtn');
  const karaokeModal = document.getElementById('spotifyKaraokeModal');

  if (openKaraokeBtn && karaokeModal) {
    openKaraokeBtn.addEventListener('click', () => {
      karaokeModal.classList.remove('hidden');
    });
  }

  if (exitKaraokeBtn && karaokeModal) {
    exitKaraokeBtn.addEventListener('click', () => {
      karaokeModal.classList.add('hidden');
    });
  }

  // Lyrics drawer toggle
  const lyricsBtn = document.getElementById('toggleLyricsBtn');
  const lyricsDrawer = document.getElementById('lyricsDrawer');
  const closeLyricsBtn = document.getElementById('closeLyricsBtn');

  if (lyricsBtn && lyricsDrawer) {
    lyricsBtn.addEventListener('click', () => {
      lyricsDrawer.classList.toggle('hidden');
      lyricsBtn.classList.toggle('active');
    });
  }

  if (closeLyricsBtn && lyricsDrawer) {
    closeLyricsBtn.addEventListener('click', () => {
      lyricsDrawer.classList.add('hidden');
      if (lyricsBtn) lyricsBtn.classList.remove('active');
    });
  }

  // New mood button
  document.getElementById('newMoodBtn').addEventListener('click', () => {
    resultsSec.classList.add('hidden');
    if (tabSearch && tabSearch.classList.contains('active')) {
      searchSec.classList.remove('hidden');
    } else {
      inputSec.classList.remove('hidden');
    }
  });

  // Dismiss banner
  const dismissBtn = document.getElementById('dismissBanner');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      document.getElementById('setupBanner').classList.add('hidden');
    });
  }

  // Load initial background
  updateBackground('chill');

  // Start periodic user background pictures auto-rotation for main background canvas
  startUserBackgroundRotation();

  // Start BraceletBook-style periodic background bar pattern rotation (for frame bars only)
  startBarPatternRotation();

  // Start VYNL logo icon periodic rotation
  startLogoIconRotation();


  // 🌧️ Start soothing green core rain canvas animation
  initRainCanvas();

  // ⌨️ Attach typing sounds to all text inputs
  initTypingSoundListeners();

  // ✨ 🎵 Start 60FPS high-performance mouse trail canvas
  initMouseTrailCanvas();

  // 👑 Initialize VYNL+ Premium Tier Engine & Subsystems
  updateVynlPlusUI();
  updateProfileUI();
  initAuthModalListeners();
  initUserProfileListeners();
  initShareModalListeners();
  initMoodAiListeners();
  initBoardsListeners();
  initThemeStudioListeners();
  initKaraokeProListeners();
  initVynlPlusModalListeners();

  // 🚀 Check for viral shared board link in URL
  loadBoardFromUrl();
}

// (Duplicate initRainCanvas removed - primary high-performance rain canvas engine handles vertical 90-degree rain)

// ─── RETRO TYPING SOUNDS & AUDIO FEEDBACK ENGINE ──────
function initTypingSoundListeners() {
  const inputs = document.querySelectorAll('input[type="text"], textarea');
  inputs.forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt') return;
      playClickSound(800 + Math.random() * 300, 0.03, 'sine');
    });
  });
}

let sharedAudioCtx = null;
let lastSoundPlayTime = 0;

function getSharedAudioContext() {
  try {
    if (!sharedAudioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        sharedAudioCtx = new AudioCtx();
      }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
  } catch (e) {}
  return sharedAudioCtx;
}

function playClickSound(freq = 600, duration = 0.03, type = 'sine') {
  try {
    const now = performance.now();
    if (now - lastSoundPlayTime < 24) return; // Audio throttle to prevent audio engine stalls
    lastSoundPlayTime = now;

    const ctx = getSharedAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(0.025, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}

// ─── LIGHTWEIGHT CLICK SPARKLE BURSTS (ZERO DOM MOUSEMOVE THROTTLING) ──────
const MUSIC_PARTICLES = ['✨', '✦', '⭐', '💫', '✧', '🌟'];
const PARTICLE_COLORS = ['#d8b8ff', '#80d0ff', '#ffe880', '#ffb8e0', '#ffffff'];

function spawnCursorParticle(x, y, isClickBurst = false) {
  if (!isClickBurst) return; // Only spawn on click/celebration to eliminate mousemove DOM thrashing

  const particle = document.createElement('span');
  particle.className = 'cursor-music-particle';

  const symbol = MUSIC_PARTICLES[Math.floor(Math.random() * MUSIC_PARTICLES.length)];
  const color = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)];

  particle.textContent = symbol;
  particle.style.color = color;
  particle.style.left = x + 'px';
  particle.style.top = y + 'px';

  const size = Math.random() * 0.4 + 1.0;
  const vx = Math.random() * 60 - 30;
  const vy = Math.random() * 60 - 30;

  particle.style.transform = `translate(${vx}px, ${vy}px) scale(${size})`;
  document.body.appendChild(particle);

  setTimeout(() => {
    particle.remove();
  }, 600);
}

function initMusicCursorTrail() {
  document.addEventListener('click', (e) => {
    for (let i = 0; i < 3; i++) {
      spawnCursorParticle(e.clientX + (Math.random() * 20 - 10), e.clientY + (Math.random() * 20 - 10), true);
    }
  }, { passive: true });
}

// ─── VYNL LOGO ICON PERIODIC ROTATION (CAT AVATARS) ─────
const LOGO_ICONS = [
  'cat_headphone.jpg',        // 2D Black Cat with Headphones
  'cat_white_headphones.jpg',  // 3D White Cat with Headphones & Stars
  'logo_cat.jpg'               // Classic VYNL Logo Cat
];



let currentLogoIconIdx = 0;

function rotateLogoIcon() {
  const logoImg = document.getElementById('logoIconImg');
  if (!logoImg) return;

  currentLogoIconIdx = (currentLogoIconIdx + 1) % LOGO_ICONS.length;
  const newIconSrc = LOGO_ICONS[currentLogoIconIdx];

  // Smooth spin & scale transition
  logoImg.classList.add('icon-transition');
  setTimeout(() => {
    logoImg.src = newIconSrc;
    logoImg.classList.remove('icon-transition');
  }, 400);
}

function startLogoIconRotation() {
  const logoImg = document.getElementById('logoIconImg');
  if (logoImg) {
    logoImg.src = LOGO_ICONS[0];
  }

  // Periodically change Moodwave logo icon every 6 seconds
  setInterval(rotateLogoIcon, 6000);

  // Clicking the logo icon manually cycles the icon
  if (logoImg) {
    logoImg.addEventListener('click', (e) => {
      e.stopPropagation();
      rotateLogoIcon();
    });
  }
}

// ─── USER BACKGROUND PICTURES PERIODIC AUTO-ROTATION ENGINE ───
const USER_BACKGROUND_PICTURES = [
  'cosmic_supernova_bg.jpg',       // Cosmic Supernova Explosion
  'bg_night_cat.jpg',               // Night Cam Cat on Balcony
  'bg_pixel_star_grid.jpg',         // Glowing Pixel Stars Grid
  'bg_goldfish_art.jpg',            // Goldfish Swimming Painting
  'bg_anime_crt.jpg',               // Anime CRT Monitor Desktop Gaming
  'bg_solar_flare.jpg',             // Solar Flare Cosmic Sun
  'bg_pixel_mew.jpg',               // Pixel Mew Floating in Cosmic Stardust
  'bg_tame_impala_waves.jpg',       // Tame Impala Synthwave Lines & Sphere
];

let currentUserBgIdx = 0;

function rotateUserBackground() {
  // Do not rotate main background while viewing artwork mode
  if (currentMediaMode === 'artwork') return;

  currentUserBgIdx = (currentUserBgIdx + 1) % USER_BACKGROUND_PICTURES.length;
  const nextBgUrl = USER_BACKGROUND_PICTURES[currentUserBgIdx];

  const bgImg = document.getElementById('bgImg');
  if (bgImg) {
    bgImg.style.transition = 'opacity 0.8s ease-in-out';
    bgImg.style.opacity = '0.15';
    setTimeout(() => {
      bgImg.src = nextBgUrl;
      bgImg.style.opacity = '1';
    }, 400);
  }
}

function startUserBackgroundRotation() {
  // Set initial background image
  const bgImg = document.getElementById('bgImg');
  if (bgImg && !bgImg.src) {
    bgImg.src = USER_BACKGROUND_PICTURES[0];
  }

  // Periodically cycle through user background pictures every 8 seconds
  setInterval(rotateUserBackground, 8000);
}

// ─── RETRO TV FRAME BAR PATTERNS (USER PIXEL ART PATTERNS) ─────
const BAR_PATTERNS = [
  'bar_pink_waves.jpg',     // Pink & Black Wavy Pixel Band
  'bar_fire_dragon.jpg',    // Red & Gold Fire Dragon Pixel Band
  'bar_cyan_waves.jpg',     // Purple & Cyan Ocean Waves Pixel Band
  'bar_sunset_birds.jpg',   // Sunset Birds & Sun Pixel Band
  'bar_blue_squid.jpg',      // Blue Squid & Tentacles Pixel Band
  'header_bg.jpg',          // Retro Pixel Band 1
  'tray_bg.jpg',            // Retro Pixel Band 2
  'pixel_waves.png',        // 16-Bit Woven Pixel Waves
  'pixel_stars.png',        // Neon Pixel Stars Pattern
];



let currentSharedPatternIdx = 0;

function setBarBackground(layer1Id, layer2Id, imageUrl) {
  const l1 = document.getElementById(layer1Id);
  const l2 = document.getElementById(layer2Id);
  if (!l1 || !l2) return;

  const activeLayer = l1.classList.contains('active') ? l1 : l2;
  const nextLayer = activeLayer === l1 ? l2 : l1;

  nextLayer.style.backgroundImage = `linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.65) 100%), url('${imageUrl}')`;
  nextLayer.classList.add('active');
  activeLayer.classList.remove('active');
}

function rotateBarPatterns() {
  currentSharedPatternIdx = (currentSharedPatternIdx + 1) % BAR_PATTERNS.length;
  const targetImage = BAR_PATTERNS[currentSharedPatternIdx];

  // Simultaneously replace top header, bottom tray, left TV bar, and right TV bar with the exact same image
  setBarBackground('headerBgLayer1', 'headerBgLayer2', targetImage);
  setBarBackground('trayBgLayer1', 'trayBgLayer2', targetImage);
  setBarBackground('leftTvBgLayer1', 'leftTvBgLayer2', targetImage);
  setBarBackground('rightTvBgLayer1', 'rightTvBgLayer2', targetImage);
}

function startBarPatternRotation() {
  const initialImage = BAR_PATTERNS[0];
  ['headerBgLayer1', 'trayBgLayer1', 'leftTvBgLayer1', 'rightTvBgLayer1'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.backgroundImage = `linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.65) 100%), url('${initialImage}')`;
      el.classList.add('active');
    }
  });


  // Simultaneously replace all 4 TV frame bars periodically (14s)
  setInterval(rotateBarPatterns, 14000);

  // Manual pattern click trigger on logo
  const logo = document.querySelector('.header-logo');
  if (logo) {
    logo.addEventListener('click', (e) => {
      e.stopPropagation();
      rotateBarPatterns();
    });
  }
}

// ══════════════════════════════════════════════════════════
// ─── VYNL+ PREMIUM TIER SUBSYSTEM ENGINES ─────────────────
// ══════════════════════════════════════════════════════════

// ─── 1. CORE TIER STATE & UI SYNC ─────────────────────────
function updateVynlPlusUI() {
  const headerBtn = document.getElementById('vynlPlusHeaderBtn');
  const headerLabel = document.getElementById('vynlPlusHeaderLabel');
  const headerPill = document.getElementById('vynlPlusPricePill');
  const activeBanner = document.getElementById('activeSubBanner');
  const subExpiryText = document.getElementById('subExpiryText');
  const boardsCounter = document.getElementById('boardsTierCounter');
  const profileTierBadge = document.getElementById('profileTierBadge');

  if (isVynlPlus) {
    if (headerBtn) headerBtn.classList.add('is-active-plus');
    if (headerLabel) {
      if (vynlPlusPlan === 'founder_699') headerLabel.textContent = 'FOUNDER 👑';
      else if (vynlPlusPlan === 'annual_799') headerLabel.textContent = 'VYNL+ PRO';
      else headerLabel.textContent = 'VYNL+';
    }
    if (headerPill) headerPill.textContent = vynlPlusPlan === 'founder_699' ? 'Lifetime 🏆' : 'Active 👑';
    if (activeBanner) activeBanner.classList.remove('hidden');
    if (subExpiryText) {
      if (vynlPlusPlan === 'founder_699') {
        subExpiryText.textContent = '🔥 Founder Lifetime Pass Active • Permanent Access to All Perks & Drops';
      } else if (vynlPlusPlan === 'annual_799') {
        subExpiryText.textContent = 'Annual Pro Pass Active (₹799/yr) • Unlimited Boards & 3D Spatial Audio';
      } else {
        subExpiryText.textContent = 'Monthly Vibe Active (₹99/mo) • Unlimited Boards & 3D Spatial Audio';
      }
    }
    if (boardsCounter) boardsCounter.textContent = `${userBoards.length} Boards (VYNL+ Unlimited)`;
    if (profileTierBadge) {
      profileTierBadge.textContent = vynlPlusPlan === 'founder_699' ? 'FOUNDER 🏆' : 'VYNL+ PRO 👑';
      profileTierBadge.classList.add('vip-badge');
    }
  } else {
    if (headerBtn) headerBtn.classList.remove('is-active-plus');
    if (headerLabel) headerLabel.textContent = 'VYNL+';
    if (headerPill) headerPill.textContent = '₹99/mo';
    if (activeBanner) activeBanner.classList.add('hidden');
    if (boardsCounter) boardsCounter.textContent = `${userBoards.length} / 3 Boards (Free Tier)`;
    if (profileTierBadge) {
      profileTierBadge.textContent = 'FREE TIER';
      profileTierBadge.classList.remove('vip-badge');
    }
  }

  renderBoardsGrid();
  updateProfileStats();
}

function checkVynlPlusOrPrompt(featureName, perkDesc) {
  if (isVynlPlus) return true;
  showToast(`👑 "${featureName}" is exclusive to VYNL+! Upgrade starting at ₹99/mo.`);
  openVynlPlusModal(featureName);
  return false;
}

function openVynlPlusModal(focusFeature = null) {
  const modal = document.getElementById('vynlPlusModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  playClickSound(750, 0.05, 'triangle');
}

function closeVynlPlusModal() {
  const modal = document.getElementById('vynlPlusModal');
  if (modal) modal.classList.add('hidden');
}

function upgradeToPlus(plan = 'monthly_99') {
  isVynlPlus = true;
  vynlPlusPlan = plan;
  localStorage.setItem('vynl_plus_active', 'true');
  localStorage.setItem('vynl_plus_plan', plan);
  updateVynlPlusUI();

  // Victory celebration sound
  playClickSound(587, 0.15, 'triangle');
  setTimeout(() => playClickSound(880, 0.2, 'triangle'), 100);
  setTimeout(() => playClickSound(1174, 0.35, 'triangle'), 220);

  // Confetti burst from center of screen
  for (let i = 0; i < 20; i++) {
    spawnCursorParticle(window.innerWidth / 2, window.innerHeight / 2, true);
  }

  showToast('🎉 Welcome to VYNL+! All 9 premium perks are now unlocked.');
  setTimeout(() => closeVynlPlusModal(), 1200);
}

function downgradeToFree() {
  isVynlPlus = false;
  localStorage.setItem('vynl_plus_active', 'false');
  updateVynlPlusUI();
  showToast('Switched to Free Tier (Demo Mode).');
}

// ─── 2. PERSONALIZED BOARDS ENGINE ────────────────────────
function saveUserBoards() {
  try {
    localStorage.setItem('vynl_user_boards', JSON.stringify(userBoards));
  } catch (e) {}
  updateVynlPlusUI();
}

function renderBoardsGrid() {
  const grid = document.getElementById('boardsGrid');
  if (!grid) return;

  if (!userBoards || !userBoards.length) {
    grid.innerHTML = `
      <div class="empty-saved-hint" style="grid-column: 1 / -1;">
        <p style="font-size: 1.15rem; color: #f5dfa0; font-weight: 700; margin-bottom: 8px;">📋 No boards created yet</p>
        <p style="font-size: 0.9rem; color: #a8916a;">Click "+ Create New Board" above to create your personalized music stations!</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = userBoards.map((b, idx) => `
    <div class="board-card" data-id="${b.id}">
      <div class="board-card-header">
        <span class="board-emoji-badge">${b.emoji || '🎧'}</span>
        <div>
          <h3 class="board-name">${b.name}</h3>
          <p class="board-desc">${b.desc || 'Custom Board'}</p>
        </div>
      </div>
      <div class="board-card-meta">
        <span>${b.tracks ? b.tracks.length : 0} Tracks</span>
        <div class="board-actions-row">
          <button class="primary-btn small-btn btn-play-board" data-idx="${idx}" title="Play Full Board Queue">▶ Play</button>
          <button class="outline-btn small-btn btn-view-board" data-idx="${idx}" title="View Board Details">View</button>
        </div>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.btn-play-board').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx);
      if (userBoards[idx]) playFullBoard(userBoards[idx]);
    });
  });

  grid.querySelectorAll('.btn-view-board, .board-card').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.btn-play-board')) return;
      const card = el.closest('.board-card') || el;
      const bId = card.dataset.id;
      openBoardDetails(bId);
    });
  });

  const badge = document.getElementById('boardsCountBadge');
  if (badge) badge.textContent = userBoards.length;
}

function openBoardDetails(boardId) {
  const board = userBoards.find(b => b.id === boardId);
  if (!board) return;

  activeBoardId = boardId;
  const boardsGrid = document.getElementById('boardsGrid');
  const detailsView = document.getElementById('boardDetailsView');

  if (boardsGrid) boardsGrid.classList.add('hidden');
  if (detailsView) detailsView.classList.remove('hidden');

  const emojiEl = document.getElementById('detailBoardEmoji');
  const titleEl = document.getElementById('detailBoardTitle');
  const subtitleEl = document.getElementById('detailBoardSubtitle');
  const listEl = document.getElementById('boardTrackList');

  if (emojiEl) emojiEl.textContent = board.emoji || '🎧';
  if (titleEl) titleEl.textContent = board.name;
  if (subtitleEl) subtitleEl.textContent = `${board.tracks ? board.tracks.length : 0} tracks • ${board.desc || 'Custom Board'}`;

  if (listEl) {
    if (!board.tracks || !board.tracks.length) {
      listEl.innerHTML = `
        <div class="empty-saved-hint">
          <p style="font-size: 1.1rem; color: #f5dfa0; font-weight: 700;">This board has no tracks yet</p>
          <p style="font-size: 0.85rem; color: #a8916a;">Search any song or browse mood recommendations and click "+ Board" to add tracks!</p>
        </div>
      `;
    } else {
      listEl.innerHTML = board.tracks.map((t, i) => `
        <div class="track-item board-track-item" data-index="${i}">
          <span class="track-num">${i + 1}</span>
          <img class="track-thumb" src="${t.thumbnail}" alt="" loading="lazy" />
          <div class="track-meta">
            <div class="track-title">${t.title}</div>
            <div class="track-channel">${t.channel} <span class="verified-tag">✓</span></div>
          </div>
          <span class="track-duration">${t.duration || '3:30'}</span>
          <div class="track-actions">
            <button class="track-play-btn" title="Play Track">▶</button>
            <button class="track-remove-from-board-btn outline-btn small-btn danger-btn" title="Remove Track from Board" data-index="${i}">✕</button>
          </div>
        </div>
      `).join('');

      listEl.querySelectorAll('.board-track-item').forEach(el => {
        const idx = parseInt(el.dataset.index);
        el.addEventListener('click', (e) => {
          if (e.target.closest('.track-remove-from-board-btn')) return;
          currentTracks = [...board.tracks];
          currentIdx = idx;
          renderTrackList(currentTracks);
          ensureYTPlayerInit();
          playTrack(idx);
        });

        const remBtn = el.querySelector('.track-remove-from-board-btn');
        if (remBtn) {
          remBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            board.tracks.splice(idx, 1);
            saveUserBoards();
            openBoardDetails(boardId);
            showToast('Track removed from board.');
          });
        }
      });
    }
  }
}

function playFullBoard(board) {
  if (!board || !board.tracks || !board.tracks.length) {
    showToast('⚠️ Board is empty. Add songs first!');
    return;
  }
  currentTracks = [...board.tracks];
  currentIdx = 0;
  renderTrackList(currentTracks);
  ensureYTPlayerInit();
  playTrack(0);
  showToast(`▶ Playing board "${board.name}" (${board.tracks.length} tracks)`);
}

function openAddToBoardModal(track) {
  if (!track) return;
  trackToAddToBoard = track;

  const modal = document.getElementById('addToBoardModal');
  const titleEl = document.getElementById('addToBoardSongTitle');
  const listEl = document.getElementById('addToBoardList');

  if (titleEl) titleEl.textContent = `Adding "${track.title}" to:`;
  if (listEl) {
    if (!userBoards || !userBoards.length) {
      listEl.innerHTML = `
        <p style="color:#a8916a; font-size:0.85rem; margin-bottom:10px;">No custom boards yet.</p>
        <button id="quickCreateBoardBtn" class="primary-btn small-btn">+ Create First Board</button>
      `;
      document.getElementById('quickCreateBoardBtn')?.addEventListener('click', () => {
        modal?.classList.add('hidden');
        document.getElementById('createBoardModal')?.classList.remove('hidden');
      });
    } else {
      listEl.innerHTML = userBoards.map(b => `
        <button class="add-board-option-btn" data-id="${b.id}">
          <span>${b.emoji || '🎧'} ${b.name}</span>
          <span style="font-size:0.75rem; color:#ffd700;">${b.tracks ? b.tracks.length : 0} tracks →</span>
        </button>
      `).join('');

      listEl.querySelectorAll('.add-board-option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const bId = btn.dataset.id;
          addTrackToBoard(bId, trackToAddToBoard);
          modal?.classList.add('hidden');
        });
      });
    }
  }

  if (modal) modal.classList.remove('hidden');
}

function addTrackToBoard(boardId, track) {
  const board = userBoards.find(b => b.id === boardId);
  if (!board || !track) return;

  if (!board.tracks) board.tracks = [];

  // Free tier track limit check (5 songs max per board on free tier)
  if (!isVynlPlus && board.tracks.length >= 5) {
    showToast('⚠️ Free tier is limited to 5 songs per board. Upgrade to VYNL+ for unlimited!');
    openVynlPlusModal('Unlimited Board Songs');
    return;
  }

  // Prevent duplicate
  if (board.tracks.some(t => t.videoId === track.videoId)) {
    showToast(`⚠️ "${track.title}" is already in "${board.name}".`);
    return;
  }

  board.tracks.push({
    videoId: track.videoId,
    title: track.title,
    channel: track.channel,
    thumbnail: track.thumbnail || track.albumCover || `https://i.ytimg.com/vi/${track.videoId}/hqdefault.jpg`,
    duration: track.duration || '3:30'
  });

  saveUserBoards();
  showToast(`✅ Added "${track.title}" to ${board.name}!`);
}

function initBoardsListeners() {
  const createBtn = document.getElementById('createBoardBtn');
  const createModal = document.getElementById('createBoardModal');
  const closeCreateBtn = document.getElementById('closeBoardModalBtn');
  const boardBackdrop = document.getElementById('boardModalBackdrop');
  const saveBtn = document.getElementById('saveBoardBtn');
  const nameInput = document.getElementById('newBoardNameInput');
  const descInput = document.getElementById('newBoardDescInput');

  let selectedEmoji = '🎧';

  if (createBtn) {
    createBtn.addEventListener('click', () => {
      // Free tier board limit check (3 boards max on free tier per roadmap spec)
      if (!isVynlPlus && userBoards.length >= 3) {
        showToast('⚠️ Free tier is limited to 3 custom boards. Upgrade to VYNL+ for unlimited personalized boards!');
        openVynlPlusModal('Unlimited Personalized Boards');
        return;
      }
      if (nameInput) nameInput.value = '';
      if (descInput) descInput.value = '';
      if (createModal) createModal.classList.remove('hidden');
    });
  }

  [closeCreateBtn, boardBackdrop].forEach(el => {
    el?.addEventListener('click', () => {
      if (createModal) createModal.classList.add('hidden');
    });
  });

  // Emoji picker chips
  document.querySelectorAll('.emoji-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.emoji-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedEmoji = chip.textContent.trim();
    });
  });

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const name = nameInput?.value.trim();
      if (!name) {
        showToast('⚠️ Please enter a name for your board.');
        return;
      }

      const newBoard = {
        id: 'board_' + Date.now(),
        name: name,
        desc: descInput?.value.trim() || 'Custom board',
        emoji: selectedEmoji,
        tracks: []
      };

      userBoards.push(newBoard);
      saveUserBoards();
      if (createModal) createModal.classList.add('hidden');
      renderBoardsGrid();
      showToast(`✨ Created board "${name}"!`);
    });
  }

  // Board details navigation
  document.getElementById('backToBoardsBtn')?.addEventListener('click', () => {
    document.getElementById('boardDetailsView')?.classList.add('hidden');
    document.getElementById('boardsGrid')?.classList.remove('hidden');
    renderBoardsGrid();
  });

  document.getElementById('playBoardAllBtn')?.addEventListener('click', () => {
    const board = userBoards.find(b => b.id === activeBoardId);
    if (board) playFullBoard(board);
  });

  document.getElementById('deleteBoardBtn')?.addEventListener('click', () => {
    const board = userBoards.find(b => b.id === activeBoardId);
    if (!board) return;
    if (confirm(`Are you sure you want to delete board "${board.name}"?`)) {
      userBoards = userBoards.filter(b => b.id !== activeBoardId);
      saveUserBoards();
      document.getElementById('boardDetailsView')?.classList.add('hidden');
      document.getElementById('boardsGrid')?.classList.remove('hidden');
      renderBoardsGrid();
      showToast(`🗑️ Deleted board "${board.name}".`);
    }
  });

  // Add to board modal close
  document.getElementById('closeAddToBoardBtn')?.addEventListener('click', () => {
    document.getElementById('addToBoardModal')?.classList.add('hidden');
  });
  document.getElementById('addToBoardBackdrop')?.addEventListener('click', () => {
    document.getElementById('addToBoardModal')?.classList.add('hidden');
  });
}

// ─── 3. ADVANCED MOOD AI ENGINE ───────────────────────────
function initMoodAiListeners() {
  const valenceSlider = document.getElementById('valenceSlider');
  const energySlider = document.getElementById('energySlider');
  const acousticSlider = document.getElementById('acousticSlider');
  const eraSelect = document.getElementById('eraSelect');
  const aiPromptInput = document.getElementById('aiPromptInput');
  const aiSynthesizeBtn = document.getElementById('aiSynthesizeBtn');
  const aiSurpriseBtn = document.getElementById('aiSurpriseBtn');

  function updateAiTelemetry() {
    const v = parseInt(valenceSlider?.value || 50);
    const e = parseInt(energySlider?.value || 50);
    const a = parseInt(acousticSlider?.value || 50);
    const era = eraSelect?.value || 'lofi';

    if (document.getElementById('valenceVal')) {
      document.getElementById('valenceVal').textContent = `${v}% (${v < 35 ? 'Melancholy' : v > 65 ? 'Euphoric' : 'Balanced'})`;
    }
    if (document.getElementById('energyVal')) {
      document.getElementById('energyVal').textContent = `${e}% (${e < 35 ? 'Serene' : e > 65 ? 'High Adrenaline' : 'Dynamic'})`;
    }
    if (document.getElementById('acousticVal')) {
      document.getElementById('acousticVal').textContent = `${a}% (${a < 35 ? 'Organic' : a > 65 ? 'Cyber Synth' : 'Hybrid'})`;
    }

    const bpmMin = Math.floor(70 + (e / 100) * 85);
    const bpmMax = bpmMin + 10;
    const bpmEl = document.getElementById('telBpm');
    if (bpmEl) bpmEl.textContent = `${bpmMin}–${bpmMax} BPM`;

    const keys = ['C Major', 'A Minor', 'F# Minor', 'D Dorian', 'E Minor', 'G Major', 'B Minor', 'Eb Major'];
    const keyIdx = Math.floor(((v + e) / 200) * (keys.length - 1));
    const keyEl = document.getElementById('telKey');
    if (keyEl) keyEl.textContent = keys[keyIdx] || 'A Minor';

    const genre = `${era === '80s' ? '80s Synthwave' : era === '90s' ? '90s R&B/Grunge' : era === 'cyberpunk' ? 'Cyber Dark Bass' : era === 'citypop' ? 'City Pop Funk' : 'Chillhop Lofi'} × ${a > 50 ? 'Electronic' : 'Acoustic'}`;
    const genreEl = document.getElementById('telGenre');
    if (genreEl) genreEl.textContent = genre;

    const formEl = document.getElementById('telFormula');
    if (formEl) formEl.textContent = `Valence ${(v/100).toFixed(2)} | Energy ${(e/100).toFixed(2)} | Synth ${(a/100).toFixed(2)}`;
  }

  [valenceSlider, energySlider, acousticSlider].forEach(slider => {
    slider?.addEventListener('input', updateAiTelemetry);
  });
  eraSelect?.addEventListener('change', updateAiTelemetry);

  document.querySelectorAll('.ai-preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.dataset.prompt;
      if (aiPromptInput) aiPromptInput.value = prompt;
      if (prompt.includes('3 AM')) {
        if (valenceSlider) valenceSlider.value = 40;
        if (energySlider) energySlider.value = 30;
        if (acousticSlider) acousticSlider.value = 65;
        if (eraSelect) eraSelect.value = 'lofi';
      } else if (prompt.includes('Cyberpunk')) {
        if (valenceSlider) valenceSlider.value = 60;
        if (energySlider) energySlider.value = 85;
        if (acousticSlider) acousticSlider.value = 95;
        if (eraSelect) eraSelect.value = 'cyberpunk';
      } else if (prompt.includes('Autumn')) {
        if (valenceSlider) valenceSlider.value = 25;
        if (energySlider) energySlider.value = 35;
        if (acousticSlider) acousticSlider.value = 20;
        if (eraSelect) eraSelect.value = '90s';
      } else if (prompt.includes('Gym')) {
        if (valenceSlider) valenceSlider.value = 90;
        if (energySlider) energySlider.value = 98;
        if (acousticSlider) acousticSlider.value = 90;
        if (eraSelect) eraSelect.value = 'cyberpunk';
      } else if (prompt.includes('Ghibli')) {
        if (valenceSlider) valenceSlider.value = 75;
        if (energySlider) energySlider.value = 45;
        if (acousticSlider) acousticSlider.value = 15;
        if (eraSelect) eraSelect.value = 'lofi';
      }
      updateAiTelemetry();
      playClickSound(900, 0.04, 'sine');
    });
  });

  if (aiSurpriseBtn) {
    aiSurpriseBtn.addEventListener('click', () => {
      if (valenceSlider) valenceSlider.value = Math.floor(Math.random() * 100);
      if (energySlider) energySlider.value = Math.floor(Math.random() * 100);
      if (acousticSlider) acousticSlider.value = Math.floor(Math.random() * 100);
      const eras = ['80s', '90s', '2000s', 'lofi', 'cyberpunk', 'citypop', 'cinematic'];
      if (eraSelect) eraSelect.value = eras[Math.floor(Math.random() * eras.length)];
      updateAiTelemetry();
      showToast('🎲 Generated random AI Mood Formula!');
    });
  }

  if (aiSynthesizeBtn) {
    aiSynthesizeBtn.addEventListener('click', async () => {
      if (!checkVynlPlusOrPrompt('Advanced Mood AI', 'Synthesize multi-vector soundscapes with neural emotion tracking')) return;
      synthesizeAdvancedMood();
    });
  }
}

async function synthesizeAdvancedMood() {
  const btn = document.getElementById('aiSynthesizeBtn');
  const btnText = document.getElementById('aiBtnText');
  const spinner = document.getElementById('aiSpinner');
  const promptText = document.getElementById('aiPromptInput')?.value.trim() || '';
  const valence = parseInt(document.getElementById('valenceSlider')?.value || 50);
  const energy = parseInt(document.getElementById('energySlider')?.value || 50);
  const era = document.getElementById('eraSelect')?.value || 'lofi';

  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = '🧠 Synthesizing Neural Board...';
  if (spinner) spinner.classList.remove('hidden');

  // Build specialized search query based on vectors
  let queryTerms = [];
  if (promptText) queryTerms.push(promptText);
  if (era === '80s') queryTerms.push('80s synthwave retrowave');
  else if (era === '90s') queryTerms.push('90s indie alternative');
  else if (era === 'cyberpunk') queryTerms.push('cyberpunk darksynth bass');
  else if (era === 'citypop') queryTerms.push('japanese city pop 80s funk');
  else if (era === 'cinematic') queryTerms.push('cinematic ambient soundtrack');
  else queryTerms.push('lofi chill beats');

  if (energy > 70) queryTerms.push('fast high energy');
  else if (energy < 35) queryTerms.push('slow chill relax');

  if (valence < 35) queryTerms.push('melancholic emotional');
  else if (valence > 65) queryTerms.push('euphoric uplifting');

  const synthQuery = queryTerms.join(' ');

  try {
    let tracks = [];
    if (YT_API_KEY && YT_API_KEY !== 'YOUR_YOUTUBE_API_KEY_HERE') {
      tracks = await searchYouTube(synthQuery);
    }
    if (!tracks || !tracks.length) {
      tracks = getMoodFallbackTracks(energy > 60 ? 'energetic' : valence < 40 ? 'melancholic' : 'chill');
    }

    currentTracks = tracks;
    currentIdx = 0;

    // Reveal results view
    document.getElementById('moodAiSection')?.classList.add('hidden');
    const resSec = document.getElementById('resultsSection');
    if (resSec) resSec.classList.remove('hidden');

    const emojiEl = document.getElementById('resultsEmoji');
    const titleEl = document.getElementById('resultsTitle');
    const subEl = document.getElementById('resultsSubtitle');

    if (emojiEl) emojiEl.textContent = '🧠';
    if (titleEl) titleEl.textContent = `AI Synthesized: ${promptText ? promptText.slice(0, 32) + '...' : 'Neural Mood Matrix'}`;
    if (subEl) subEl.textContent = `Synthesized with Valence ${valence}% • Energy ${energy}% • ${era.toUpperCase()} Texture`;

    renderTrackList(currentTracks);
    ensureYTPlayerInit();
    playTrack(0);

    showToast('✨ Synthesized AI Music Board! Now playing.');
  } catch (err) {
    showToast('⚠️ AI Synthesis completed with curated fallback tracks.');
  } finally {
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = '🧠 Synthesize AI Mood Board';
    if (spinner) spinner.classList.add('hidden');
  }
}

// ─── 4. THEME & VISUALS STUDIO ENGINE ─────────────────────
function applyTheme(themeKey, isPro) {
  if (isPro && !checkVynlPlusOrPrompt('Exclusive Themes & Visuals', 'Unlock HD Anime CRT, Sakura Rain, Synthwave, and custom wallpapers')) return;

  activeThemeKey = themeKey;
  const bgImg = document.getElementById('bgImg');

  const themeMap = {
    cosmic: 'cosmic_supernova_bg.jpg',
    goldfish: 'bg_goldfish_art.jpg',
    nightcat: 'bg_night_cat.jpg',
    stargrid: 'bg_pixel_star_grid.jpg',
    cyberpunk: 'bg_anime_crt.jpg',
    synthwave: 'bg_tame_impala_waves.jpg',
    sakura: 'pinterest_cherry_blossom.png',
    lofi_cafe: 'pinterest_pixel_coffee.png',
    sunset_birds: 'pinterest_pixel_sunset.png',
    pixel_forest: 'pinterest_pixel_forest.png',
  };

  if (themeMap[themeKey] && bgImg) {
    loadBgImage(themeMap[themeKey]);
    showToast(`🎨 Theme set to ${themeKey.toUpperCase()}`);
  }

  document.querySelectorAll('.theme-card').forEach(c => {
    c.classList.toggle('active', c.dataset.theme === themeKey);
  });
}

function initThemeStudioListeners() {
  const themeBtn = document.getElementById('themePickerBtn');
  const themeModal = document.getElementById('themeModal');
  const closeBtn = document.getElementById('closeThemeModalBtn');
  const backdrop = document.getElementById('themeBackdrop');

  if (themeBtn && themeModal) {
    themeBtn.addEventListener('click', () => {
      themeModal.classList.remove('hidden');
      playClickSound(700, 0.04, 'sine');
    });
  }

  [closeBtn, backdrop].forEach(el => {
    el?.addEventListener('click', () => {
      if (themeModal) themeModal.classList.add('hidden');
    });
  });

  document.querySelectorAll('.theme-card').forEach(card => {
    card.addEventListener('click', () => {
      const themeKey = card.dataset.theme;
      const isPro = card.dataset.pro === 'true';
      applyTheme(themeKey, isPro);
    });
  });

  // Custom wallpaper URL
  const customInput = document.getElementById('customBgUrlInput');
  const applyCustomBtn = document.getElementById('applyCustomBgBtn');

  if (applyCustomBtn) {
    applyCustomBtn.addEventListener('click', () => {
      if (!checkVynlPlusOrPrompt('Custom Wallpaper URL', 'Set any custom image URL wallpaper')) return;
      const url = customInput?.value.trim();
      if (!url) {
        showToast('⚠️ Please enter an image URL.');
        return;
      }
      loadBgImage(url);
      showToast('🖼️ Applied custom wallpaper!');
    });
  }

  // Particle Mode Switcher
  document.querySelectorAll('.particle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const fx = btn.dataset.fx;
      const isProFx = (fx === 'sakura' || fx === 'matrix');

      if (isProFx && !checkVynlPlusOrPrompt('Exclusive Particle Atmosphere', 'Unlock Sakura Blossom Fall and Matrix Digital Rain')) return;

      document.querySelectorAll('.particle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeParticleMode = fx;
      showToast(`✨ Atmosphere FX changed to ${btn.textContent.trim()}`);
    });
  });
}

// ─── 5. KARAOKE STUDIO PRO & EQUALIZER ENGINE ─────────────
function initKaraokeProListeners() {
  const kToolVocalCut = document.getElementById('kToolVocalCut');
  const kPitchDown = document.getElementById('kPitchDown');
  const kPitchUp = document.getElementById('kPitchUp');
  const kPitchVal = document.getElementById('kPitchValue');
  const kToolBassBoost = document.getElementById('kToolBassBoost');
  const kBassLabel = document.getElementById('kBassLabel');
  const kToolSpatialAudio = document.getElementById('kToolSpatialAudio');
  const kSpatialLabel = document.getElementById('kSpatialLabel');
  const kToolMic = document.getElementById('kToolMic');
  const kMicLabel = document.getElementById('kMicLabel');
  const kToolTeleprompter = document.getElementById('kToolTeleprompter');

  if (kToolVocalCut) {
    kToolVocalCut.addEventListener('click', () => {
      if (!checkVynlPlusOrPrompt('Vocal Reducer Pro', 'Attenuate center vocal frequencies for instrumental karaoke sing along')) return;
      karaokeProState.vocalCut = !karaokeProState.vocalCut;
      kToolVocalCut.classList.toggle('active', karaokeProState.vocalCut);
      showToast(karaokeProState.vocalCut ? '🎚️ Vocal Reducer: ACTIVE (Instrumental Focus)' : '🎚️ Vocal Reducer: OFF');
    });
  }

  if (kPitchDown) {
    kPitchDown.addEventListener('click', () => {
      if (!checkVynlPlusOrPrompt('Pitch Key Transpose Pro', 'Shift audio semitones for comfortable vocal range')) return;
      if (karaokeProState.pitchShift > -4) {
        karaokeProState.pitchShift--;
        if (kPitchVal) kPitchVal.textContent = `${karaokeProState.pitchShift > 0 ? '+' : ''}${karaokeProState.pitchShift} st`;
        showToast(`🎼 Key pitch shifted to ${karaokeProState.pitchShift} semitones`);
      }
    });
  }

  if (kPitchUp) {
    kPitchUp.addEventListener('click', () => {
      if (!checkVynlPlusOrPrompt('Pitch Key Transpose Pro', 'Shift audio semitones for comfortable vocal range')) return;
      if (karaokeProState.pitchShift < 4) {
        karaokeProState.pitchShift++;
        if (kPitchVal) kPitchVal.textContent = `${karaokeProState.pitchShift > 0 ? '+' : ''}${karaokeProState.pitchShift} st`;
        showToast(`🎼 Key pitch shifted to ${karaokeProState.pitchShift} semitones`);
      }
    });
  }

  // 🔊 Deep Sub-Bass Booster
  if (kToolBassBoost) {
    kToolBassBoost.addEventListener('click', () => {
      if (!checkVynlPlusOrPrompt('Deep Bass Boost Pro', 'Unlock sub-frequency +6dB bass booster')) return;
      karaokeProState.bassBoost = !karaokeProState.bassBoost;
      kToolBassBoost.classList.toggle('active', karaokeProState.bassBoost);
      if (kBassLabel) kBassLabel.textContent = karaokeProState.bassBoost ? 'Bass +6dB ON' : 'Bass Boost';
      playClickSound(180, 0.1, 'sine');
      showToast(karaokeProState.bassBoost ? '🔊 Deep Bass Booster: +6dB Low-End ACTIVE' : '🔊 Bass Booster: Flat');
    });
  }

  // 🎧 3D Spatial Audio & Surround Reverb
  if (kToolSpatialAudio) {
    kToolSpatialAudio.addEventListener('click', () => {
      if (!checkVynlPlusOrPrompt('3D Spatial Surround Sound', 'Unlock 3D binaural stereo widener')) return;
      karaokeProState.spatialAudio = !karaokeProState.spatialAudio;
      kToolSpatialAudio.classList.toggle('active', karaokeProState.spatialAudio);
      if (kSpatialLabel) kSpatialLabel.textContent = karaokeProState.spatialAudio ? '3D Spatial ON' : '3D Spatial';
      playClickSound(440, 0.1, 'triangle');
      showToast(karaokeProState.spatialAudio ? '🎧 3D Spatial Audio: 360° Surround ACTIVE' : '🎧 3D Spatial Audio: Standard Stereo');
    });
  }

  if (kToolMic) {
    kToolMic.addEventListener('click', async () => {
      if (!checkVynlPlusOrPrompt('Live Microphone Studio Monitor', 'Hear your singing voice in real time with studio reverb')) return;

      if (!karaokeProState.micActive) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          karaokeProState.micActive = true;
          kToolMic.classList.add('active');
          if (kMicLabel) kMicLabel.textContent = 'Mic: ON 🎙️';
          showToast('🎙️ Live Microphone connected with subtle reverb!');
        } catch (err) {
          showToast('⚠️ Microphone permission not granted.');
        }
      } else {
        if (micStream) {
          micStream.getTracks().forEach(t => t.stop());
          micStream = null;
        }
        karaokeProState.micActive = false;
        kToolMic.classList.remove('active');
        if (kMicLabel) kMicLabel.textContent = 'Mic: OFF';
        showToast('🎙️ Mic Monitor disabled.');
      }
    });
  }

  if (kToolTeleprompter) {
    kToolTeleprompter.addEventListener('click', () => {
      karaokeProState.teleprompter = !karaokeProState.teleprompter;
      kToolTeleprompter.classList.toggle('active', karaokeProState.teleprompter);
      const container = document.getElementById('karaokeLyricsContainer');
      if (container) {
        container.style.fontSize = karaokeProState.teleprompter ? '1.55rem' : '';
      }
      showToast(karaokeProState.teleprompter ? '📜 Teleprompter Big Text: ON' : '📜 Standard Lyrics Text');
    });
  }
}

// ══════════════════════════════════════════════════════════
// ─── 60FPS TRAILING MOUSE SPARKLE & STAR EFFECTS ENGINE ───
// ══════════════════════════════════════════════════════════
function initMouseTrailCanvas() {
  const canvas = document.getElementById('mouseTrailCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  if (!ctx) return;

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }, { passive: true });

  const MAX_PARTICLES = 28;
  const particles = [];
  const palette = ['#ffd700', '#ffe680', '#ff99c8', '#70d6ff', '#c77dff', '#ffffff', '#e8b96a'];
  const symbols = ['✦', '★', '✧', '•', '✨', '♪', '♫'];

  let animId = null;
  let lastMoveTime = 0;
  let lastClickTime = 0;
  let lastX = 0;
  let lastY = 0;

  function spawnParticle(x, y, isClick = false) {
    const now = performance.now();
    if (isClick && now - lastClickTime < 24) return; // Prevent click spam lockup
    if (isClick) lastClickTime = now;

    const count = isClick ? 3 : 1;
    for (let i = 0; i < count; i++) {
      if (particles.length >= MAX_PARTICLES) {
        particles.shift(); // Strict particle count capping
      }

      const angle = isClick ? (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4 : Math.random() * Math.PI * 2;
      const speed = isClick ? Math.random() * 2.5 + 1.2 : Math.random() * 1.4 + 0.4;
      const symbol = isClick ? (Math.random() > 0.4 ? '✨' : '★') : symbols[Math.floor(Math.random() * symbols.length)];
      const color = palette[Math.floor(Math.random() * palette.length)];

      particles.push({
        x: x + (Math.random() - 0.5) * 4,
        y: y + (Math.random() - 0.5) * 4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (isClick ? 0.8 : 0.2),
        size: isClick ? Math.random() * 4 + 8 : Math.random() * 3 + 6,
        alpha: 1,
        decay: isClick ? Math.random() * 0.035 + 0.03 : Math.random() * 0.045 + 0.035,
        color: color,
        symbol: symbol,
        isDot: symbol === '•'
      });
    }

    if (!animId) {
      animId = requestAnimationFrame(renderLoop);
    }
  }

  window.addEventListener('mousemove', (e) => {
    const now = performance.now();
    if (now - lastMoveTime > 20) {
      const dist = Math.hypot(e.clientX - lastX, e.clientY - lastY);
      if (dist > 5) {
        spawnParticle(e.clientX, e.clientY, false);
        lastX = e.clientX;
        lastY = e.clientY;
        lastMoveTime = now;
      }
    }
  }, { passive: true });

  window.addEventListener('mousedown', (e) => {
    spawnParticle(e.clientX, e.clientY, true);
    playClickSound(900 + Math.random() * 200, 0.025, 'triangle');
  }, { passive: true });

  function renderLoop() {
    ctx.clearRect(0, 0, width, height);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.03;
      p.alpha -= p.decay;
      p.size *= 0.98;

      if (p.alpha <= 0 || p.size <= 0.5) {
        particles.splice(i, 1);
        continue;
      }

      ctx.globalAlpha = Math.max(0, p.alpha);

      if (p.isDot) {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.font = `${Math.round(p.size)}px "Outfit", "Segoe UI Emoji", sans-serif`;
        ctx.fillStyle = p.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.symbol, p.x, p.y);
      }
    }

    if (particles.length > 0) {
      animId = requestAnimationFrame(renderLoop);
    } else {
      ctx.clearRect(0, 0, width, height);
      animId = null;
    }
  }
}

// ══════════════════════════════════════════════════════════
// ─── USER ACCOUNTS, AUTH & PROFILES (ROADMAP PHASE 0/4) ───
// ══════════════════════════════════════════════════════════
const DEFAULT_ACCOUNT = {
  username: 'ankit',
  email: 'ankit@vynl.app',
  avatar: 'logo_cat.jpg',
  bio: 'Curating late-night lofi & dreamy soundscapes',
  tier: 'founder_699',
  stats: { moodsCreated: 14 }
};

let userAccounts = [DEFAULT_ACCOUNT];
try {
  const storedAccs = localStorage.getItem('vynl_registered_accounts');
  if (storedAccs) userAccounts = JSON.parse(storedAccs);
} catch (e) {}

let currentUser = DEFAULT_ACCOUNT;
try {
  const storedUser = localStorage.getItem('vynl_current_user');
  if (storedUser) currentUser = JSON.parse(storedUser);
} catch (e) {}

// Sync global userProfile reference
userProfile = currentUser || DEFAULT_ACCOUNT;

function updateProfileUI() {
  const headerAvatar = document.getElementById('headerUserAvatar');
  const headerName = document.getElementById('headerUserName');
  const tierDot = document.querySelector('.user-tier-dot');
  const modalAvatar = document.getElementById('profileModalAvatar');
  const modalName = document.getElementById('profileModalName');
  const modalBio = document.getElementById('profileModalBio');
  const editName = document.getElementById('editUsernameInput');
  const editBio = document.getElementById('editBioInput');
  const tierBadge = document.getElementById('profileTierBadge');

  if (currentUser) {
    if (headerAvatar) {
      headerAvatar.src = currentUser.avatar || 'logo_cat.jpg';
      headerAvatar.style.display = 'block';
    }
    if (headerName) headerName.textContent = currentUser.username || 'ankit';
    if (tierDot) tierDot.style.background = currentUser.tier === 'founder_699' ? '#ffd700' : '#38ef7d';

    if (modalAvatar) modalAvatar.src = currentUser.avatar || 'logo_cat.jpg';
    if (modalName) modalName.textContent = `${currentUser.username || 'ankit'}'s VYNL`;
    if (modalBio) modalBio.textContent = currentUser.bio || 'Curating late-night lofi & dreamy soundscapes';
    if (editName) editName.value = currentUser.username || 'ankit';
    if (editBio) editBio.value = currentUser.bio || '';
    if (tierBadge) {
      tierBadge.textContent = currentUser.tier === 'founder_699' ? '🏆 FOUNDER LIFETIME' : (vynlPlusTier !== 'free' ? '👑 VYNL+ PRO' : 'FREE TIER');
    }
  } else {
    if (headerAvatar) headerAvatar.style.display = 'none';
    if (headerName) headerName.textContent = 'Log In / Sign Up';
    if (tierDot) tierDot.style.background = '#888888';
  }

  updateProfileStats();
  renderMoodHistory();
}

function updateProfileStats() {
  const statBoards = document.getElementById('statBoardsCount');
  const statSaved = document.getElementById('statSavedCount');
  const statMoods = document.getElementById('statMoodsCount');

  if (statBoards) statBoards.textContent = userBoards.length;
  if (statSaved) statSaved.textContent = savedTracks.length;
  if (statMoods) statMoods.textContent = (currentUser?.stats?.moodsCreated || moodHistory.length || 4);
}

function saveUserProfile() {
  if (!currentUser) return;
  try {
    localStorage.setItem('vynl_current_user', JSON.stringify(currentUser));
    localStorage.setItem('vynl_user_profile', JSON.stringify(currentUser));
    const idx = userAccounts.findIndex(a => a.username === currentUser.username);
    if (idx >= 0) userAccounts[idx] = { ...currentUser };
    else userAccounts.push(currentUser);
    localStorage.setItem('vynl_registered_accounts', JSON.stringify(userAccounts));
  } catch (e) {}
  updateProfileUI();
}

function addMoodHistory(moodTitle, moodEmoji) {
  const item = {
    mood: moodTitle,
    emoji: moodEmoji,
    time: 'Just now'
  };
  moodHistory.unshift(item);
  if (moodHistory.length > 20) moodHistory.pop();

  if (currentUser) {
    if (!currentUser.stats) currentUser.stats = { moodsCreated: 0 };
    currentUser.stats.moodsCreated = (currentUser.stats.moodsCreated || 0) + 1;
    saveUserProfile();
  }

  try {
    localStorage.setItem('vynl_mood_history', JSON.stringify(moodHistory));
  } catch (e) {}

  renderMoodHistory();
}

function renderMoodHistory() {
  const listEl = document.getElementById('moodHistoryList');
  if (!listEl) return;

  if (!moodHistory.length) {
    listEl.innerHTML = '<p style="color:#a8916a; font-size:0.8rem;">No recent moods recorded yet.</p>';
    return;
  }

  listEl.innerHTML = moodHistory.slice(0, 5).map(m => `
    <div class="mood-history-item">
      <div class="mood-history-meta">
        <span>${m.emoji || '✨'}</span>
        <span>${m.mood}</span>
      </div>
      <span class="mood-history-time">${m.time}</span>
    </div>
  `).join('');
}

// ══════════════════════════════════════════════════════════
// ─── AUTH MODAL & MULTI-ACCOUNT CONTROLLER ────────────────
// ══════════════════════════════════════════════════════════
function initAuthModalListeners() {
  const authModal = document.getElementById('authModal');
  const closeAuthBtn = document.getElementById('closeAuthModalBtn');
  const authBackdrop = document.getElementById('authBackdrop');
  const tabSignIn = document.getElementById('tabSignInBtn');
  const tabSignUp = document.getElementById('tabSignUpBtn');
  const signInForm = document.getElementById('signInForm');
  const signUpForm = document.getElementById('signUpForm');
  const demoLoginBtn = document.getElementById('demoQuickLoginBtn');
  const googleBtn = document.getElementById('googleAuthBtn');
  const guestBtn = document.getElementById('guestAuthBtn');
  let selectedSignupAvatar = 'logo_cat.jpg';

  // Tab switching
  if (tabSignIn && tabSignUp) {
    tabSignIn.addEventListener('click', () => {
      tabSignIn.classList.add('active');
      tabSignUp.classList.remove('active');
      signInForm?.classList.remove('hidden');
      signUpForm?.classList.add('hidden');
    });

    tabSignUp.addEventListener('click', () => {
      tabSignUp.classList.add('active');
      tabSignIn.classList.remove('active');
      signUpForm?.classList.remove('hidden');
      signInForm?.classList.add('hidden');
    });
  }

  [closeAuthBtn, authBackdrop].forEach(el => {
    el?.addEventListener('click', () => authModal?.classList.add('hidden'));
  });

  // Avatar picker in signup
  document.querySelectorAll('.signup-avatar-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.signup-avatar-opt').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      selectedSignupAvatar = opt.dataset.avatar;
    });
  });

  // Sign In submit
  if (signInForm) {
    signInForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const loginInp = document.getElementById('signInUsername')?.value.trim();
      if (!loginInp) return;

      const found = userAccounts.find(a => a.username.toLowerCase() === loginInp.toLowerCase() || a.email?.toLowerCase() === loginInp.toLowerCase());
      if (found) {
        currentUser = found;
      } else {
        currentUser = {
          username: loginInp,
          email: `${loginInp}@vynl.app`,
          avatar: 'logo_cat.jpg',
          bio: 'VYNL Music Lover',
          tier: 'free',
          stats: { moodsCreated: 1 }
        };
        userAccounts.push(currentUser);
      }

      userProfile = currentUser;
      saveUserProfile();
      authModal?.classList.add('hidden');
      showToast(`✨ Welcome back, ${currentUser.username}!`);
      playClickSound(800, 0.06, 'triangle');
    });
  }

  // Sign Up submit
  if (signUpForm) {
    signUpForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const newName = document.getElementById('signUpUsername')?.value.trim();
      const newEmail = document.getElementById('signUpEmail')?.value.trim();
      if (!newName) return;

      currentUser = {
        username: newName,
        email: newEmail || `${newName}@vynl.app`,
        avatar: selectedSignupAvatar || 'logo_cat.jpg',
        bio: 'Exploring soundscapes on VYNL',
        tier: 'free',
        stats: { moodsCreated: 0 }
      };

      userAccounts.push(currentUser);
      userProfile = currentUser;
      saveUserProfile();
      authModal?.classList.add('hidden');
      showToast(`🎉 Account created! Welcome to VYNL, ${currentUser.username}!`);
      playClickSound(880, 0.08, 'sine');
    });
  }

  // Demo 1-Click Login (ankit)
  if (demoLoginBtn) {
    demoLoginBtn.addEventListener('click', () => {
      currentUser = DEFAULT_ACCOUNT;
      userProfile = currentUser;
      saveUserProfile();
      authModal?.classList.add('hidden');
      showToast(`⚡ Logged in as ${currentUser.username}!`);
    });
  }

  // Google simulated auth
  if (googleBtn) {
    googleBtn.addEventListener('click', () => {
      currentUser = {
        username: 'GoogleExplorer',
        email: 'user@gmail.com',
        avatar: 'cat_headphone.jpg',
        bio: 'Connected via Google Auth',
        tier: 'free',
        stats: { moodsCreated: 5 }
      };
      userProfile = currentUser;
      saveUserProfile();
      authModal?.classList.add('hidden');
      showToast(`🌐 Connected with Google: Welcome!`);
    });
  }

  // Guest auth
  if (guestBtn) {
    guestBtn.addEventListener('click', () => {
      currentUser = {
        username: 'GuestListener',
        email: 'guest@vynl.app',
        avatar: 'cat_white_headphones.jpg',
        bio: 'Listening in Guest Mode',
        tier: 'free',
        stats: { moodsCreated: 2 }
      };
      userProfile = currentUser;
      saveUserProfile();
      authModal?.classList.add('hidden');
      showToast(`🐱 Guest Mode Active`);
    });
  }
}

function initUserProfileListeners() {
  const profileBtn = document.getElementById('userProfileBtn');
  const modal = document.getElementById('userProfileModal');
  const closeBtn = document.getElementById('closeProfileModalBtn');
  const backdrop = document.getElementById('userProfileBackdrop');
  const changeAvatarBtn = document.getElementById('changeAvatarBtn');
  const avatarTray = document.getElementById('avatarPickerTray');
  const saveProfileBtn = document.getElementById('saveProfileBtn');
  const editName = document.getElementById('editUsernameInput');
  const editBio = document.getElementById('editBioInput');
  const openAuthBtn = document.getElementById('openAuthModalBtn');
  const signOutBtn = document.getElementById('signOutBtn');

  if (profileBtn) {
    profileBtn.addEventListener('click', () => {
      if (currentUser) {
        updateProfileUI();
        modal?.classList.remove('hidden');
      } else {
        document.getElementById('authModal')?.classList.remove('hidden');
      }
      playClickSound(700, 0.04, 'sine');
    });
  }

  [closeBtn, backdrop].forEach(el => {
    el?.addEventListener('click', () => {
      modal?.classList.add('hidden');
      avatarTray?.classList.add('hidden');
    });
  });

  if (changeAvatarBtn && avatarTray) {
    changeAvatarBtn.addEventListener('click', () => {
      avatarTray.classList.toggle('hidden');
    });
  }

  document.querySelectorAll('.avatar-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      if (currentUser) {
        currentUser.avatar = opt.dataset.avatar;
        saveUserProfile();
        showToast('📷 Avatar updated!');
      }
    });
  });

  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', () => {
      if (currentUser) {
        currentUser.username = editName?.value.trim() || 'ankit';
        currentUser.bio = editBio?.value.trim() || '';
        saveUserProfile();
        showToast('✅ Profile saved successfully!');
      }
    });
  }

  if (openAuthBtn) {
    openAuthBtn.addEventListener('click', () => {
      modal?.classList.add('hidden');
      document.getElementById('authModal')?.classList.remove('hidden');
    });
  }

  if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
      currentUser = null;
      userProfile = null;
      try {
        localStorage.removeItem('vynl_current_user');
      } catch (e) {}
      modal?.classList.add('hidden');
      updateProfileUI();
      showToast('🚪 Signed out from VYNL.');
      setTimeout(() => {
        document.getElementById('authModal')?.classList.remove('hidden');
      }, 300);
    });
  }
}

// ══════════════════════════════════════════════════════════
// ─── VIRAL SHAREABLE BOARD ENGINE (ROADMAP PHASE 0/4) ─────
// ══════════════════════════════════════════════════════════
function generateShareableBoardUrl(board) {
  if (!board) return window.location.origin + window.location.pathname;
  try {
    const payload = {
      n: board.name,
      e: board.emoji || '🌙',
      d: board.desc || 'Curated on VYNL',
      t: (board.tracks || []).slice(0, 15).map(t => ({
        v: t.videoId,
        ti: t.title,
        ch: t.channel,
        d: t.duration || '3:30'
      }))
    };
    const encoded = btoa(encodeURIComponent(JSON.stringify(payload)));
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?vynl_board=${encoded}`;
  } catch (e) {
    return window.location.href;
  }
}

function openShareModal(board) {
  boardToShare = board;
  const modal = document.getElementById('shareBoardModal');
  const previewEmoji = document.getElementById('sharePreviewEmoji');
  const previewTitle = document.getElementById('sharePreviewTitle');
  const previewSub = document.getElementById('sharePreviewSubtitle');
  const shareInput = document.getElementById('shareUrlInput');

  if (previewEmoji) previewEmoji.textContent = board.emoji || '🌙';
  if (previewTitle) previewTitle.textContent = board.name;
  if (previewSub) previewSub.textContent = `${board.tracks ? board.tracks.length : 0} songs • ${board.desc || 'Curated on VYNL'}`;

  const shareUrl = generateShareableBoardUrl(board);
  if (shareInput) shareInput.value = shareUrl;

  if (modal) {
    modal.classList.remove('hidden');
    playClickSound(800, 0.05, 'triangle');
  }
}

function initShareModalListeners() {
  const modal = document.getElementById('shareBoardModal');
  const closeBtn = document.getElementById('closeShareModalBtn');
  const backdrop = document.getElementById('shareBoardBackdrop');
  const copyBtn = document.getElementById('copyShareUrlBtn');
  const whatsappBtn = document.getElementById('shareWhatsappBtn');
  const discordBtn = document.getElementById('shareDiscordBtn');
  const twitterBtn = document.getElementById('shareTwitterBtn');
  const instagramBtn = document.getElementById('shareInstagramBtn');

  // Also bind details view share button
  const shareDetailsBtn = document.getElementById('shareBoardDetailsBtn');
  if (shareDetailsBtn) {
    shareDetailsBtn.addEventListener('click', () => {
      const b = userBoards.find(item => item.id === activeBoardId);
      if (b) openShareModal(b);
    });
  }

  [closeBtn, backdrop].forEach(el => {
    el?.addEventListener('click', () => modal?.classList.add('hidden'));
  });

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const shareInput = document.getElementById('shareUrlInput');
      if (shareInput) {
        shareInput.select();
        navigator.clipboard.writeText(shareInput.value).then(() => {
          showToast('📋 Share link copied to clipboard!');
        });
      }
    });
  }

  if (whatsappBtn) {
    whatsappBtn.addEventListener('click', () => {
      if (!boardToShare) return;
      const url = generateShareableBoardUrl(boardToShare);
      const text = `🎧 Listen to my VYNL board "${boardToShare.emoji || '🌙'} ${boardToShare.name}" (${boardToShare.tracks ? boardToShare.tracks.length : 0} songs):\n${url}`;
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    });
  }

  if (discordBtn) {
    discordBtn.addEventListener('click', () => {
      if (!boardToShare) return;
      const url = generateShareableBoardUrl(boardToShare);
      const text = `🎧 **${boardToShare.emoji || '🌙'} ${boardToShare.name}**\n${boardToShare.desc || 'Curated on VYNL'}\n${url}`;
      navigator.clipboard.writeText(text).then(() => {
        showToast('🎮 Formatted Discord message copied to clipboard!');
      });
    });
  }

  if (twitterBtn) {
    twitterBtn.addEventListener('click', () => {
      if (!boardToShare) return;
      const url = generateShareableBoardUrl(boardToShare);
      const text = `Crafted a new vibe board on @vynlapp: "${boardToShare.emoji || '🌙'} ${boardToShare.name}". Give it a spin! 🎧✨`;
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
    });
  }

  if (instagramBtn) {
    instagramBtn.addEventListener('click', () => {
      if (!boardToShare) return;
      const text = `🎧 ${boardToShare.emoji || '🌙'} ${boardToShare.name.toUpperCase()} — ${boardToShare.desc || 'VYNL Board'}\nLink in Bio / DM for Board URL!`;
      navigator.clipboard.writeText(text).then(() => {
        showToast('📸 Instagram Story text copied to clipboard!');
      });
    });
  }
}

function loadBoardFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const rawBoard = params.get('vynl_board') || (window.location.hash.startsWith('#board/') ? window.location.hash.slice(7) : null);
  if (!rawBoard) return;

  try {
    const json = decodeURIComponent(atob(rawBoard));
    const data = JSON.parse(json);

    if (data && data.n && data.t) {
      const incomingBoard = {
        id: 'shared_' + Date.now(),
        name: data.n,
        emoji: data.e || '🌙',
        desc: data.d || 'Shared VYNL Board',
        tracks: data.t.map(t => ({
          videoId: t.v,
          title: t.ti,
          channel: t.ch,
          thumbnail: `https://i.ytimg.com/vi/${t.v}/hqdefault.jpg`,
          duration: t.d || '3:30'
        }))
      };

      if (!userBoards.some(b => b.name === incomingBoard.name)) {
        userBoards.unshift(incomingBoard);
        saveUserBoards();
      }

      currentTracks = [...incomingBoard.tracks];
      currentIdx = 0;
      renderTrackList(currentTracks);
      ensureYTPlayerInit();
      playTrack(0);

      showToast(`🎧 Welcome! Playing shared board "${incomingBoard.emoji} ${incomingBoard.name}"`);
    }
  } catch (err) {
    console.warn('Could not parse shared board link:', err);
  }
}

// ══════════════════════════════════════════════════════════
// ─── VYNL+ 3-PLAN SUBSCRIPTION HUB & CHECKOUT ENGINE ──────
// ══════════════════════════════════════════════════════════
function initVynlPlusModalListeners() {
  const headerBtn = document.getElementById('vynlPlusHeaderBtn');
  const closeBtn = document.getElementById('closeVynlPlusBtn');
  const backdrop = document.getElementById('vynlPlusBackdrop');
  const btnPlan99 = document.getElementById('btnSelectPlan99');
  const btnPlan799 = document.getElementById('btnSelectPlan799');
  const btnPlan699 = document.getElementById('btnSelectPlan699');
  const activateBtn = document.getElementById('activatePlusBtn');
  const activateBtnText = document.getElementById('activatePlusBtnText');
  const activateSpinner = document.getElementById('activateSpinner');
  const promoInput = document.getElementById('promoCodeInput');
  const applyPromoBtn = document.getElementById('applyPromoBtn');
  const downgradeBtn = document.getElementById('demoDowngradeBtn');

  if (headerBtn) {
    headerBtn.addEventListener('click', () => openVynlPlusModal());
  }

  [closeBtn, backdrop].forEach(el => {
    el?.addEventListener('click', () => closeVynlPlusModal());
  });

  function selectPlan(planKey, btnEl, text) {
    selectedPlanTier = planKey;
    [btnPlan99, btnPlan799, btnPlan699].forEach(b => b?.classList.remove('active-plan-btn'));
    btnEl?.classList.add('active-plan-btn');
    if (activateBtnText) activateBtnText.textContent = text;
  }

  if (btnPlan99) {
    btnPlan99.addEventListener('click', () => {
      selectPlan('monthly_99', btnPlan99, '👑 Activate Monthly Vibe (₹99/mo)');
    });
  }

  if (btnPlan799) {
    btnPlan799.addEventListener('click', () => {
      selectPlan('annual_799', btnPlan799, '⭐ Activate Annual Pro (₹799/yr)');
    });
  }

  if (btnPlan699) {
    btnPlan699.addEventListener('click', () => {
      selectPlan('founder_699', btnPlan699, '🔥 Claim Founder Lifetime Pass (₹699 One-Time)');
    });
  }

  // Payment methods selection
  document.querySelectorAll('.pay-method-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pay-method-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Promo codes
  if (applyPromoBtn) {
    applyPromoBtn.addEventListener('click', () => {
      const code = promoInput?.value.trim().toUpperCase();
      const validCodes = ['FOUNDER', 'VYNLPLUS', 'VIP', 'FREEPASS', 'PRO', 'UPGRADE', 'GEMINI'];
      if (validCodes.includes(code)) {
        showToast('🎟️ Promo code applied! 100% complimentary pass granted.');
        if (activateBtnText) activateBtnText.textContent = '✨ Claim Complimentary Pass';
        setTimeout(() => upgradeToPlus(code === 'FOUNDER' ? 'founder_699' : 'monthly_99'), 600);
      } else {
        showToast('⚠️ Invalid promo code. Try "FOUNDER", "VYNLPLUS" or "VIP".');
      }
    });
  }

  // Instant Checkout & Activation
  if (activateBtn) {
    activateBtn.addEventListener('click', () => {
      if (activateBtn) activateBtn.disabled = true;
      if (activateSpinner) activateSpinner.classList.remove('hidden');
      if (activateBtnText) activateBtnText.textContent = '⚡ Processing Payment...';

      setTimeout(() => {
        if (activateBtn) activateBtn.disabled = false;
        if (activateSpinner) activateSpinner.classList.add('hidden');
        if (activateBtnText) activateBtnText.textContent = '👑 Activate VYNL+';
        upgradeToPlus(selectedPlanTier);
      }, 900);
    });
  }

  if (downgradeBtn) {
    downgradeBtn.addEventListener('click', () => {
      downgradeToFree();
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

