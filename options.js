// Options Page Script for JobHunter AI
// This script handles the options page functionality with working Claude API integration

document.addEventListener('DOMContentLoaded', function() {
  // Load saved API key and profile on page load
  loadSavedData();

  // Handle Save API Key
  document.getElementById('save-api-key').addEventListener('click', saveApiKey);

  // Handle Analyze CV Button
  document.getElementById('analyze-btn').addEventListener('click', analyzeCV);
});

// Load saved API key and profile data
function loadSavedData() {
  chrome.storage.local.get(['claudeApiKey', 'userProfile'], function(result) {
    if (result.claudeApiKey) {
      document.getElementById('claude-api-key').value = result.claudeApiKey;
      document.getElementById('api-key-status').textContent = 'API key loaded';
      document.getElementById('api-key-status').className = 'status';
    }

    if (result.userProfile) {
      displayProfile(result.userProfile);
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

  profileDiv.innerHTML = html;
}
