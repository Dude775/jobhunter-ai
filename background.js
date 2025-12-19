// 🤖 JobHunter AI - Autonomous Intelligent Recruitment Agent
// Revolutionary background service worker with AI-powered job hunting automation

console.log('🚀 JobHunter AI: Autonomous Agent Initialized');

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

const CONFIG = {
  API_RATE_LIMIT: 10, // API calls per minute
  BATCH_SIZE: 5, // Jobs to analyze in one batch
  BLACKLIST_KEYWORDS: ['SAP', 'ERP', 'implementer', 'יישום', 'מיישם', 'legacy', 'COBOL', 'mainframe'],
  PRIORITY_KEYWORDS: ['RAG', 'AI', 'ML', 'n8n', 'Docker', 'Kubernetes', 'automation', 'infrastructure'],
  PREFERRED_LOCATIONS: ['Center District', 'Tel Aviv', 'Remote'],
  MIN_MATCH_THRESHOLD: 60
};

// Rate limiting tracker
const rateLimiter = {
  calls: [],
  canMakeCall() {
    const now = Date.now();
    this.calls = this.calls.filter(time => now - time < 60000);
    return this.calls.length < CONFIG.API_RATE_LIMIT;
  },
  recordCall() {
    this.calls.push(Date.now());
  }
};

// ============================================================================
// MESSAGE ROUTER
// ============================================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log(`📨 Received message: ${request.type}`);

  // Route messages to appropriate handlers
  const handlers = {
    'ANALYZE_CV': () => handleCVAnalysis(request.apiKey, request.cvText),
    'CALCULATE_MATCH': () => handleMatchCalculation(request.jobData),
    'GENERATE_SEARCH_QUERIES': () => handleGenerateSearchQueries(request.apiKey),
    'BATCH_ANALYZE_JOBS': () => handleBatchAnalyzeJobs(request.apiKey, request.jobs),
    'FILTER_JOB': () => handleFilterJob(request.jobData),
    'GENERATE_COVER_LETTER': () => handleGenerateCoverLetter(request.apiKey, request.jobData),
    'TRACK_INTERACTION': () => handleTrackInteraction(request.interaction),
    'GET_INSIGHTS': () => handleGetInsights(),
    'AUTO_APPLY': () => handleAutoApply(request.jobData)
  };

  const handler = handlers[request.type];

  if (handler) {
    handler()
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => {
        console.error(`❌ Error in ${request.type}:`, error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Async response
  }

  // Legacy handlers
  if (request.type === 'GET_MATCH_SCORE') {
    sendResponse({ score: 0 });
  }
  if (request.type === 'START_EASY_APPLY') {
    sendResponse({ success: false });
  }
});

// ============================================================================
// 🧠 FEATURE 1: INTELLIGENT SEARCH QUERY GENERATOR
// ============================================================================

