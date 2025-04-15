/**
 * Supabase Configuration and Database Operations
 * This file handles all interactions with the Supabase backend.
 */

// Supabase configuration - Replace with your own project details
const SUPABASE_URL = 'https://phxqyzgmtsnffcdejuhw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoeHF5emdtdHNuZmZjZGVqdWh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2MzMxOTgsImV4cCI6MjA2MDIwOTE5OH0.YQwcPpFLXbIkJh-RJd1j6HiptemeIOZB0MfYn35ScuQ';

// Database configuration
const TABLE_NAME = 'scores'; // Make sure this matches your Supabase table name

// Initialize the Supabase client (ensure we're using window.supabase)
let supabaseClient = null;

// Initialize variables
let currentUserEmail = '';
let connectionAttempted = false;

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

// Initialize Supabase client when the window loads
function initSupabase() {
  try {
    // Load local scores from localStorage
    loadLocalScores();
    
    // Try to initialize Supabase
    if (window.supabase) {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      supabaseConnected = true;
      console.log('Supabase client initialized successfully');
      
      // Verify if the table exists
      verifyTableAndSetMode();
    } else {
      connectionAttempted = true;
      offlineMode = true;
      console.error('Supabase library not found. Running in offline mode.');
    }
  } catch (error) {
    connectionAttempted = true;
    offlineMode = true;
    console.error('Error initializing Supabase client:', error);
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
 */
async function createTableFromSql() {
  if (!supabaseClient || creatingTable || retryCount >= MAX_RETRIES) return;
  
  creatingTable = true;
  retryCount++;
  
  try {
    console.log(`Attempt ${retryCount}/${MAX_RETRIES} to create scores table...`);
    
    // Execute the SQL
    const { error } = await supabaseClient.rpc('exec_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS public.scores (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            email TEXT NOT NULL,
            score INTEGER NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        );
        
        ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Allow anyone to insert scores" 
            ON public.scores
            FOR INSERT
            TO anon
            WITH CHECK (true);
        
        CREATE POLICY "Allow anyone to read all scores" 
            ON public.scores
            FOR SELECT
            TO anon
            USING (true);
        
        CREATE INDEX IF NOT EXISTS scores_score_desc_idx ON public.scores (score DESC);
      `
    });
    
    if (error) {
      console.error('Failed to create table:', error);
      
      // Retry with execute_sql
      try {
        const { error: execError } = await supabaseClient.rpc('execute_sql', {
          sql_query: `
            CREATE TABLE IF NOT EXISTS public.scores (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                email TEXT NOT NULL,
                score INTEGER NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
            );
            
            ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
            
            CREATE POLICY "Allow anyone to insert scores" 
                ON public.scores
                FOR INSERT
                TO anon
                WITH CHECK (true);
            
            CREATE POLICY "Allow anyone to read all scores" 
                ON public.scores
                FOR SELECT
                TO anon
                USING (true);
          `
        });
        
        if (execError) {
          throw execError;
        }
      } catch (e) {
        console.error('Failed to create table with execute_sql:', e);
        throw e;
      }
    }
    
    // Verify the table was created
    const exists = await checkTableExists();
    
    if (exists) {
      console.log('Table created successfully!');
      tableExists = true;
      offlineMode = false;
      // Try to sync any offline scores now that the table exists
      syncOfflineScores();
      return true;
    } else {
      console.error('Failed to create table. Will run in offline mode.');
      return false;
    }
  } catch (error) {
    console.error('Error creating table:', error);
    return false;
  } finally {
    creatingTable = false;
    
    // If we failed and have retries left, try again after a delay
    if (!tableExists && retryCount < MAX_RETRIES) {
      setTimeout(createTableFromSql, 2000);
    } else if (!tableExists) {
      displayTableSetupInstructions();
    }
  }
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

/**
 * Display instructions for setting up the scores table
 */
function displayTableSetupInstructions() {
  console.error(`Table '${TABLE_NAME}' does not exist in your Supabase project.`);
  console.info('%c IMPORTANT: Leaderboard Setup Instructions', 'font-size: 16px; font-weight: bold; color: blue;');
  console.info('To set up the leaderboard, you need to create the scores table in your Supabase project.');
  console.info('1. Log in to your Supabase dashboard at https://app.supabase.com/');
  console.info('2. Select your project');
  console.info('3. Go to the "SQL Editor" section');
  console.info('4. Create a new query and paste the following SQL:');
  console.info(`%c
CREATE TABLE IF NOT EXISTS public.scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  score INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anyone to insert scores" 
  ON public.scores
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anyone to read all scores" 
  ON public.scores
  FOR SELECT
  TO anon
  USING (true);

CREATE INDEX IF NOT EXISTS scores_score_desc_idx ON public.scores (score DESC);
  `, 'background-color: #f0f0f0; padding: 8px; border-radius: 4px;');
  console.info('5. Click "Run" to execute the SQL and create the table');
  console.info('6. Refresh the game page after creating the table');
  console.info('');
  console.info('%c ADVANCED: Direct PostgreSQL Connection', 'font-size: 16px; font-weight: bold; color: green;');
  console.info('If you prefer to use direct PostgreSQL connection, you can use the following connection string:');
  console.info('postgresql://postgres.phxqyzgmtsnffcdejuhw:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres');
  console.info('Replace [YOUR-PASSWORD] with your actual database password.');
  console.info('Note: Direct PostgreSQL connections should only be used in server-side code, not in the browser.');
  console.info('%c NOTE: Until the table is created, the game will run in offline mode.', 'font-weight: bold; color: orange;');
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

// Initialize on load
window.addEventListener('load', () => {
  initSupabase();
  setupPeriodicTableCheck();
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

/**
 * Submit a score directly to Supabase
 * @param {string} email - Player's email
 * @param {number} score - Score value
 * @returns {Promise<Object>} - Result of the submission
 */
async function submitScoreToSupabase(email, score) {
  if (!supabaseClient || !tableExists) {
    return { success: false, error: 'Supabase not available' };
  }
  
  try {
    // Store current user's email for highlighting in the leaderboard
    currentUserEmail = email;
    
    // Insert the new score record
    console.log(`Inserting score ${score} for ${email} into Supabase table`);
    
    const { data, error } = await supabaseClient
      .from(TABLE_NAME)
      .insert([
        { email, score }
      ])
      .select();
    
    if (error) {
      console.error('Database error when submitting score:', error);
      
      // Check for specific error types
      if (error.code === '42P01') {
        tableExists = false;
        offlineMode = true;
        return { 
          success: false, 
          error: "Table not found. Switched to offline mode." 
        };
      } else if (error.code === '23505') {
        return { 
          success: false, 
          error: "You've already submitted this score." 
        };
      } else if (error.code === '23502') {
        return { 
          success: false, 
          error: "Missing required information (email or score)." 
        };
      } else if (error.message && (error.message.includes('not found') || error.message.includes('does not exist'))) {
        tableExists = false;
        offlineMode = true;
        return { 
          success: false, 
          error: "The scores table doesn't exist. Switched to offline mode." 
        };
      }
      
      throw error;
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Error submitting score to Supabase:', error);
    
    // Handle network errors
    if (error.message && error.message.includes('Failed to fetch')) {
      return { 
        success: false, 
        error: "Network error. Please check your internet connection." 
      };
    }
    
    return { 
      success: false, 
      error: error.message || 'Failed to submit score to Supabase.' 
    };
  }
}

/**
 * Submits a new score to the leaderboard
 * @param {string} email - Player's email address
 * @param {number} score - Player's final score
 * @returns {Promise} - Resolution indicates success/failure of the operation
 */
async function submitScore(email, score) {
  try {
    // Always save locally first for reliability
    saveScoreLocally(email, score);
    
    // Check if we're in offline mode
    const status = getSetupStatus();
    if (!status.online) {
      return { 
        success: true, 
        offlineMode: true,
        message: "Score saved locally. Leaderboard is in offline mode."
      };
    }
    
    // Try to submit to Supabase
    const result = await submitScoreToSupabase(email, score);
    
    if (!result.success) {
      return { 
        success: true, 
        offlineMode: true,
        error: result.error,
        message: "Score saved locally. Will sync to online leaderboard when available."
      };
    }
    
    // Mark the local score as synced
    markScoreAsSynced(email, score);
    
    return { 
      success: true, 
      offlineMode: false,
      data: result.data,
      message: "Score submitted to online leaderboard successfully!"
    };
  } catch (error) {
    console.error('Error in submitScore:', error);
    
    // Fallback to local storage
    return { 
      success: true, 
      offlineMode: true,
      error: error.message,
      message: "Score saved locally. Could not connect to online leaderboard."
    };
  }
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
 * Retrieves the top scores from the leaderboard
 * @param {number} limit - Maximum number of scores to retrieve (default: 10)
 * @returns {Promise} - Resolution contains the leaderboard data
 */
async function getLeaderboard(limit = 10) {
  try {
    // Check if we're in offline mode
    const status = getSetupStatus();
    
    // If offline mode or not ready, return local scores
    if (status.offlineMode || !status.online) {
      return getLocalLeaderboard(limit);
    }
    
    // Get top scores from Supabase
    console.log(`Fetching top ${limit} scores from Supabase`);
    const { data, error } = await supabaseClient
      .from(TABLE_NAME)
      .select('id, email, score, created_at')
      .order('score', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Database error when fetching leaderboard:', error);
      
      // Check for specific error types
      if (error.code === '42P01' || (error.message && error.message.includes('does not exist'))) {
        tableExists = false;
        offlineMode = true;
        
        // Fall back to local leaderboard
        return getLocalLeaderboard(limit);
      }
      
      throw error;
    }
    
    // If we get an empty array but no error, it means the table exists but has no data
    if (!data || data.length === 0) {
      return {
        success: true,
        online: true,
        data: []
      };
    }
    
    return { 
      success: true,
      online: true, 
      data: data.map(entry => ({
        ...entry,
        // Mask the email for privacy (show only first character and domain)
        maskedEmail: maskEmail(entry.email),
        // Flag if this entry belongs to the current user
        isCurrentUser: entry.email === currentUserEmail
      }))
    };
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    
    // Fall back to local leaderboard
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