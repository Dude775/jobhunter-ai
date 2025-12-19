// 🤖 JobHunter AI - Autonomous Job Hunting Agent (Content Script)
// Revolutionary floating command center with intelligent automation

console.log('🚀 JobHunter AI: Autonomous Agent Content Script Loaded');

let processedJobs = new Set();
let isProcessing = false;
let commandCenterVisible = false;
let stats = {
  totalScanned: 0,
  highMatch: 0,
  mediumMatch: 0,
  lowMatch: 0,
  filtered: 0
};

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initJobHunter);
} else {
  initJobHunter();
}

function initJobHunter() {
  console.log('🎯 JobHunter AI: Initializing...');

  // Create floating command center
  createCommandCenter();

  // Check if user has profile
  chrome.storage.local.get(['userProfile'], (data) => {
    if (!data.userProfile) {
      console.log('⚠️ No profile found - skipping job analysis');
      updateCommandCenter('⚠️ No profile configured', 'warning');
      return;
    }

    console.log('✅ Profile found - starting job monitoring');
    updateCommandCenter('🎯 Agent scanning for opportunities...', 'active');
    startJobMonitoring();
  });
}

function startJobMonitoring() {
  // Initial scan after 3 seconds (LinkedIn needs time to load)
  setTimeout(() => {
    console.log('🔍 Starting initial job scan...');
    processVisibleJobs();
  }, 3000);
  
  // Monitor for new jobs with multiple strategies
  const observer = new MutationObserver(() => {
    if (!isProcessing) {
      isProcessing = true;
      setTimeout(() => {
        processVisibleJobs();
        isProcessing = false;
      }, 2000); // Longer delay for stability
    }
  });
  
  // Watch multiple containers
  const containers = [
    document.querySelector('.jobs-search-results-list'),
    document.querySelector('main'),
    document.body
  ].filter(Boolean);
  
  containers.forEach(container => {
    observer.observe(container, { 
      childList: true, 
      subtree: true 
    });
  });
  
  console.log('👀 Job monitoring active');
}

async function processVisibleJobs() {
  // Multiple selector strategies for LinkedIn's changing structure
  const selectorStrategies = [
    {
      name: 'job-card-container',
      selector: '.job-card-container',
      titleSelector: '.job-card-list__title',
      companySelector: '.job-card-container__company-name'
    },
    {
      name: 'search-results-item',
      selector: '.jobs-search-results__list-item',
      titleSelector: '.artdeco-entity-lockup__title',
      companySelector: '.artdeco-entity-lockup__subtitle'
    },
    {
      name: 'scaffold-layout',
      selector: '.scaffold-layout__list-item',
      titleSelector: 'a[data-control-name="job_card_title"]',
      companySelector: '.job-card-container__primary-description'
    },
    {
      name: 'data-job-id',
      selector: '[data-job-id]',
      titleSelector: '.job-card-list__title, .artdeco-entity-lockup__title',
      companySelector: '.job-card-container__company-name, .artdeco-entity-lockup__subtitle'
    }
  ];
  
  let jobElements = [];
  let usedStrategy = null;
  
  for (const strategy of selectorStrategies) {
    const elements = document.querySelectorAll(strategy.selector);
    if (elements.length > 0) {
      jobElements = Array.from(elements);
      usedStrategy = strategy;
      console.log(`📋 Found ${jobElements.length} jobs using strategy: ${strategy.name}`);
      break;
    }
  }
  
  if (jobElements.length === 0) {
    console.log('⚠️ No job cards found with any selector strategy');
    return;
  }
  
  // Process up to 10 jobs to avoid rate limiting
  let processed = 0;
  for (const jobElement of jobElements) {
    if (processed >= 10) break;
    
    const jobId = getJobId(jobElement);
    if (jobId && !processedJobs.has(jobId)) {
      await processJobElement(jobElement, jobId, usedStrategy);
      processedJobs.add(jobId);
      processed++;
      
      // Human-like delay between jobs
      await sleep(800 + Math.random() * 400);
    }
  }
  
  console.log(`✅ Processed ${processed} new jobs`);
}

function getJobId(element) {
  return element.dataset.jobId || 
         element.querySelector('[data-job-id]')?.dataset.jobId ||
         element.querySelector('a[href*="/jobs/view/"]')?.href.match(/\/jobs\/view\/(\d+)/)?.[1] ||
         `job_${Math.random().toString(36).substr(2, 9)}`;
}