async function handleGenerateSearchQueries(apiKey) {
  console.log('🔍 Generating intelligent search queries...');

  const { userProfile } = await chrome.storage.local.get(['userProfile']);
  if (!userProfile) {
    throw new Error('User profile not configured');
  }

  if (!apiKey) {
    const { apiKey: storedKey } = await chrome.storage.local.get(['apiKey']);
    apiKey = storedKey;
  }

  if (!apiKey) {
    throw new Error('API key not configured');
  }

  const prompt = `You are an expert AI recruitment strategist. Based on this user profile, generate 6-8 highly targeted LinkedIn job search queries.

User Profile:
- Skills: ${userProfile.skills?.join(', ') || 'N/A'}
- Tech Stack: ${userProfile.techStack?.join(', ') || 'N/A'}
- Experience: ${userProfile.experience?.map(exp => exp.title).join(', ') || 'N/A'}
- Seniority: ${userProfile.seniorityLevel || 'Senior'}
- Summary: ${userProfile.summary || 'N/A'}

REQUIREMENTS:
1. Focus on roles matching: RAG Engineer, AI/ML Engineer, DevOps+AI, Technical Lead, n8n Automation
2. Each query should be 2-4 words maximum
3. Prioritize: AI infrastructure, automation, MLOps, RAG systems
4. AVOID: SAP, ERP, implementation, legacy systems
5. Include variations: different titles for same skills

Return ONLY a JSON array of search query strings:
["query1", "query2", "query3", ...]`;

  try {
    if (!rateLimiter.canMakeCall()) {
      console.warn('⚠️ Rate limit reached, waiting...');
      await sleep(2000);
    }

    rateLimiter.recordCall();

    const response = await callClaudeAPI(apiKey, prompt, 1000);
    let queries = JSON.parse(response);

    // Filter out queries with blacklisted keywords
    queries = queries.filter(query =>
      !CONFIG.BLACKLIST_KEYWORDS.some(keyword =>
        query.toLowerCase().includes(keyword.toLowerCase())
      )
    );

    console.log(`✅ Generated ${queries.length} search queries:`, queries);

    // Store for analytics
    await chrome.storage.local.set({
      lastGeneratedQueries: queries,
      lastQueryGeneration: Date.now()
    });

    return { queries, count: queries.length };
  } catch (error) {
    console.error('❌ Search query generation failed:', error);
    // 🚀 GOD MODE FALLBACK - Auto-suggest 5 winning searches
    return {
      queries: [
        'AI Engineer Israel',
        'RAG Engineer Israel',
        'Senior ML Engineer Israel',
        'AI Infrastructure Israel',
        'MLOps Engineer Remote',
        'n8n Automation Israel',
        'Agentic AI Israel',
        'LLM Engineer Israel'
      ],
      count: 8,
      fallback: true,
      message: '🎯 GOD MODE: Auto-suggested winning searches!'
    };
  }
}

// ============================================================================
// 🎯 FEATURE 2: ENHANCED BATCH JOB ANALYZER
// ============================================================================

async function handleBatchAnalyzeJobs(apiKey, jobs) {
  console.log(`📊 Batch analyzing ${jobs.length} jobs...`);

  if (!apiKey) {
    const { apiKey: storedKey } = await chrome.storage.local.get(['apiKey']);
    apiKey = storedKey;
  }

  const { userProfile } = await chrome.storage.local.get(['userProfile']);
  if (!userProfile) {
    throw new Error('User profile not configured');
  }

  const prompt = `You are an expert job matching AI. Analyze these job postings against the user's profile and score each one.

User Profile:
- Skills: ${userProfile.skills?.join(', ')}
- Tech Stack: ${userProfile.techStack?.join(', ')}
- Seniority: ${userProfile.seniorityLevel}
- Summary: ${userProfile.summary}

SCORING CRITERIA (0-100):
- RAG/AI/ML keywords: +30 points
- Senior/Lead position: +20 points
- Modern tech stack match: +20 points
- Remote/preferred location: +10 points
- Company type (startup/AI company): +10 points
- Avoid: SAP/ERP/legacy (-50 points)

Jobs to analyze:
${jobs.map((job, i) => `${i + 1}. ${job.title} at ${job.company}`).join('\n')}

Return ONLY a JSON array of objects:
[
  {"index": 0, "score": 95, "reason": "Perfect RAG Engineer role with modern stack"},
  ...
]`;

  try {
    if (!rateLimiter.canMakeCall()) {
      await sleep(2000);
    }

    rateLimiter.recordCall();

    const response = await callClaudeAPI(apiKey, prompt, 1500);
    const results = JSON.parse(response);

    console.log(`✅ Batch analysis complete: ${results.length} jobs scored`);

    return results;
  } catch (error) {
    console.error('❌ Batch analysis failed:', error);
    // Fallback to basic keyword matching
    return jobs.map((job, index) => ({
      index,
      score: calculateBasicScore(job, userProfile),
      reason: 'Basic keyword matching (API error)'
    }));
  }
}

// ============================================================================
// 🚫 FEATURE 3: AUTONOMOUS FILTERING ENGINE
// ============================================================================

