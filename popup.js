// 🤖 JobHunter AI - Revolutionary Popup Interface
// Autonomous job hunting agent control center

console.log('🚀 JobHunter AI Popup: Initializing...');

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async function() {
  console.log('📱 Popup loaded, initializing UI...');

  // Load profile and stats
  await loadProfileStatus();
  await loadActivityStats();

  // Setup event listeners
  setupEventListeners();

  console.log('✅ Popup ready');
});

// ============================================================================
// PROFILE & STATS LOADING
// ============================================================================

async function loadProfileStatus() {
  try {
    const { userProfile } = await chrome.storage.local.get(['userProfile']);
    const profileStatusEl = document.getElementById('profileStatus');

    if (userProfile) {
      const skillCount = userProfile.skills?.length || 0;
      const techCount = userProfile.techStack?.length || 0;
      const level = userProfile.seniorityLevel || 'Professional';

      profileStatusEl.innerHTML = `
        <div class="profile-icon">✅</div>
        <div class="profile-info">
          <div class="profile-name">${level} Profile Active</div>
          <div class="profile-stats">${skillCount} skills | ${techCount} technologies</div>
        </div>
      `;

      // Update status indicator to active
      document.querySelector('.status-indicator').className = 'status-indicator status-active';
    } else {
      profileStatusEl.innerHTML = `
        <div class="profile-icon">⚠️</div>
        <div class="profile-info">
          <div class="profile-name">No Profile Configured</div>
          <div class="profile-stats">Please configure your profile in Settings</div>
        </div>
      `;

      // Update status indicator to inactive
      document.querySelector('.status-indicator').className = 'status-indicator status-inactive';
    }
  } catch (error) {
    console.error('❌ Error loading profile:', error);
  }
}

