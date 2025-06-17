/**
 * Supabase Configuration and Database Operations
 * This file handles all interactions with the Supabase backend.
 */

// =====================================================
// SUPABASE CONFIGURATION
// =====================================================
// 🔥 IMPORTANT: Replace these with your actual Supabase project credentials
// Get them from: Supabase Dashboard → Settings → API
const SUPABASE_URL = 'https://rvtjznavtnlumptgpftj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2dGp6bmF2dG5sdW1wdGdwZnRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxOTYzNTMsImV4cCI6MjA2NTc3MjM1M30.NJWhyE5dqtV7Ps1hto1hNw_v6xP3Ix2FaLK_nLq6KGI';

// Database configuration
const TABLE_NAME = 'scores'; // Make sure this matches your Supabase table name

// Initialize the Supabase client (ensure we're using window.supabase)
let supabaseClient = null;

// Initialize variables
let currentUserEmail = '';
let connectionAttempted = false;

// =====================================================
// CONNECTION STATUS & CONFIGURATION
// =====================================================
// Status flags
let tableExists = false;
let supabaseConnected = false;
let creatingTable = false;

// Offline mode support  
let offlineMode = false;
let localScores = [];

// Connection retry settings
const MAX_RETRIES = 3;
let retryCount = 0;
let lastCheckTime = 0;

// Network monitoring
let isOnline = navigator.onLine;
let connectionQuality = 'unknown'; // 'good', 'poor', 'offline'
let lastSuccessfulRequest = null;

// User feedback system
const FEEDBACK_MESSAGES = {
  CONNECTING: 'Connecting to leaderboard...',
  CONNECTED: 'Connected to online leaderboard!',
  OFFLINE: 'Playing offline - scores saved locally',
  SYNC_SUCCESS: 'Score synced to online leaderboard!',
  SYNC_FAILED: 'Score saved locally, will sync when online',
  RATE_LIMITED: 'Too many submissions. Please wait before submitting again.',
  INVALID_SCORE: 'Invalid score detected. Please play fairly.',
  NETWORK_ERROR: 'Network connection issues. Scores saved locally.'
};

// =====================================================
// INITIALIZATION & NETWORK MONITORING
// =====================================================

// Initialize Supabase client when the window loads
function initSupabase() {
  try {
    console.log('🚀 Initializing Supabase integration...');
    
    // Load local scores from localStorage
    loadLocalScores();
    
    // Set up network monitoring
    setupNetworkMonitoring();
    
    // Validate configuration
    if (!SUPABASE_URL.startsWith('https://') || SUPABASE_URL.includes('YOUR_SUPABASE')) {
      throw new Error('Supabase URL not configured. Please update SUPABASE_URL with your project URL.');
    }
    
    if (!SUPABASE_ANON_KEY.startsWith('eyJ') || SUPABASE_ANON_KEY.includes('YOUR_SUPABASE')) {
      throw new Error('Supabase API key not configured. Please update SUPABASE_ANON_KEY with your anon key.');
    }
    
    // Try to initialize Supabase
    if (window.supabase) {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      supabaseConnected = true;
      console.log('✅ Supabase client initialized successfully');
      
      // Verify if the table exists
      verifyTableAndSetMode();
    } else {
      throw new Error('Supabase library not loaded. Check if the CDN is accessible.');
    }
  } catch (error) {
    connectionAttempted = true;
    offlineMode = true;
    console.error('❌ Supabase initialization failed:', error.message);
    displayUserFeedback(FEEDBACK_MESSAGES.OFFLINE);
    
    // Still provide helpful instructions
    if (error.message.includes('not configured')) {
      displayConfigurationInstructions();
    }
  }
}

/**
 * Set up network connection monitoring
 */
