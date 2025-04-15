/**
 * Leaderboard Integration for Flappy Bird
 * This file handles UI interactions and integrates the leaderboard with the game.
 */

// DOM Elements
let leaderboardModal;
let leaderboardTable;
let leaderboardBody;
let leaderboardLoading;
let submitScoreModal;
let finalScoreDisplay;
let playerEmailInput;
let emailError;
let submitForm;
let submissionStatus;
let closeButtons;
let playAgainButton;
let skipSubmitButton;
let submitScoreButton;

// State tracking
let hasSubmittedScore = false;
let offlineIndicatorAdded = false;

/**
 * Initialize leaderboard UI elements and event listeners
 * This function is called when the DOM is fully loaded
 */
document.addEventListener('DOMContentLoaded', function() {
  // Get DOM elements
  leaderboardModal = document.getElementById('leaderboardModal');
  leaderboardTable = document.getElementById('leaderboardTable');
  leaderboardBody = document.getElementById('leaderboardBody');
  leaderboardLoading = document.getElementById('leaderboardLoading');
  submitScoreModal = document.getElementById('submitScoreModal');
  finalScoreDisplay = document.getElementById('finalScoreDisplay');
  playerEmailInput = document.getElementById('playerEmail');
  emailError = document.getElementById('emailError');
  submitForm = document.getElementById('scoreSubmitForm');
  submissionStatus = document.getElementById('submissionStatus');
  closeButtons = document.getElementsByClassName('close-button');
  playAgainButton = document.getElementById('playAgainButton');
  skipSubmitButton = document.getElementById('skipSubmitButton');
  submitScoreButton = document.getElementById('submitScoreButton');

  // Set up event listeners
  setupEventListeners();
});

/**
 * Check if Supabase client is properly initialized
 * @returns {boolean} Whether the Supabase client is available
 */
function isSupabaseAvailable() {
  // Use the function from supabase.js if available
  if (typeof isSupabaseClientInitialized === 'function') {
    return isSupabaseClientInitialized();
  }
  // Fallback check
  return typeof supabaseClient !== 'undefined' && supabaseClient !== null;
}

/**
 * Set up all UI event listeners
 */
function setupEventListeners() {
  // Close buttons for modals
  for (let i = 0; i < closeButtons.length; i++) {
    closeButtons[i].addEventListener('click', function() {
      leaderboardModal.style.display = 'none';
      submitScoreModal.style.display = 'none';
    });
  }

  // Play Again button
  if (playAgainButton) {
    playAgainButton.addEventListener('click', function() {
      leaderboardModal.style.display = 'none';
      restartGame();
    });
  }

  // Skip submission button
  if (skipSubmitButton) {
    skipSubmitButton.addEventListener('click', function() {
      submitScoreModal.style.display = 'none';
      showLeaderboard();
    });
  }

  // Form submission
  if (submitForm) {
    submitForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const email = playerEmailInput.value.trim();
      
      // Validate email
      if (!isValidEmail(email)) {
        emailError.textContent = 'Please enter a valid email address';
        return;
      }
      
      emailError.textContent = '';
      handleScoreSubmission(email);
    });
  }

  // Email validation on input
  if (playerEmailInput) {
    playerEmailInput.addEventListener('input', function() {
      const email = playerEmailInput.value.trim();
      if (email && !isValidEmail(email)) {
        emailError.textContent = 'Please enter a valid email address';
      } else {
        emailError.textContent = '';
      }
    });
  }

  // Close modals when clicking outside
  window.addEventListener('click', function(event) {
    if (event.target === leaderboardModal) {
      leaderboardModal.style.display = 'none';
    }
    if (event.target === submitScoreModal) {
      submitScoreModal.style.display = 'none';
    }
  });
}

/**
 * Shows the score submission form with the player's final score
 * @param {number} score - The player's final score
 */
