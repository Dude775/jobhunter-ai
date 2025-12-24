// Options Page Script for JobHunter AI
// This script handles the options page functionality with working Claude API integration

document.addEventListener('DOMContentLoaded', function() {
  // Load saved API key and profile on page load
  loadSavedData();

  // Handle Save API Key
  document.getElementById('save-api-key').addEventListener('click', saveApiKey);

  // Handle Analyze CV Button
  document.getElementById('analyze-btn').addEventListener('click', analyzeCV);

  // Handle Save Preferences Button
  document.getElementById('save-preferences').addEventListener('click', savePreferences);
});

// Load saved API key, profile, and preferences data
function loadSavedData() {
  chrome.storage.local.get(['claudeApiKey', 'userProfile', 'userPreferences'], function(result) {
    if (result.claudeApiKey) {
      document.getElementById('claude-api-key').value = result.claudeApiKey;
      document.getElementById('api-key-status').textContent = 'API key loaded';
      document.getElementById('api-key-status').className = 'status';
    }

    if (result.userProfile) {
      displayProfile(result.userProfile);
    }

    // Load preferences
    if (result.userPreferences) {
      const prefs = result.userPreferences;
      document.getElementById('auto-filter').checked = prefs.autoFilter === true; // Default OFF
      document.getElementById('blacklist-keywords').value = (prefs.blacklistKeywords || []).join(', ');
      document.getElementById('preferred-locations').value = (prefs.preferredLocations || []).join(', ');

      // Load experience levels (default: Mid-Senior level checked)
      const savedLevels = prefs.experienceLevels || ['Mid-Senior level'];
      const expCheckboxes = document.querySelectorAll('[id^="exp-"]');
      expCheckboxes.forEach(checkbox => {
        checkbox.checked = savedLevels.includes(checkbox.value);
      });
    } else {
      // Set default: Mid-Senior level checked
      document.getElementById('exp-mid-senior').checked = true;
    }
  });
}

// Save API Key to chrome.storage.local
function saveApiKey() {
  const apiKey = document.getElementById('claude-api-key').value.trim();
  const statusDiv = document.getElementById('api-key-status');

  if (!apiKey) {
    statusDiv.textContent = 'Please enter an API key';
    statusDiv.className = 'status error';
    return;
  }

  // Validate API key format
  if (!apiKey.startsWith('sk-ant-')) {
    statusDiv.textContent = 'Invalid API key format. Key must start with "sk-ant-"';
    statusDiv.className = 'status error';
    return;
  }

  chrome.storage.local.set({ claudeApiKey: apiKey }, function() {
    statusDiv.textContent = 'API key saved successfully!';
    statusDiv.className = 'status';
  });
}

// Analyze CV using Chrome message to background script
function analyzeCV() {
  const cvText = document.getElementById('cv-text').value.trim();
  const resultsDiv = document.getElementById('analysis-results');
  const analyzeBtn = document.getElementById('analyze-btn');

  if (!cvText) {
    resultsDiv.innerHTML = '<p class="error">Please paste your CV text first</p>';
    return;
  }

  // Get API key from storage
  chrome.storage.local.get(['claudeApiKey'], function(result) {
    if (!result.claudeApiKey) {
      resultsDiv.innerHTML = '<p class="error">Please save your Claude API key first</p>';
      return;
    }

    // Show loading state
    analyzeBtn.disabled = true;
    resultsDiv.innerHTML = '<p class="loading">Analyzing your CV with Claude AI... This may take a moment.</p>';

    // Send message to background script to analyze CV
    chrome.runtime.sendMessage(
      {
        type: 'ANALYZE_CV',
        apiKey: result.claudeApiKey,
        cvText: cvText
      },
      function(response) {
        // Re-enable button
        analyzeBtn.disabled = false;

        // Handle errors
        if (chrome.runtime.lastError) {
          resultsDiv.innerHTML = `<p class="error">Error: ${chrome.runtime.lastError.message}</p>`;
          return;
        }

        // Check response
        if (!response) {
          resultsDiv.innerHTML = '<p class="error">No response from background script. Please try again.</p>';
          return;
        }

        if (!response.success) {
          resultsDiv.innerHTML = `<p class="error">Error: ${response.error || 'Unknown error occurred'}</p>`;
          return;
        }

        // Success - save the profile
        const analysis = response.data;
        const userProfile = {
          skills: analysis.skills || [],
          experience: analysis.experience || [],
          education: analysis.education || [],
          techStack: analysis.techStack || [],
          dynamicKeywords: analysis.dynamicKeywords || [], // Bug fix: save extracted keywords
          targetJobTitles: analysis.targetJobTitles || [], // NEW: save target job titles for search
          seniorityLevel: analysis.seniorityLevel || 'Not specified',
          summary: analysis.summary || '',
          rawCV: cvText,
          lastUpdated: new Date().toISOString()
        };

        chrome.storage.local.set({ userProfile: userProfile }, function() {
          displayAnalysisResults(analysis);
          displayProfile(userProfile);
        });
      }
    );
  });
}