async function processJobElement(jobElement, jobId, strategy) {
  try {
    const jobData = extractJobData(jobElement, strategy);
    if (!jobData.title) {
      console.log('⚠️ No title found for job, skipping');
      return;
    }

    stats.totalScanned++;
    console.log(`🔍 Analyzing: "${jobData.title}" at "${jobData.company}"`);

    // STEP 1: Check if job should be filtered
    const filterResponse = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'FILTER_JOB',
        jobData: jobData
      }, resolve);
    });

    if (filterResponse?.success && filterResponse.data) {
      const filterResult = filterResponse.data;

      // Auto-hide blacklisted jobs
      if (!filterResult.shouldShow) {
        console.log(`🚫 Filtering out: ${jobData.title} - ${filterResult.reason}`);
        stats.filtered++;
        jobElement.style.opacity = '0.3';
        jobElement.style.filter = 'grayscale(100%)';
        jobElement.style.pointerEvents = 'none';

        // Add filter notice
        const notice = document.createElement('div');
        notice.className = 'jobhunter-filtered-notice';
        notice.textContent = `🚫 Filtered: ${filterResult.reason}`;
        notice.style.cssText = `
          position: absolute;
          top: 8px;
          right: 8px;
          padding: 4px 8px;
          background: #e53935;
          color: white;
          border-radius: 12px;
          font-size: 11px;
          font-weight: bold;
          z-index: 1000;
        `;
        jobElement.appendChild(notice);
        updateCommandCenterStats();
        return;
      }

      // Highlight priority jobs
      if (filterResult.action === 'highlight') {
        jobElement.style.border = '2px solid #2196F3';
        jobElement.style.boxShadow = '0 0 10px rgba(33, 150, 243, 0.3)';
      }
    }

    // STEP 2: Get match score from background
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'CALCULATE_MATCH',
        jobData: jobData
      }, resolve);
    });

    if (response?.success && response.data) {
      const { score, reason, breakdown } = response.data;
      console.log(`✅ Match: ${score}% - ${jobData.title}`);

      // Update stats (RECALIBRATED: 75%+ high, 50-74% medium)
      if (score >= 75) stats.highMatch++;
      else if (score >= 50) stats.mediumMatch++;
      else stats.lowMatch++;

      injectMatchBadge(jobElement, score, reason || 'Match based on profile analysis');

      // Track interaction
      chrome.runtime.sendMessage({
        type: 'TRACK_INTERACTION',
        interaction: {
          type: 'job_scored',
          jobTitle: jobData.title,
          company: jobData.company,
          score: score
        }
      });

      // Track job for export
      trackedJobs.push({
        ...jobData,
        score: score,
        reason: reason,
        breakdown: breakdown,
        jobId: jobId,
        url: window.location.href,
        timestamp: Date.now()
      });

      // Keep only last 100 jobs
      if (trackedJobs.length > 100) {
        trackedJobs.shift();
      }

      updateCommandCenterStats();

      // STEP 3: Analyze skills gap
      analyzeJobSkillsGap(jobData);
    } else {
      console.log(`❌ No response for: ${jobData.title}`);
    }

  } catch (error) {
    console.error('❌ Error processing job:', error);
  }
}

