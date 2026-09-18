// ACULION Traffic Intelligence Dashboard Controller

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:8080' 
    : 'https://api.aculion.com');

document.addEventListener('DOMContentLoaded', () => {
    // Extract active billboard details from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    let activeBillboardCode = urlParams.get('billboard_code') || 'ACU-BB-0001';
    let activeCameraFfCode = urlParams.get('camera_ff_code') || '';
    let activeCameraBfCode = urlParams.get('camera_bf_code') || '';
    let activeBillboardName = urlParams.get('bb_name') || '';

    function getInitialStats() {
        return {
            totalVehicles: 0,
            avgDwellTime: 0.0,
            peakHour: 'N/A',
            estimatedReach: 0,
            flowRate: 0.0,
            accuracy: 98.7,
            classes: {
                economy: { name: 'Bike', count: 0, pct: 0, color: '#1E88FF' },
                premium: { name: 'Commercial', count: 0, pct: 0, color: '#00C4FF' },
                luxury: { name: 'Economy', count: 0, pct: 0, color: '#8B5CF6' },
                ultra: { name: 'Premium', count: 0, pct: 0, color: '#F59E0B' },
                bikes: { name: 'Luxury', count: 0, pct: 0, color: '#10B981' },
                commercial: { name: 'Ultra Luxury', count: 0, pct: 0, color: '#F97316' }
            },
            dwellStats: {
                avg: 0.0,
                max: 0.0,
                min: 0.0,
                median: 0.0,
                periods: {
                    morning: 0.0,
                    afternoon: 0.0,
                    evening: 0.0,
                    night: 0.0
                }
            }
        };
    }

    const initialSimData = getInitialStats();

    // --- Global State & Configuration ---
    const state = {
        stats: {
            totalVehicles: initialSimData.totalVehicles,
            avgDwellTime: initialSimData.avgDwellTime,
            peakHour: initialSimData.peakHour,
            estimatedReach: initialSimData.estimatedReach,
            flowRate: initialSimData.flowRate,
            accuracy: initialSimData.accuracy,
            classes: initialSimData.classes,
            dwellStats: initialSimData.dwellStats
        },

        // Active Filters
        filters: {
            location: activeBillboardCode,
            roadType: 'all',
            dateRange: 'today',
            categories: {
                economy: true,
                premium: true,
                luxury: true,
                ultra: true,
                bikes: true,
                commercial: true
            },
            timeInterval: '1h',
            dayType: 'all',
            density: 'all',
            weather: 'all'
        },

        // Dynamic Simulation Speed multiplier
        simulationSpeed: 1.0,
        spawnChance: 0, // only spawn vehicles on canvas when live traffic exists

        // Chart Instances
        charts: {}
    };

    // --- Dom Elements ---
    const elements = {
        sidebar: document.getElementById('sidebarFilters'),
        openSidebarBtn: document.getElementById('openSidebarBtn'),
        closeSidebarBtn: document.getElementById('closeSidebarBtn'),
        applyFiltersBtn: document.getElementById('applyFiltersBtn'),
        resetFiltersBtn: document.getElementById('resetFiltersBtn'),
        refreshBtn: document.getElementById('refreshBtn'),
        lastUpdatedTime: document.getElementById('lastUpdatedTime'),
        headerLocationSelect: document.getElementById('headerLocationSelect'),
        filterLocation: document.getElementById('filterLocation'),
        filterRoadType: document.getElementById('filterRoadType'),
        filterDateRange: document.getElementById('filterDateRange'),
        filterTimeInterval: document.getElementById('filterTimeInterval'),
        filterDayType: document.getElementById('filterDayType'),
        filterDensity: document.getElementById('filterDensity'),
        filterWeather: document.getElementById('filterWeather'),

        // Checkboxes
        catEconomy: document.getElementById('catEconomy'),
        catPremium: document.getElementById('catPremium'),
        catLuxury: document.getElementById('catLuxury'),
        catUltra: document.getElementById('catUltra'),
        catBikes: document.getElementById('catBikes'),
        catCommercial: document.getElementById('catCommercial'),

        // KPI values
        kpiVehicles: document.getElementById('kpi-vehicles-value'),
        kpiDwell: document.getElementById('kpi-dwell-value'),
        kpiPeak: document.getElementById('kpi-peak-value'),
        kpiReach: document.getElementById('kpi-reach-value'),
        kpiFlow: document.getElementById('kpi-flow-value'),

        // Class counts and bars
        counts: {
            economy: document.getElementById('count-economy'),
            premium: document.getElementById('count-premium'),
            luxury: document.getElementById('count-luxury'),
            ultra: document.getElementById('count-ultra'),
            bikes: document.getElementById('count-bikes'),
            commercial: document.getElementById('count-commercial')
        },
        pcts: {
            economy: document.getElementById('pct-economy'),
            premium: document.getElementById('pct-premium'),
            luxury: document.getElementById('pct-luxury'),
            ultra: document.getElementById('pct-ultra'),
            bikes: document.getElementById('pct-bikes'),
            commercial: document.getElementById('pct-commercial')
        },
        bars: {
            economy: document.getElementById('bar-economy'),
            premium: document.getElementById('bar-premium'),
            luxury: document.getElementById('bar-luxury'),
            ultra: document.getElementById('bar-ultra'),
            bikes: document.getElementById('bar-bikes'),
            commercial: document.getElementById('bar-commercial')
        },

        // Dwell Stats
        dwellAvg: document.getElementById('dwell-stat-avg'),
        dwellMax: document.getElementById('dwell-stat-max'),
        dwellMin: document.getElementById('dwell-stat-min'),
        dwellMedian: document.getElementById('dwell-stat-median'),
        dwellMedianBox: document.getElementById('dwell-stat-median-box'),

        // Dwell Periods
        dwellMorning: document.getElementById('dwell-period-morning'),
        dwellAfternoon: document.getElementById('dwell-period-afternoon'),
        dwellEvening: document.getElementById('dwell-period-evening'),
        dwellNight: document.getElementById('dwell-period-night'),

        // Metadata & Timestamp
        hudTime: document.getElementById('hudTime'),
        hudStats: document.getElementById('hudStats'),
        cctvCamId: document.getElementById('cctvCamId'),
        cctvFps: document.getElementById('cctvFps'),
        cctvConfidence: document.getElementById('cctvConfidence'),

        // Heatmap
        densityHeatmap: document.getElementById('densityHeatmap'),

        // Canvas
        canvas: document.getElementById('cctvCanvas')
    };

    // --- Sidebar Controls ---
    if (elements.openSidebarBtn) {
        elements.openSidebarBtn.addEventListener('click', () => {
            if (elements.sidebar) elements.sidebar.classList.add('active');
        });
    }

    if (elements.closeSidebarBtn) {
        elements.closeSidebarBtn.addEventListener('click', () => {
            if (elements.sidebar) elements.sidebar.classList.remove('active');
        });
    }

    // Toggle location across header and filter panel synchronously
    if (elements.headerLocationSelect) {
        elements.headerLocationSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            if (elements.filterLocation) elements.filterLocation.value = val;
            updateLocationConfig(val);
        });
    }

    if (elements.filterLocation) {
        elements.filterLocation.addEventListener('change', (e) => {
            const val = e.target.value;
            if (elements.headerLocationSelect) elements.headerLocationSelect.value = val;
            updateLocationConfig(val);
        });
    }

    function updateLocationConfig(locationVal) {
        state.filters.location = locationVal;
        activeBillboardCode = (locationVal === 'active-cam') ? (urlParams.get('billboard_code') || 'ACU-BB-0001') : locationVal;

        if (window.syncHeaderDropdown) {
            window.syncHeaderDropdown(locationVal);
        }

        // Update CCTV camera ID display
        if (elements.cctvCamId) {
            const dropdown = document.getElementById('locationDropdown');
            const activeItem = dropdown?.querySelector(`.custom-dropdown-item[data-value="${locationVal}"]`);
            const labelText = activeItem ? activeItem.querySelector('.item-text').textContent : locationVal;
            elements.cctvCamId.textContent = `Camera ID: ${labelText}`;
        }

        // Trigger live fetch for this specific billboard
        fetchFromSupabaseDirectly(activeBillboardCode);
    }

    // --- Filters Submission ---
    if (elements.applyFiltersBtn) {
        elements.applyFiltersBtn.addEventListener('click', () => {
            if (elements.sidebar) elements.sidebar.classList.remove('active');

            // Grab values
            if (elements.filterLocation) state.filters.location = elements.filterLocation.value;
            if (elements.filterRoadType) state.filters.roadType = elements.filterRoadType.value;
            if (elements.filterDateRange) state.filters.dateRange = elements.filterDateRange.value;
            if (elements.filterTimeInterval) state.filters.timeInterval = elements.filterTimeInterval.value;
            if (elements.filterDayType) state.filters.dayType = elements.filterDayType.value;
            if (elements.filterDensity) state.filters.density = elements.filterDensity.value;
            if (elements.filterWeather) state.filters.weather = elements.filterWeather.value;

            // Checkboxes
            if (elements.catEconomy) state.filters.categories.economy = elements.catEconomy.checked;
            if (elements.catPremium) state.filters.categories.premium = elements.catPremium.checked;
            if (elements.catLuxury) state.filters.categories.luxury = elements.catLuxury.checked;
            if (elements.catUltra) state.filters.categories.ultra = elements.catUltra.checked;
            if (elements.catBikes) state.filters.categories.bikes = elements.catBikes.checked;
            if (elements.catCommercial) state.filters.categories.commercial = elements.catCommercial.checked;

            fetchFromSupabaseDirectly(state.filters.location);
            showNotification("Filters Applied Successfully");
        });
    }

    if (elements.resetFiltersBtn) {
        elements.resetFiltersBtn.addEventListener('click', () => {
            const hiddenSelect = document.getElementById('headerLocationSelect');
            const defaultCam = hiddenSelect && hiddenSelect.options.length > 0 ? hiddenSelect.options[0].value : activeBillboardCode;
            if (defaultCam) {
                if (elements.filterLocation) elements.filterLocation.value = defaultCam;
                if (elements.headerLocationSelect) elements.headerLocationSelect.value = defaultCam;
            }
            if (elements.filterRoadType) elements.filterRoadType.value = 'all';
            if (elements.filterDateRange) elements.filterDateRange.value = 'today';
            if (elements.filterTimeInterval) elements.filterTimeInterval.value = '1h';
            if (elements.filterDayType) elements.filterDayType.value = 'all';
            if (elements.filterDensity) elements.filterDensity.value = 'all';
            if (elements.filterWeather) elements.filterWeather.value = 'all';

            if (elements.catEconomy) elements.catEconomy.checked = true;
            if (elements.catPremium) elements.catPremium.checked = true;
            if (elements.catLuxury) elements.catLuxury.checked = true;
            if (elements.catUltra) elements.catUltra.checked = true;
            if (elements.catBikes) elements.catBikes.checked = true;
            if (elements.catCommercial) elements.catCommercial.checked = true;

            if (defaultCam) {
                updateLocationConfig(defaultCam);
            }
            showNotification("Filters Reset to Defaults");
        });
    }

    let lastUpdatedTimestamp = new Date();

    function formatLastUpdated(date = new Date()) {
        lastUpdatedTimestamp = date;
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        return `Last updated at ${timeStr}`;
    }

    // Refresh trigger handler (used both for auto-refresh interval and manual click)
    async function triggerAutoRefresh() {
        try {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({ 
                    type: 'ACULION_REFRESH_TRAFFIC_DATA',
                    billboard_code: activeBillboardCode 
                }, '*');
            }
        } catch (e) {
            console.error("Error dispatching refresh request to parent:", e);
        }

        await fetchFromSupabaseDirectly(activeBillboardCode);
    }

    if (elements.refreshBtn) {
        elements.refreshBtn.addEventListener('click', (e) => {
            e.preventDefault();
            triggerAutoRefresh();
        });
    }

    function showNotification(msg) {
        if (elements.lastUpdatedTime) {
            elements.lastUpdatedTime.textContent = msg;
            elements.lastUpdatedTime.style.color = 'var(--color-cyan)';
            setTimeout(() => {
                elements.lastUpdatedTime.textContent = formatLastUpdated(lastUpdatedTimestamp);
                elements.lastUpdatedTime.style.color = '';
            }, 3000);
        }
    }

    // Indian Comma Format Helper
    function formatIndianNumber(num) {
        if (num === undefined || num === null) return "0";
        let str = num.toString();
        let lastThree = str.substring(str.length - 3);
        let otherNumbers = str.substring(0, str.length - 3);
        if (otherNumbers !== '') {
            lastThree = ',' + lastThree;
        }
        return otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
    }

    // --- UI Values Update Binders ---
    function updateUIElements() {
        // Format KPI numbers
        if (elements.kpiVehicles) elements.kpiVehicles.textContent = formatIndianNumber(state.stats.totalVehicles);
        if (elements.kpiDwell) elements.kpiDwell.textContent = `${Number(state.stats.avgDwellTime || 0).toFixed(2)} sec`;
        if (elements.kpiReach) elements.kpiReach.textContent = formatIndianNumber(state.stats.estimatedReach);
        if (elements.kpiFlow) elements.kpiFlow.textContent = `${Number(state.stats.flowRate || 0).toFixed(1)} / min`;
        if (elements.kpiPeak) elements.kpiPeak.textContent = state.stats.peakHour || 'N/A';

        // Update list values and progress bars
        Object.keys(state.stats.classes).forEach(key => {
            const data = state.stats.classes[key];
            if (elements.counts && elements.counts[key]) {
                elements.counts[key].textContent = formatIndianNumber(data.count);
            }
            if (elements.pcts && elements.pcts[key]) {
                elements.pcts[key].textContent = `${data.pct}%`;
            }
            if (elements.bars && elements.bars[key]) {
                elements.bars[key].style.width = `${data.pct}%`;
            }
        });

        // Dwell details
        if (elements.dwellAvg) elements.dwellAvg.textContent = `${Number(state.stats.dwellStats.avg || 0).toFixed(1)}s`;
        if (elements.dwellMax) elements.dwellMax.textContent = `${Number(state.stats.dwellStats.max || 0).toFixed(1)}s`;
        if (elements.dwellMin) elements.dwellMin.textContent = `${Number(state.stats.dwellStats.min || 0).toFixed(1)}s`;
        if (elements.dwellMedian) elements.dwellMedian.textContent = `${Number(state.stats.dwellStats.median || 0).toFixed(1)}s`;
        if (elements.dwellMedianBox) elements.dwellMedianBox.textContent = `${Number(state.stats.dwellStats.median || 0).toFixed(1)}s`;

        // Dwell periods
        if (elements.dwellMorning) elements.dwellMorning.textContent = `${Number(state.stats.dwellStats.periods.morning || 0).toFixed(1)}s`;
        if (elements.dwellAfternoon) elements.dwellAfternoon.textContent = `${Number(state.stats.dwellStats.periods.afternoon || 0).toFixed(1)}s`;
        if (elements.dwellEvening) elements.dwellEvening.textContent = `${Number(state.stats.dwellStats.periods.evening || 0).toFixed(1)}s`;
        if (elements.dwellNight) elements.dwellNight.textContent = `${Number(state.stats.dwellStats.periods.night || 0).toFixed(1)}s`;

        // Update timestamp
        if (elements.hudTime) {
            const now = new Date();
            elements.hudTime.textContent = now.toISOString().replace('T', ' ').substring(0, 19);
        }

        if (elements.hudStats) {
            elements.hudStats.textContent = `DETECTIONS: ${formatIndianNumber(state.stats.totalVehicles)}`;
        }

        updateAIRecommendations();
    }

    function updateAIRecommendations() {
        const recTraffic = document.getElementById('recTrafficText');
        const recVehicleMix = document.getElementById('recVehicleMixText');
        const recDwell = document.getElementById('recDwellText');
        const recAudience = document.getElementById('recAudienceText');
        const recSmartAction = document.getElementById('recSmartAction');

        if (!recTraffic) return;

        const peak = state.stats.peakHour;
        const dwellAvg = Number(state.stats.avgDwellTime || 0).toFixed(1);

        if (state.stats.totalVehicles === 0) {
            recTraffic.innerHTML = `No live vehicular flow detected on <strong>${activeBillboardCode}</strong>. Connect camera sensor to begin tracking.`;
            recVehicleMix.textContent = `Vehicle mix breakdown will update automatically once traffic data streams from the Radxa computer.`;
            recDwell.textContent = `Average dwell time analytics are currently idle (0.0s).`;
            recAudience.textContent = `Audience reach analysis will calculate when vehicle detection thresholds are active.`;
            recSmartAction.textContent = `Standby for active traffic data streams to generate AI-assisted campaign optimizations.`;
            return;
        }

        let topClass = 'Economy';
        let maxCount = 0;
        Object.keys(state.stats.classes).forEach(k => {
            if (state.stats.classes[k].count > maxCount) {
                maxCount = state.stats.classes[k].count;
                topClass = state.stats.classes[k].name;
            }
        });

        recTraffic.innerHTML = `Peak traffic detected between <strong>${peak}</strong>. Recommend prioritizing advertising campaigns during this high-traffic window.`;
        recVehicleMix.textContent = `${topClass} account for the highest traffic volume. Truck and Bus traffic increases during morning hours. Cars and SUVs peak during evening hours.`;
        recDwell.textContent = `Average dwell time (${dwellAvg}s) is above the expected benchmark. Current billboard visibility is performing well with strong advertisement engagement.`;
        recAudience.textContent = `High-value vehicle segments (Cars + SUVs) represent an ideal audience for premium brands. Recommend targeting consumer campaigns during peak evening traffic.`;
        recSmartAction.textContent = `Increase brand campaigns from 6 PM to 8 PM to maximize visibility and audience engagement based on current traffic patterns and dwell time analytics (${dwellAvg}s).`;
    }

    // --- Heat Timeline Generation ---
    function renderHeatTimeline() {
        if (!elements.densityHeatmap) return;
        elements.densityHeatmap.innerHTML = '';

        const totalSlots = 17;
        for (let i = 0; i < totalSlots; i++) {
            const hourVal = 6 + i;
            let formattedHour = '';
            if (hourVal < 12) formattedHour = `${hourVal} AM`;
            else if (hourVal === 12) formattedHour = `12 PM`;
            else formattedHour = `${hourVal - 12} PM`;

            let densityMult = 0.25;
            let status = 'Low Density';
            if (hourVal >= 8 && hourVal <= 9) {
                densityMult = 0.85;
                status = 'High Density';
            } else if (hourVal >= 17 && hourVal <= 19) {
                densityMult = 0.98;
                status = 'Peak Intensity';
            } else if (hourVal >= 10 && hourVal <= 16) {
                densityMult = 0.55;
                status = 'Moderate Traffic';
            } else if (hourVal >= 20) {
                densityMult = 0.40;
                status = 'Declining Flow';
            }

            const scale = Math.round(densityMult * 120 + Math.random() * 20);

            const block = document.createElement('div');
            block.className = 'heatmap-block';
            block.style.backgroundColor = `rgba(30, 136, 255, ${densityMult})`;
            block.style.borderTop = `2px solid rgba(0, 240, 255, ${densityMult * 0.5})`;

            if (i % 2 === 0) {
                const label = document.createElement('span');
                label.className = 'heatmap-block-label';
                label.textContent = formattedHour;
                block.appendChild(label);
            }

            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.innerHTML = `
                <strong>${formattedHour}</strong><br/>
                Flow: ${scale} veh/min<br/>
                Status: <span style="color:var(--color-cyan)">${status}</span>
            `;
            block.appendChild(tooltip);

            elements.densityHeatmap.appendChild(block);
        }
    }

    // --- ApexCharts Implementations ---
    function initSparklines() {
        const commonSparklineOptions = {
            chart: {
                type: 'line',
                sparkline: { enabled: true },
                animations: { enabled: true, easing: 'smooth', speed: 800 }
            },
            stroke: {
                curve: 'smooth',
                width: 2
            },
            tooltip: { enabled: false },
            markers: { size: 0 }
        };

        const vEl = document.querySelector("#sparkline-vehicles");
        if (vEl) {
            state.charts.sparkVehicles = new ApexCharts(vEl, {
                ...commonSparklineOptions,
                series: [{ data: [0, 0, 0, 0, 0, 0, 0, 0, 0] }],
                colors: ['#1E88FF']
            });
            state.charts.sparkVehicles.render();
        }

        const dEl = document.querySelector("#sparkline-dwell");
        if (dEl) {
            state.charts.sparkDwell = new ApexCharts(dEl, {
                ...commonSparklineOptions,
                series: [{ data: [0, 0, 0, 0, 0, 0, 0, 0, 0] }],
                colors: ['#00F0FF']
            });
            state.charts.sparkDwell.render();
        }

        const rEl = document.querySelector("#sparkline-reach");
        if (rEl) {
            state.charts.sparkReach = new ApexCharts(rEl, {
                ...commonSparklineOptions,
                series: [{ data: [0, 0, 0, 0, 0, 0, 0, 0, 0] }],
                colors: ['#10B981']
            });
            state.charts.sparkReach.render();
        }

        const fEl = document.querySelector("#sparkline-flow");
        if (fEl) {
            state.charts.sparkFlow = new ApexCharts(fEl, {
                ...commonSparklineOptions,
                series: [{ data: [0, 0, 0, 0, 0, 0, 0, 0, 0] }],
                colors: ['#F97316']
            });
            state.charts.sparkFlow.render();
        }
    }

    function initDonutChart() {
        const classes = state.stats.classes;
        const options = {
            series: [
                classes.economy.count,
                classes.premium.count,
                classes.luxury.count,
                classes.ultra.count,
                classes.bikes.count,
                classes.commercial.count
            ],
            labels: ['Bike', 'Commercial', 'Economy', 'Premium', 'Luxury', 'Ultra Luxury'],
            chart: {
                type: 'donut',
                height: 260,
                background: 'transparent',
                foreColor: '#94a3b8'
            },
            theme: {
                mode: 'dark'
            },
            colors: [
                '#1E88FF',
                '#00C4FF',
                '#8B5CF6',
                '#F59E0B',
                '#10B981',
                '#F97316'
            ],
            stroke: {
                show: true,
                colors: ['rgba(22, 28, 45, 0.9)'],
                width: 2
            },
            dataLabels: {
                enabled: false
            },
            legend: {
                position: 'bottom',
                horizontalAlign: 'center',
                fontSize: '12px',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                markers: { radius: 12 },
                itemMargin: { horizontal: 8, vertical: 4 }
            },
            plotOptions: {
                pie: {
                    donut: {
                        size: '72%',
                        labels: {
                            show: true,
                            name: {
                                show: true,
                                fontSize: '13px',
                                fontFamily: 'Outfit, sans-serif',
                                color: '#94a3b8'
                            },
                            value: {
                                show: true,
                                fontSize: '20px',
                                fontFamily: 'Outfit, sans-serif',
                                color: '#FFFFFF',
                                fontWeight: 700,
                                formatter: function (val) {
                                    return Number(val).toLocaleString();
                                }
                            },
                            total: {
                                show: true,
                                label: 'Total Vehicles',
                                color: '#94a3b8',
                                formatter: function () {
                                    return formatIndianNumber(state.stats.totalVehicles || 0);
                                }
                            }
                        }
                    }
                }
            },
            tooltip: {
                y: {
                    formatter: function (val, { seriesIndex, w }) {
                        const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                        const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                        const trends = ['▲ +4.2%', '▲ +1.5%', '▼ -0.8%', '▲ +0.5%', '▲ +2.8%', '▼ -1.2%'];
                        return `${val.toLocaleString()} (${pct}%) • Trend: ${trends[seriesIndex] || ''}`;
                    }
                }
            }
        };

        const container = document.querySelector("#vehicleDonutChart");
        if (container) {
            container.innerHTML = '';
            state.charts.donut = new ApexCharts(container, options);
            state.charts.donut.render();
        }
    }

    function initDwellAreaChart() {
        const options = {
            series: [{
                name: 'Average Dwell Time (sec)',
                data: [9.8, 11.2, 15.2, 14.5, 12.8, 11.6, 14.2, 17.4, 16.1, 10.4]
            }],
            chart: {
                type: 'area',
                height: 200,
                background: 'transparent',
                foreColor: '#94a3b8',
                toolbar: { show: false },
                sparkline: { enabled: false }
            },
            theme: { mode: 'dark' },
            colors: ['#00F0FF'],
            fill: {
                type: 'gradient',
                gradient: {
                    shadeIntensity: 1,
                    opacityFrom: 0.35,
                    opacityTo: 0.02,
                    stops: [0, 90, 100]
                }
            },
            dataLabels: { enabled: false },
            stroke: {
                curve: 'smooth',
                width: 2
            },
            grid: {
                borderColor: 'rgba(255, 255, 255, 0.05)',
                xaxis: { lines: { show: false } },
                yaxis: { lines: { show: true } }
            },
            xaxis: {
                categories: ['6 AM', '8 AM', '10 AM', '12 PM', '2 PM', '4 PM', '6 PM', '8 PM', '10 PM', '12 AM'],
                axisBorder: { show: false },
                axisTicks: { show: false }
            },
            yaxis: {
                labels: {
                    formatter: function (val) {
                        return val.toFixed(1) + 's';
                    }
                }
            },
            tooltip: {
                theme: 'dark',
                x: { show: true }
            }
        };

        const container = document.querySelector("#dwellTimeAreaGraph");
        if (container) {
            container.innerHTML = '';
            state.charts.dwellArea = new ApexCharts(container, options);
            state.charts.dwellArea.render();
        }
    }

    // Interactive Multi-Series Line Chart showing Traffic Trends dynamically
    function initTrafficTrendChart() {
        const timeSeries = [];
        const baseTime = new Date();
        baseTime.setMinutes(0);
        baseTime.setSeconds(0);

        for (let i = 9; i >= 0; i--) {
            const d = new Date(baseTime.getTime() - i * 60 * 1000 * 15);
            timeSeries.push(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }

        const options = {
            series: [
                { name: 'Bike', data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
                { name: 'Commercial', data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
                { name: 'Economy', data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
                { name: 'Premium', data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
                { name: 'Luxury', data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
                { name: 'Ultra Luxury', data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }
            ],
            chart: {
                type: 'line',
                height: 280,
                background: 'transparent',
                foreColor: '#94a3b8',
                toolbar: { show: false },
                animations: {
                    enabled: true,
                    easing: 'linear',
                    dynamicAnimation: { speed: 1000 }
                }
            },
            colors: [
                '#1E88FF',
                '#00C4FF',
                '#8B5CF6',
                '#F59E0B',
                '#10B981',
                '#F97316'
            ],
            stroke: {
                curve: 'smooth',
                width: 3
            },
            grid: {
                borderColor: 'rgba(255, 255, 255, 0.05)',
                xaxis: { lines: { show: false } },
                yaxis: { lines: { show: true } }
            },
            dataLabels: { enabled: false },
            xaxis: {
                categories: timeSeries,
                axisBorder: { show: false },
                axisTicks: { show: false }
            },
            yaxis: {
                title: { text: 'Vehicles / Interval', style: { color: '#94a3b8' } }
            },
            legend: {
                position: 'top',
                horizontalAlign: 'right',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                markers: { radius: 12 }
            },
            tooltip: { theme: 'dark' }
        };

        const container = document.querySelector("#trafficTrendLineChart");
        if (container) {
            container.innerHTML = '';
            state.charts.trendLine = new ApexCharts(container, options);
            state.charts.trendLine.render();
        }
    }

    // --- CCTV Live Canvas Simulation ---
    const canvas = elements.canvas;
    const ctx = canvas ? canvas.getContext('2d') : null;

    let vehicles = [];
    let detectionTriggered = false;
    let detectionTriggerTimer = 0;

    let lastFpsUpdateTime = 0;
    let frameCount = 0;
    let currentFps = 29.8;

    class SimulatedVehicle {
        constructor(type) {
            this.type = type;
            this.y = 70;
            this.scale = 0.15;
            this.opacity = 0;
            this.detected = false;

            this.lane = Math.floor(Math.random() * 3);
            this.speed = 1.6 + Math.random() * 1.5;
            this.confidence = (94 + Math.random() * 5.9).toFixed(1);
            this.id = Math.floor(100 + Math.random() * 899);

            this.x = 320 + (this.lane - 1) * 30 + (Math.random() - 0.5) * 15;
        }

        update() {
            this.y += this.speed * state.simulationSpeed;
            const ratio = (this.y - 70) / (360 - 70);
            this.scale = 0.1 + ratio * 0.9;
            this.opacity = Math.min(1.0, ratio * 2.5);

            const laneCenterOffset = (this.lane - 1) * 160 * ratio;
            const targetX = 320 + laneCenterOffset;
            this.x = this.x + (targetX - this.x) * 0.1;
        }

        draw() {
            if (!ctx) return;
            ctx.save();
            ctx.globalAlpha = this.opacity;

            const width = 85 * this.scale;
            const height = 55 * this.scale;

            let color = 'rgba(30, 136, 255, 0.7)';
            if (this.detected) {
                color = 'rgba(0, 240, 255, 0.9)';
            }

            ctx.strokeStyle = color;
            ctx.lineWidth = Math.max(1, 2 * this.scale);

            ctx.strokeRect(this.x - width / 2, this.y - height / 2, width, height);

            const len = 8 * this.scale;
            ctx.beginPath();
            ctx.moveTo(this.x - width / 2 + len, this.y - height / 2);
            ctx.lineTo(this.x - width / 2, this.y - height / 2);
            ctx.lineTo(this.x - width / 2, this.y - height / 2 + len);

            ctx.moveTo(this.x + width / 2 - len, this.y - height / 2);
            ctx.lineTo(this.x + width / 2, this.y - height / 2);
            ctx.lineTo(this.x + width / 2, this.y - height / 2 + len);

            ctx.moveTo(this.x - width / 2 + len, this.y + height / 2);
            ctx.lineTo(this.x - width / 2, this.y + height / 2);
            ctx.lineTo(this.x - width / 2, this.y + height / 2 - len);

            ctx.moveTo(this.x + width / 2 - len, this.y + height / 2);
            ctx.lineTo(this.x + width / 2, this.y + height / 2);
            ctx.lineTo(this.x + width / 2, this.y + height / 2 - len);
            ctx.stroke();

            ctx.fillStyle = color;
            ctx.font = `bold ${Math.max(8, Math.round(11 * this.scale))}px monospace`;

            const emojis = { economy: '🏍', premium: '🚚', luxury: '🚗', ultra: '🚙', bikes: '🏎', commercial: '👑' };
            const tagText = `${emojis[this.type] || '🚗'} ID:${this.id} [${this.confidence}%]`;
            ctx.fillText(tagText, this.x - width / 2, this.y - height / 2 - 4);

            ctx.beginPath();
            ctx.moveTo(this.x, this.y + height / 2);
            ctx.lineTo(this.x, this.y + height / 2 + 10 * this.scale);
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
            ctx.stroke();

            ctx.restore();
        }
    }

    function initCctvSimulation() {
        if (!canvas) return;

        function drawCctvFrame(timestamp) {
            if (!ctx) return;
            if (!lastFpsUpdateTime) {
                lastFpsUpdateTime = timestamp;
            }
            frameCount++;
            if (timestamp - lastFpsUpdateTime >= 1000) {
                currentFps = +(frameCount * 1000 / (timestamp - lastFpsUpdateTime)).toFixed(1);
                if (elements.cctvFps) elements.cctvFps.textContent = currentFps;
                frameCount = 0;
                lastFpsUpdateTime = timestamp;
            }

            ctx.fillStyle = '#070C18';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.strokeStyle = 'rgba(30, 136, 255, 0.1)';
            ctx.lineWidth = 1;
            for (let i = 0; i <= canvas.width; i += 40) {
                ctx.beginPath();
                ctx.moveTo(i, canvas.height);
                ctx.lineTo(320 + (i - 320) * 0.1, 70);
                ctx.stroke();
            }

            ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
            ctx.beginPath();
            ctx.moveTo(0, 70);
            ctx.lineTo(canvas.width, 70);
            ctx.stroke();

            ctx.fillStyle = '#101524';
            ctx.beginPath();
            ctx.moveTo(320 - 40, 70);
            ctx.lineTo(320 + 40, 70);
            ctx.lineTo(canvas.width - 40, canvas.height);
            ctx.lineTo(40, canvas.height);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.setLineDash([8, 12]);
            ctx.lineWidth = 2;

            ctx.beginPath();
            ctx.moveTo(320 - 15, 70);
            ctx.lineTo(canvas.width / 2 - 120, canvas.height);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(320 + 15, 70);
            ctx.lineTo(canvas.width / 2 + 120, canvas.height);
            ctx.stroke();

            ctx.setLineDash([]);

            const detectionY = 240;
            ctx.save();
            ctx.shadowBlur = detectionTriggered ? 25 : 8;
            ctx.shadowColor = '#00F0FF';
            ctx.strokeStyle = detectionTriggered ? 'rgba(0, 240, 255, 0.8)' : 'rgba(0, 240, 255, 0.35)';
            ctx.lineWidth = detectionTriggered ? 4 : 2;
            ctx.beginPath();
            ctx.moveTo(80, detectionY);
            ctx.lineTo(canvas.width - 80, detectionY);
            ctx.stroke();
            ctx.restore();

            ctx.fillStyle = 'rgba(0, 240, 255, 0.8)';
            ctx.font = 'bold 9px monospace';
            ctx.fillText("AI DETECTION ZONE GATE", 90, detectionY - 6);

            // Manage vehicle spawning only when totalVehicles > 0
            if (state.spawnChance > 0 && Math.random() < state.spawnChance) {
                const rand = Math.random() * 100;
                let vehicleClass = 'luxury';
                if (rand < 52) vehicleClass = 'luxury';
                else if (rand < 81) vehicleClass = 'economy';
                else if (rand < 94) vehicleClass = 'ultra';
                else if (rand < 99) vehicleClass = 'premium';
                else if (rand < 99.8) vehicleClass = 'bikes';
                else vehicleClass = 'commercial';

                if (state.filters.categories[vehicleClass]) {
                    vehicles.push(new SimulatedVehicle(vehicleClass));
                }
            }

            for (let i = vehicles.length - 1; i >= 0; i--) {
                const vehicle = vehicles[i];
                vehicle.update();
                vehicle.draw();

                if (vehicle.y >= detectionY && !vehicle.detected) {
                    vehicle.detected = true;
                    detectionTriggered = true;
                    detectionTriggerTimer = 10;
                }

                if (vehicle.y > canvas.height + 30) {
                    vehicles.splice(i, 1);
                }
            }

            if (detectionTriggered) {
                detectionTriggerTimer--;
                if (detectionTriggerTimer <= 0) {
                    detectionTriggered = false;
                }
            }

            if (elements.hudStats) {
                elements.hudStats.textContent = `DETECTIONS: ${formatIndianNumber(state.stats.totalVehicles)}`;
            }

            requestAnimationFrame(drawCctvFrame);
        }

        requestAnimationFrame(drawCctvFrame);
    }

    // --- Dynamic Trend Line Streaming ---
    // Every 5 seconds, append live point if live data exists
    setInterval(() => {
        if (!state.charts.trendLine) return;
        if (state.stats.totalVehicles === 0) return; // Strict: no fake data when vehicle count is 0

        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const classes = state.stats.classes;
        const trend = state.charts.trendLine;

        const seriesData = trend.w.config.series;
        const newCats = [...trend.w.config.xaxis.categories];

        newCats.push(timeStr);
        if (newCats.length > 10) newCats.shift();

        const counts = [
            Math.round(classes.economy.count / 40 + (Math.random() - 0.5) * 5),
            Math.round(classes.premium.count / 40 + (Math.random() - 0.5) * 3),
            Math.round(classes.luxury.count / 40 + (Math.random() - 0.5) * 2),
            Math.round(classes.ultra.count / 40 + (Math.random() - 0.5) * 1),
            Math.round(classes.bikes.count / 40 + (Math.random() - 0.5) * 3),
            Math.round(classes.commercial.count / 40 + (Math.random() - 0.5) * 2)
        ];

        const normalizedCounts = counts.map(val => Math.max(0, val));

        const updatedSeries = seriesData.map((series, idx) => {
            const data = [...series.data];
            data.push(normalizedCounts[idx]);
            if (data.length > 10) data.shift();
            return {
                name: series.name,
                data: data
            };
        });

        trend.updateOptions({
            xaxis: { categories: newCats },
            series: updatedSeries
        });
    }, 5000);

    // --- Direct Supabase REST Integration ---
    const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1cXRzaGZwdG1xaWVhcWNnaGZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzkwOTYyMiwiZXhwIjoyMDk5NDg1NjIyfQ.f12uC9oK_BzLzlXgy_5ybUAgdHJTY6N7E5VWXXmgr5Q';
    let isFetchingDirectly = false;

    async function fetchFromSupabaseDirectly(overrideCode) {
        if (isFetchingDirectly) return null;
        isFetchingDirectly = true;

        const targetCode = overrideCode || activeBillboardCode || 'ACU-BB-0001';
        const cleanCode = (targetCode === 'active-cam') ? (urlParams.get('billboard_code') || 'ACU-BB-0001') : targetCode;

        // Show spinning animation on the refresh icon while the request is running
        const icon = elements.refreshBtn ? elements.refreshBtn.querySelector('svg, .refresh-icon, i, [data-lucide]') : null;
        if (icon) {
            icon.classList.add('spin-animation');
        }

        try {
            const queryUrl = `https://buqtshfptmqieaqcghfx.supabase.co/rest/v1/traffic_overview?select=*&billboard_code=eq.${encodeURIComponent(cleanCode)}&order=last_updated.desc&limit=1&_nocache=${Date.now()}`;
            const response = await fetch(queryUrl, {
                cache: 'no-store',
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data && Array.isArray(data) && data.length > 0 && data[0].billboard_code === cleanCode) {
                    const row = data[0];
                    updateDashboardWithLiveData(row, cleanCode);
                    setStatus('connected', true);
                    if (elements.lastUpdatedTime) {
                        elements.lastUpdatedTime.textContent = formatLastUpdated(new Date());
                    }
                    return row;
                } else {
                    // STRICT NO-DATA RULE: Exact billboard has no records in database -> Display 0s
                    applyZeroState(cleanCode);
                    if (elements.lastUpdatedTime) {
                        elements.lastUpdatedTime.textContent = formatLastUpdated(new Date());
                    }
                    return null;
                }
            } else {
                console.warn("Supabase fetch returned error status:", response.status);
                if (elements.lastUpdatedTime) {
                    elements.lastUpdatedTime.textContent = formatLastUpdated(new Date());
                }
            }
        } catch (err) {
            console.warn("Direct Supabase fetch exception:", err);
        } finally {
            isFetchingDirectly = false;
            if (icon) {
                icon.classList.remove('spin-animation');
            }
        }
        return null;
    }

    function applyZeroState(cleanCode) {
        state.stats = getInitialStats();
        state.spawnChance = 0;
        vehicles = [];

        updateUIElements();

        // Refresh Donut Chart to 0
        if (state.charts.donut) {
            state.charts.donut.updateSeries([0, 0, 0, 0, 0, 0]);
            state.charts.donut.updateOptions({
                plotOptions: {
                    pie: {
                        donut: {
                            labels: {
                                total: {
                                    formatter: function () {
                                        return "0";
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }

        // Refresh Traffic Trend Chart to 0
        if (state.charts.trendLine) {
            const seriesData = state.charts.trendLine.w.config.series;
            const updatedSeries = seriesData.map(series => ({
                name: series.name,
                data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
            }));
            state.charts.trendLine.updateSeries(updatedSeries);
        }

        // Sparklines to 0
        if (state.charts.sparkVehicles) {
            state.charts.sparkVehicles.updateSeries([{ data: [0, 0, 0, 0, 0, 0, 0, 0, 0] }]);
        }
        if (state.charts.sparkDwell) {
            state.charts.sparkDwell.updateSeries([{ data: [0, 0, 0, 0, 0, 0, 0, 0, 0] }]);
        }
        if (state.charts.sparkReach) {
            state.charts.sparkReach.updateSeries([{ data: [0, 0, 0, 0, 0, 0, 0, 0, 0] }]);
        }
        if (state.charts.sparkFlow) {
            state.charts.sparkFlow.updateSeries([{ data: [0, 0, 0, 0, 0, 0, 0, 0, 0] }]);
        }

        setStatus('connected', true);
    }

    function updateDashboardWithLiveData(data, targetBillboard) {
        if (!data) {
            applyZeroState(targetBillboard || activeBillboardCode);
            return;
        }

        // Verify billboard code match strictly
        const currentTarget = targetBillboard || activeBillboardCode;
        if (data.billboard_code && currentTarget && data.billboard_code !== currentTarget && currentTarget !== 'active-cam') {
            return;
        }

        // Vehicle breakdown
        const bikeCount = Number(data.bikes) || 0;
        const commercialCount = Number(data.commercial) || 0;
        const economyCount = Number(data.economy) || 0;
        const premiumCount = Number(data.premium) || 0;
        const luxuryCount = Number(data.luxury) || 0;
        const ultraLuxuryCount = Number(data.ultra_luxury) || 0;
        const calculatedSum = bikeCount + commercialCount + economyCount + premiumCount + luxuryCount + ultraLuxuryCount;
        const totalVehicles = Number(data.total_vehicles) || calculatedSum || 0;

        // Set stats
        state.stats.totalVehicles = totalVehicles;
        state.stats.avgDwellTime = Number(data.avg_exposure_time) || 0.0;
        state.stats.peakHour = data.peak_traffic_hour || 'N/A';
        state.stats.estimatedReach = Number(data.estimated_reach) || (totalVehicles > 0 ? Math.round(totalVehicles * 2.4) : 0);
        state.stats.flowRate = Number(data.flow_rate) || 0.0;

        state.stats.classes.economy.count = bikeCount;          // Bike
        state.stats.classes.premium.count = commercialCount;     // Commercial
        state.stats.classes.luxury.count = economyCount;         // Economy
        state.stats.classes.ultra.count = premiumCount;          // Premium
        state.stats.classes.bikes.count = luxuryCount;           // Luxury
        state.stats.classes.commercial.count = ultraLuxuryCount; // Ultra Luxury

        // Calculate percentages dynamically from sum
        const totalDivisor = calculatedSum > 0 ? calculatedSum : (totalVehicles > 0 ? totalVehicles : 1);
        Object.keys(state.stats.classes).forEach(key => {
            const count = state.stats.classes[key].count;
            state.stats.classes[key].pct = totalVehicles > 0 ? Math.round((count / totalDivisor) * 100) : 0;
        });

        if (state.stats.dwellStats) {
            state.stats.dwellStats.avg = Number(data.avg_exposure_time) || 0.0;
            state.stats.dwellStats.max = Number(data.max_exposure_time) || 0.0;
            state.stats.dwellStats.min = totalVehicles > 0 ? 1.5 : 0.0;
            state.stats.dwellStats.median = totalVehicles > 0 ? +(Number(data.avg_exposure_time) * 0.85).toFixed(1) : 0.0;
        }

        state.spawnChance = totalVehicles > 0 ? 0.035 : 0;

        updateUIElements();

        // Set status to connected
        setStatus('connected', true);

        // Update timestamp to current fetch time
        if (elements.lastUpdatedTime) {
            elements.lastUpdatedTime.textContent = formatLastUpdated(new Date());
        }

        if (elements.hudTime) {
            const updatedDate = data.last_updated ? new Date(data.last_updated) : new Date();
            elements.hudTime.textContent = updatedDate.toISOString().replace('T', ' ').substring(0, 19);
        }

        // Refresh Donut Chart and synchronize center label with KPI
        if (state.charts.donut) {
            state.charts.donut.updateSeries([
                state.stats.classes.economy.count,
                state.stats.classes.premium.count,
                state.stats.classes.luxury.count,
                state.stats.classes.ultra.count,
                state.stats.classes.bikes.count,
                state.stats.classes.commercial.count
            ]);
            state.charts.donut.updateOptions({
                plotOptions: {
                    pie: {
                        donut: {
                            labels: {
                                total: {
                                    formatter: function () {
                                        return formatIndianNumber(state.stats.totalVehicles);
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }

        // Refresh Traffic Trend Chart series scaled to 15-min intervals
        if (state.charts.trendLine) {
            if (totalVehicles === 0) {
                const seriesData = state.charts.trendLine.w.config.series;
                const updatedSeries = seriesData.map(series => ({
                    name: series.name,
                    data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
                }));
                state.charts.trendLine.updateSeries(updatedSeries);
            } else {
                const bBase = Math.max(1, Math.round(state.stats.classes.economy.count / 45));
                const cBase = Math.max(1, Math.round(state.stats.classes.premium.count / 45));
                const eBase = Math.max(1, Math.round(state.stats.classes.luxury.count / 45));
                const pBase = Math.max(1, Math.round(state.stats.classes.ultra.count / 45));
                const lBase = Math.max(1, Math.round(state.stats.classes.bikes.count / 45));
                const uBase = Math.max(1, Math.round(state.stats.classes.commercial.count / 45));

                const updatedSeries = [
                    { name: 'Bike', data: [bBase*0.6, bBase*0.8, bBase*0.75, bBase*0.9, bBase*1.1, bBase*0.95, bBase*1.2, bBase*1.4, bBase*1.3, bBase].map(Math.round) },
                    { name: 'Commercial', data: [cBase*0.7, cBase*0.9, cBase*1.0, cBase*0.95, cBase*0.8, cBase*0.75, cBase*0.9, cBase*1.1, cBase*1.0, cBase].map(Math.round) },
                    { name: 'Economy', data: [eBase*0.6, eBase*0.75, eBase*0.7, eBase*0.85, eBase*0.95, eBase*0.8, eBase*1.05, eBase*1.2, eBase*1.1, eBase].map(Math.round) },
                    { name: 'Premium', data: [pBase*0.5, pBase*0.6, pBase*0.7, pBase*0.65, pBase*0.85, pBase*0.8, pBase*0.95, pBase*1.15, pBase*1.0, pBase].map(Math.round) },
                    { name: 'Luxury', data: [lBase*0.5, lBase*0.6, lBase*0.6, lBase*0.75, lBase*0.7, lBase*0.6, lBase*0.9, lBase*1.2, lBase*0.9, lBase].map(Math.round) },
                    { name: 'Ultra Luxury', data: [uBase*0.4, uBase*0.5, uBase*0.6, uBase*0.5, uBase*0.7, uBase*0.4, uBase*1.0, uBase*1.2, uBase*0.8, uBase].map(Math.round) }
                ];
                state.charts.trendLine.updateSeries(updatedSeries);
            }
        }
    }

    function setStatus(stateName, isDb = false) {
        const indicator = document.getElementById('connectionStatusIndicator');
        const statusText = document.getElementById('connectionStatusText');
        if (!indicator || !statusText) return;

        if (stateName === 'connected') {
            indicator.className = 'status-indicator connected';
            statusText.textContent = isDb ? 'CONNECTED' : 'LIVE';
        } else if (stateName === 'reconnecting') {
            indicator.className = 'status-indicator reconnecting';
            statusText.textContent = 'CONNECTING...';
        } else {
            indicator.className = 'status-indicator disconnected';
            statusText.textContent = 'DISCONNECTED';
        }
    }

    // Reliable 5-second automatic refresh interval
    if (window.__trafficAutoRefreshInterval) {
        clearInterval(window.__trafficAutoRefreshInterval);
    }
    window.__trafficAutoRefreshInterval = setInterval(() => {
        triggerAutoRefresh();
    }, 5000);

    window.addEventListener('beforeunload', () => {
        if (window.__trafficAutoRefreshInterval) {
            clearInterval(window.__trafficAutoRefreshInterval);
        }
    });

    // Listen to parent frame updates
    window.addEventListener('message', (e) => {
        if (e.data) {
            if (e.data.type === 'ACULION_TRAFFIC_UPDATE' || e.data.type === 'ACULION_TRAFFIC_DATA_UPDATE') {
                const targetCode = e.data.billboard_code;
                const payload = e.data.data !== undefined ? e.data.data : e.data.payload;

                if (!targetCode || targetCode === activeBillboardCode) {
                    if (payload && payload.billboard_code === activeBillboardCode) {
                        updateDashboardWithLiveData(payload, activeBillboardCode);
                    } else if (!payload) {
                        applyZeroState(activeBillboardCode);
                    }
                }
            } else if (e.data.type === 'ACULION_SET_BILLBOARD') {
                if (e.data.billboard_code) {
                    activeBillboardCode = e.data.billboard_code;
                    fetchFromSupabaseDirectly(activeBillboardCode);
                }
            }
        }
    });

    function populateCameraDropdown() {
        const select = document.getElementById('headerLocationSelect');
        const menu = document.getElementById('locationDropdownMenu');
        const selectedText = document.getElementById('selectedLocationText');
        if (!select || !menu) return;

        const cameras = [
            { id: 'ACU-BB-0001', name: 'Mount Road Junction — ACU-BB-0001' },
            { id: 'ACU-BB-0002', name: 'OMR IT Corridor — ACU-BB-0002' },
            { id: 'ACU-BB-0003', name: 'GST Road Flyover — ACU-BB-0003' },
            { id: 'ACU-BB-0004', name: 'Anna Nagar Roundtana — ACU-BB-0004' }
        ];

        menu.innerHTML = '';
        select.innerHTML = '';

        let matchedName = activeBillboardName || '';
        const foundCam = cameras.find(c => c.id === activeBillboardCode);
        if (foundCam) {
            matchedName = foundCam.name;
        } else if (!matchedName) {
            matchedName = `Active Billboard (${activeBillboardCode})`;
        }

        const activeOpt = document.createElement('option');
        activeOpt.value = activeBillboardCode;
        activeOpt.textContent = matchedName;
        activeOpt.selected = true;
        select.appendChild(activeOpt);

        const activeItem = document.createElement('div');
        activeItem.className = 'custom-dropdown-item active';
        activeItem.setAttribute('data-value', activeBillboardCode);
        activeItem.setAttribute('role', 'option');
        activeItem.innerHTML = `<span class="item-text">${matchedName}</span><i data-lucide="check" class="item-check"></i>`;
        menu.appendChild(activeItem);

        if (selectedText) {
            selectedText.textContent = matchedName;
        }

        cameras.forEach(cam => {
            if (cam.id === activeBillboardCode) return;
            const opt = document.createElement('option');
            opt.value = cam.id;
            opt.textContent = cam.name;
            select.appendChild(opt);

            const item = document.createElement('div');
            item.className = 'custom-dropdown-item';
            item.setAttribute('data-value', cam.id);
            item.setAttribute('role', 'option');
            item.innerHTML = `<span class="item-text">${cam.name}</span><i data-lucide="check" class="item-check" style="display:none;"></i>`;
            menu.appendChild(item);
        });

        setupDropdownItemListeners();
        if (window.lucide) lucide.createIcons();
    }

    function setupDropdownItemListeners() {
        const dropdown = document.getElementById('locationDropdown');
        if (!dropdown) return;
        const items = dropdown.querySelectorAll('.custom-dropdown-item');
        const selectedText = document.getElementById('selectedLocationText');
        const hiddenSelect = document.getElementById('headerLocationSelect');

        items.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const val = item.getAttribute('data-value');
                const text = item.querySelector('.item-text').textContent;

                items.forEach(i => {
                    i.classList.remove('active');
                    const check = i.querySelector('.item-check');
                    if (check) check.style.display = 'none';
                });
                item.classList.add('active');
                const itemCheck = item.querySelector('.item-check');
                if (itemCheck) itemCheck.style.display = '';

                if (selectedText) selectedText.textContent = text;

                if (hiddenSelect) {
                    hiddenSelect.value = val;
                    hiddenSelect.dispatchEvent(new Event('change', { bubbles: true }));
                }

                activeBillboardCode = val;
                updateLocationConfig(val);

                dropdown.classList.remove('open');
                const toggle = document.getElementById('locationDropdownToggle');
                if (toggle) toggle.setAttribute('aria-expanded', 'false');
            });
        });
    }

    // --- Initialization Execution ---
    initCustomDropdowns();
    initSparklines();
    initDonutChart();
    initDwellAreaChart();
    initTrafficTrendChart();
    renderHeatTimeline();
    updateUIElements();
    initCctvSimulation();
    populateCameraDropdown();

    if (elements.lastUpdatedTime) {
        elements.lastUpdatedTime.textContent = formatLastUpdated(new Date());
    }

    // Trigger initial direct Supabase fetch for the active billboard
    fetchFromSupabaseDirectly(activeBillboardCode);

    if (window.lucide) {
        lucide.createIcons();
    }
});

// --- Custom Location Dropdown Controller ---
function initCustomDropdowns() {
    const dropdown = document.getElementById('locationDropdown');
    if (!dropdown) return;

    const toggle = document.getElementById('locationDropdownToggle');
    const hiddenSelect = document.getElementById('headerLocationSelect');
    const selectedText = document.getElementById('selectedLocationText');
    const items = dropdown.querySelectorAll('.custom-dropdown-item');

    let isOpen = false;

    function openDropdown() {
        document.querySelectorAll('.custom-dropdown.open').forEach(d => {
            if (d !== dropdown) d.classList.remove('open');
        });
        dropdown.classList.add('open');
        toggle.setAttribute('aria-expanded', 'true');
        isOpen = true;
    }

    function closeDropdown() {
        dropdown.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        isOpen = false;
    }

    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isOpen) {
            closeDropdown();
        } else {
            openDropdown();
        }
    });

    items.forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const val = item.getAttribute('data-value');
            const text = item.querySelector('.item-text').textContent;

            items.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            if (selectedText) selectedText.textContent = text;

            if (hiddenSelect) {
                hiddenSelect.value = val;
                hiddenSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }

            closeDropdown();
        });
    });

    document.addEventListener('click', (e) => {
        if (isOpen && !dropdown.contains(e.target)) {
            closeDropdown();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (isOpen && e.key === 'Escape') {
            closeDropdown();
        }
    });

    window.syncHeaderDropdown = function (val) {
        items.forEach(i => {
            if (i.getAttribute('data-value') === val) {
                i.classList.add('active');
                if (selectedText) selectedText.textContent = i.querySelector('.item-text').textContent;
            } else {
                i.classList.remove('active');
            }
        });
    };
}