function setupNetworkMonitoring() {
  // Monitor online/offline status
  window.addEventListener('online', () => {
    isOnline = true;
    console.log('📶 Network connection restored');
    if (offlineMode && supabaseConnected) {
      // Try to reconnect and sync
      setTimeout(verifyTableAndSetMode, 1000);
    }
  });
  
  window.addEventListener('offline', () => {
    isOnline = false;
    connectionQuality = 'offline';
    console.log('📵 Network connection lost - switching to offline mode');
    displayUserFeedback(FEEDBACK_MESSAGES.OFFLINE);
  });
  
  // Test connection quality periodically
  setInterval(testConnectionQuality, 30000); // Every 30 seconds
}

/**
 * Test network connection quality
 */
async function testConnectionQuality() {
  if (!isOnline || !supabaseConnected) return;
  
  const startTime = Date.now();
  try {
    // Simple ping test to Supabase
    const { error } = await supabaseClient
      .from(TABLE_NAME)
      .select('id')
      .limit(1);
    
    const responseTime = Date.now() - startTime;
    
    if (error) {
      connectionQuality = 'poor';
    } else {
      connectionQuality = responseTime < 1000 ? 'good' : 'poor';
      lastSuccessfulRequest = Date.now();
    }
  } catch (e) {
    connectionQuality = 'poor';
  }
}

/**
 * Verify if the table exists and set the appropriate mode
 */
async function verifyTableAndSetMode() {
  try {
    const exists = await checkTableExists();
    tableExists = exists;
    connectionAttempted = true;
    
    if (!exists) {
      console.log(`Table '${TABLE_NAME}' does not exist. Switching to offline mode.`);
      offlineMode = true;
      
      // Try to create the table using supabase_setup.sql
      createTableFromSql();
    } else {
      console.log(`Table '${TABLE_NAME}' verified. Online mode active.`);
      offlineMode = false;
      // Try to sync any offline scores
      syncOfflineScores();
    }
  } catch (error) {
    connectionAttempted = true;
    offlineMode = true;
    console.error('Error verifying table:', error);
  }
}

/**
 * Create table using the SQL from supabase_setup.sql
 * NOTE: This function cannot create tables from the client side.
 * Tables must be created manually in the Supabase dashboard.
 */
async function createTableFromSql() {
  // Tables cannot be created from client-side code for security reasons
  // Display setup instructions immediately
  displayTableSetupInstructions();
  return false;
}

/**
 * Load scores saved in localStorage
 */
function loadLocalScores() {
  try {
    const savedScores = localStorage.getItem('flappyBirdScores');
    if (savedScores) {
      localScores = JSON.parse(savedScores);
      console.log(`Loaded ${localScores.length} local scores`);
    }
  } catch (e) {
    console.error('Error loading local scores:', e);
    localScores = [];
  }
}

/**
 * Save scores to localStorage
 */
function saveLocalScores() {
  try {
    localStorage.setItem('flappyBirdScores', JSON.stringify(localScores));
  } catch (e) {
    console.error('Error saving local scores:', e);
  }
}

/**
 * Periodically check if Supabase table exists and switch to online mode if it does
 */
function setupPeriodicTableCheck() {
  // Check every 30 seconds if we're in offline mode
  setInterval(() => {
    const now = Date.now();
    // Only check if we're in offline mode and at least 30 seconds have passed since last check
    if (offlineMode && tableExists === false && now - lastCheckTime > 30000) {
      lastCheckTime = now;
      verifyTableAndSetMode();
    }
  }, 30000);
}

/**
 * Try to sync offline scores with the server when online
 */
async function syncOfflineScores() {
  if (!tableExists || !supabaseConnected || localScores.length === 0) return;
  
  console.log(`Attempting to sync ${localScores.length} offline scores...`);
  
  // Filter to scores that haven't been synced yet
  const unsynced = localScores.filter(score => !score.synced);
  
  if (unsynced.length === 0) {
    console.log('No offline scores to sync');
    return;
  }
  
  // Try to submit each score
  let syncedCount = 0;
  
  for (const score of unsynced) {
    try {
      const { success } = await submitScoreToSupabase(score.email, score.score);
      
      if (success) {
        // Mark as synced
        score.synced = true;
        syncedCount++;
      }
    } catch (e) {
      console.error('Error syncing score:', e);
    }
  }
  
  console.log(`Synced ${syncedCount} of ${unsynced.length} offline scores`);
  saveLocalScores();
}