function extractJobData(element, strategy) {
  let title = '';
  let company = '';
  let location = '';
  let description = '';

  // ============================================================================
  // FIX 1: CLEAN TITLE EXTRACTION (Remove duplicates)
  // ============================================================================
  const titleEl = element.querySelector(strategy.titleSelector);
  if (titleEl) {
    title = titleEl.innerText?.trim() || '';
    // Remove duplicates: "AI EngineerAI Engineer" → "AI Engineer"
    title = title.replace(/(.+)\1+/g, '$1').trim();
  }

  // Fallback to generic selectors
  if (!title) {
    const fallbackTitleSelectors = [
      'a[data-control-name="job_card_title"]',
      '.job-card-list__title',
      '.artdeco-entity-lockup__title',
      'h3 a',
      '.job-card-container__link'
    ];

    for (const selector of fallbackTitleSelectors) {
      const el = element.querySelector(selector);
      if (el) {
        title = el.innerText?.trim() || '';
        title = title.replace(/(.+)\1+/g, '$1').trim();
        break;
      }
    }
  }

  // ============================================================================
  // COMPANY EXTRACTION
  // ============================================================================
  const companyEl = element.querySelector(strategy.companySelector);
  if (companyEl) {
    company = companyEl.textContent.trim();
  }

  if (!company) {
    const fallbackCompanySelectors = [
      '.job-card-container__company-name',
      '.artdeco-entity-lockup__subtitle',
      '.job-card-container__primary-description'
    ];

    for (const selector of fallbackCompanySelectors) {
      const el = element.querySelector(selector);
      if (el) {
        company = el.textContent.trim();
        break;
      }
    }
  }

  // ============================================================================
  // FIX 2: LOCATION EXTRACTION
  // ============================================================================
  const locationSelectors = [
    '.job-card-container__metadata-item',
    '.artdeco-entity-lockup__caption',
    '.job-card-container__metadata-wrapper',
    '.job-search-card__location'
  ];

  for (const selector of locationSelectors) {
    const els = element.querySelectorAll(selector);
    for (const el of els) {
      const text = el.textContent.trim().toLowerCase();
      // Check if it contains location keywords
      if (text.includes('israel') || text.includes('tel aviv') || text.includes('remote') ||
          text.includes('hybrid') || text.includes('herzliya') || text.includes('raanana')) {
        location = el.textContent.trim();
        break;
      }
    }
    if (location) break;
  }

  // ============================================================================
  // FIX 3: ROBUST DESCRIPTION SCRAPING
  // ============================================================================
  const descriptionSelectors = [
    '.jobs-description__content',
    '.job-details-jobs-unified-top-card__job-description',
    '.jobs-search__job-details--container',
    '.job-view-layout .jobs-box__html-content',
    '#job-details .jobs-description',
    '.jobs-details__main-content',
    '.jobs-description-content__text',
    'article.jobs-description',
    '.jobs-box__html-content'
  ];

  for (const selector of descriptionSelectors) {
    const el = document.querySelector(selector);
    if (el && el.innerText?.trim()) {
      description = el.innerText.trim();
      break;
    }
  }

  // FIX 4: FALLBACK - Try to get description from expanded job view
  if (!description || description.length < 50) {
    // Check if there's a visible job details panel
    const jobDetailsPanel = document.querySelector('.jobs-details__main-content, .jobs-search__job-details');
    if (jobDetailsPanel) {
      description = jobDetailsPanel.innerText?.trim() || '';
    }
  }

  // ============================================================================
  // DEBUG LOGGING
  // ============================================================================
  console.log(`📋 Extracted Data:
    Title: "${title}" (${title.length} chars)
    Company: "${company}"
    Location: "${location || 'NOT FOUND'}"
    Description: ${description.length} chars
  `);

  // Warning if description is missing
  if (!description || description.length < 50) {
    console.warn(`⚠️ Description not found for "${title}" - using title-only scoring`);
  }

  return {
    title,
    company,
    location,
    description
  };
}