async function handleFilterJob(jobData) {
  console.log(`🔍 Filtering job: ${jobData.title} at ${jobData.company}`);

  // Get user preferences and learning data
  const { userPreferences, interactionHistory } = await chrome.storage.local.get([
    'userPreferences',
    'interactionHistory'
  ]);

  const filters = {
    blacklist: CONFIG.BLACKLIST_KEYWORDS,
    whitelist: CONFIG.PRIORITY_KEYWORDS,
    hiddenCompanies: userPreferences?.hiddenCompanies || [],
    preferredCompanies: userPreferences?.preferredCompanies || []
  };

  // Check blacklist
  const jobText = `${jobData.title} ${jobData.company} ${jobData.description || ''}`.toLowerCase();
  const hasBlacklistKeyword = filters.blacklist.some(keyword =>
    jobText.includes(keyword.toLowerCase())
  );

  if (hasBlacklistKeyword) {
    console.log(`❌ Job filtered out: contains blacklisted keyword`);
    return {
      shouldShow: false,
      reason: 'Contains excluded keywords (SAP/ERP/legacy)',
      action: 'hide'
    };
  }

  // Check hidden companies
  if (filters.hiddenCompanies.includes(jobData.company)) {
    return {
      shouldShow: false,
      reason: 'Company hidden by user',
      action: 'hide'
    };
  }

  // Calculate priority score
  const priorityScore = filters.whitelist.reduce((score, keyword) => {
    return score + (jobText.includes(keyword.toLowerCase()) ? 1 : 0);
  }, 0);

  // Check if company is preferred
  const isPreferred = filters.preferredCompanies.includes(jobData.company);

  return {
    shouldShow: true,
    priority: priorityScore + (isPreferred ? 5 : 0),
    reason: priorityScore > 0 ? `Matches ${priorityScore} priority keywords` : 'Normal job',
    action: priorityScore >= 3 ? 'highlight' : 'show'
  };
}

// ============================================================================
// ✍️ FEATURE 4: SMART COVER LETTER GENERATOR
// ============================================================================

async function handleGenerateCoverLetter(apiKey, jobData) {
  console.log(`📝 Generating cover letter for: ${jobData.title}`);

  const { userProfile } = await chrome.storage.local.get(['userProfile']);
  if (!userProfile) {
    throw new Error('User profile not configured');
  }

  if (!apiKey) {
    const { apiKey: storedKey } = await chrome.storage.local.get(['apiKey']);
    apiKey = storedKey;
  }

  const prompt = `You are an expert career coach. Write a compelling, concise cover letter for this job application.

Job Details:
Title: ${jobData.title}
Company: ${jobData.company}
Description: ${jobData.description || 'Not provided'}

Candidate Profile:
${userProfile.summary}
Key Skills: ${userProfile.skills?.slice(0, 8).join(', ')}
Tech Stack: ${userProfile.techStack?.slice(0, 8).join(', ')}
Experience: ${userProfile.experience?.[0]?.title} at ${userProfile.experience?.[0]?.company}

REQUIREMENTS:
- 3-4 short paragraphs maximum
- Professional but enthusiastic tone
- Highlight relevant AI/ML/RAG experience
- Connect skills directly to job requirements
- Show genuine interest in the role
- End with clear call to action

Return the cover letter text directly (no JSON, no quotes).`;

  try {
    rateLimiter.recordCall();
    const coverLetter = await callClaudeAPI(apiKey, prompt, 800);

    console.log('✅ Cover letter generated');

    // Track generation for analytics
    await trackInteraction({
      type: 'cover_letter_generated',
      jobTitle: jobData.title,
      company: jobData.company,
      timestamp: Date.now()
    });

    return { coverLetter };
  } catch (error) {
    console.error('❌ Cover letter generation failed:', error);
    throw error;
  }
}

// ============================================================================
// 📊 FEATURE 5: LEARNING & TRACKING SYSTEM
// ============================================================================

async function handleTrackInteraction(interaction) {
  console.log(`📊 Tracking interaction: ${interaction.type}`);

  const { interactionHistory = [] } = await chrome.storage.local.get(['interactionHistory']);

  interactionHistory.push({
    ...interaction,
    timestamp: Date.now()
  });

  // Keep last 500 interactions
  const trimmedHistory = interactionHistory.slice(-500);

  await chrome.storage.local.set({ interactionHistory: trimmedHistory });

  // Update analytics
  await updateAnalytics(interaction);

  return { tracked: true };
}