// =====================================================
// USER FEEDBACK & SETUP FUNCTIONS
// =====================================================

/**
 * Display user feedback messages in the UI and console
 */
function displayUserFeedback(message, type = 'info') {
  // Console logging with emojis for better visibility
  const emoji = {
    'info': 'ℹ️',
    'success': '✅',
    'warning': '⚠️',
    'error': '❌'
  };
  
  console.log(`${emoji[type]} ${message}`);
  
  // Try to display in UI if submission status element exists
  const statusElement = document.getElementById('submissionStatus');
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.className = `info ${type}`;
    
    // Auto-clear after 5 seconds unless it's an error
    if (type !== 'error') {
      setTimeout(() => {
        if (statusElement.textContent === message) {
          statusElement.textContent = '';
        }
      }, 5000);
    }
  }
}

/**
 * Display configuration instructions
 */
function displayConfigurationInstructions() {
  console.info('%c 🔧 CONFIGURATION REQUIRED', 'font-size: 16px; font-weight: bold; color: orange;');
  console.info('Your Supabase credentials need to be configured in supabase.js');
  console.info('1. Go to https://app.supabase.com/');
  console.info('2. Select your project → Settings → API');
  console.info('3. Copy your Project URL and anon/public key');
  console.info('4. Update SUPABASE_URL and SUPABASE_ANON_KEY in supabase.js');
}

/**
 * Display instructions for setting up the scores table
 */
function displayTableSetupInstructions() {
  console.error(`❌ Table '${TABLE_NAME}' does not exist in your Supabase project.`);
  console.info('%c 📋 DATABASE SETUP REQUIRED', 'font-size: 16px; font-weight: bold; color: blue;');
  console.info('Follow these steps to set up your leaderboard database:');
  console.info('');
  console.info('1. 🌐 Go to https://app.supabase.com/');
  console.info('2. 🎯 Select your project');
  console.info('3. 📝 Go to "SQL Editor" in the left sidebar');
  console.info('4. ➕ Click "New Query"');
  console.info('5. 📋 Copy and paste the complete SQL from supabase_setup.sql');
  console.info('6. ▶️ Click "Run" to execute the setup');
  console.info('7. 🔄 Refresh this page after setup is complete');
  console.info('');
  console.info('%c 💡 The setup includes security, performance optimizations, and data validation!', 'font-weight: bold; color: green;');
  console.info('%c ⏳ Until setup is complete, the game runs in offline mode.', 'font-weight: bold; color: orange;');
}

/**
 * Check if the required table exists in the Supabase database
 * @returns {Promise<boolean>} Whether the table exists
 */
async function checkTableExists() {
  if (!supabaseClient) return false;
  
  try {
    // Try to query the table structure to see if it exists
    const { data, error } = await supabaseClient
      .from(TABLE_NAME)
      .select('id')
      .limit(1);
    
    // If there's no error, the table exists
    return !error;
  } catch (error) {
    console.error(`Error checking if table '${TABLE_NAME}' exists:`, error);
    return false;
  }
}

// =====================================================
// APPLICATION INITIALIZATION
// =====================================================

// Initialize on load
window.addEventListener('load', () => {
  console.log('🎮 Flappy Bird Leaderboard System Initializing...');
  
  // Start initialization process
  initSupabase();
  setupPeriodicTableCheck();
  
  // Show initialization status after a brief delay
  setTimeout(() => {
    const status = getSetupStatus();
    console.log('📊 Setup Status:', status);
    
    if (status.online) {
      console.log('🌐 Online leaderboard active!');
    } else {
      console.log('📱 Running in offline mode');
    }
  }, 2000);
});

/**
 * Check if the setup is ready for online operation
 * @returns {Object} - Status with detailed feedback
 */