async function loadActivityStats() {
  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'GET_INSIGHTS'
      }, resolve);
    });

    if (response?.success && response.data) {
      const insights = response.data;

      document.getElementById('statInteractions').textContent = insights.totalInteractions || 0;
      document.getElementById('statLast7Days').textContent = insights.last7Days || 0;
    } else {
      document.getElementById('statInteractions').textContent = '0';
      document.getElementById('statLast7Days').textContent = '0';
    }
  } catch (error) {
    console.error('❌ Error loading stats:', error);
    document.getElementById('statInteractions').textContent = '-';
    document.getElementById('statLast7Days').textContent = '-';
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupEventListeners() {
  // Main action buttons
  document.getElementById('generateQueries')?.addEventListener('click', handleGenerateQueries);
  document.getElementById('findJobs')?.addEventListener('click', handleFindJobs);
  document.getElementById('xraySearch')?.addEventListener('click', handleXraySearch);
  document.getElementById('viewInsights')?.addEventListener('click', handleViewInsights);

  // Quick actions
  document.getElementById('findManager')?.addEventListener('click', handleFindManager);
  document.getElementById('openLinkedIn')?.addEventListener('click', handleOpenLinkedIn);
  document.getElementById('openSettings')?.addEventListener('click', handleOpenSettings);
  document.getElementById('exportData')?.addEventListener('click', handleExportData);
  document.getElementById('resetFilters')?.addEventListener('click', handleResetFilters);

  console.log('✅ Event listeners attached');
}

// ============================================================================
// MAIN ACTION HANDLERS
// ============================================================================

async function handleGenerateQueries() {
  console.log('🧠 Generating search queries...');

  const btn = document.getElementById('generateQueries');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span>⏳</span><span>Generating...</span>';
  btn.disabled = true;

  try {
    const { userProfile } = await chrome.storage.local.get(['userProfile']);

    if (!userProfile) {
      alert('⚠️ Please configure your profile first by going to Settings and analyzing your CV.');
      chrome.runtime.openOptionsPage();
      return;
    }

    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'GENERATE_SEARCH_QUERIES'
      }, resolve);
    });

    if (response?.success && response.data) {
      const { queries, count, fallback } = response.data;

      let message = `🎯 Generated ${count} Intelligent Search Strategies:\n\n`;
      queries.forEach((query, i) => {
        message += `${i + 1}. ${query}\n`;
      });
      message += `\n✨ Opening LinkedIn with first query...`;

      if (fallback) {
        message += `\n\n⚠️ Note: Using fallback queries (API issue)`;
      }

      alert(message);

      // Open LinkedIn with first query
      const firstQuery = queries[0];
      const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(firstQuery)}&location=Center%20District%2C%20Israel`;
      chrome.tabs.create({ url: searchUrl });

      // Store queries for later use
      await chrome.storage.local.set({ lastGeneratedQueries: queries });

    } else {
      throw new Error(response?.error || 'Failed to generate queries');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    alert(`❌ Error generating queries: ${error.message}\n\nPlease make sure you have configured your API key in Settings.`);
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

// פונקציה לחילוץ מילות מפתח נקיות - משותפת לכל הפונקציות
function extractCleanKeywords(profile) {
  // כל הטקסט מהפרופיל
  const allText = [
    ...(profile.skills || []),
    ...(profile.techStack || []),
    profile.seniorityLevel || ''
  ].join(' ').toLowerCase();

  // רשימת זהב: רק המילים האלה יכולות להיכנס לחיפוש
  const goldKeywords = [
    'rag', 'n8n', 'vector', 'pinecone', 'weaviate', 'langchain',
    'docker', 'kubernetes', 'python', 'react', 'node.js',
    'devops', 'mlops', 'ai', 'ml', 'infrastructure', 'platform',
    'architect', 'agent', 'automation', 'gcp', 'aws'
  ];

  // מצא מילות מפתח שקיימות בפרופיל
  const foundKeywords = goldKeywords.filter(keyword =>
    allText.includes(keyword)
  );

  // המרה למילים נקיות לחיפוש
  const cleanMap = {
    'rag': 'RAG',
    'n8n': 'n8n',
    'vector': 'Vector',
    'pinecone': 'Pinecone',
    'langchain': 'LangChain',
    'docker': 'Docker',
    'kubernetes': 'Kubernetes',
    'python': 'Python',
    'react': 'React',
    'node.js': 'Node.js',
    'devops': 'DevOps',
    'mlops': 'MLOps',
    'ai': 'AI',
    'ml': 'ML',
    'infrastructure': 'Infrastructure',
    'platform': 'Platform',
    'architect': 'Architect',
    'agent': 'Agent',
    'automation': 'Automation'
  };

  return foundKeywords.map(kw => cleanMap[kw] || kw);
}

// Find Similar Jobs - FIXED: Uses first targetJobTitle instead of keyword mashup
async function handleFindJobs() {
  console.log('🚀 Find Similar Jobs clicked!');

  const btn = document.getElementById('findJobs');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span>⏳</span><span>Searching...</span>';
  btn.disabled = true;

  try {
    const { userProfile, userPreferences } = await chrome.storage.local.get(['userProfile', 'userPreferences']);

    if (!userProfile) {
      alert('⚠️ Please configure your profile first by going to Settings and analyzing your CV.');
      chrome.runtime.openOptionsPage();
      return;
    }

    // ============================================================================
    // FIX: Use FIRST targetJobTitle instead of keyword mashup
    // Format: "[Job Title] [Location]"
    // Example: "AI Engineer Center District Israel" NOT "Senior RAG n8n Agent Pinecone"
    // ============================================================================

    let jobTitle = '';

    // Priority 1: Use first targetJobTitle from CV analysis
    if (userProfile.targetJobTitles && userProfile.targetJobTitles.length > 0) {
      jobTitle = userProfile.targetJobTitles[0];
      console.log('✅ Using targetJobTitle:', jobTitle);
    }
    // Fallback: Build from seniority + generic title
    else {
      const seniorityText = userProfile.seniorityLevel || 'Senior';
      const firstWord = seniorityText.split(/[,\s]/)[0] || 'Senior';
      jobTitle = `${firstWord} Engineer`;
      console.log('⚠️ Fallback job title:', jobTitle);
    }

    // Get preferred location
    const preferredLocations = userPreferences?.preferredLocations || ['Center District', 'Tel Aviv'];
    const location = preferredLocations[0] || 'Center District';
    const locationQuery = location.toLowerCase().includes('israel') ? location : `${location}, Israel`;

    // Build clean search query: "[Job Title] [Location]"
    const query = jobTitle;
    const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query)}&location=${encodeURIComponent(locationQuery)}`;

    // Debug information
    console.log('=== 🔍 JobHunter AI FIXED Search ===');
    console.log('Target Job Title:', jobTitle);
    console.log('Location:', locationQuery);
    console.log('Final search query:', query);
    console.log('LinkedIn URL:', searchUrl);
    console.log('=====================================');

    // Open LinkedIn search
    chrome.tabs.create({ url: searchUrl });

    setTimeout(() => {
      const allTitles = userProfile.targetJobTitles?.slice(0, 3).join(', ') || jobTitle;
      alert(`🔍 Searching for: "${jobTitle}"\n\n📋 Your target job titles:\n${allTitles}\n\nThe JobHunter AI agent will automatically analyze jobs and show match scores on the page!`);
    }, 500);

  } catch (error) {
    console.error('❌ Error:', error);
    alert(`❌ Error: ${error.message}`);
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

async function handleViewInsights() {
  console.log('📊 Loading insights...');

  const btn = document.getElementById('viewInsights');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span>⏳</span><span>Loading...</span>';
  btn.disabled = true;

  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'GET_INSIGHTS'
      }, resolve);
    });

    if (response?.success && response.data) {
      const insights = response.data;
      const topCompanies = insights.topCompanies?.slice(0, 5) || [];

      let message = `📊 JobHunter AI Career Insights\n`;
      message += `${'='.repeat(40)}\n\n`;
      message += `📈 Activity Summary:\n`;
      message += `• Total Interactions: ${insights.totalInteractions}\n`;
      message += `• Last 7 Days: ${insights.last7Days}\n`;
      message += `• Last 30 Days: ${insights.last30Days}\n\n`;

      if (topCompanies.length > 0) {
        message += `🏢 Top Companies You're Interested In:\n`;
        topCompanies.forEach((comp, i) => {
          message += `${i + 1}. ${comp.company}\n`;
          message += `   Views: ${comp.views} | Applications: ${comp.applications}\n`;
        });
        message += `\n`;
      }

      const interactionBreakdown = insights.interactionBreakdown;
      if (interactionBreakdown && Object.keys(interactionBreakdown).length > 0) {
        message += `📊 Activity Breakdown:\n`;
        Object.entries(interactionBreakdown).forEach(([type, count]) => {
          message += `• ${type}: ${count}\n`;
        });
      }

      alert(message);

    } else {
      throw new Error('Failed to load insights');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    alert(`📊 No insights available yet.\n\nStart using JobHunter AI on LinkedIn to build your career insights!`);
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

// ============================================================================
// QUICK ACTION HANDLERS
// ============================================================================

function handleOpenLinkedIn() {
  console.log('💼 Opening LinkedIn Jobs...');
  chrome.tabs.create({
    url: 'https://www.linkedin.com/jobs/search/?keywords=Senior%20AI%20Engineer&location=Center%20District%2C%20Israel'
  });
}

function handleOpenSettings() {
  console.log('⚙️ Opening settings...');
  chrome.runtime.openOptionsPage();
}

async function handleExportData() {
  console.log('📥 Exporting data...');

  try {
    const data = await chrome.storage.local.get([
      'userProfile',
      'interactionHistory',
      'analytics',
      'lastGeneratedQueries'
    ]);

    const exportData = {
      exportDate: new Date().toISOString(),
      version: '2.0',
      ...data
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `jobhunter-ai-export-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);

    alert('✅ Data exported successfully!');

  } catch (error) {
    console.error('❌ Export error:', error);
    alert(`❌ Error exporting data: ${error.message}`);
  }
}

async function handleResetFilters() {
  console.log('🔄 Resetting filters...');

  const confirm = window.confirm(
    '🔄 Reset all filters and preferences?\n\nThis will:\n• Clear hidden companies\n• Reset preferred companies\n• Keep your profile and interaction history\n\nContinue?'
  );

  if (!confirm) return;

  try {
    await chrome.storage.local.set({
      userPreferences: {
        hiddenCompanies: [],
        preferredCompanies: []
      }
    });

    alert('✅ Filters reset successfully!');

  } catch (error) {
    console.error('❌ Reset error:', error);
    alert(`❌ Error resetting filters: ${error.message}`);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function showLoading() {
  // Add loading overlay if needed
}

function hideLoading() {
  // Remove loading overlay if needed
}

// ============================================================================
// 🕵️ X-RAY SEARCH - HIDDEN JOB BOARDS
// ============================================================================

async function handleXraySearch() {
  console.log('🕵️ Launching X-Ray search...');

  const { userProfile } = await chrome.storage.local.get(['userProfile']);

  if (!userProfile) {
    alert('⚠️ Please configure your profile first by going to Settings and analyzing your CV.');
    chrome.runtime.openOptionsPage();
    return;
  }

  // מילות מפתח מהפרופיל (מהלוגיקה הקיימת)
  const coreSkills = extractCleanKeywords(userProfile).slice(0, 3);
  const skillsQuery = coreSkills.map(skill => `"${skill}"`).join(' OR ');

  // אתרי ATS מהמדריך
  const atsSites = [
    'site:boards.greenhouse.io',
    'site:comeet.com',
    'site:jobs.lever.co',
    'site:workday.com'
  ].join(' OR ');

  // מיקומים מהמדריך
  const locations = '("Tel Aviv" OR "תל אביב" OR "Israel" OR "Center District" OR "Remote")';

  // רמות ניסיון (לפי המדריך - לא לסנן!)
  const experienceLevels = '("junior" OR "entry level" OR "associate" OR "student" OR "graduate")';

  // בניית שאילתה מלאה
  const booleanQuery = `${atsSites} (${skillsQuery}) ${locations} ${experienceLevels}`;

  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(booleanQuery)}`;

  console.log('🔍 X-Ray Boolean Query:', booleanQuery);
  console.log('🌐 Google Search URL:', googleUrl);

  chrome.tabs.create({ url: googleUrl });

  // הצגת הודעה למשתמש
  setTimeout(() => {
    alert(`🔍 X-Ray Search Launched!\n\nSearching for: ${coreSkills.join(', ')}\nIn: Hidden job boards (Greenhouse, Comeet, Lever)\nLevels: All experience levels\n\n💡 Tip: These jobs often have less competition!`);
  }, 1000);
}

// Export for use in popup HTML
window.handleXraySearch = handleXraySearch;

// ============================================================================
// 👔 FIND HIRING MANAGER
// ============================================================================

async function handleFindManager() {
  console.log('👔 Finding hiring managers...');

  // קבלת מידע על הטאב הנוכחי
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url.includes('linkedin.com/jobs')) {
    alert('⚠️ Please navigate to a specific LinkedIn job page first!');
    return;
  }

  // חילוץ שם החברה מהדף
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractCompanyFromJobPage
  }, (results) => {
    if (results && results[0] && results[0].result) {
      const companyName = results[0].result;

      // תפקידי מפתח מהמדריך
      const managerTitles = [
        'Software Team Lead',
        'Development Manager',
        'Director of R&D',
        'VP Engineering',
        'Head of AI',
        'ML Team Lead',
        'Engineering Manager'
      ];

      // יצירת חיפושים מרובים
      const searches = managerTitles.slice(0, 3).map(title => {
        const query = `${companyName} "${title}"`;
        return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`;
      });

      // פתיחת טאבים
      searches.forEach((url, index) => {
        setTimeout(() => {
          chrome.tabs.create({ url });
        }, index * 1000); // פיזור בזמן כדי לא להציף
      });

      // הודעת הדרכה
      setTimeout(() => {
        alert(`👔 Hunting Managers at ${companyName}!\n\n📋 Opened ${searches.length} targeted searches:\n• ${managerTitles.slice(0, 3).join('\n• ')}\n\n💡 Pro Tip from Guide:\n1. Send connection request + personal message\n2. Mention specific interest in the role\n3. Follow up after 72 hours if no response\n\n🎯 Look for managers who posted recently or show "Hiring" in their activity`);
      }, 2000);

    } else {
      alert('❌ Could not extract company name. Make sure you\'re on a LinkedIn job page.');
    }
  });
}

// פונקציה שרצה בתוך דף המשרה
function extractCompanyFromJobPage() {
  // ניסיון מספר 1: element ישיר
  const companyElement = document.querySelector('.job-details-jobs-unified-top-card__company-name a');
  if (companyElement) {
    return companyElement.textContent.trim();
  }

  // ניסיון מספר 2: כותרת הדף
  const title = document.title;
  const atIndex = title.indexOf(' at ');
  if (atIndex !== -1) {
    const afterAt = title.substring(atIndex + 4);
    const pipeIndex = afterAt.indexOf(' | ');
    return pipeIndex !== -1 ? afterAt.substring(0, pipeIndex).trim() : afterAt.trim();
  }

  // ניסיון מספר 3: selectors נוספים
  const altSelectors = [
    '.job-details-jobs-unified-top-card__company-name',
    '.jobs-unified-top-card__company-name',
    '[data-test-id="job-company-name"]'
  ];

  for (const selector of altSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element.textContent.trim();
    }
  }

  return null;
}

// Export for use in popup HTML
window.handleFindManager = handleFindManager;

console.log('✅ JobHunter AI Popup: Ready');