async function updateAnalytics(interaction) {
  const { analytics = {} } = await chrome.storage.local.get(['analytics']);

  if (!analytics.interactions) analytics.interactions = {};
  if (!analytics.companies) analytics.companies = {};
  if (!analytics.keywords) analytics.keywords = {};

  // Track interaction types
  analytics.interactions[interaction.type] = (analytics.interactions[interaction.type] || 0) + 1;

  // Track companies
  if (interaction.company) {
    if (!analytics.companies[interaction.company]) {
      analytics.companies[interaction.company] = { views: 0, clicks: 0, applications: 0 };
    }

    if (interaction.type === 'job_viewed') analytics.companies[interaction.company].views++;
    if (interaction.type === 'job_clicked') analytics.companies[interaction.company].clicks++;
    if (interaction.type === 'job_applied') analytics.companies[interaction.company].applications++;
  }

  await chrome.storage.local.set({ analytics });
}

async function handleGetInsights() {
  const { analytics = {}, interactionHistory = [] } = await chrome.storage.local.get([
    'analytics',
    'interactionHistory'
  ]);

  const now = Date.now();
  const last7Days = interactionHistory.filter(i => now - i.timestamp < 7 * 24 * 60 * 60 * 1000);
  const last30Days = interactionHistory.filter(i => now - i.timestamp < 30 * 24 * 60 * 60 * 1000);

  return {
    totalInteractions: interactionHistory.length,
    last7Days: last7Days.length,
    last30Days: last30Days.length,
    topCompanies: Object.entries(analytics.companies || {})
      .sort(([, a], [, b]) => (b.clicks + b.applications) - (a.clicks + a.applications))
      .slice(0, 5)
      .map(([company, stats]) => ({ company, ...stats })),
    interactionBreakdown: analytics.interactions || {},
    analytics
  };
}

// ============================================================================
// 🤖 FEATURE 6: AUTO-APPLY ASSISTANT
// ============================================================================

async function handleAutoApply(jobData) {
  console.log(`🎯 Auto-apply initiated for: ${jobData.title}`);

  const { userProfile } = await chrome.storage.local.get(['userProfile']);
  if (!userProfile) {
    throw new Error('User profile not configured');
  }

  // Track application
  await trackInteraction({
    type: 'job_applied',
    jobTitle: jobData.title,
    company: jobData.company,
    method: 'auto_apply'
  });

  return {
    success: true,
    prefillData: {
      email: userProfile.email || '',
      phone: userProfile.phone || '',
      linkedin: userProfile.linkedinUrl || '',
      portfolio: userProfile.portfolio || '',
      message: `Enthusiastic ${userProfile.seniorityLevel} professional with expertise in ${userProfile.techStack?.slice(0, 3).join(', ')}`
    }
  };
}

// ============================================================================
// 🔧 CORE: CV ANALYSIS (Enhanced)
// ============================================================================

async function handleCVAnalysis(apiKey, cvText) {
  if (!apiKey || !cvText) {
    throw new Error('Missing API key or CV text');
  }

  const prompt = `Analyze this AI Engineer profile and extract SIMPLE keywords only.

Profile:
${cvText.substring(0, 4000)}

Return ONLY valid JSON with SIMPLE, SINGLE-WORD keywords:
{
  "summary": "Brief professional summary",
  "skills": ["RAG Systems", "AI Infrastructure", "n8n Automation", "Docker", "Python"],
  "techStack": ["RAG", "n8n", "Docker", "Python", "Kubernetes", "Vector", "LLM", "React"],
  "seniorityLevel": "Senior",
  "experience": [{"title": "AI Engineer", "company": "TechCorp", "duration": "2 years", "description": "Built RAG systems"}],
  "education": [{"degree": "BS Computer Science", "institution": "University", "year": "2020"}],
  "email": "email@example.com",
  "phone": "+972-XX-XXX-XXXX",
  "linkedinUrl": "https://linkedin.com/in/username"
}

CRITICAL REQUIREMENTS:
- techStack must be SINGLE WORDS or max 2-word phrases
- NO colons (:), NO lists like "Vector Databases: Pinecone"
- SIMPLE keywords only: "RAG", "Docker", "Python", "n8n"
- NO framework lists or detailed descriptions
- Max 15 items in techStack array
- Each techStack item must be a clean keyword, not a sentence

Return ONLY valid JSON, no other text.`;

  try {
    rateLimiter.recordCall();
    const response = await callClaudeAPI(apiKey, prompt, 4000);
    const analysis = JSON.parse(response);

    console.log('✅ CV analyzed successfully');

    // Store user profile
    await chrome.storage.local.set({ userProfile: analysis });

    return analysis;
  } catch (error) {
    console.error('CV Analysis Error:', error);
    throw error;
  }
}