function getSetupStatus() {
  if (!connectionAttempted) {
    return {
      ready: false,
      online: false,
      offlineMode: false,
      tableExists: false,
      error: 'Still initializing connection to Supabase...'
    };
  }
  
  if (offlineMode) {
    return {
      ready: true,
      online: false,
      offlineMode: true,
      tableExists: tableExists,
      error: supabaseConnected 
        ? 'The scores table does not exist in Supabase. Running in offline mode.' 
        : 'Could not connect to Supabase. Running in offline mode.'
    };
  }
  
  if (!supabaseConnected) {
    return {
      ready: false,
      online: false,
      offlineMode: true,
      tableExists: false,
      error: 'Failed to connect to Supabase. Running in offline mode.'
    };
  }
  
  if (!tableExists) {
    return {
      ready: false,
      online: false,
      offlineMode: true,
      tableExists: false,
      error: `The '${TABLE_NAME}' table doesn't exist in your Supabase database. Running in offline mode.`
    };
  }
  
  return {
    ready: true,
    online: true,
    offlineMode: false,
    tableExists: true,
    error: null
  };
}

// =====================================================
// ENHANCED SCORE SUBMISSION WITH VALIDATION
// =====================================================

/**
 * Validate score and email before submission
 * @param {string} email - Player's email
 * @param {number} score - Score value
 * @returns {Object} - Validation result
 */