function showScoreSubmissionForm(score) {
  // Check if Supabase is available
  const isOnline = isSupabaseAvailable();
  
  // Reset state
  hasSubmittedScore = false;
  
  // Try to get saved email from localStorage
  const savedEmail = localStorage.getItem('playerEmail');
  
  if (playerEmailInput) {
    playerEmailInput.value = savedEmail || '';
    playerEmailInput.focus();
  }
  
  if (emailError) {
    emailError.textContent = '';
  }
  
  if (submissionStatus) {
    submissionStatus.textContent = isOnline ? '' : 'Leaderboard is in offline mode. Your score will be saved locally.';
    submissionStatus.className = isOnline ? '' : 'info';
  }
  
  // Display the score
  if (finalScoreDisplay) {
    finalScoreDisplay.textContent = `Your Score: ${score}`;
  }
  
  // Update button text if offline
  if (skipSubmitButton) {
    skipSubmitButton.textContent = isOnline ? 'Skip' : 'Continue';
  }
  
  // Show the modal
  if (submitScoreModal) {
    submitScoreModal.style.display = 'block';
  }
}

/**
 * Shows the leaderboard with the latest scores
 */
async function showLeaderboard() {
  if (!leaderboardModal || !leaderboardTable || !leaderboardBody || !leaderboardLoading) {
    console.error('Leaderboard elements not found in the DOM');
    return;
  }
  
  // Reset state
  offlineIndicatorAdded = false;
  
  // Clear previous entries
  leaderboardBody.innerHTML = '';
  
  // Remove any existing offline indicators
  const existingIndicators = document.querySelectorAll('.offline-indicator');
  existingIndicators.forEach(indicator => indicator.remove());
  
  // Show loading indicator
  leaderboardLoading.style.display = 'block';
  leaderboardLoading.innerHTML = 'Loading leaderboard...';
  leaderboardLoading.style.color = '#000';
  leaderboardTable.style.display = 'none';
  leaderboardModal.style.display = 'block';
  
  try {
    // Get the leaderboard data
    const result = await getLeaderboard();
    
    // Hide loading indicator
    leaderboardLoading.style.display = 'none';
    
    if (result.success) {
      // Setup the header based on mode
      const leaderboardTitle = document.querySelector('#leaderboardModal h2');
      if (leaderboardTitle) {
        leaderboardTitle.textContent = result.online ? 'Online Leaderboard' : 'Local Leaderboard';
      }
      
      // Show offline mode indicator if needed and not already added
      if (!result.online && !offlineIndicatorAdded) {
        addOfflineIndicator();
      }
      
      // Populate the table
      leaderboardTable.style.display = 'table';
      populateLeaderboardTable(result.data);
    } else {
      // Handle error
      leaderboardLoading.style.display = 'block';
      leaderboardLoading.innerHTML = result.error || 'Failed to load leaderboard';
      leaderboardLoading.style.color = '#d9534f'; // Red color for error
    }
  } catch (error) {
    console.error('Error showing leaderboard:', error);
    leaderboardLoading.style.display = 'block';
    leaderboardLoading.innerHTML = 'Failed to load leaderboard. Please try again.';
    leaderboardLoading.style.color = '#d9534f'; // Red color for error
  }
}

/**
 * Add an offline indicator to the leaderboard modal
 */
function addOfflineIndicator() {
  if (offlineIndicatorAdded || !leaderboardLoading || !leaderboardLoading.parentNode) return;
  
  const offlineIndicator = document.createElement('div');
  offlineIndicator.className = 'offline-indicator';
  offlineIndicator.innerHTML = 'Playing in offline mode. Scores are saved locally.<br>To enable online leaderboard, please set up Supabase (see console for instructions).';
  
  leaderboardLoading.parentNode.insertBefore(offlineIndicator, leaderboardLoading);
  offlineIndicatorAdded = true;
}

/**
 * Populates the leaderboard table with player data
 * @param {Array} entries - Array of leaderboard entries
 */