// ============================================================================
// 🎯 CORE: ENHANCED MATCH CALCULATION
// ============================================================================

async function handleMatchCalculation(jobData) {
  const { apiKey, userProfile } = await chrome.storage.local.get(['apiKey', 'userProfile']);

  if (!userProfile) {
    // Fallback to basic keyword matching
    return calculateBasicMatch(jobData);
  }

  if (!apiKey) {
    return calculateBasicMatch(jobData);
  }

  const prompt = `You are an expert job matching AI. Analyze this job against the user's profile.

Job:
Title: ${jobData.title}
Company: ${jobData.company}
Description: ${jobData.description || 'Not provided'}

User Profile:
Skills: ${userProfile.skills?.join(', ')}
Tech Stack: ${userProfile.techStack?.join(', ')}
Seniority: ${userProfile.seniorityLevel}
Summary: ${userProfile.summary}

SCORING RULES:
- Perfect RAG/AI/ML role: 90-100
- Strong tech stack match: 80-95
- Good fit with some gaps: 60-79
- Mediocre fit: 40-59
- Poor fit or contains SAP/ERP: 0-39

Return ONLY JSON:
{"score": <0-100>, "reason": "<one sentence>"}`;

  try {
    if (!rateLimiter.canMakeCall()) {
      return calculateBasicMatch(jobData);
    }

    rateLimiter.recordCall();

    const response = await callClaudeAPI(apiKey, prompt, 500);
    const result = JSON.parse(response);

    // Track this scoring for learning
    await trackInteraction({
      type: 'job_scored',
      jobTitle: jobData.title,
      company: jobData.company,
      score: result.score
    });

    return result;
  } catch (error) {
    console.error('Match calculation error:', error);
    return calculateBasicMatch(jobData);
  }
}

// ============================================================================
// 🛠️ UTILITY FUNCTIONS
// ============================================================================

async function callClaudeAPI(apiKey, prompt, maxTokens = 1000) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: maxTokens,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  const content = data.content[0].text;

  // Extract JSON if present
  const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  return content;
}

