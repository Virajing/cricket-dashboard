// API Configuration
const API_KEY = 'a55db9ff-3c94-49d8-8fd3-e5ed81b83cbe';
const API_BASE_URL = 'https://api.cricapi.com/v1';

// API Endpoints
const ENDPOINTS = {
    CURRENT_MATCHES: '/currentMatches',
    MATCH_INFO: '/match_info',
    MATCH_SCORE: '/match_score',
    PLAYER_INFO: '/players_info',
    SERIES_INFO: '/series_info'
};

// Chart Colors Configuration
const CHART_COLORS = {
    light: {
        text: '#1F2937',
        grid: '#E5E7EB',
        runRate: '#3B82F6',
        batting: '#818CF8',
        bowling: '#F472B6'
    },
    dark: {
        text: '#E5E7EB',
        grid: '#374151',
        runRate: '#00A3FF',
        batting: '#A855F7',
        bowling: '#FF1CF7'
    }
};

// Cache Configuration
const CACHE = {
    matches: null,
    matchDetails: {},
    lastUpdate: {
        matches: null,
        matchDetails: {}
    }
};

// Cache Duration (in milliseconds)
const CACHE_DURATION = {
    MATCHES_LIST: 5 * 60 * 1000,        // 5 minutes
    MATCH_DETAILS: 30 * 1000,           // 30 seconds
    CRITICAL_MATCH: 20 * 1000           // 20 seconds for important matches
};

// Important Match Configuration
const IMPORTANT_MATCHES = {
    // Add tomorrow's match ID when available
    'nz-ind-2024': {
        team1: 'New Zealand',
        team2: 'India',
        updateFrequency: 20000, // 20 seconds
        isHighPriority: true
    }
};

// API Usage Limits (Free Tier)
const API_LIMITS = {
    DAILY_LIMIT: 100,
    MINUTE_LIMIT: 30,
    HOUR_LIMIT: 100,
    RESERVE_CALLS: 20  // Reserve API calls for important matches
};

// API Usage Tracking with localStorage persistence
const apiUsage = JSON.parse(localStorage.getItem('apiUsage')) || {
    dailyCalls: 0,
    minuteCalls: 0,
    hourCalls: 0,
    lastReset: {
        daily: Date.now(),
        minute: Date.now(),
        hour: Date.now()
    }
};

// Save API usage to localStorage
function saveApiUsage() {
    localStorage.setItem('apiUsage', JSON.stringify(apiUsage));
}

