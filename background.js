// 🤖 JobHunter AI - Autonomous Intelligent Recruitment Agent
// Revolutionary background service worker with AI-powered job hunting automation

console.log('🚀 JobHunter AI: Autonomous Agent Initialized');

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

const CONFIG = {
  API_RATE_LIMIT: 10, // API calls per minute
  BATCH_SIZE: 5, // Jobs to analyze in one batch
  // BLACKLIST_KEYWORDS now loaded from user preferences (Bug #3 fix)
  DEFAULT_BLACKLIST_KEYWORDS: [], // Empty by default - user controls this
  // PRIORITY_KEYWORDS now derived from user profile (Bug #2 fix)
  DEFAULT_PRIORITY_KEYWORDS: [], // Empty by default - extracted from CV
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
    const { userPreferences } = await chrome.storage.local.get(['userPreferences']);
    const results = await Promise.all(jobs.map(async (job, index) => ({
      index,
      score: await calculateBasicScore(job, userProfile, userPreferences),
      reason: 'Basic keyword matching (API error)'
    })));
    return results;
  }
}

// ============================================================================
// 🚫 FEATURE 3: AUTONOMOUS FILTERING ENGINE
// ============================================================================

async function handleFilterJob(jobData) {
  console.log(`🔍 Filtering job: ${jobData.title} at ${jobData.company}`);

  // Get user preferences, profile, and learning data
  const { userPreferences, userProfile, interactionHistory } = await chrome.storage.local.get([
    'userPreferences',
    'userProfile',
    'interactionHistory'
  ]);

  // Bug #3 Fix: Blacklist is now user-controlled (empty by default)
  const userBlacklist = userPreferences?.blacklistKeywords || CONFIG.DEFAULT_BLACKLIST_KEYWORDS;
  // Bug #2 Fix: Priority keywords derived from user profile
  const userPriorityKeywords = userProfile?.techStack || CONFIG.DEFAULT_PRIORITY_KEYWORDS;

  const filters = {
    blacklist: userBlacklist,
    whitelist: userPriorityKeywords,
    hiddenCompanies: userPreferences?.hiddenCompanies || [],
    preferredCompanies: userPreferences?.preferredCompanies || [],
    autoFilter: userPreferences?.autoFilter === true // Default: OFF (Bug #3 fix)
  };

  // Check blacklist (only if autoFilter is ON AND blacklist has items)
  const jobText = `${jobData.title} ${jobData.company} ${jobData.description || ''}`.toLowerCase();

  if (filters.autoFilter && filters.blacklist.length > 0) {
    const matchedBlacklistKeyword = filters.blacklist.find(keyword =>
      jobText.includes(keyword.toLowerCase())
    );

    if (matchedBlacklistKeyword) {
      console.log(`❌ Job filtered out: contains blacklisted keyword "${matchedBlacklistKeyword}"`);
      return {
        shouldShow: false,
        reason: `Contains excluded keyword: ${matchedBlacklistKeyword}`,
        action: 'hide'
      };
    }
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

  const prompt = `Analyze this professional CV/resume and extract relevant keywords for job matching.

Profile:
${cvText.substring(0, 4000)}

Return ONLY valid JSON:
{
  "summary": "Brief professional summary",
  "skills": ["Skill 1", "Skill 2", "Skill 3"],
  "techStack": ["Tech1", "Tech2", "Tech3"],
  "seniorityLevel": "Junior|Mid-Level|Senior|Lead|Principal",
  "experience": [{"title": "Job Title", "company": "Company", "duration": "X years", "description": "Brief description"}],
  "education": [{"degree": "Degree", "institution": "University", "year": "2020"}],
  "dynamicKeywords": ["keyword1", "keyword2", "keyword3"],
  "targetJobTitles": ["Job Title 1", "Job Title 2", "Job Title 3", "Job Title 4", "Job Title 5"],
  "email": "email@example.com",
  "phone": "+972-XX-XXX-XXXX",
  "linkedinUrl": "https://linkedin.com/in/username"
}

CRITICAL - dynamicKeywords EXTRACTION:
- Extract 15-20 MOST RELEVANT professional keywords from this specific CV
- These should match job postings in this person's field
- Examples by profession:
  * Product Manager: ["product strategy", "roadmap", "stakeholders", "KPIs", "agile", "scrum", "user research"]
  * AI Engineer: ["RAG", "LLM", "PyTorch", "embeddings", "MLOps", "machine learning"]
  * Operations: ["process optimization", "SLA", "vendor management", "workflow", "automation"]
  * Project Manager: ["project planning", "risk management", "PMO", "stakeholder", "timeline"]
- Keywords should be 1-3 words each, lowercase
- Include both hard skills AND soft skills relevant to job matching

CRITICAL - targetJobTitles EXTRACTION:
- Extract exactly 5 most relevant job titles this person should search for
- Base titles on their experience, skills, and career level
- Examples by profession:
  * AI/ML professional: ["AI Engineer", "ML Engineer", "RAG Engineer", "MLOps Engineer", "AI Solutions Architect"]
  * Product: ["Product Manager", "Senior Product Manager", "Technical Product Manager", "Product Owner", "Product Lead"]
  * DevOps: ["DevOps Engineer", "SRE Engineer", "Platform Engineer", "Cloud Engineer", "Infrastructure Engineer"]
  * Operations: ["CS Operations Manager", "Operations Lead", "Technical Operations Manager", "Customer Success Manager", "Operations Analyst"]
- Titles should be 2-4 words, properly capitalized
- Match seniority level to experience (Junior/Mid/Senior/Lead/Principal)
- FIRST title should be the BEST match for LinkedIn search

OTHER REQUIREMENTS:
- techStack: max 15 items, simple keywords (no colons or lists)
- skills: professional competencies
- seniorityLevel: infer from experience years and job titles

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

async function calculateBasicMatch(jobData) {
  // 🚀 DYNAMIC PROFILE-BASED SCORING SYSTEM (Bug #2 Fix)
  // Keywords are now extracted from user's CV profile instead of hardcoded

  // ============================================================================
  // LOAD USER PROFILE FOR DYNAMIC MATCHING
  // ============================================================================
  const { userProfile, userPreferences } = await chrome.storage.local.get(['userProfile', 'userPreferences']);

  // Extract dynamic keywords from user profile (Bug #2 fix)
  // PRIMARY: dynamicKeywords (extracted from CV analysis)
  // FALLBACK: techStack + skills (for backward compatibility)
  const dynamicKeywords = (userProfile?.dynamicKeywords || []).map(k => k.toLowerCase());
  const userTechStack = (userProfile?.techStack || []).map(t => t.toLowerCase());
  const userSkills = (userProfile?.skills || []).map(s => s.toLowerCase());
  const userExperience = userProfile?.experience || [];
  const userSeniority = (userProfile?.seniorityLevel || '').toLowerCase();

  // Build dynamic target titles from user's experience
  const userTitles = userExperience.map(exp => exp.title?.toLowerCase()).filter(Boolean);

  // Use dynamicKeywords if available, otherwise fall back to techStack+skills
  const primaryKeywords = dynamicKeywords.length > 0
    ? dynamicKeywords
    : [...userTechStack, ...userSkills].slice(0, 20);

  console.log(`🔍 ANALYZING: ${jobData.title}`);
  console.log(`📄 Description length: ${jobData.description?.length || 0} chars`);
  console.log(`📍 Location: ${jobData.location || 'MISSING'}`);
  console.log(`🏢 Company: ${jobData.company || 'Unknown'}`);
  console.log(`👤 Dynamic keywords: ${primaryKeywords.slice(0, 5).join(', ')}`);

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
  // PHASE 1: DYNAMIC TITLE MATCHING (50% weight)
  // Uses targetJobTitles from CV analysis + synonyms
  // ============================================================================

  // Keyword synonym mappings for better matching
  const keywordSynonyms = {
    'prompt engineer': ['llm', 'ai', 'gpt', 'automation', 'agentic', 'orchestration'],
    'ai agent': ['agentic', 'llm', 'orchestration', 'automation'],
    'automation': ['workflow', 'n8n', 'make', 'zapier', 'python', 'docker'],
    'ai engineer': ['ml', 'machine learning', 'llm', 'rag', 'nlp'],
    'rag': ['retrieval', 'vector', 'embedding', 'llm'],
    'mlops': ['ml', 'devops', 'kubernetes', 'docker'],
    'n8n': ['automation', 'workflow', 'integration'],
    'llm': ['ai', 'gpt', 'claude', 'prompt', 'agentic'],
    'product manager': ['product', 'pm', 'roadmap', 'strategy', 'stakeholder'],
    'operations': ['ops', 'process', 'workflow', 'optimization'],
    'project manager': ['project', 'pmo', 'timeline', 'delivery']
  };

  // NEW: Get targetJobTitles from profile for direct title matching
  const targetJobTitles = (userProfile?.targetJobTitles || []).map(t => t.toLowerCase());

  // PRIORITY 1: Direct match against targetJobTitles (highest score)
  let directTitleMatch = false;
  for (const targetTitle of targetJobTitles) {
    // Check if job title contains target title OR vice versa
    if (jobTitle.includes(targetTitle) || targetTitle.includes(jobTitle.replace(/senior|junior|lead|principal|staff/gi, '').trim())) {
      titleScore = 45;
      directTitleMatch = true;
      matchDetails.push(`✅ Title: Direct match with "${targetTitle}" (+45%)`);
      break;
    }
    // Check partial matches (e.g., "AI Engineer" matches "Senior AI Engineer")
    const targetWords = targetTitle.split(/\s+/).filter(w => w.length > 2);
    const jobWords = jobTitle.split(/\s+/).filter(w => w.length > 2);
    const matchCount = targetWords.filter(tw => jobWords.some(jw => jw.includes(tw) || tw.includes(jw))).length;
    if (matchCount >= 2 || (targetWords.length <= 2 && matchCount >= 1)) {
      titleScore = 35;
      directTitleMatch = true;
      matchDetails.push(`✅ Title: Partial match with "${targetTitle}" (+35%)`);
      break;
    }
  }

  // PRIORITY 2: Keyword-based matching (if no direct match)
  if (!directTitleMatch) {
    // Build title keywords from user profile
    const titleKeywords = new Set();

    // Add keywords from user's job titles
    userTitles.forEach(title => {
      title.split(/\s+/).forEach(word => {
        if (word.length > 2) titleKeywords.add(word);
      });
    });

    // Add keywords from skills
    userSkills.forEach(skill => {
      skill.split(/\s+/).forEach(word => {
        if (word.length > 2) titleKeywords.add(word.toLowerCase());
      });
    });

    // Add synonyms for user's keywords
    const expandedKeywords = new Set(titleKeywords);
    titleKeywords.forEach(keyword => {
      Object.entries(keywordSynonyms).forEach(([key, synonyms]) => {
        if (keyword.includes(key) || key.includes(keyword)) {
          synonyms.forEach(syn => expandedKeywords.add(syn));
        }
      });
    });

    // Calculate title match score based on keyword overlap
    let titleMatches = 0;
    expandedKeywords.forEach(keyword => {
      if (jobTitle.includes(keyword)) {
        titleMatches++;
      }
    });

    // Also check if job title matches any synonym keys
    Object.entries(keywordSynonyms).forEach(([key, synonyms]) => {
      if (jobTitle.includes(key)) {
        synonyms.forEach(syn => {
          if (expandedKeywords.has(syn) || primaryKeywords.includes(syn)) {
            titleMatches++;
          }
        });
      }
    });

    // Score based on match percentage (max 50 points)
    if (expandedKeywords.size > 0) {
      const matchRatio = titleMatches / Math.min(expandedKeywords.size, 5);
      titleScore = Math.min(50, Math.round(matchRatio * 50));

      if (titleScore > 0) {
        matchDetails.push(`✅ Title: Keyword match (+${titleScore}%)`);
      }
    }

    // Fallback: Generic title matching for common roles
    if (titleScore === 0) {
      const genericTitles = [
        { keywords: ['engineer', 'developer'], points: 25 },
        { keywords: ['architect', 'lead'], points: 30 },
        { keywords: ['manager', 'director'], points: 20 }
      ];

      for (const titleGroup of genericTitles) {
        if (titleGroup.keywords.some(keyword => jobTitle.includes(keyword))) {
          titleScore = titleGroup.points;
          matchDetails.push(`✅ Title: Generic match (+${titleGroup.points}%)`);
          break;
        }
      }
    }
  }

  // BOOST: When description is empty, title gets more weight
  const descriptionEmpty = !jobData.description || jobData.description.length < 50;
  if (descriptionEmpty && titleScore > 0 && titleScore < 50) {
    const boost = Math.min(15, 50 - titleScore);
    titleScore = titleScore + boost;
    matchDetails.push(`📈 Title boost (no description): +${boost}%`);
  }

  // ============================================================================
  // PHASE 2: LOCATION MATCHING (20% weight)
  // ============================================================================
  const preferredLocations = userPreferences?.preferredLocations || CONFIG.PREFERRED_LOCATIONS;
  const locationKeywords = preferredLocations.map(l => l.toLowerCase());

  for (const location of locationKeywords) {
    if (jobText.includes(location)) {
      locationScore = 20;
      matchDetails.push(`📍 Location: ${location} (+20%)`);
      break;
    }
  }

  // Also check common remote keywords
  if (locationScore === 0 && (jobText.includes('remote') || jobText.includes('hybrid'))) {
    locationScore = 18;
    matchDetails.push(`📍 Location: Remote/Hybrid (+18%)`);
  }

  // ============================================================================
  // PHASE 3: DYNAMIC KEYWORD MATCHING (20% weight per spec)
  // Uses dynamicKeywords extracted from user's CV + synonym expansion
  // ============================================================================
  let keywordMatches = [];

  // Expand primaryKeywords with synonyms
  const expandedPrimaryKeywords = new Set(primaryKeywords.map(k => k.toLowerCase()));
  primaryKeywords.forEach(keyword => {
    const kLower = keyword.toLowerCase();
    Object.entries(keywordSynonyms).forEach(([key, synonyms]) => {
      if (kLower.includes(key) || key.includes(kLower)) {
        synonyms.forEach(syn => expandedPrimaryKeywords.add(syn));
      }
    });
  });

  // Match against expanded keywords
  expandedPrimaryKeywords.forEach(keyword => {
    if (jobText.includes(keyword)) {
      const points = keywordMatches.length < 5 ? 4 : 2;
      keywordScore += points;
      if (!keywordMatches.includes(keyword)) {
        keywordMatches.push(keyword);
      }
    }
  });

  // BOOST: When description empty, boost keyword score from title matches
  if (descriptionEmpty && keywordMatches.length > 0) {
    keywordScore = Math.min(30, keywordScore + 10);
    matchDetails.push(`🔑 Keywords: ${keywordMatches.slice(0, 5).join(', ')} (+${keywordScore}% boosted)`);
  } else if (keywordMatches.length > 0) {
    matchDetails.push(`🔑 Keywords: ${keywordMatches.slice(0, 5).join(', ')} (+${keywordScore}%)`);
  }

  // Cap at 20% normally, 30% when description empty
  keywordScore = Math.min(descriptionEmpty ? 30 : 20, keywordScore);

  // ============================================================================
  // PHASE 4: USER-CONTROLLED NEGATIVE FILTERS (Bug #3 Fix)
  // Only apply if user enabled autoFilter AND has blacklist keywords
  // ============================================================================
  const autoFilterEnabled = userPreferences?.autoFilter === true;
  const userBlacklist = userPreferences?.blacklistKeywords || [];

  if (autoFilterEnabled && userBlacklist.length > 0) {
    let negativeMatches = [];

    userBlacklist.forEach(keyword => {
      if (jobText.includes(keyword.toLowerCase())) {
        negativeScore -= 10;
        negativeMatches.push(keyword);
      }
    });

    if (negativeMatches.length > 0) {
      matchDetails.push(`⚠️ Blacklist: ${negativeMatches.join(', ')} (${negativeScore}%)`);
    }

    // Cap negative score at -30%
    negativeScore = Math.max(-30, negativeScore);
  }

  // ============================================================================
  // PHASE 5: SENIORITY/EXPERIENCE LEVEL MATCHING (10% weight)
  // Matches user's experienceLevels preferences from settings
  // ============================================================================

  // Get user's preferred experience levels
  const userExperienceLevels = (userPreferences?.experienceLevels || ['Mid-Senior level']).map(l => l.toLowerCase());

  // Map job title/description keywords to LinkedIn experience levels
  const experienceLevelMap = [
    { keywords: ['intern', 'internship'], level: 'internship', points: 10, label: 'Internship' },
    { keywords: ['entry level', 'entry-level', 'junior', 'jr.', 'graduate', 'trainee'], level: 'entry level', points: 10, label: 'Entry Level' },
    { keywords: ['associate'], level: 'associate', points: 10, label: 'Associate' },
    { keywords: ['senior', 'sr.', 'staff', 'mid-senior', 'experienced'], level: 'mid-senior level', points: 10, label: 'Mid-Senior Level' },
    { keywords: ['director', 'head of', 'vp', 'vice president'], level: 'director', points: 10, label: 'Director' },
    { keywords: ['executive', 'c-level', 'cto', 'ceo', 'cfo', 'chief'], level: 'executive', points: 10, label: 'Executive' },
    { keywords: ['lead', 'principal', 'architect', 'manager'], level: 'mid-senior level', points: 10, label: 'Lead/Principal' }
  ];

  // Check if job matches user's preferred experience levels
  let matchedLevel = null;
  for (const levelInfo of experienceLevelMap) {
    if (levelInfo.keywords.some(keyword => jobText.includes(keyword))) {
      matchedLevel = levelInfo;
      break;
    }
  }

  if (matchedLevel) {
    // Check if this level matches user's preferences
    const isPreferredLevel = userExperienceLevels.some(userLevel =>
      matchedLevel.level.includes(userLevel) || userLevel.includes(matchedLevel.level)
    );

    if (isPreferredLevel) {
      seniorityScore = matchedLevel.points;
      matchDetails.push(`👔 Experience: ${matchedLevel.label} - Preferred (+${seniorityScore}%)`);
    } else {
      // Partial score for non-preferred but valid level
      seniorityScore = Math.max(0, matchedLevel.points - 5);
      matchDetails.push(`👔 Experience: ${matchedLevel.label} - Not preferred (+${seniorityScore}%)`);
    }
  } else {
    // Default scoring based on user's seniority level from profile
    const seniorityLevels = [
      { keywords: ['senior', 'sr.', 'staff'], points: 8, label: 'Senior/Staff' },
      { keywords: ['lead', 'principal', 'architect'], points: 8, label: 'Lead/Principal' },
      { keywords: ['mid-level', 'mid level', 'intermediate'], points: 7, label: 'Mid-Level' },
      { keywords: ['junior', 'jr.', 'entry level'], points: 5, label: 'Junior' }
    ];

    for (const level of seniorityLevels) {
      if (level.keywords.some(keyword => jobTitle.includes(keyword))) {
        const matchesUserLevel = level.keywords.some(k => userSeniority.includes(k));
        seniorityScore = matchesUserLevel ? level.points : level.points - 3;
        matchDetails.push(`👔 Seniority: ${level.label} (+${seniorityScore}%)`);
        break;
      }
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

  if (finalScore >= 75) {
    emoji = '🔥';
    reason = `${emoji} Excellent Match! ${matchDetails.join(' • ')}`;
  } else if (finalScore >= 50) {
    emoji = '🟡';
    reason = `${emoji} Good Match. ${matchDetails.slice(0, 3).join(' • ')}`;
  } else if (finalScore >= 30) {
    emoji = '🟠';
    reason = `${emoji} Partial Match. ${matchDetails.slice(0, 2).join(' • ')}`;
  } else {
    emoji = '⚫';
    reason = `${emoji} Low Match. ${matchDetails.length > 0 ? matchDetails[0] : 'Few matching keywords'}`;
  }

  // ============================================================================
  // DEBUG OUTPUT
  // ============================================================================
  console.log(`
╔═══════════════════════════════════════════════════════════════════════════╗
║ 🎯 DYNAMIC PROFILE-BASED ANALYSIS                                        ║
╠═══════════════════════════════════════════════════════════════════════════╣
║ Job: ${jobData.title?.substring(0, 60)}
║ Company: ${jobData.company}
║ Profile Keywords: ${userTechStack.slice(0, 3).join(', ')}
╠═══════════════════════════════════════════════════════════════════════════╣
║ SCORING BREAKDOWN:
║   📌 Title Match:     ${titleScore}% (50% max)
║   📍 Location:        ${locationScore}% (20% max)
║   🔑 Keywords:        ${keywordScore}% (30% max)
║   ⚠️  Blacklist:       ${negativeScore}% (penalty)
║   👔 Seniority:       ${seniorityScore}% (10% max)
║   ─────────────────────────────────────
║   🎯 FINAL SCORE:     ${finalScore}%
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

async function calculateBasicScore(job, userProfile, userPreferences = {}) {
  const jobText = `${job.title} ${job.company}`.toLowerCase();
  let score = 50;

  // Check tech stack matches (dynamic from profile)
  const userTech = (userProfile?.techStack || []).map(t => t.toLowerCase());
  userTech.forEach(tech => {
    if (jobText.includes(tech)) score += 5;
  });

  // Check skill matches (dynamic from profile)
  const userSkills = (userProfile?.skills || []).map(s => s.toLowerCase());
  userSkills.forEach(skill => {
    if (jobText.includes(skill)) score += 3;
  });

  // Blacklist penalties (user-controlled, empty by default)
  const blacklist = userPreferences?.blacklistKeywords || [];
  blacklist.forEach(keyword => {
    if (jobText.includes(keyword.toLowerCase())) score -= 20;
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