function calculateBasicMatch(jobData) {
  // 🚀 GOD MODE ALGORITHM - Title-First Weighted Scoring System

  // ============================================================================
  // DEBUG VERIFICATION
  // ============================================================================
  console.log(`🔍 ANALYZING: ${jobData.title}`);
  console.log(`📄 Description length: ${jobData.description?.length || 0} chars`);
  console.log(`📍 Location: ${jobData.location || 'MISSING'}`);
  console.log(`🏢 Company: ${jobData.company || 'Unknown'}`);

  const jobTitle = (jobData.title || '').toLowerCase();
  const jobCompany = (jobData.company || '').toLowerCase();
  const jobDescription = (jobData.description || '').toLowerCase();
  const jobLocation = (jobData.location || '').toLowerCase();
  const jobText = `${jobTitle} ${jobCompany} ${jobDescription} ${jobLocation}`;

  let titleScore = 0;
  let locationScore = 0;
  let keywordScore = 0;
  let negativeScore = 0;
  let seniorityScore = 0;

  let matchDetails = [];

  // Warning if description is missing
  if (!jobData.description || jobData.description.length < 50) {
    console.warn(`⚠️ CRITICAL: No description found - scoring will be title-only!`);
    matchDetails.push(`⚠️ Title-only analysis (no job description)`);
  }

  // ============================================================================
  // PHASE 1: TITLE-FIRST MATCHING (50% weight)
  // ============================================================================
  const targetTitles = [
    { keywords: ['ai engineer', 'artificial intelligence engineer'], points: 50 },
    { keywords: ['ai infrastructure', 'ml infrastructure'], points: 50 },
    { keywords: ['ai systems', 'ml systems'], points: 50 },
    { keywords: ['ml engineer', 'machine learning engineer'], points: 50 },
    { keywords: ['mlops engineer', 'mlops'], points: 50 },
    { keywords: ['rag developer', 'rag engineer'], points: 50 },
    { keywords: ['agentic'], points: 50 },
    { keywords: ['llm engineer', 'large language model'], points: 50 },
    { keywords: ['ai architect', 'ml architect'], points: 48 },
    { keywords: ['data scientist'], points: 40 },
    { keywords: ['backend engineer', 'backend developer'], points: 35 },
    { keywords: ['full stack'], points: 30 },
    { keywords: ['devops engineer'], points: 35 },
    { keywords: ['software engineer'], points: 30 }
  ];

  for (const titleGroup of targetTitles) {
    if (titleGroup.keywords.some(keyword => jobTitle.includes(keyword))) {
      titleScore = titleGroup.points;
      matchDetails.push(`✅ Title: "${jobData.title}" (+${titleGroup.points}%)`);
      break;
    }
  }

  // ============================================================================
  // PHASE 2: LOCATION MATCHING (20% weight)
  // ============================================================================
  const preferredLocations = [
    { keywords: ['israel'], points: 20 },
    { keywords: ['tel aviv', 'tel-aviv'], points: 20 },
    { keywords: ['remote'], points: 20 },
    { keywords: ['hybrid'], points: 18 },
    { keywords: ['center district', 'merkaz'], points: 20 },
    { keywords: ['herzliya', 'raanana', 'petah tikva'], points: 18 }
  ];

  for (const location of preferredLocations) {
    if (location.keywords.some(keyword => jobText.includes(keyword))) {
      locationScore = location.points;
      matchDetails.push(`📍 Location: Israel/Remote (+${location.points}%)`);
      break;
    }
  }

  // ============================================================================
  // PHASE 3: GOLD KEYWORDS (20% weight)
  // ============================================================================
  const primaryKeywords = [
    { keyword: 'rag', points: 5, label: 'RAG' },
    { keyword: 'mcp', points: 5, label: 'MCP' },
    { keyword: 'agentic', points: 5, label: 'Agentic' },
    { keyword: 'mlops', points: 5, label: 'MLOps' }
  ];

  const secondaryKeywords = [
    { keyword: 'n8n', points: 2, label: 'n8n' },
    { keyword: 'docker', points: 2, label: 'Docker' },
    { keyword: 'python', points: 2, label: 'Python' },
    { keyword: 'vector', points: 2, label: 'Vector DB' },
    { keyword: 'langchain', points: 2, label: 'LangChain' },
    { keyword: 'kubernetes', points: 2, label: 'Kubernetes' },
    { keyword: 'pytorch', points: 2, label: 'PyTorch' },
    { keyword: 'tensorflow', points: 2, label: 'TensorFlow' },
    { keyword: 'llm', points: 2, label: 'LLM' },
    { keyword: 'embedding', points: 2, label: 'Embeddings' }
  ];

  let keywordMatches = [];

  primaryKeywords.forEach(({ keyword, points, label }) => {
    if (jobText.includes(keyword)) {
      keywordScore += points;
      keywordMatches.push(label);
    }
  });

  secondaryKeywords.forEach(({ keyword, points, label }) => {
    if (jobText.includes(keyword)) {
      keywordScore += points;
      keywordMatches.push(label);
    }
  });

  if (keywordMatches.length > 0) {
    matchDetails.push(`🔑 Keywords: ${keywordMatches.join(', ')} (+${keywordScore}%)`);
  }

  // Cap at 20%
  keywordScore = Math.min(20, keywordScore);

  // ============================================================================
  // PHASE 4: NEGATIVE FILTERS (-20% penalty max)
  // ============================================================================
  const negativeFilters = [
    // HIGH PRIORITY PENALTIES - Different focus areas
    { keywords: ['computer vision', 'cv engineer', 'image processing', 'opencv'], penalty: -20, label: 'Computer Vision (not RAG)' },
    { keywords: ['frontend', 'react developer', 'vue', 'angular developer'], penalty: -15, label: 'Frontend-focused' },
    { keywords: ['mobile developer', 'ios', 'android developer'], penalty: -15, label: 'Mobile-focused' },
    { keywords: ['game developer', 'unity', 'unreal engine'], penalty: -15, label: 'Game Development' },

    // MEDIUM PRIORITY PENALTIES - Wrong industry/role
    { keywords: ['qa engineer', 'qa automation', 'quality assurance'], penalty: -10, label: 'QA-only' },
    { keywords: ['sap', 'sap implementation', 'sap consultant'], penalty: -15, label: 'SAP/ERP' },
    { keywords: ['erp consultant', 'erp implementation'], penalty: -15, label: 'ERP' },
    { keywords: ['marketing', 'digital marketing'], penalty: -10, label: 'Marketing' },
    { keywords: ['manual tester', 'manual testing'], penalty: -12, label: 'Manual Testing' },
    { keywords: ['support engineer', 'customer support'], penalty: -8, label: 'Support' },
    { keywords: ['legacy systems', 'cobol', 'mainframe'], penalty: -12, label: 'Legacy Tech' },

    // LOW PRIORITY PENALTIES - Data roles (sometimes relevant)
    { keywords: ['data analyst', 'business analyst'], penalty: -8, label: 'Analysis-only' },
    { keywords: ['bi developer', 'tableau', 'power bi'], penalty: -8, label: 'BI-focused' }
  ];

  let negativeMatches = [];

  negativeFilters.forEach(({ keywords, penalty, label }) => {
    if (keywords.some(keyword => jobText.includes(keyword))) {
      // Special handling: Computer Vision is OK if RAG/LLM is also mentioned
      if (label.includes('Computer Vision')) {
        if (jobText.includes('rag') || jobText.includes('llm') || jobText.includes('language model')) {
          negativeScore += penalty / 3; // Reduced penalty
          negativeMatches.push(`${label} + AI (reduced, -${Math.abs(penalty / 3)}%)`);
        } else {
          negativeScore += penalty;
          negativeMatches.push(`${label} (${penalty}%)`);
        }
      }
      // Reduced penalty if AI/ML/Automation is also mentioned
      else if (jobText.includes('ai infrastructure') || jobText.includes('mlops') || jobText.includes('machine learning platform')) {
        negativeScore += penalty / 2;
        negativeMatches.push(`${label} (AI-related, -${Math.abs(penalty / 2)}%)`);
      } else {
        negativeScore += penalty;
        negativeMatches.push(`${label} (${penalty}%)`);
      }
    }
  });

  if (negativeMatches.length > 0) {
    matchDetails.push(`⚠️ Negatives: ${negativeMatches.join(', ')}`);
  }

  // Cap negative score at -20%
  negativeScore = Math.max(-20, negativeScore);

  // ============================================================================
  // PHASE 5: SENIORITY BOOST (10% weight)
  // ============================================================================
  const seniorityLevels = [
    { keywords: ['senior', 'sr.', 'staff'], points: 10, label: 'Senior/Staff' },
    { keywords: ['lead', 'principal', 'architect'], points: 10, label: 'Lead/Principal' },
    { keywords: ['mid-level', 'mid level', 'intermediate'], points: 7, label: 'Mid-Level' },
    { keywords: ['junior', 'jr.', 'entry level'], points: 5, label: 'Junior (opportunity!)' }
  ];

  for (const level of seniorityLevels) {
    if (level.keywords.some(keyword => jobTitle.includes(keyword))) {
      seniorityScore = level.points;
      matchDetails.push(`👔 Seniority: ${level.label} (+${level.points}%)`);
      break;
    }
  }

  // ============================================================================
  // CALCULATE FINAL SCORE
  // ============================================================================
  const finalScore = Math.max(0, Math.min(100,
    titleScore + locationScore + keywordScore + negativeScore + seniorityScore
  ));

  // Generate reason with color coding
  let reason = '';
  let emoji = '';

  if (finalScore >= 95) {
    emoji = '🔥';
    reason = `${emoji} DREAM JOB! ${matchDetails.join(' • ')}`;
  } else if (finalScore >= 85) {
    emoji = '🟢';
    reason = `${emoji} Excellent Match! ${matchDetails.slice(0, 3).join(' • ')}`;
  } else if (finalScore >= 70) {
    emoji = '🟡';
    reason = `${emoji} Strong Match. ${matchDetails.slice(0, 2).join(' • ')}`;
  } else if (finalScore >= 50) {
    emoji = '🟠';
    reason = `${emoji} Decent Match. ${matchDetails.slice(0, 2).join(' • ')}`;
  } else {
    emoji = '⚫';
    reason = `${emoji} Weak Match. ${negativeMatches.length > 0 ? negativeMatches.join(', ') : 'Low relevance'}`;
  }

  // ============================================================================
  // DETAILED DEBUG OUTPUT
  // ============================================================================
  console.log(`
╔═══════════════════════════════════════════════════════════════════════════╗
║ 🎯 GOD MODE ANALYSIS COMPLETE                                            ║
╠═══════════════════════════════════════════════════════════════════════════╣
║ Job: ${jobData.title?.substring(0, 60)}
║ Company: ${jobData.company}
║ Location: ${jobData.location || 'N/A'}
║ Description: ${jobData.description ? `${jobData.description.length} chars` : 'MISSING!'}
╠═══════════════════════════════════════════════════════════════════════════╣
║ SCORING BREAKDOWN:
║   📌 Title Match:     ${titleScore}% (50% max)
║   📍 Location:        ${locationScore}% (20% max)
║   🔑 Keywords:        ${keywordScore}% (20% max)
║   ⚠️  Negative:        ${negativeScore}% (penalty)
║   👔 Seniority:       ${seniorityScore}% (10% max)
║   ─────────────────────────────────────
║   🎯 FINAL SCORE:     ${finalScore}%
╠═══════════════════════════════════════════════════════════════════════════╣
║ ${reason.substring(0, 70)}
╚═══════════════════════════════════════════════════════════════════════════╝
  `);

  return {
    score: finalScore,
    reason,
    breakdown: {
      title: titleScore,
      location: locationScore,
      keywords: keywordScore,
      negative: negativeScore,
      seniority: seniorityScore
    }
  };
}