function validateScoreSubmission(email, score) {
  const errors = [];
  
  // Email validation
  if (!email || typeof email !== 'string') {
    errors.push('Email is required');
  } else if (!isValidEmail(email)) {
    errors.push('Invalid email format');
  }
  
  // Score validation
  if (typeof score !== 'number' || isNaN(score)) {
    errors.push('Score must be a valid number');
  } else if (score < 0) {
    errors.push('Score cannot be negative');
  } else if (score > 10000) {
    errors.push('Score seems unrealistic (max: 10000)');
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

/**
 * Submit a score directly to Supabase with comprehensive error handling
 * @param {string} email - Player's email
 * @param {number} score - Score value
 * @returns {Promise<Object>} - Result of the submission
 */
async function submitScoreToSupabase(email, score) {
  // Pre-submission validation
  const validation = validateScoreSubmission(email, score);
  if (!validation.isValid) {
    return { 
      success: false, 
      error: validation.errors.join(', '),
      type: 'validation' 
    };
  }
  
  if (!supabaseClient || !tableExists) {
    return { 
      success: false, 
      error: 'Database not available', 
      type: 'connection' 
    };
  }
  
  // Check network connectivity
  if (!isOnline) {
    return { 
      success: false, 
      error: FEEDBACK_MESSAGES.NETWORK_ERROR,
      type: 'network' 
    };
  }
  
  try {
    // Store current user's email for highlighting in the leaderboard
    currentUserEmail = email;
    
    // Show progress feedback
    displayUserFeedback('Submitting score to leaderboard...', 'info');
    
    console.log(`📤 Submitting score ${score} for ${email}...`);
    
    const startTime = Date.now();
    const { data, error } = await supabaseClient
      .from(TABLE_NAME)
      .insert([{ email, score }])
      .select();
    
    const responseTime = Date.now() - startTime;
    console.log(`⏱️ Submission completed in ${responseTime}ms`);
    
    if (error) {
      console.error('❌ Database error:', error);
      
      // Handle specific database errors with user-friendly messages
      if (error.code === '42P01') {
        tableExists = false;
        offlineMode = true;
        return { 
          success: false, 
          error: "Database table not found. Switched to offline mode.",
          type: 'database' 
        };
      } else if (error.code === '23505') {
        return { 
          success: false, 
          error: "Duplicate score detected. Each score can only be submitted once.",
          type: 'duplicate' 
        };
      } else if (error.code === '23502') {
        return { 
          success: false, 
          error: "Missing required information.",
          type: 'validation' 
        };
      } else if (error.message && error.message.includes('check constraint')) {
        return { 
          success: false, 
          error: FEEDBACK_MESSAGES.INVALID_SCORE,
          type: 'validation' 
        };
      } else if (error.message && error.message.includes('policy')) {
        return { 
          success: false, 
          error: FEEDBACK_MESSAGES.RATE_LIMITED,
          type: 'rate_limit' 
        };
      } else if (error.message && (error.message.includes('not found') || error.message.includes('does not exist'))) {
        tableExists = false;
        offlineMode = true;
        return { 
          success: false, 
          error: "Database table not found. Switched to offline mode.",
          type: 'database' 
        };
      }
      
      throw error;
    }
    
    // Success!
    lastSuccessfulRequest = Date.now();
    console.log('✅ Score submitted successfully!', data);
    displayUserFeedback(FEEDBACK_MESSAGES.SYNC_SUCCESS, 'success');
    
    return { 
      success: true, 
      data: data,
      responseTime: responseTime 
    };
    
  } catch (error) {
    console.error('❌ Submission error:', error);
    
    // Handle network and connection errors
    if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
      connectionQuality = 'poor';
      return { 
        success: false, 
        error: FEEDBACK_MESSAGES.NETWORK_ERROR,
        type: 'network' 
      };
    } else if (error.name === 'AbortError') {
      return { 
        success: false, 
        error: "Request timed out. Please try again.",
        type: 'timeout' 
      };
    }
    
    return { 
      success: false, 
      error: error.message || 'An unexpected error occurred while submitting your score.',
      type: 'unknown' 
    };
  }
}

/**
 * Main score submission function with comprehensive error handling
 * @param {string} email - Player's email address
 * @param {number} score - Player's final score
 * @returns {Promise<Object>} - Detailed result of the submission operation
 */
async function submitScore(email, score) {
  try {
    console.log(`🎯 Starting score submission: ${score} for ${email}`);
    
    // Always save locally first for reliability
    saveScoreLocally(email, score);
    displayUserFeedback('Score saved locally...', 'info');
    
    // Check if we're in offline mode or if setup is incomplete
    const status = getSetupStatus();
    if (!status.online) {
      displayUserFeedback(FEEDBACK_MESSAGES.OFFLINE, 'warning');
      return { 
        success: true, 
        offlineMode: true,
        message: FEEDBACK_MESSAGES.OFFLINE,
        localRank: getLocalRank(email, score)
      };
    }
    
    // Try to submit to Supabase
    displayUserFeedback('Connecting to online leaderboard...', 'info');
    const result = await submitScoreToSupabase(email, score);
    
    if (!result.success) {
      // Handle different types of errors appropriately
      const errorType = result.type || 'unknown';
      
      if (errorType === 'rate_limit') {
        displayUserFeedback(result.error, 'warning');
        return {
          success: false,
          offlineMode: false,
          error: result.error,
          message: result.error
        };
      } else if (errorType === 'validation') {
        displayUserFeedback(result.error, 'error');
        return {
          success: false,
          offlineMode: false,
          error: result.error,
          message: result.error
        };
      } else {
        // Network or database issues - fall back to offline mode
        displayUserFeedback(FEEDBACK_MESSAGES.SYNC_FAILED, 'warning');
        return { 
          success: true, 
          offlineMode: true,
          error: result.error,
          message: FEEDBACK_MESSAGES.SYNC_FAILED,
          localRank: getLocalRank(email, score)
        };
      }
    }
    
    // Success! Mark the local score as synced
    markScoreAsSynced(email, score);
    
    return { 
      success: true, 
      offlineMode: false,
      data: result.data,
      message: FEEDBACK_MESSAGES.SYNC_SUCCESS,
      responseTime: result.responseTime
    };
    
  } catch (error) {
    console.error('❌ Unexpected error in submitScore:', error);
    
    // Fallback to local storage with error details
    displayUserFeedback(FEEDBACK_MESSAGES.SYNC_FAILED, 'warning');
    return { 
      success: true, 
      offlineMode: true,
      error: error.message,
      message: FEEDBACK_MESSAGES.SYNC_FAILED,
      localRank: getLocalRank(email, score)
    };
  }
}

/**
 * Get the rank of a score in the local leaderboard
 * @param {string} email - Player's email
 * @param {number} score - Score value
 * @returns {number} - Rank in local leaderboard
 */
function getLocalRank(email, score) {
  const sortedScores = [...localScores].sort((a, b) => b.score - a.score);
  const rank = sortedScores.findIndex(s => s.email === email && s.score === score) + 1;
  return rank || localScores.length + 1;
}

/**
 * Save a score to local storage
 * @param {string} email - Player's email
 * @param {number} score - Score value
 */
function saveScoreLocally(email, score) {
  // Set current user email
  currentUserEmail = email;
  
  // Add the score to local storage
  localScores.push({
    id: generateLocalId(),
    email: email,
    score: score,
    created_at: new Date().toISOString(),
    synced: false
  });
  
  // Sort by score (highest first)
  localScores.sort((a, b) => b.score - a.score);
  
  // Limit to top 100 scores
  if (localScores.length > 100) {
    localScores = localScores.slice(0, 100);
  }
  
  // Save to localStorage
  saveLocalScores();
  
  console.log(`Score ${score} for ${email} saved locally`);
}

/**
 * Mark a locally stored score as synced with the server
 * @param {string} email - Player's email
 * @param {number} score - Score value
 */
function markScoreAsSynced(email, score) {
  // Find the matching score
  const scoreEntry = localScores.find(s => 
    s.email === email && s.score === score && !s.synced);
  
  if (scoreEntry) {
    scoreEntry.synced = true;
    saveLocalScores();
  }
}

/**
 * Generate a unique ID for local scores
 * @returns {string} - A unique ID
 */
function generateLocalId() {
  return 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Retrieves the top scores from the leaderboard with enhanced error handling
 * @param {number} limit - Maximum number of scores to retrieve (default: 10)
 * @returns {Promise<Object>} - Comprehensive leaderboard data with metadata
 */
async function getLeaderboard(limit = 10) {
  try {
    console.log(`🏆 Fetching leaderboard (limit: ${limit})`);
    
    // Check if we're in offline mode
    const status = getSetupStatus();
    
    // If offline mode or not ready, return local scores
    if (status.offlineMode || !status.online) {
      console.log('📱 Using local leaderboard');
      return getLocalLeaderboard(limit);
    }
    
    // Check network connectivity
    if (!isOnline) {
      console.log('📵 No network connection, using local leaderboard');
      return getLocalLeaderboard(limit);
    }
    
    // Get top scores from Supabase using optimized function
    console.log(`🌐 Fetching top ${limit} scores from online database...`);
    const startTime = Date.now();
    
    let data, error;
    
    // Try to use the optimized function first
    try {
      const result = await supabaseClient.rpc('get_top_scores', { limit_count: limit });
      data = result.data;
      error = result.error;
    } catch (rpcError) {
      // Fall back to regular table query if RPC function doesn't exist
      console.log('🔄 RPC function not available, using direct table query');
      const result = await supabaseClient
        .from(TABLE_NAME)
        .select('id, email, score, created_at')
        .order('score', { ascending: false })
        .order('created_at', { ascending: true }) // Tie-breaker: earlier submission wins
        .limit(limit);
      
      data = result.data;
      error = result.error;
    }
    
    const responseTime = Date.now() - startTime;
    console.log(`⏱️ Leaderboard fetched in ${responseTime}ms`);
    
    if (error) {
      console.error('❌ Database error when fetching leaderboard:', error);
      
      // Check for specific error types
      if (error.code === '42P01' || (error.message && error.message.includes('does not exist'))) {
        tableExists = false;
        offlineMode = true;
        console.log('🔄 Table not found, switching to offline mode');
        return getLocalLeaderboard(limit);
      }
      
      // For other errors, still fall back to local
      console.log('🔄 Database error, falling back to local leaderboard');
      return getLocalLeaderboard(limit);
    }
    
    // Update connection quality based on response time
    connectionQuality = responseTime < 1000 ? 'good' : 'poor';
    lastSuccessfulRequest = Date.now();
    
    // If we get an empty array but no error, it means the table exists but has no data
    if (!data || data.length === 0) {
      console.log('📊 Online leaderboard is empty');
      return {
        success: true,
        online: true,
        data: [],
        responseTime: responseTime,
        connectionQuality: connectionQuality
      };
    }
    
    console.log(`✅ Successfully fetched ${data.length} scores from online leaderboard`);
    
    return { 
      success: true,
      online: true, 
      data: data.map((entry, index) => ({
        ...entry,
        // Add rank if not provided by RPC function
        rank: entry.rank || (index + 1),
        // Mask the email for privacy
        maskedEmail: maskEmail(entry.email),
        // Flag if this entry belongs to the current user
        isCurrentUser: entry.email === currentUserEmail
      })),
      responseTime: responseTime,
      connectionQuality: connectionQuality,
      totalScores: data.length
    };
    
  } catch (error) {
    console.error('❌ Error fetching leaderboard:', error);
    
    // Update connection quality
    connectionQuality = 'poor';
    
    // Fall back to local leaderboard
    console.log('🔄 Falling back to local leaderboard due to error');
    return getLocalLeaderboard(limit);
  }
}

/**
 * Get the leaderboard from local scores
 * @param {number} limit - Maximum number of scores to return
 * @returns {Object} - Leaderboard data from local storage
 */
function getLocalLeaderboard(limit = 10) {
  console.log(`Getting local leaderboard (limit: ${limit})`);
  
  // If no local scores, return empty array
  if (!localScores || localScores.length === 0) {
    return {
      success: true,
      online: false,
      offlineMode: true,
      data: []
    };
  }
  
  // Return top scores
  return {
    success: true,
    online: false,
    offlineMode: true,
    data: localScores
      .slice(0, limit)
      .map(entry => ({
        ...entry,
        maskedEmail: maskEmail(entry.email),
        isCurrentUser: entry.email === currentUserEmail
      }))
  };
}

/**
 * Masks an email address for privacy
 * @param {string} email - The full email address
 * @returns {string} - The masked email (e.g., j***@example.com)
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  
  const [username, domain] = email.split('@');
  if (!username || !domain) return email;
  
  // Show first character, mask the rest of the username
  const maskedUsername = username.charAt(0) + 
    '*'.repeat(Math.min(username.length - 1, 3));
    
  return `${maskedUsername}@${domain}`;
}

/**
 * Validates an email address format
 * @param {string} email - The email address to validate
 * @returns {boolean} - Whether the email is valid
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if the Supabase client is properly initialized
 * @returns {boolean} - Whether the client is ready to use
 */
function isSupabaseClientInitialized() {
  return supabaseConnected;
}

// =====================================================
// UTILITY FUNCTIONS FOR LEADERBOARD MANAGEMENT  
// =====================================================

/**
 * Clear all local scores (for maintenance/testing)
 * @returns {boolean} - Whether scores were cleared
 */
function clearLocalScores() {
  const count = localScores.length;
  localScores = [];
  saveLocalScores();
  console.log(`🗑️ Cleared ${count} local scores`);
  return count > 0;
}

/**
 * Get comprehensive statistics about local scores
 * @returns {Object} - Statistics object
 */
function getLocalStats() {
  if (localScores.length === 0) {
    return { totalScores: 0, highestScore: 0, averageScore: 0, uniqueEmails: 0 };
  }
  
  const scores = localScores.map(s => s.score);
  const emails = [...new Set(localScores.map(s => s.email))];
  
  return {
    totalScores: localScores.length,
    highestScore: Math.max(...scores),
    lowestScore: Math.min(...scores),
    averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    uniqueEmails: emails.length,
    syncedScores: localScores.filter(s => s.synced).length,
    unsyncedScores: localScores.filter(s => !s.synced).length
  };
}