function populateLeaderboardTable(entries) {
  if (!leaderboardBody) return;
  
  leaderboardBody.innerHTML = '';
  
  if (!entries || entries.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.textContent = 'No scores submitted yet. Be the first!';
    cell.style.textAlign = 'center';
    cell.style.padding = '20px';
    row.appendChild(cell);
    leaderboardBody.appendChild(row);
    return;
  }
  
  entries.forEach((entry, index) => {
    const row = document.createElement('tr');
    
    // Add current-player class if this is the current user
    if (entry.isCurrentUser) {
      row.classList.add('current-player');
    }
    
    // Rank column
    const rankCell = document.createElement('td');
    rankCell.textContent = index + 1;
    row.appendChild(rankCell);
    
    // Player column (masked email)
    const playerCell = document.createElement('td');
    playerCell.textContent = entry.maskedEmail || 'Anonymous';
    row.appendChild(playerCell);
    
    // Score column
    const scoreCell = document.createElement('td');
    scoreCell.textContent = entry.score;
    row.appendChild(scoreCell);
    
    // Date column
    const dateCell = document.createElement('td');
    dateCell.textContent = formatDate(entry.created_at);
    row.appendChild(dateCell);
    
    leaderboardBody.appendChild(row);
  });
}

/**
 * Formats a date string to a more readable format
 * @param {string} dateString - ISO date string
 * @returns {string} - Formatted date string (e.g., "Jun 15, 2023")
 */
function formatDate(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  
  const options = { month: 'short', day: 'numeric', year: 'numeric' };
  return date.toLocaleDateString(undefined, options);
}

/**
 * Adds leaderboard buttons to game screens
 * This function is called from the sketch.js file
 */
function addLeaderboardButtons() {
  // This function is a hook for the main game code to call
}

/**
 * Restarts the game
 * This function is called when clicking Play Again
 */
function restartGame() {
  // This function is implemented in sketch.js and will be called from there
  if (typeof resetGame === 'function') {
    resetGame();
    if (typeof gameState !== 'undefined') {
      gameState = 'playing';
    }
  }
}

/**
 * Save the current email to localStorage for future use
 * @param {string} email - The email to save
 */
function saveCurrentEmail(email) {
  if (email && isValidEmail(email)) {
    localStorage.setItem('playerEmail', email);
  }
}

/**
 * Handles the submission of a player's score
 * @param {string} email - The player's email address
 */
async function handleScoreSubmission(email) {
  if (hasSubmittedScore) return;
  
  // Save email for future use
  saveCurrentEmail(email);
  
  // Update UI for submission in progress
  if (submitScoreButton) {
    submitScoreButton.disabled = true;
    submitScoreButton.textContent = 'Submitting...';
  }
  
  if (submissionStatus) {
    submissionStatus.textContent = 'Submitting your score...';
    submissionStatus.className = '';
  }
  
  // Get the score value
  let score = 0;
  if (finalScoreDisplay) {
    const scoreText = finalScoreDisplay.textContent || '';
    score = parseInt(scoreText.replace(/\D/g, ''), 10) || 0;
  }
  
  try {
    // Submit the score
    const result = await submitScore(email, score);
    
    hasSubmittedScore = true;
    
    if (submissionStatus) {
      submissionStatus.textContent = result.message || 'Score submitted successfully!';
      submissionStatus.className = result.offlineMode ? 'info' : 'success';
    }
    
    // Wait briefly, then show the leaderboard
    setTimeout(() => {
      if (submitScoreModal) {
        submitScoreModal.style.display = 'none';
      }
      showLeaderboard();
    }, 1500);
  } catch (error) {
    console.error('Error submitting score:', error);
    
    if (submissionStatus) {
      submissionStatus.textContent = error.message || 'Failed to submit score. Please try again.';
      submissionStatus.className = 'error';
    }
  } finally {
    // Re-enable submit button
    if (submitScoreButton) {
      submitScoreButton.disabled = false;
      submitScoreButton.textContent = 'Submit Score';
    }
  }
} 