function calculateBasicScore(job, userProfile) {
  const jobText = `${job.title} ${job.company}`.toLowerCase();
  let score = 50;

  // Check tech stack matches
  const userTech = (userProfile.techStack || []).map(t => t.toLowerCase());
  userTech.forEach(tech => {
    if (jobText.includes(tech)) score += 5;
  });

  // Check skill matches
  const userSkills = (userProfile.skills || []).map(s => s.toLowerCase());
  userSkills.forEach(skill => {
    if (jobText.includes(skill)) score += 3;
  });

  // Priority keywords
  CONFIG.PRIORITY_KEYWORDS.forEach(keyword => {
    if (jobText.includes(keyword.toLowerCase())) score += 8;
  });

  // Blacklist penalties
  CONFIG.BLACKLIST_KEYWORDS.forEach(keyword => {
    if (jobText.includes(keyword.toLowerCase())) score -= 30;
  });

  return Math.max(0, Math.min(100, score));
}

async function trackInteraction(interaction) {
  const { interactionHistory = [] } = await chrome.storage.local.get(['interactionHistory']);
  interactionHistory.push({
    ...interaction,
    timestamp: Date.now()
  });
  await chrome.storage.local.set({
    interactionHistory: interactionHistory.slice(-500)
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

console.log('✅ JobHunter AI: All autonomous agents ready');