function injectMatchBadge(element, score, reason) {
  // Remove existing badge
  const existingBadge = element.querySelector('.jobhunter-badge');
  if (existingBadge) existingBadge.remove();

  // Create badge
  const badge = document.createElement('div');
  badge.className = 'jobhunter-badge';

  // 🚀 GOD MODE BADGE SYSTEM - RECALIBRATED THRESHOLDS (75%+ GREEN!)
  let backgroundColor, textColor, emoji, borderColor, pulseAnimation, badgeText;

  if (score >= 75) {
    // 🔥 EXCELLENT MATCH - Green with pulse animation (LOWERED FROM 95%)
    backgroundColor = '#00C853';
    textColor = 'white';
    emoji = '🔥';
    borderColor = '#FFD700';
    pulseAnimation = 'pulse-green';
    badgeText = `${emoji} ${score}% EXCELLENT MATCH!`;
  } else if (score >= 50) {
    // 🟡 DECENT MATCH - Yellow/Orange
    backgroundColor = '#f57c00';
    textColor = 'white';
    emoji = '🟡';
    borderColor = '#FF9800';
    pulseAnimation = '';
    badgeText = `${emoji} ${score}% Decent Match`;
  } else {
    // ⚫ SKIP - Gray/Red
    backgroundColor = '#757575';
    textColor = 'white';
    emoji = '⚫';
    borderColor = '';
    pulseAnimation = '';
    badgeText = `${emoji} ${score}% Skip`;
  }

  badge.innerHTML = badgeText;
  badge.title = reason;

  // Professional styling with enhanced visuals
  badge.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 6px 12px;
    background: ${backgroundColor};
    color: ${textColor};
    border-radius: 16px;
    font-weight: bold;
    font-size: ${score >= 75 ? '13px' : '11px'};
    z-index: 1000;
    cursor: help;
    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    white-space: nowrap;
    ${borderColor ? `border: 2px solid ${borderColor};` : ''}
    ${pulseAnimation ? 'animation: pulse-green 2s infinite;' : ''}
  `;

  // Add pulse animation style if needed
  if (pulseAnimation && !document.getElementById('jobhunter-pulse-style')) {
    const style = document.createElement('style');
    style.id = 'jobhunter-pulse-style';
    style.textContent = `
      @keyframes pulse-green {
        0%, 100% {
          box-shadow: 0 4px 8px rgba(0,0,0,0.3), 0 0 0 0 rgba(0, 200, 83, 0.7);
        }
        50% {
          box-shadow: 0 4px 8px rgba(0,0,0,0.3), 0 0 0 8px rgba(0, 200, 83, 0);
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Ensure parent has relative positioning
  const computedStyle = getComputedStyle(element);
  if (computedStyle.position === 'static') {
    element.style.position = 'relative';
  }

  // Highlight excellent matches with border (UPDATED THRESHOLD: 75%+)
  if (score >= 75) {
    element.style.border = '3px solid #FFD700';
    element.style.boxShadow = '0 0 20px rgba(255, 215, 0, 0.5)';
    element.style.backgroundColor = 'rgba(0, 200, 83, 0.05)';
  } else if (score >= 50) {
    element.style.border = '2px solid #FF9800';
    element.style.boxShadow = '0 0 10px rgba(255, 152, 0, 0.3)';
  }

  element.appendChild(badge);

  console.log(`🎯 GOD MODE Badge: ${score}% for "${element.querySelector('[data-job-id]')?.dataset.jobId || 'Unknown'}"`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// 🎯 FLOATING COMMAND CENTER
// ============================================================================

function createCommandCenter() {
  // Remove existing command center if any
  const existing = document.getElementById('jobhunter-command-center');
  if (existing) existing.remove();

  const commandCenter = document.createElement('div');
  commandCenter.id = 'jobhunter-command-center';
  commandCenter.innerHTML = `
    <div class="jh-header">
      <span class="jh-title">🤖 JobHunter AI Agent</span>
      <button class="jh-toggle" onclick="this.parentElement.parentElement.classList.toggle('jh-minimized')">−</button>
    </div>
    <div class="jh-body">
      <div class="jh-status">🎯 Initializing...</div>
      <div class="jh-stats">
        <div class="jh-stat">
          <span class="jh-stat-value" id="jh-total">0</span>
          <span class="jh-stat-label">Scanned</span>
        </div>
        <div class="jh-stat jh-stat-high">
          <span class="jh-stat-value" id="jh-high">0</span>
          <span class="jh-stat-label">🟢 High</span>
        </div>
        <div class="jh-stat jh-stat-medium">
          <span class="jh-stat-value" id="jh-medium">0</span>
          <span class="jh-stat-label">🟡 Medium</span>
        </div>
        <div class="jh-stat jh-stat-low">
          <span class="jh-stat-value" id="jh-low">0</span>
          <span class="jh-stat-label">⚫ Low</span>
        </div>
        <div class="jh-stat jh-stat-filtered">
          <span class="jh-stat-value" id="jh-filtered">0</span>
          <span class="jh-stat-label">🚫 Filtered</span>
        </div>
      </div>
      <div class="jh-actions">
        <button class="jh-btn jh-btn-primary" id="jh-find-more">🔍 Generate Search Queries</button>
        <button class="jh-btn jh-btn-secondary" id="jh-insights">📊 View Insights</button>
        <button class="jh-btn jh-btn-success" id="jh-export">📥 Export Top 10 Jobs</button>
        <button class="jh-btn jh-btn-xray" id="jh-xray-mode">🔬 X-Ray Mode: OFF</button>
      </div>
    </div>
  `;

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    #jobhunter-command-center {
      position: fixed;
      top: 80px;
      right: 20px;
      width: 320px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: white;
      transition: all 0.3s ease;
    }

    #jobhunter-command-center.jh-minimized .jh-body {
      display: none;
    }

    #jobhunter-command-center.jh-minimized {
      width: 250px;
    }

    .jh-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.2);
      cursor: move;
    }

    .jh-title {
      font-weight: bold;
      font-size: 14px;
    }

    .jh-toggle {
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
    }

    .jh-toggle:hover {
      background: rgba(255,255,255,0.3);
    }

    .jh-body {
      padding: 16px;
    }

    .jh-status {
      background: rgba(255,255,255,0.15);
      padding: 10px;
      border-radius: 6px;
      margin-bottom: 12px;
      font-size: 13px;
      text-align: center;
      font-weight: 500;
    }

    .jh-stats {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
      margin-bottom: 12px;
    }

    .jh-stat {
      background: rgba(255,255,255,0.1);
      padding: 8px 4px;
      border-radius: 6px;
      text-align: center;
    }

    .jh-stat-value {
      display: block;
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 4px;
    }

    .jh-stat-label {
      display: block;
      font-size: 10px;
      opacity: 0.9;
    }

    .jh-stat-high { background: rgba(46, 125, 50, 0.3); }
    .jh-stat-medium { background: rgba(245, 124, 0, 0.3); }
    .jh-stat-low { background: rgba(117, 117, 117, 0.3); }
    .jh-stat-filtered { background: rgba(229, 57, 53, 0.3); }

    .jh-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .jh-btn {
      width: 100%;
      padding: 10px;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .jh-btn-primary {
      background: white;
      color: #667eea;
    }

    .jh-btn-primary:hover {
      background: #f0f0f0;
      transform: translateY(-1px);
    }

    .jh-btn-secondary {
      background: rgba(255,255,255,0.2);
      color: white;
    }

    .jh-btn-secondary:hover {
      background: rgba(255,255,255,0.3);
    }

    .jh-btn-success {
      background: #00C853;
      color: white;
    }

    .jh-btn-success:hover {
      background: #00E676;
      transform: translateY(-1px);
    }

    .jh-btn-xray {
      background: rgba(255,255,255,0.15);
      color: white;
      border: 1px dashed rgba(255,255,255,0.3);
    }

    .jh-btn-xray:hover {
      background: rgba(255,255,255,0.25);
      border: 1px solid rgba(255,255,255,0.5);
    }

    .jh-btn-xray.active {
      background: #FF6B35;
      border: 1px solid #FF8C42;
      animation: pulse-xray 1.5s infinite;
    }

    @keyframes pulse-xray {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(commandCenter);

  // Add event listeners
  document.getElementById('jh-find-more')?.addEventListener('click', handleGenerateQueries);
  document.getElementById('jh-insights')?.addEventListener('click', handleViewInsights);
  document.getElementById('jh-export')?.addEventListener('click', handleExportTopJobs);
  document.getElementById('jh-xray-mode')?.addEventListener('click', handleToggleXRayMode);

  // Make draggable
  makeDraggable(commandCenter);

  console.log('✅ Command Center created');
}

function updateCommandCenter(message, status = 'active') {
  const statusEl = document.querySelector('.jh-status');
  if (statusEl) {
    statusEl.textContent = message;

    // Update color based on status
    if (status === 'warning') {
      statusEl.style.background = 'rgba(245, 124, 0, 0.3)';
    } else if (status === 'error') {
      statusEl.style.background = 'rgba(229, 57, 53, 0.3)';
    } else {
      statusEl.style.background = 'rgba(255,255,255,0.15)';
    }
  }
}

function updateCommandCenterStats() {
  document.getElementById('jh-total').textContent = stats.totalScanned;
  document.getElementById('jh-high').textContent = stats.highMatch;
  document.getElementById('jh-medium').textContent = stats.mediumMatch;
  document.getElementById('jh-low').textContent = stats.lowMatch;
  document.getElementById('jh-filtered').textContent = stats.filtered;

  // Update status message
  if (stats.highMatch > 0) {
    updateCommandCenter(`✅ Found ${stats.highMatch} excellent matches!`, 'active');
  } else {
    updateCommandCenter(`🔍 Scanning... ${stats.totalScanned} jobs analyzed`, 'active');
  }
}

async function handleGenerateQueries() {
  updateCommandCenter('🧠 Generating intelligent search queries...', 'active');

  const response = await new Promise((resolve) => {
    chrome.runtime.sendMessage({
      type: 'GENERATE_SEARCH_QUERIES'
    }, resolve);
  });

  if (response?.success && response.data) {
    const { queries, count } = response.data;
    updateCommandCenter(`✅ Generated ${count} search strategies!`, 'active');

    // Open first query
    if (queries.length > 0) {
      const firstQuery = queries[0];
      const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(firstQuery)}&location=Center%20District%2C%20Israel`;
      window.open(searchUrl, '_blank');

      // Show alert with all queries
      setTimeout(() => {
        alert(`🎯 JobHunter AI Generated ${count} Search Strategies:\n\n${queries.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nOpening first search now...`);
      }, 500);
    }
  } else {
    updateCommandCenter('❌ Failed to generate queries', 'error');
  }
}

async function handleViewInsights() {
  updateCommandCenter('📊 Loading insights...', 'active');

  const response = await new Promise((resolve) => {
    chrome.runtime.sendMessage({
      type: 'GET_INSIGHTS'
    }, resolve);
  });

  if (response?.success && response.data) {
    const insights = response.data;
    const topCompanies = insights.topCompanies?.slice(0, 3) || [];

    let message = `📊 JobHunter AI Insights\n\n`;
    message += `Total Interactions: ${insights.totalInteractions}\n`;
    message += `Last 7 Days: ${insights.last7Days}\n`;
    message += `Last 30 Days: ${insights.last30Days}\n\n`;

    if (topCompanies.length > 0) {
      message += `Top Companies:\n`;
      topCompanies.forEach((comp, i) => {
        message += `${i + 1}. ${comp.company} (${comp.views} views, ${comp.applications} apps)\n`;
      });
    }

    alert(message);
    updateCommandCenter('✅ Insights loaded', 'active');
  } else {
    updateCommandCenter('❌ Failed to load insights', 'error');
  }
}

function makeDraggable(element) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  const header = element.querySelector('.jh-header');

  if (header) {
    header.onmousedown = dragMouseDown;
  }

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    element.style.top = (element.offsetTop - pos2) + "px";
    element.style.right = 'auto';
    element.style.left = (element.offsetLeft - pos1) + "px";
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

// ============================================================================
// ⚠️ SKILLS GAP ANALYSIS
// ============================================================================

function analyzeJobSkillsGap(jobData) {
  chrome.storage.local.get(['userProfile'], function(result) {
    if (!result.userProfile) return;

    const jobText = `${jobData.title} ${jobData.description || ''}`.toLowerCase();
    const userProfile = result.userProfile;

    // מילות מפתח קריטיות לפי התמחות
    const criticalKeywords = [
      'MCP', 'RAG', 'Agentic', 'n8n', 'Vector Database', 'Docker',
      'Kubernetes', 'Python', 'LangChain', 'MLOps', 'AI Infrastructure',
      'Orchestration', 'Tool Calling', 'Multi-agent'
    ];

    const missingSkills = [];
    const foundSkills = [];

    criticalKeywords.forEach(keyword => {
      if (jobText.includes(keyword.toLowerCase())) {
        // בדיקה אם המילה קיימת בפרופיל המשתמש
        const profileText = JSON.stringify(userProfile).toLowerCase();
        if (profileText.includes(keyword.toLowerCase())) {
          foundSkills.push(keyword);
        } else {
          missingSkills.push(keyword);
        }
      }
    });

    // הצגת התראה אם יש פערים
    if (missingSkills.length > 0) {
      showSkillGapAlert(missingSkills, foundSkills, jobData.company);
    }
  });
}

function showSkillGapAlert(missing, found, company) {
  // בדיקה אם כבר יש התראה פעילה
  const existingAlert = document.getElementById('jobhunter-skill-gap-alert');
  if (existingAlert) {
    existingAlert.remove();
  }

  // יצירת התראה ויזואלית
  const alertDiv = document.createElement('div');
  alertDiv.id = 'jobhunter-skill-gap-alert';
  alertDiv.style.cssText = `
    position: fixed; top: 20px; right: 20px; width: 320px;
    background: linear-gradient(135deg, #e74c3c, #c0392b);
    color: white; padding: 15px; border-radius: 10px;
    z-index: 10000; font-family: 'Segoe UI', sans-serif;
    box-shadow: 0 8px 25px rgba(0,0,0,0.3);
    border-left: 5px solid #fff;
    animation: slideInRight 0.4s ease-out;
  `;

  alertDiv.innerHTML = `
    <div style="display: flex; align-items: center; margin-bottom: 10px;">
      <span style="font-size: 18px; margin-right: 8px;">⚠️</span>
      <strong>Skills Gap Alert - ${company}</strong>
    </div>

    ${found.length > 0 ? `
    <div style="margin-bottom: 8px;">
      <strong style="color: #2ecc71;">✅ You have:</strong><br>
      <span style="font-size: 12px; background: rgba(46,204,113,0.2); padding: 2px 6px; border-radius: 3px; margin: 2px; display: inline-block;">
        ${found.join('</span> <span style="font-size: 12px; background: rgba(46,204,113,0.2); padding: 2px 6px; border-radius: 3px; margin: 2px; display: inline-block;">')}
      </span>
    </div>
    ` : ''}

    <div style="margin-bottom: 10px;">
      <strong style="color: #f39c12;">⚠️ Missing from your profile:</strong><br>
      <span style="font-size: 12px; background: rgba(241,196,15,0.3); padding: 2px 6px; border-radius: 3px; margin: 2px; display: inline-block;">
        ${missing.join('</span> <span style="font-size: 12px; background: rgba(241,196,15,0.3); padding: 2px 6px; border-radius: 3px; margin: 2px; display: inline-block;">')}
      </span>
    </div>

    <div style="font-size: 11px; opacity: 0.9; line-height: 1.4;">
      💡 Add these keywords to your LinkedIn About section to pass ATS filtering
    </div>

    <button onclick="this.parentElement.remove()" style="
      position: absolute; top: 5px; right: 8px;
      background: none; border: none; color: white;
      font-size: 20px; cursor: pointer; opacity: 0.7;
      line-height: 1;
    ">×</button>
  `;

  // Add animation style
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(alertDiv);

  // העלמה אוטומטית אחרי 15 שניות
  setTimeout(() => {
    if (alertDiv.parentElement) {
      alertDiv.style.animation = 'slideOutRight 0.4s ease-out';
      setTimeout(() => alertDiv.remove(), 400);
    }
  }, 15000);

  console.log(`⚠️ Skills gap detected for ${company}: Missing ${missing.length} skills`);
}

// ============================================================================
// 📥 EXPORT TOP 10 JOBS
// ============================================================================

let trackedJobs = []; // Store all analyzed jobs

async function handleExportTopJobs() {
  updateCommandCenter('📥 Preparing export...', 'active');

  // Get top 10 jobs from tracked jobs (50%+ decent matches)
  const topJobs = trackedJobs
    .filter(job => job.score >= 50)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  if (topJobs.length === 0) {
    alert('No high-quality jobs found yet. Keep browsing!');
    updateCommandCenter('⚠️ No jobs to export', 'warning');
    return;
  }

  // Generate CSV
  let csv = 'Rank,Score,Title,Company,Location,Reason,LinkedIn_URL\n';
  topJobs.forEach((job, index) => {
    const cleanTitle = (job.title || '').replace(/,/g, ';');
    const cleanCompany = (job.company || '').replace(/,/g, ';');
    const cleanReason = (job.reason || '').replace(/,/g, ';');
    const url = job.url || window.location.href;

    csv += `${index + 1},${job.score},"${cleanTitle}","${cleanCompany}","${job.location || 'N/A'}","${cleanReason}","${url}"\n`;
  });

  // Download CSV
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `JobHunter_Top10_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  updateCommandCenter(`✅ Exported ${topJobs.length} top jobs!`, 'active');

  // Show summary
  setTimeout(() => {
    alert(`📥 JobHunter AI Export Complete!\n\n✅ Exported ${topJobs.length} top jobs\n🔥 Average Score: ${Math.round(topJobs.reduce((sum, j) => sum + j.score, 0) / topJobs.length)}%\n\nFile saved to your Downloads folder!`);
  }, 500);
}

// ============================================================================
// 🔬 X-RAY MODE - 1-Click Job Analysis
// ============================================================================

let xrayModeEnabled = false;

function handleToggleXRayMode() {
  xrayModeEnabled = !xrayModeEnabled;
  const btn = document.getElementById('jh-xray-mode');

  if (xrayModeEnabled) {
    btn.textContent = '🔬 X-Ray Mode: ON';
    btn.classList.add('active');
    updateCommandCenter('🔬 X-Ray Mode Active - Click any job!', 'active');
    enableXRayMode();
  } else {
    btn.textContent = '🔬 X-Ray Mode: OFF';
    btn.classList.remove('active');
    updateCommandCenter('🎯 Agent scanning...', 'active');
    disableXRayMode();
  }
}

function enableXRayMode() {
  // Add click listeners to all job cards
  document.addEventListener('click', handleXRayClick, true);
  console.log('🔬 X-Ray Mode enabled - click any job for instant analysis');
}

function disableXRayMode() {
  document.removeEventListener('click', handleXRayClick, true);
  console.log('🔬 X-Ray Mode disabled');
}

async function handleXRayClick(event) {
  if (!xrayModeEnabled) return;

  // Find the job card element
  const jobCard = event.target.closest('[data-job-id], .job-card-container, .jobs-search-results__list-item');
  if (!jobCard) return;

  event.preventDefault();
  event.stopPropagation();

  // Extract job data
  const titleEl = jobCard.querySelector('.job-card-list__title, .artdeco-entity-lockup__title');
  const companyEl = jobCard.querySelector('.job-card-container__company-name, .artdeco-entity-lockup__subtitle');

  if (!titleEl) return;

  const jobData = {
    title: titleEl.textContent.trim(),
    company: companyEl?.textContent.trim() || 'Unknown Company'
  };

  updateCommandCenter('🔬 X-Ray analyzing job...', 'active');

  // Get instant analysis
  const response = await new Promise((resolve) => {
    chrome.runtime.sendMessage({
      type: 'CALCULATE_MATCH',
      jobData: jobData
    }, resolve);
  });

  if (response?.success && response.data) {
    const { score, reason, breakdown } = response.data;

    // Show instant analysis popup
    const popup = document.createElement('div');
    popup.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 24px;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      z-index: 999999;
      max-width: 500px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    popup.innerHTML = `
      <div style="font-size: 24px; font-weight: bold; margin-bottom: 16px;">
        🔬 X-Ray Analysis
      </div>
      <div style="font-size: 18px; margin-bottom: 8px;">
        ${jobData.title}
      </div>
      <div style="font-size: 14px; opacity: 0.9; margin-bottom: 16px;">
        ${jobData.company}
      </div>
      <div style="font-size: 48px; font-weight: bold; text-align: center; margin: 20px 0; text-shadow: 0 4px 8px rgba(0,0,0,0.3);">
        ${score}%
      </div>
      <div style="background: rgba(255,255,255,0.15); padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 13px;">
        ${reason}
      </div>
      ${breakdown ? `
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 16px; font-size: 12px;">
        <div style="background: rgba(255,255,255,0.1); padding: 8px; border-radius: 6px;">
          <div style="opacity: 0.8;">Title Match</div>
          <div style="font-weight: bold; font-size: 16px;">${breakdown.title}%</div>
        </div>
        <div style="background: rgba(255,255,255,0.1); padding: 8px; border-radius: 6px;">
          <div style="opacity: 0.8;">Location</div>
          <div style="font-weight: bold; font-size: 16px;">${breakdown.location}%</div>
        </div>
        <div style="background: rgba(255,255,255,0.1); padding: 8px; border-radius: 6px;">
          <div style="opacity: 0.8;">Keywords</div>
          <div style="font-weight: bold; font-size: 16px;">${breakdown.keywords}%</div>
        </div>
        <div style="background: rgba(255,255,255,0.1); padding: 8px; border-radius: 6px;">
          <div style="opacity: 0.8;">Seniority</div>
          <div style="font-weight: bold; font-size: 16px;">${breakdown.seniority}%</div>
        </div>
      </div>
      ` : ''}
      <button onclick="this.parentElement.remove()" style="
        width: 100%;
        padding: 12px;
        background: white;
        color: #667eea;
        border: none;
        border-radius: 8px;
        font-weight: bold;
        font-size: 14px;
        cursor: pointer;
      ">Close</button>
    `;

    document.body.appendChild(popup);

    // Auto-close after 8 seconds
    setTimeout(() => {
      if (popup.parentElement) popup.remove();
    }, 8000);

    updateCommandCenter(`🔬 Analyzed: ${score}%`, 'active');
  }
}

console.log('✅ JobHunter AI: GOD MODE ENABLED! 🚀🔥');