// Display analysis results
function displayAnalysisResults(analysis) {
  const resultsDiv = document.getElementById('analysis-results');

  let html = '<div class="profile-item"><h3>Analysis Complete!</h3>';
  html += `<p><strong>Seniority Level:</strong> ${analysis.seniorityLevel}</p>`;
  html += `<p><strong>Summary:</strong> ${analysis.summary}</p>`;
  html += '</div>';

  html += '<div class="profile-item"><h3>Skills Extracted</h3>';
  html += '<ul>';
  analysis.skills.forEach(skill => {
    html += `<li>${skill}</li>`;
  });
  html += '</ul></div>';

  html += '<div class="profile-item"><h3>Tech Stack</h3>';
  html += '<ul>';
  analysis.techStack.forEach(tech => {
    html += `<li>${tech}</li>`;
  });
  html += '</ul></div>';

  // NEW: Show target job titles (Top 5 Professions)
  if (analysis.targetJobTitles && analysis.targetJobTitles.length > 0) {
    html += '<div class="profile-item"><h3>Top 5 Target Job Titles</h3>';
    html += '<p style="font-size: 12px; color: #666;">These titles will be used for LinkedIn job searches:</p>';
    html += '<ol>';
    analysis.targetJobTitles.forEach((title, index) => {
      const badge = index === 0 ? ' <span style="background: #00C853; color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px;">PRIMARY</span>' : '';
      html += `<li>${title}${badge}</li>`;
    });
    html += '</ol></div>';
  }

  html += '<p class="status">Profile saved successfully! You can now use JobHunter AI on LinkedIn job pages.</p>';

  resultsDiv.innerHTML = html;
}

// Display saved profile
function displayProfile(profile) {
  const profileDiv = document.getElementById('profileInfo');

  if (!profile || !profile.skills) {
    profileDiv.innerHTML = '<p>No profile data available. Analyze your CV to create a profile.</p>';
    return;
  }

  let html = `<p><strong>Last Updated:</strong> ${new Date(profile.lastUpdated).toLocaleString()}</p>`;

  html += '<div class="profile-item"><h3>Skills</h3>';
  html += '<ul>';
  profile.skills.slice(0, 10).forEach(skill => {
    html += `<li>${skill}</li>`;
  });
  if (profile.skills.length > 10) {
    html += `<li><em>...and ${profile.skills.length - 10} more</em></li>`;
  }
  html += '</ul></div>';

  html += '<div class="profile-item"><h3>Tech Stack</h3>';
  html += '<ul>';
  profile.techStack.slice(0, 10).forEach(tech => {
    html += `<li>${tech}</li>`;
  });
  if (profile.techStack.length > 10) {
    html += `<li><em>...and ${profile.techStack.length - 10} more</em></li>`;
  }
  html += '</ul></div>';

  html += `<div class="profile-item"><h3>Seniority Level</h3><p>${profile.seniorityLevel}</p></div>`;

  // NEW: Show target job titles if available
  if (profile.targetJobTitles && profile.targetJobTitles.length > 0) {
    html += '<div class="profile-item"><h3>Target Job Titles</h3>';
    html += '<ol>';
    profile.targetJobTitles.slice(0, 5).forEach((title, index) => {
      const badge = index === 0 ? ' <span style="background: #00C853; color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px;">PRIMARY</span>' : '';
      html += `<li>${title}${badge}</li>`;
    });
    html += '</ol></div>';
  }

  profileDiv.innerHTML = html;
}

// Save user preferences for filtering
function savePreferences() {
  const statusDiv = document.getElementById('preferences-status');

  const autoFilter = document.getElementById('auto-filter').checked;
  const blacklistInput = document.getElementById('blacklist-keywords').value.trim();
  const locationsInput = document.getElementById('preferred-locations').value.trim();

  // Parse comma-separated values, filter empty strings
  const blacklistKeywords = blacklistInput
    ? blacklistInput.split(',').map(k => k.trim()).filter(k => k.length > 0)
    : [];

  const preferredLocations = locationsInput
    ? locationsInput.split(',').map(l => l.trim()).filter(l => l.length > 0)
    : ['Center District', 'Tel Aviv', 'Remote'];

  // Collect selected experience levels
  const experienceLevels = [];
  const expCheckboxes = document.querySelectorAll('[id^="exp-"]');
  expCheckboxes.forEach(checkbox => {
    if (checkbox.checked) {
      experienceLevels.push(checkbox.value);
    }
  });

  const userPreferences = {
    autoFilter,
    blacklistKeywords,
    preferredLocations,
    experienceLevels: experienceLevels.length > 0 ? experienceLevels : ['Mid-Senior level'],
    lastUpdated: new Date().toISOString()
  };

  chrome.storage.local.set({ userPreferences }, function() {
    const status = autoFilter
      ? `Auto-filtering ON with ${blacklistKeywords.length} keywords.`
      : `Auto-filtering OFF. All jobs will be shown.`;
    statusDiv.textContent = status;
    statusDiv.className = 'status';
  });
}