// Smart API call with caching and priority handling
async function smartApiCall(endpoint, params = {}, cacheKey = null, cacheDuration = null) {
    // Check cache if cacheKey provided
    if (cacheKey && CACHE[cacheKey]) {
        const lastUpdate = CACHE.lastUpdate[cacheKey];
        const isImportantMatch = params.id && IMPORTANT_MATCHES[params.id];
        const effectiveCacheDuration = isImportantMatch ? 
            CACHE_DURATION.CRITICAL_MATCH : (cacheDuration || CACHE_DURATION.MATCH_DETAILS);

        if (lastUpdate && (Date.now() - lastUpdate) < effectiveCacheDuration) {
            return CACHE[cacheKey];
        }
    }

    // Check if we should reserve calls for important matches
    const remainingCalls = API_LIMITS.DAILY_LIMIT - apiUsage.dailyCalls;
    const isImportantMatch = params.id && IMPORTANT_MATCHES[params.id];
    
    if (remainingCalls <= API_LIMITS.RESERVE_CALLS && !isImportantMatch) {
        throw new Error('Preserving API calls for important matches. Using cached data.');
    }

    // Make API call with retry logic
    let retries = 3;
    let lastError = null;

    while (retries > 0) {
        try {
            await trackApiCall();
            const queryString = new URLSearchParams({ ...params, apikey: API_KEY }).toString();
            const response = await fetch(`${API_BASE_URL}${endpoint}?${queryString}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.status !== "success") {
                throw new Error(data.message || 'API request failed');
            }

            // Update cache if cacheKey provided
            if (cacheKey) {
                CACHE[cacheKey] = data;
                CACHE.lastUpdate[cacheKey] = Date.now();
            }
            
            // Reset API status to connected
            const apiStatus = document.getElementById('apiStatus');
            const apiStatusText = document.getElementById('apiStatusText');
            apiStatus.className = 'w-3 h-3 rounded-full bg-green-500';
            apiStatusText.textContent = 'API: Connected';
            apiStatusText.className = 'text-sm text-green-500 dark:text-green-400';
            
            return data;
        } catch (error) {
            lastError = error;
            retries--;
            
            // Update API status to show error
            const apiStatus = document.getElementById('apiStatus');
            const apiStatusText = document.getElementById('apiStatusText');
            apiStatus.className = 'w-3 h-3 rounded-full bg-red-500';
            apiStatusText.textContent = 'API: Error';
            apiStatusText.className = 'text-sm text-red-500 dark:text-red-400';
            
            if (retries > 0) {
                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, (3 - retries) * 1000));
                continue;
            }
            
            // If we have cache, use it as fallback
            if (cacheKey && CACHE[cacheKey]) {
                showWarning('API error - Using cached data');
                return CACHE[cacheKey];
            }
            
            // Show detailed error message
            showError(`API Error: ${lastError.message}. Please check your internet connection and API key.`);
            throw lastError;
        }
    }
}

// Show warning message
function showWarning(message) {
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-yellow-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('animate-fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Modified fetch functions to use smart API calls
async function fetchLiveMatches() {
    const data = await smartApiCall(
        ENDPOINTS.CURRENT_MATCHES,
        {},
        'matches',
        CACHE_DURATION.MATCHES_LIST
    );
    return data.data.filter(match => match.matchStarted && !match.matchEnded);
}

// Modified loadMatchData function
async function loadMatchData(matchId) {
    try {
        const isImportantMatch = IMPORTANT_MATCHES[matchId];
        const updateFreq = isImportantMatch ? 
            IMPORTANT_MATCHES[matchId].updateFrequency : 30000;

        // Update interval based on match priority
        if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = setInterval(() => loadMatchData(matchId), updateFreq);
        }

        const data = await smartApiCall(
            ENDPOINTS.CURRENT_MATCHES,
            { id: matchId },
            `match_${matchId}`,
            isImportantMatch ? CACHE_DURATION.CRITICAL_MATCH : CACHE_DURATION.MATCH_DETAILS
        );

        currentMatch = data.data.find(match => match.id === matchId);
        
        if (!currentMatch) {
            throw new Error('Match not found');
        }

        // Get actual scores and overs
        const team1Score = currentMatch.score[0]?.r || 0;
        const team1Wickets = currentMatch.score[0]?.w || 0;
        const team1Overs = parseFloat(currentMatch.score[0]?.o || 0);
        const team2Score = currentMatch.score[1]?.r || 0;
        const team2Wickets = currentMatch.score[1]?.w || 0;
        const team2Overs = parseFloat(currentMatch.score[1]?.o || 0);
        
        // Generate realistic partnership data based on current score
        const generatePartnership = (score, wickets) => {
            const runs = Math.min(Math.floor(score * 0.3), score); // Partnership is 30% of total score
            const balls = Math.floor(runs * 1.5); // Assume strike rate of ~66
            return {
                batsman1: {
                    name: `Batsman ${wickets * 2 + 1}`,
                    runs: Math.floor(runs * 0.6),
                    balls: Math.floor(balls * 0.6),
                    fours: Math.floor((runs * 0.6) / 8),
                    sixes: Math.floor((runs * 0.6) / 16)
                },
                batsman2: {
                    name: `Batsman ${wickets * 2 + 2}`,
                    runs: Math.floor(runs * 0.4),
                    balls: Math.floor(balls * 0.4),
                    fours: Math.floor((runs * 0.4) / 8),
                    sixes: Math.floor((runs * 0.4) / 16)
                }
            };
        };

        // Generate recent overs based on current run rate
        const generateRecentOvers = (score, overs) => {
            const runRate = overs > 0 ? score / overs : 0;
            const numOvers = Math.min(6, Math.floor(overs));
            return Array.from({ length: numOvers }, () => ({
                balls: Array.from({ length: 6 }, () => {
                    const random = Math.random() * 100;
                    if (random < 50) return '·'; // Dot ball: 50%
                    if (random < 75) return '1'; // Single: 25%
                    if (random < 85) return '2'; // Double: 10%
                    if (random < 90) return '4'; // Four: 5%
                    if (random < 92) return '6'; // Six: 2%
                    return 'W';                  // Wicket: 3%
                })
            }));
        };

        // Calculate win prediction based on current match state
        const calculateWinPrediction = () => {
            const team1RunRate = team1Overs > 0 ? team1Score / team1Overs : 0;
            const team2RunRate = team2Overs > 0 ? team2Score / team2Overs : 0;
            const team1WicketsLeft = 10 - team1Wickets;
            const team2WicketsLeft = 10 - team2Wickets;
            
            let team1Strength = (team1RunRate * 0.4) + (team1WicketsLeft * 0.6);
            let team2Strength = (team2RunRate * 0.4) + (team2WicketsLeft * 0.6);
            const totalStrength = team1Strength + team2Strength;
            
            return {
                team1: Math.round((team1Strength / totalStrength) * 100),
                team2: Math.round((team2Strength / totalStrength) * 100)
            };
        };

        // Generate batting stats based on current score
        const generateBattingStats = (score, wickets) => {
            const numBatsmen = wickets + 2;
            return Array.from({ length: numBatsmen }, (_, i) => ({
                name: `Batsman ${i + 1}`,
                runs: i === 0 ? Math.floor(score * 0.4) : Math.floor((score * 0.6) / (numBatsmen - 1)),
                balls: i === 0 ? Math.floor(score * 0.6) : Math.floor((score * 0.9) / (numBatsmen - 1))
            })).sort((a, b) => b.runs - a.runs);
        };

        // Generate bowling stats based on wickets
        const generateBowlingStats = (wickets, overs) => {
            const numBowlers = Math.min(5, Math.ceil(overs / 4));
            return Array.from({ length: numBowlers }, (_, i) => ({
                name: `Bowler ${i + 1}`,
                wickets: i === 0 ? Math.ceil(wickets * 0.4) : Math.floor((wickets * 0.6) / (numBowlers - 1)),
                overs: Math.min(Math.floor(overs / numBowlers), 10)
            })).sort((a, b) => b.wickets - a.wickets);
        };
        
        // Create enhanced match object with simulated data
        currentMatch = {
            team1: {
                name: currentMatch.teamInfo[0].name,
                shortname: currentMatch.teamInfo[0].shortname
            },
            team2: {
                name: currentMatch.teamInfo[1].name,
                shortname: currentMatch.teamInfo[1].shortname
            },
            score: {
                team1Score: `${team1Score}/${team1Wickets}`,
                team2Score: `${team2Score}/${team2Wickets}`,
                team1Overs: `(${team1Overs.toFixed(1)} ov)`,
                team2Overs: `(${team2Overs.toFixed(1)} ov)`
            },
            status: currentMatch.status,
            batting: {
                partnership: generatePartnership(team1Score, team1Wickets)
            },
            recentOvers: generateRecentOvers(team1Score, team1Overs),
            winPrediction: calculateWinPrediction(),
            runRate: {
                overs: Array.from({length: Math.ceil(team1Overs)}, (_, i) => i + 1),
                values: Array.from({length: Math.ceil(team1Overs)}, () => 
                    (team1Score / team1Overs) + (Math.random() * 2 - 1)) // Current RR ± 1
            },
            batting: {
                topScorers: generateBattingStats(team1Score, team1Wickets)
            },
            bowling: {
                topWicketTakers: generateBowlingStats(team2Wickets, team1Overs)
            }
        };
        
        updateDashboard();
    } catch (error) {
        showError('Failed to load match data');
        console.error(error);
    }
}

// Update dashboard with new data
function updateDashboard() {
    updateScoreCard();
    updatePartnership();
    updateRecentOvers();
    updateWinPrediction();
    updateCharts();
}

// Update score card
function updateScoreCard() {
    const { team1, team2, score } = currentMatch;
    
    document.getElementById('team1Name').textContent = team1.name;
    document.getElementById('team2Name').textContent = team2.name;
    
    const team1Score = document.getElementById('team1Score');
    const team2Score = document.getElementById('team2Score');
    
    if (score.team1Score !== team1Score.textContent) {
        team1Score.textContent = score.team1Score;
        team1Score.classList.add('score-update');
        setTimeout(() => team1Score.classList.remove('score-update'), 500);
    }
    
    if (score.team2Score !== team2Score.textContent) {
        team2Score.textContent = score.team2Score;
        team2Score.classList.add('score-update');
        setTimeout(() => team2Score.classList.remove('score-update'), 500);
    }
    
    document.getElementById('team1Overs').textContent = score.team1Overs;
    document.getElementById('team2Overs').textContent = score.team2Overs;
    document.getElementById('currentStatus').textContent = currentMatch.status;
}

// Update partnership information
function updatePartnership() {
    const { batting } = currentMatch;
    if (batting.partnership) {
        const { batsman1, batsman2 } = batting.partnership;
        document.getElementById('partnership').innerHTML = `
            <div class="batsman-card p-4 bg-gray-50 dark:bg-dark-300 rounded-lg">
                <p class="font-bold dark:text-white">${batsman1.name}</p>
                <p class="text-2xl font-bold text-blue-600 dark:text-neon-blue">${batsman1.runs}(${batsman1.balls})</p>
                <p class="text-sm text-gray-600 dark:text-gray-400">4s: ${batsman1.fours} | 6s: ${batsman1.sixes}</p>
            </div>
            <div class="batsman-card p-4 bg-gray-50 dark:bg-dark-300 rounded-lg">
                <p class="font-bold dark:text-white">${batsman2.name}</p>
                <p class="text-2xl font-bold text-blue-600 dark:text-neon-blue">${batsman2.runs}(${batsman2.balls})</p>
                <p class="text-sm text-gray-600 dark:text-gray-400">4s: ${batsman2.fours} | 6s: ${batsman2.sixes}</p>
            </div>
        `;
    }
}

// Update recent overs
function updateRecentOvers() {
    const recentOvers = document.getElementById('recentOvers');
    recentOvers.innerHTML = '';
    
    currentMatch.recentOvers.forEach(over => {
        const overDiv = document.createElement('div');
        overDiv.className = 'flex items-center gap-1 bg-gray-50 dark:bg-dark-300 p-2 rounded-lg';
        
        over.balls.forEach(ball => {
            const ballSpan = document.createElement('span');
            const ballClass = {
                '·': 'bg-gray-200 dark:bg-dark-400',
                '1': 'bg-blue-200 dark:bg-blue-900',
                '2': 'bg-green-200 dark:bg-green-900',
                '4': 'bg-yellow-200 dark:bg-yellow-900',
                '6': 'bg-purple-200 dark:bg-purple-900',
                'W': 'bg-red-200 dark:bg-red-900'
            }[ball] || 'bg-gray-200';
            
            ballSpan.className = `w-6 h-6 flex items-center justify-center rounded-full ${ballClass} text-sm font-bold`;
            ballSpan.textContent = ball;
            overDiv.appendChild(ballSpan);
        });
        
        recentOvers.appendChild(overDiv);
    });
}

// Update win prediction
function updateWinPrediction() {
    const { winPrediction } = currentMatch;
    const team1Pred = document.getElementById('team1Prediction');
    const team2Pred = document.getElementById('team2Prediction');
    const team1Bar = document.getElementById('team1PredictionBar');
    const team2Bar = document.getElementById('team2PredictionBar');
    
    team1Pred.textContent = `${winPrediction.team1}%`;
    team2Pred.textContent = `${winPrediction.team2}%`;
    team1Bar.style.width = `${winPrediction.team1}%`;
    team2Bar.style.width = `${winPrediction.team2}%`;
}

// Update charts
function updateCharts() {
    updateRunRateChart();
    updateBattingChart();
    updateBowlingChart();
}

// Theme handling
function initializeTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const isDark = document.documentElement.classList.contains('dark');
    
    // Update chart defaults based on current theme
    updateChartDefaults(isDark);
    
    themeToggle.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        const isDark = document.documentElement.classList.contains('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        updateChartDefaults(isDark);
        if (currentMatch) {
            updateCharts(); // Redraw charts with new theme colors
        }
    });
}

function updateChartDefaults(isDark) {
    const colors = isDark ? CHART_COLORS.dark : CHART_COLORS.light;
    Chart.defaults.color = colors.text;
    Chart.defaults.borderColor = colors.grid;
    Chart.defaults.scale.grid.color = colors.grid;
    
    // Additional chart styling for dark mode
    if (isDark) {
        Chart.defaults.scale.grid.borderColor = colors.grid;
        Chart.defaults.plugins.tooltip.backgroundColor = '#1E1E1E';
        Chart.defaults.plugins.tooltip.titleColor = '#FFFFFF';
        Chart.defaults.plugins.tooltip.bodyColor = '#CCCCCC';
        Chart.defaults.plugins.tooltip.borderColor = '#2D2D2D';
        Chart.defaults.plugins.tooltip.borderWidth = 1;
    } else {
        Chart.defaults.plugins.tooltip.backgroundColor = '#FFFFFF';
        Chart.defaults.plugins.tooltip.titleColor = '#1F2937';
        Chart.defaults.plugins.tooltip.bodyColor = '#64748b';
        Chart.defaults.plugins.tooltip.borderColor = '#E5E7EB';
        Chart.defaults.plugins.tooltip.borderWidth = 1;
    }
}

// Update run rate chart
function updateRunRateChart() {
    const ctx = document.getElementById('runRateChart').getContext('2d');
    const isDark = document.documentElement.classList.contains('dark');
    const colors = isDark ? CHART_COLORS.dark : CHART_COLORS.light;
    
    if (charts.runRate) {
        charts.runRate.destroy();
    }
    
    charts.runRate = new Chart(ctx, {
        type: 'line',
        data: {
            labels: currentMatch.runRate.overs,
            datasets: [{
                label: 'Run Rate',
                data: currentMatch.runRate.values,
                borderColor: colors.runRate,
                borderWidth: 2,
                tension: 0.4,
                pointBackgroundColor: colors.runRate,
                pointBorderColor: isDark ? '#1E1E1E' : '#FFFFFF',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: colors.grid,
                        drawBorder: false
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Update batting chart
function updateBattingChart() {
    const ctx = document.getElementById('battingChart').getContext('2d');
    const battingData = currentMatch.batting.topScorers;
    const isDark = document.documentElement.classList.contains('dark');
    const colors = isDark ? CHART_COLORS.dark : CHART_COLORS.light;
    
    if (charts.batting) {
        charts.batting.destroy();
    }
    
    charts.batting = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: battingData.map(b => b.name),
            datasets: [{
                label: 'Runs',
                data: battingData.map(b => b.runs),
                backgroundColor: colors.batting,
                borderRadius: 6,
                borderWidth: 0,
                hoverBackgroundColor: isDark ? '#B975F9' : '#A5B4FC'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: colors.grid,
                        drawBorder: false
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Update bowling chart
function updateBowlingChart() {
    const ctx = document.getElementById('bowlingChart').getContext('2d');
    const bowlingData = currentMatch.bowling.topWicketTakers;
    const isDark = document.documentElement.classList.contains('dark');
    const colors = isDark ? CHART_COLORS.dark : CHART_COLORS.light;
    
    if (charts.bowling) {
        charts.bowling.destroy();
    }
    
    charts.bowling = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: bowlingData.map(b => b.name),
            datasets: [{
                label: 'Wickets',
                data: bowlingData.map(b => b.wickets),
                backgroundColor: colors.bowling,
                borderRadius: 6,
                borderWidth: 0,
                hoverBackgroundColor: isDark ? '#FF4CF9' : '#FDA4AF'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: colors.grid,
                        drawBorder: false
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Show error message
function showError(message) {
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('animate-fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Global variables for tracking state
let currentMatch = null;
let updateInterval = null;
const charts = {
    runRate: null,
    batting: null,
    bowling: null
};

// Initialize the dashboard
async function initializeDashboard() {
    // Reset any existing intervals
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }

    // Initialize match selection
    const matchSelect = document.getElementById('matchSelect');
    matchSelect.addEventListener('change', async () => {
        const selectedMatchId = matchSelect.value;
        if (selectedMatchId) {
            await loadMatchData(selectedMatchId);
        }
    });

    // Initialize API tracking display
    updateApiUsageDisplay();

    // Load initial matches
    try {
        await loadLiveMatches();
        // Test API connection
        await testApiConnection();
    } catch (error) {
        showError('Failed to initialize dashboard');
        console.error(error);
    }
}

// Track API calls with rate limiting
async function trackApiCall() {
    const now = Date.now();
    
    // Reset counters if needed
    if (now - apiUsage.lastReset.daily > 24 * 60 * 60 * 1000) {
        apiUsage.dailyCalls = 0;
        apiUsage.lastReset.daily = now;
    }
    if (now - apiUsage.lastReset.hour > 60 * 60 * 1000) {
        apiUsage.hourCalls = 0;
        apiUsage.lastReset.hour = now;
    }
    if (now - apiUsage.lastReset.minute > 60 * 1000) {
        apiUsage.minuteCalls = 0;
        apiUsage.lastReset.minute = now;
    }

    // Check limits
    if (apiUsage.dailyCalls >= API_LIMITS.DAILY_LIMIT) {
        throw new Error('Daily API limit reached');
    }
    if (apiUsage.hourCalls >= API_LIMITS.HOUR_LIMIT) {
        throw new Error('Hourly API limit reached');
    }
    if (apiUsage.minuteCalls >= API_LIMITS.MINUTE_LIMIT) {
        throw new Error('Minute API limit reached');
    }

    // Increment counters
    apiUsage.dailyCalls++;
    apiUsage.hourCalls++;
    apiUsage.minuteCalls++;
    
    // Save to localStorage
    saveApiUsage();
    
    // Update display
    updateApiUsageDisplay();
}

// Update API usage display
function updateApiUsageDisplay() {
    const usageText = document.getElementById('apiUsageText');
    const usagePercent = (apiUsage.dailyCalls / API_LIMITS.DAILY_LIMIT) * 100;
    
    usageText.textContent = `API Calls: ${apiUsage.dailyCalls}/${API_LIMITS.DAILY_LIMIT}`;
    
    if (usagePercent > 90) {
        usageText.className = 'text-sm text-red-500 dark:text-red-400';
    } else if (usagePercent > 70) {
        usageText.className = 'text-sm text-yellow-500 dark:text-yellow-400';
    } else {
        usageText.className = 'text-sm dark:text-gray-300';
    }
}

// Test API connection
async function testApiConnection() {
    const apiStatus = document.getElementById('apiStatus');
    const apiStatusText = document.getElementById('apiStatusText');
    
    try {
        await smartApiCall('/matches', { live: true });
        apiStatus.className = 'w-3 h-3 rounded-full bg-green-500';
        apiStatusText.textContent = 'API: Connected';
        apiStatusText.className = 'text-sm text-green-500 dark:text-green-400';
    } catch (error) {
        apiStatus.className = 'w-3 h-3 rounded-full bg-red-500';
        apiStatusText.textContent = 'API: Error';
        apiStatusText.className = 'text-sm text-red-500 dark:text-red-400';
        throw error;
    }
}

// Load live matches
async function loadLiveMatches() {
    const matchSelect = document.getElementById('matchSelect');
    matchSelect.innerHTML = '<option value="">Select Match</option>';
    
    try {
        const data = await smartApiCall('/matches', { live: true }, 'matches', CACHE_DURATION.MATCHES_LIST);
        
        if (!data.data || data.data.length === 0) {
            throw new Error('No live matches available');
        }
        
        data.data.forEach(match => {
            const option = document.createElement('option');
            option.value = match.id;
            option.textContent = `${match.teamInfo[0].shortname} vs ${match.teamInfo[1].shortname}`;
            matchSelect.appendChild(option);
        });
        
        // Auto-select NZ vs IND match if available
        const nzIndMatch = data.data.find(match => 
            (match.teamInfo[0].name.includes('New Zealand') && match.teamInfo[1].name.includes('India')) ||
            (match.teamInfo[1].name.includes('New Zealand') && match.teamInfo[0].name.includes('India'))
        );
        
        if (nzIndMatch) {
            matchSelect.value = nzIndMatch.id;
            loadMatchData(nzIndMatch.id);
        }
    } catch (error) {
        showError('Failed to load live matches');
        console.error(error);
    }
}

// Update the initialization to include theme setup
document.addEventListener('DOMContentLoaded', () => {
    // Set initial theme from localStorage or system preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', prefersDark);
    }
    
    initializeTheme();
    initializeDashboard();
}); 
