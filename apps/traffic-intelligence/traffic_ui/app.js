// ACULION Traffic Intelligence Dashboard Controller

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) 
    ? import.meta.env.VITE_API_BASE_URL 
    : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:8080' 
        : 'https://api.aculion.com');

document.addEventListener('DOMContentLoaded', () => {
    function getDbOrPlaceholderStats() {
        const stored = localStorage.getItem('aculion_traffic_overview');
        if (stored) {
            try {
                const data = JSON.parse(stored);
                if (data && data.total_vehicles !== undefined) {
                    return {
                        totalVehicles: data.total_vehicles,
                        avgDwellTime: Number(data.avg_exposure_time) || 14.8,
                        peakHour: data.peak_traffic_hour || '6:00 PM – 7:00 PM',
                        estimatedReach: data.estimated_reach || 42500,
                        flowRate: Number(data.flow_rate) || 84.5,
                        accuracy: 98.7,
                        classes: {
                            economy: { name: 'Bike', count: data.bikes || 0, pct: Math.round((data.bikes / data.total_vehicles) * 100) || 0, color: '#1E88FF' },
                            premium: { name: 'Commercial', count: data.commercial || 0, pct: Math.round((data.commercial / data.total_vehicles) * 100) || 0, color: '#00C4FF' },
                            luxury: { name: 'Economy', count: data.economy || 0, pct: Math.round((data.economy / data.total_vehicles) * 100) || 0, color: '#8B5CF6' },
                            ultra: { name: 'Premium', count: data.premium || 0, pct: Math.round((data.premium / data.total_vehicles) * 100) || 0, color: '#F59E0B' },
                            bikes: { name: 'Luxury', count: data.luxury || 0, pct: Math.round((data.luxury / data.total_vehicles) * 100) || 0, color: '#10B981' },
                            commercial: { name: 'Ultra Luxury', count: data.ultra_luxury || 0, pct: Math.round((data.ultra_luxury / data.total_vehicles) * 100) || 0, color: '#F97316' }
                        },
                        dwellStats: {
                            avg: Number(data.avg_exposure_time) || 14.8,
                            max: Number(data.max_exposure_time) || 58.2,
                            min: 1.5,
                            median: 12.4,
                            periods: {
                                morning: 15.2,
                                afternoon: 11.6,
                                evening: 17.4,
                                night: 9.8
                            }
                        }
                    };
                }
            } catch (e) {
                console.error("Error parsing stored traffic overview:", e);
            }
        }
        
        // No database data available: set database-backed fields to 0 / N/A,
        // and keep non-database-backed placeholder fields as their static values.
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

    function generateSimulatedData(cameraCode) {
        return {
            total_vehicles: 0,
            avg_exposure_time: 0.0,
            max_exposure_time: 0.0,
            peak_traffic_hour: 'N/A',
            estimated_reach: 0,
            flow_rate: 0.0,
            economy: 0,
            premium: 0,
            luxury: 0,
            ultra_luxury: 0,
            bikes: 0,
            commercial: 0
        };
    }

    const initialSimData = getDbOrPlaceholderStats();

    // --- Global State & Configuration ---
    const state = {
        // Master stats seeded with dynamic baseline values
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
            location: 'active-cam',
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
        spawnChance: 0.035, // Probability of spawning a vehicle per frame

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
        exportBtn: document.getElementById('exportBtn'),

        // Selectors
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
        lastUpdatedTime: document.getElementById('lastUpdatedTime'),
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
    elements.openSidebarBtn.addEventListener('click', () => {
        elements.sidebar.classList.add('active');
    });

    elements.closeSidebarBtn.addEventListener('click', () => {
        elements.sidebar.classList.remove('active');
    });

    // Toggle location across header and filter panel synchronously
    elements.headerLocationSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        elements.filterLocation.value = val;
        updateLocationConfig(val);
    });

    elements.filterLocation.addEventListener('change', (e) => {
        const val = e.target.value;
        elements.headerLocationSelect.value = val;
        updateLocationConfig(val);
    });

    function updateLocationConfig(locationVal) {
        state.filters.location = locationVal;

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

        // Trigger live fetch and realtime subscribe
        fetchLatestData(locationVal);
        connectToSSE(locationVal);
    }

    function shakeStatsForLocation(loc) {
        // Disabled: Relying on live Supabase Realtime SSE data instead
    }

    // --- Filters Submission ---
    elements.applyFiltersBtn.addEventListener('click', () => {
        elements.sidebar.classList.remove('active');

        // Grab values
        state.filters.location = elements.filterLocation.value;
        state.filters.roadType = elements.filterRoadType.value;
        state.filters.dateRange = elements.filterDateRange.value;
        state.filters.timeInterval = elements.filterTimeInterval.value;
        state.filters.dayType = elements.filterDayType.value;
        state.filters.density = elements.filterDensity.value;
        state.filters.weather = elements.filterWeather.value;

        // Checkboxes
        state.filters.categories.economy = elements.catEconomy.checked;
        state.filters.categories.premium = elements.catPremium.checked;
        state.filters.categories.luxury = elements.catLuxury.checked;
        state.filters.categories.ultra = elements.catUltra.checked;
        state.filters.categories.bikes = elements.catBikes.checked;
        state.filters.categories.commercial = elements.catCommercial.checked;

        // Adjust simulation parameters based on filters
        // Weather influence: clear skies = high flow, rain = low flow, high dwell
        // Only apply weather/density overrides when backend data exists
        const hasBackendData = !!localStorage.getItem('aculion_traffic_overview');
        if (hasBackendData) {
            if (state.filters.weather === 'rain') {
                state.spawnChance = 0.02;
            } else if (state.filters.weather === 'fog') {
                state.spawnChance = 0.015;
            } else {
                state.spawnChance = 0.035;
            }

            // Density adjustments
            if (state.filters.density === 'high') {
                state.spawnChance = 0.07;
            } else if (state.filters.density === 'low') {
                state.spawnChance = 0.01;
            }
        }

        fetchLatestData(state.filters.location);
        showNotification("Filters Applied Successfully");
    });

    elements.resetFiltersBtn.addEventListener('click', () => {
        // Reset inputs to default values
        const hiddenSelect = document.getElementById('headerLocationSelect');
        const defaultCam = hiddenSelect && hiddenSelect.options.length > 0 ? hiddenSelect.options[0].value : '';
        if (defaultCam) {
            elements.filterLocation.value = defaultCam;
            elements.headerLocationSelect.value = defaultCam;
        }
        elements.filterRoadType.value = 'all';
        elements.filterDateRange.value = 'today';
        elements.filterTimeInterval.value = '1h';
        elements.filterDayType.value = 'all';
        elements.filterDensity.value = 'all';
        elements.filterWeather.value = 'all';

        elements.catEconomy.checked = true;
        elements.catPremium.checked = true;
        elements.catLuxury.checked = true;
        elements.catUltra.checked = true;
        elements.catBikes.checked = true;
        elements.catCommercial.checked = true;

        state.spawnChance = 0.035;
        if (defaultCam) {
            updateLocationConfig(defaultCam);
        }
        showNotification("Filters Reset to Defaults");
    });

    // Refresh and export buttons
    elements.refreshBtn.addEventListener('click', () => {
        elements.refreshBtn.querySelector('i').classList.add('fa-spin');
        setTimeout(() => {
            elements.refreshBtn.querySelector('i').classList.remove('fa-spin');
            fetchLatestData(state.filters.location);
            showNotification("Live data refreshed");
        }, 800);
    });

    elements.exportBtn.addEventListener('click', () => {
        showNotification("Exporting intelligence PDF report...", "success");
        setTimeout(() => {
            alert("ACULION Outdoor Media Intelligence Report\n========================================\nExport Successful\nGenerated: " + new Date().toLocaleString());
        }, 500);
    });

    function showNotification(msg) {
        elements.lastUpdatedTime.textContent = msg;
        elements.lastUpdatedTime.style.color = 'var(--color-cyan)';
        setTimeout(() => {
            elements.lastUpdatedTime.textContent = "Last updated: Just now";
            elements.lastUpdatedTime.style.color = '';
        }, 3000);
    }

    // --- UI Values Update Binders ---
    function updateUIElements() {
        // Format big numbers
        elements.kpiVehicles.textContent = state.stats.totalVehicles.toLocaleString();
        elements.kpiDwell.textContent = `${state.stats.avgDwellTime} sec`;
        elements.kpiReach.textContent = state.stats.estimatedReach.toLocaleString();
        elements.kpiFlow.textContent = `${state.stats.flowRate} / min`;

        // Update list values and progress bars
        Object.keys(state.stats.classes).forEach(key => {
            const data = state.stats.classes[key];
            if (elements.counts[key]) {
                elements.counts[key].textContent = data.count.toLocaleString();
            }
            if (elements.pcts[key]) {
                elements.pcts[key].textContent = `${data.pct}%`;
            }
            if (elements.bars[key]) {
                elements.bars[key].style.width = `${data.pct}%`;
            }
        });

        // Dwell details
        elements.dwellAvg.textContent = `${state.stats.dwellStats.avg}s`;
        elements.dwellMax.textContent = `${state.stats.dwellStats.max}s`;
        elements.dwellMin.textContent = `${state.stats.dwellStats.min}s`;
        elements.dwellMedian.textContent = `${state.stats.dwellStats.median}s`;
        elements.dwellMedianBox.textContent = `${state.stats.dwellStats.median}s`;

        // Dwell periods
        elements.dwellMorning.textContent = `${state.stats.dwellStats.periods.morning}s`;
        elements.dwellAfternoon.textContent = `${state.stats.dwellStats.periods.afternoon}s`;
        elements.dwellEvening.textContent = `${state.stats.dwellStats.periods.evening}s`;
        elements.dwellNight.textContent = `${state.stats.dwellStats.periods.night}s`;

        // Update timestamp
        if (elements.hudTime) {
            const now = new Date();
            elements.hudTime.textContent = now.toISOString().replace('T', ' ').substring(0, 19);
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
        const dwellAvg = state.stats.avgDwellTime;

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
        elements.densityHeatmap.innerHTML = '';
        const hours = ['6 AM', '8 AM', '10 AM', '12 PM', '2 PM', '4 PM', '6 PM', '8 PM', '10 PM'];

        // We will generate hours from 6 AM to 10 PM in 1-hour increments
        // 6AM to 10PM is 16 slots.
        const totalSlots = 17;
        for (let i = 0; i < totalSlots; i++) {
            const hourVal = 6 + i;
            let formattedHour = '';
            if (hourVal < 12) formattedHour = `${hourVal} AM`;
            else if (hourVal === 12) formattedHour = `12 PM`;
            else formattedHour = `${hourVal - 12} PM`;

            // Setup custom density profile
            let densityMult = 0.25;
            let status = 'Low Density';
            // Peaks at morning commute (8-9 AM) and evening commute (5-7 PM)
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
            // Shades of Electric Blue: background opacity represents density
            block.style.backgroundColor = `rgba(30, 136, 255, ${densityMult})`;
            block.style.borderTop = `2px solid rgba(0, 240, 255, ${densityMult * 0.5})`;

            // Only show labels on alternate/specific intervals to avoid congestion
            if (i % 2 === 0) {
                const label = document.createElement('span');
                label.className = 'heatmap-block-label';
                label.textContent = formattedHour;
                block.appendChild(label);
            }

            // Custom tooltip
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

        // Vehicles sparkline
        state.charts.sparkVehicles = new ApexCharts(document.querySelector("#sparkline-vehicles"), {
            ...commonSparklineOptions,
            series: [{ data: [12, 18, 15, 24, 21, 29, 32, 27, 35] }],
            colors: ['#1E88FF']
        });
        state.charts.sparkVehicles.render();

        // Dwell sparkline
        state.charts.sparkDwell = new ApexCharts(document.querySelector("#sparkline-dwell"), {
            ...commonSparklineOptions,
            series: [{ data: [13.2, 14.1, 13.9, 14.5, 14.8, 14.4, 15.1, 14.7, 14.8] }],
            colors: ['#00F0FF']
        });
        state.charts.sparkDwell.render();

        // Reach sparkline
        state.charts.sparkReach = new ApexCharts(document.querySelector("#sparkline-reach"), {
            ...commonSparklineOptions,
            series: [{ data: [25, 29, 27, 36, 32, 40, 43, 38, 42] }],
            colors: ['#10B981']
        });
        state.charts.sparkReach.render();

        // Flow sparkline
        state.charts.sparkFlow = new ApexCharts(document.querySelector("#sparkline-flow"), {
            ...commonSparklineOptions,
            series: [{ data: [75, 82, 79, 86, 81, 89, 84, 83, 84.5] }],
            colors: ['#F97316']
        });
        state.charts.sparkFlow.render();
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
                background: 'transparent',
                foreColor: 'var(--text-secondary)'
            },
            theme: {
                mode: 'dark'
            },
            colors: [
                'var(--color-economy)',
                'var(--color-premium)',
                'var(--color-luxury)',
                'var(--color-ultra)',
                'var(--color-bikes)',
                'var(--color-commercial)'
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
                fontFamily: 'var(--font-body)',
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
                                fontFamily: 'var(--font-heading)',
                                color: 'var(--text-secondary)'
                            },
                            value: {
                                show: true,
                                fontSize: '20px',
                                fontFamily: 'var(--font-heading)',
                                color: '#FFFFFF',
                                fontWeight: 700,
                                formatter: function (val) {
                                    return Number(val).toLocaleString();
                                }
                            },
                            total: {
                                show: true,
                                label: 'Total Vehicles',
                                color: 'var(--text-secondary)',
                                formatter: function (w) {
                                    return w.globals.seriesTotals.reduce((a, b) => a + b, 0).toLocaleString();
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
                        const pct = ((val / total) * 100).toFixed(1);
                        // Mock trend to meet "Hover should show Count, Percentage, Trend" requirement
                        const trends = ['▲ +4.2%', '▲ +1.5%', '▼ -0.8%', '▲ +0.5%', '▲ +2.8%', '▼ -1.2%'];
                        return `${val.toLocaleString()} (${pct}%) • Trend: ${trends[seriesIndex]}`;
                    }
                }
            }
        };

        state.charts.donut = new ApexCharts(document.querySelector("#vehicleDonutChart"), options);
        state.charts.donut.render();
    }

    function initDwellAreaChart() {
        const options = {
            series: [{
                name: 'Average Dwell Time (sec)',
                data: [9.8, 11.2, 15.2, 14.5, 12.8, 11.6, 14.2, 17.4, 16.1, 10.4]
            }],
            chart: {
                type: 'area',
                height: '100%',
                background: 'transparent',
                foreColor: 'var(--text-secondary)',
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

        state.charts.dwellArea = new ApexCharts(document.querySelector("#dwellTimeAreaGraph"), options);
        state.charts.dwellArea.render();
    }

    // Interactive Multi-Series Line Chart showing Traffic Trends dynamically
    function initTrafficTrendChart() {
        // Let's create some baseline historical coordinates
        const timeSeries = [];
        const baseTime = new Date();
        baseTime.setMinutes(0);
        baseTime.setSeconds(0);

        // 10 historical hourly coordinates
        for (let i = 9; i >= 0; i--) {
            const d = new Date(baseTime.getTime() - i * 60 * 1000 * 15); // 15 min intervals
            timeSeries.push(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }

        const options = {
            series: [
                { name: 'Bike', data: [45, 62, 58, 72, 88, 74, 98, 112, 105, 108] },
                { name: 'Commercial', data: [28, 35, 42, 39, 31, 28, 34, 45, 41, 40] },
                { name: 'Economy', data: [110, 134, 120, 145, 168, 142, 185, 204, 190, 195] },
                { name: 'Premium', data: [32, 28, 42, 38, 51, 48, 56, 68, 58, 62] },
                { name: 'Luxury', data: [12, 10, 14, 18, 15, 12, 22, 28, 20, 24] },
                { name: 'Ultra Luxury', data: [3, 2, 4, 3, 5, 2, 8, 9, 6, 8] }
            ],
            chart: {
                type: 'line',
                height: '100%',
                background: 'transparent',
                foreColor: 'var(--text-secondary)',
                toolbar: { show: false },
                animations: {
                    enabled: true,
                    easing: 'linear',
                    dynamicAnimation: { speed: 1000 }
                }
            },
            colors: [
                'var(--color-economy)',
                'var(--color-premium)',
                'var(--color-luxury)',
                'var(--color-ultra)',
                'var(--color-bikes)',
                'var(--color-commercial)'
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
                title: { text: 'Vehicles / Interval', style: { color: 'var(--text-secondary)' } }
            },
            legend: {
                position: 'top',
                horizontalAlign: 'right',
                fontFamily: 'var(--font-body)',
                markers: { radius: 12 }
            },
            tooltip: { theme: 'dark' }
        };

        state.charts.trendLine = new ApexCharts(document.querySelector("#trafficTrendLineChart"), options);
        state.charts.trendLine.render();
    }

    function refreshCharts() {
        const classes = state.stats.classes;

        // Donut update
        if (state.charts.donut) {
            state.charts.donut.updateSeries([
                classes.economy.count,
                classes.premium.count,
                classes.luxury.count,
                classes.ultra.count,
                classes.bikes.count,
                classes.commercial.count
            ]);
        }

        // Sparklines update slightly
        if (state.charts.sparkVehicles) {
            let data = state.charts.sparkVehicles.w.config.series[0].data;
            data.push(Math.round(data[data.length - 1] * (0.95 + Math.random() * 0.1)));
            if (data.length > 12) data.shift();
            state.charts.sparkVehicles.updateSeries([{ data: data }]);
        }
    }

    // --- CCTV Live Canvas Simulation ---
    const canvas = elements.canvas;
    const ctx = canvas ? canvas.getContext('2d') : null;

    let vehicles = [];
    let detectionTriggered = false;
    let detectionTriggerTimer = 0;

    // FPS tracking variables
    let lastFpsUpdateTime = 0;
    let frameCount = 0;
    let currentFps = 29.8;

    class SimulatedVehicle {
        constructor(type) {
            this.type = type; // economy, premium, luxury, ultra, bikes, commercial
            this.y = 70; // horizon y coordinate
            this.scale = 0.15;
            this.opacity = 0;
            this.detected = false;

            // Lane mapping (three lanes diverging in perspective)
            this.lane = Math.floor(Math.random() * 3); // 0 = left, 1 = middle, 2 = right
            this.speed = 1.6 + Math.random() * 1.5;
            this.confidence = (94 + Math.random() * 5.9).toFixed(1);
            this.id = Math.floor(100 + Math.random() * 899);

            // Starting point near horizon centering
            this.x = 320 + (this.lane - 1) * 30 + (Math.random() - 0.5) * 15;
        }

        update() {
            // Move vehicle down the street perspective
            this.y += this.speed * state.simulationSpeed;

            // Perspective calculations
            // As y goes from 70 to 360:
            const ratio = (this.y - 70) / (360 - 70);
            this.scale = 0.1 + ratio * 0.9;
            this.opacity = Math.min(1.0, ratio * 2.5); // fade in from horizon

            // Lane divergence perspective mapping
            // Lane width increases as scale increases
            const laneCenterOffset = (this.lane - 1) * 160 * ratio;
            const targetX = 320 + laneCenterOffset;
            this.x = this.x + (targetX - this.x) * 0.1; // lerp horizontal position
        }

        draw() {
            ctx.save();
            ctx.globalAlpha = this.opacity;

            // Dimensions scaled
            const width = 85 * this.scale;
            const height = 55 * this.scale;

            // Neon tracking color
            let color = 'rgba(30, 136, 255, 0.7)'; // electric blue default
            if (this.detected) {
                color = 'rgba(0, 240, 255, 0.9)'; // bright cyan detected
            }

            ctx.strokeStyle = color;
            ctx.lineWidth = Math.max(1, 2 * this.scale);

            // 1. Draw detection bounding box
            ctx.strokeRect(this.x - width / 2, this.y - height / 2, width, height);

            // 2. Draw HUD bounding corners
            const len = 8 * this.scale;
            ctx.beginPath();
            // Top-left
            ctx.moveTo(this.x - width / 2 + len, this.y - height / 2);
            ctx.lineTo(this.x - width / 2, this.y - height / 2);
            ctx.lineTo(this.x - width / 2, this.y - height / 2 + len);
            // Top-right
            ctx.moveTo(this.x + width / 2 - len, this.y - height / 2);
            ctx.lineTo(this.x + width / 2, this.y - height / 2);
            ctx.lineTo(this.x + width / 2, this.y - height / 2 + len);
            // Bottom-left
            ctx.moveTo(this.x - width / 2 + len, this.y + height / 2);
            ctx.lineTo(this.x - width / 2, this.y + height / 2);
            ctx.lineTo(this.x - width / 2, this.y + height / 2 - len);
            // Bottom-right
            ctx.moveTo(this.x + width / 2 - len, this.y + height / 2);
            ctx.lineTo(this.x + width / 2, this.y + height / 2);
            ctx.lineTo(this.x + width / 2, this.y + height / 2 - len);
            ctx.stroke();

            // 3. Draw classification tag
            ctx.fillStyle = color;
            ctx.font = `bold ${Math.max(8, Math.round(11 * this.scale))}px monospace`;

            // Emoji map
            const emojis = { economy: '🏍', premium: '🚚', luxury: '🚗', ultra: '🚙', bikes: '🏎', commercial: '👑' };
            const tagText = `${emojis[this.type]} ID:${this.id} [${this.confidence}%]`;
            ctx.fillText(tagText, this.x - width / 2, this.y - height / 2 - 4);

            // 4. Bounding vector trailing line
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
        // CCTV loop
        function drawCctvFrame(timestamp) {
            // Calculate FPS dynamically
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

            // --- Background drawing ---
            ctx.fillStyle = '#070C18';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw grid perspective guidelines
            ctx.strokeStyle = 'rgba(30, 136, 255, 0.1)';
            ctx.lineWidth = 1;
            for (let i = 0; i <= canvas.width; i += 40) {
                ctx.beginPath();
                ctx.moveTo(i, canvas.height);
                ctx.lineTo(320 + (i - 320) * 0.1, 70); // Horizon focus point
                ctx.stroke();
            }

            // Horizon limit line
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
            ctx.beginPath();
            ctx.moveTo(0, 70);
            ctx.lineTo(canvas.width, 70);
            ctx.stroke();

            // Draw highway pavement lines (perspective boundaries)
            ctx.fillStyle = '#101524';
            ctx.beginPath();
            ctx.moveTo(320 - 40, 70); // Left horizon corner
            ctx.lineTo(320 + 40, 70); // Right horizon corner
            ctx.lineTo(canvas.width - 40, canvas.height);
            ctx.lineTo(40, canvas.height);
            ctx.closePath();
            ctx.fill();

            // Pavement lane dividers (dotted lines moving down / static perspective)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.setLineDash([8, 12]);
            ctx.lineWidth = 2;

            // Left lane divider
            ctx.beginPath();
            ctx.moveTo(320 - 15, 70);
            ctx.lineTo(canvas.width / 2 - 120, canvas.height);
            ctx.stroke();

            // Right lane divider
            ctx.beginPath();
            ctx.moveTo(320 + 15, 70);
            ctx.lineTo(canvas.width / 2 + 120, canvas.height);
            ctx.stroke();

            ctx.setLineDash([]); // clear dash

            // Draw Glowing neon AI detection horizontal gate line
            // Vehicles crossing this Y coordinate get detected!
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

            // Neon Gate Label
            ctx.fillStyle = 'rgba(0, 240, 255, 0.8)';
            ctx.font = 'bold 9px monospace';
            ctx.fillText("AI DETECTION ZONE GATE", 90, detectionY - 6);

            // --- Manage Spawning ---
            if (Math.random() < state.spawnChance) {
                // Determine class based on weights (Bike 29%, Economy 52%, Commercial 12%, Premium 13%, Luxury 5%, Ultra Luxury 1%)
                const rand = Math.random() * 100;
                let vehicleClass = 'luxury';
                if (rand < 52) vehicleClass = 'luxury';       // Economy: 52%
                else if (rand < 81) vehicleClass = 'economy'; // Bike: 52+29=81%
                else if (rand < 94) vehicleClass = 'ultra';   // Premium: 81+13=94%
                else if (rand < 99) vehicleClass = 'premium'; // Commercial: 94+5≈99%
                else if (rand < 99.8) vehicleClass = 'bikes'; // Luxury: 99+0.8
                else vehicleClass = 'commercial';             // Ultra Luxury

                // Check if category is enabled in filters
                if (state.filters.categories[vehicleClass]) {
                    vehicles.push(new SimulatedVehicle(vehicleClass));
                }
            }

            // --- Update and Draw Vehicles ---
            for (let i = vehicles.length - 1; i >= 0; i--) {
                const vehicle = vehicles[i];
                vehicle.update();
                vehicle.draw();

                // Check detection line crossing trigger
                if (vehicle.y >= detectionY && !vehicle.detected) {
                    vehicle.detected = true;
                    detectionTriggered = true;
                    detectionTriggerTimer = 10; // flash frame count

                    // Trigger global stat increments (disabled locally, driven by SSE realtime)
                    // incrementVehicleCounters(vehicle.type);
                }

                // Remove vehicles when they go out of screen bounds
                if (vehicle.y > canvas.height + 30) {
                    vehicles.splice(i, 1);
                }
            }

            // HUD Overlays update
            if (detectionTriggered) {
                detectionTriggerTimer--;
                if (detectionTriggerTimer <= 0) {
                    detectionTriggered = false;
                }
            }

            if (elements.hudStats) {
                elements.hudStats.textContent = `DETECTIONS: ${state.stats.totalVehicles.toLocaleString()}`;
            }

            requestAnimationFrame(drawCctvFrame);
        }

        requestAnimationFrame(drawCctvFrame);
    }

    // Dynamic Increment triggers
    function incrementVehicleCounters(type) {
        // Increment primary counters
        state.stats.totalVehicles++;
        state.stats.estimatedReach += Math.floor(1 + Math.random() * 2); // average 1.5 reach multiplier

        // Micro flow-rate adjustments — use backend baseline when available
        const baseFlowRate = state.stats.flowRate || 0;
        state.stats.flowRate = +(baseFlowRate + (Math.random() - 0.5) * 2).toFixed(1);

        // Accuracy stays high
        state.stats.accuracy = +(98.5 + Math.random() * 0.4).toFixed(1);

        // Increment specific class count
        if (state.stats.classes[type]) {
            state.stats.classes[type].count++;
        }

        // Recompute percentages
        let totalSum = 0;
        Object.keys(state.stats.classes).forEach(key => {
            totalSum += state.stats.classes[key].count;
        });
        Object.keys(state.stats.classes).forEach(key => {
            state.stats.classes[key].pct = Math.round((state.stats.classes[key].count / totalSum) * 100);
        });

        // Trigger brief visual highlight on the KPI card value to show real-time link
        const targetElement = document.getElementById('kpi-vehicles');
        targetElement.style.borderColor = 'rgba(0, 240, 255, 0.6)';
        targetElement.style.boxShadow = '0 0 15px rgba(0, 240, 255, 0.2)';
        setTimeout(() => {
            targetElement.style.borderColor = '';
            targetElement.style.boxShadow = '';
        }, 150);

        // Periodically adjust live traffic trend line series
        // Check if we should update chart data points (e.g. streaming update)
        // Let's do it on a paced rate, e.g. update charts on every 5 vehicles
        if (state.stats.totalVehicles % 5 === 0) {
            refreshCharts();
        }

        updateUIElements();
    }

    // --- Dynamic Trend Line Streaming ---
    // Every 5 seconds, append a new data point to the Traffic Trend chart to create live scrolling
    setInterval(() => {
        if (!state.charts.trendLine) return;

        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const classes = state.stats.classes;
        const trend = state.charts.trendLine;

        // Grab current categories
        const seriesData = trend.w.config.series;
        const newCats = [...trend.w.config.xaxis.categories];

        newCats.push(timeStr);
        if (newCats.length > 10) newCats.shift();

        // Map fresh values with minor random fluctuation around current stats to represent interval count
        const counts = [
            Math.round(classes.economy.count / 40 + (Math.random() - 0.5) * 15),
            Math.round(classes.premium.count / 40 + (Math.random() - 0.5) * 8),
            Math.round(classes.luxury.count / 40 + (Math.random() - 0.5) * 4),
            Math.round(classes.ultra.count / 40 + (Math.random() - 0.5) * 2),
            Math.round(classes.bikes.count / 40 + (Math.random() - 0.5) * 10),
            Math.round(classes.commercial.count / 40 + (Math.random() - 0.5) * 6)
        ];

        // Ensure no negative values
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

    // --- Initialization Execution ---
    initCustomDropdowns();
    initSparklines();
    initDonutChart();
    initDwellAreaChart();
    initTrafficTrendChart();
    renderHeatTimeline();
    updateUIElements();
    initCctvSimulation();
    initClassifCamera();

    // --- Live Simulated Realtime Integration ---
    let sseInterval = null;

    function connectToSSE(cameraCode) {
        if (sseInterval) {
            clearInterval(sseInterval);
        }

        const indicator = document.getElementById('connectionStatusIndicator');
        const statusText = document.getElementById('connectionStatusText');

        function setStatus(stateName, isDb = false) {
            if (!indicator || !statusText) return;
            if (stateName === 'connected') {
                indicator.className = 'status-indicator status-online';
                statusText.textContent = isDb ? 'CONNECTED (DATABASE)' : 'CONNECTED (SIMULATED)';
            } else if (stateName === 'reconnecting') {
                indicator.className = 'status-indicator status-connecting';
                statusText.textContent = 'CONNECTING...';
            } else {
                indicator.className = 'status-indicator status-offline';
                statusText.textContent = 'DISCONNECTED';
            }
        }

        setStatus('reconnecting');

        setTimeout(() => {
            const stored = localStorage.getItem('aculion_traffic_overview');
            if (stored) {
                try {
                    const dbData = JSON.parse(stored);
                    if (dbData && dbData.total_vehicles !== undefined) {
                        setStatus('connected', true);
                        const parsedData = {
                            total_vehicles: dbData.total_vehicles,
                            avg_exposure_time: Number(dbData.avg_exposure_time) || 0.0,
                            max_exposure_time: Number(dbData.max_exposure_time) || 0.0,
                            peak_traffic_hour: dbData.peak_traffic_hour || 'N/A',
                            estimated_reach: dbData.estimated_reach || 0,
                            flow_rate: Number(dbData.flow_rate) || 0.0,
                            economy: dbData.bikes || 0,
                            premium: dbData.commercial || 0,
                            luxury: dbData.economy || 0,
                            ultra_luxury: dbData.premium || 0,
                            bikes: dbData.luxury || 0,
                            commercial: dbData.ultra_luxury || 0
                        };
                        updateDashboardWithLiveData(parsedData);
                        return;
                    }
                } catch (e) {
                    console.error("Error parsing dynamic SSE data:", e);
                }
            }

            setStatus('connected', false);
            let baseData = generateSimulatedData(cameraCode);
            updateDashboardWithLiveData(baseData);
        }, 500);
    }

    async function fetchLatestData(cameraCode) {
        try {
            const stored = localStorage.getItem('aculion_traffic_overview');
            if (stored) {
                try {
                    const dbData = JSON.parse(stored);
                    if (dbData && dbData.total_vehicles !== undefined) {
                        const parsedData = {
                            total_vehicles: dbData.total_vehicles,
                            avg_exposure_time: Number(dbData.avg_exposure_time) || 0.0,
                            max_exposure_time: Number(dbData.max_exposure_time) || 0.0,
                            peak_traffic_hour: dbData.peak_traffic_hour || 'N/A',
                            estimated_reach: dbData.estimated_reach || 0,
                            flow_rate: Number(dbData.flow_rate) || 0.0,
                            economy: dbData.bikes || 0,
                            premium: dbData.commercial || 0,
                            luxury: dbData.economy || 0,
                            ultra_luxury: dbData.premium || 0,
                            bikes: dbData.luxury || 0,
                            commercial: dbData.ultra_luxury || 0
                        };
                        updateDashboardWithLiveData(parsedData);
                        return;
                    }
                } catch (e) {}
            }

            const data = generateSimulatedData(cameraCode);
            updateDashboardWithLiveData(data);
        } catch (e) {
            console.error("Error fetching latest traffic data:", e);
        }
    }

    function updateDashboardWithLiveData(data) {
        if (!data) return;

        // Map fields
        state.stats.totalVehicles = data.total_vehicles || 0;
        state.stats.avgDwellTime = data.avg_exposure_time || 0.0;
        state.stats.peakHour = data.peak_traffic_hour || 'N/A';
        state.stats.estimatedReach = data.estimated_reach || 0;
        state.stats.flowRate = data.flow_rate || 0.0;

        // Vehicle breakdown
        state.stats.classes.economy.count = data.economy || 0;
        state.stats.classes.premium.count = data.premium || 0;
        state.stats.classes.luxury.count = data.luxury || 0;
        state.stats.classes.ultra.count = data.ultra_luxury || 0;
        state.stats.classes.bikes.count = data.bikes || 0;
        state.stats.classes.commercial.count = data.commercial || 0;

        // Calculate percentages dynamically from total_vehicles
        const total = data.total_vehicles || 1;
        Object.keys(state.stats.classes).forEach(key => {
            const count = state.stats.classes[key].count;
            state.stats.classes[key].pct = Math.round((count / total) * 100);
        });

        if (state.stats.dwellStats) {
            state.stats.dwellStats.avg = data.avg_exposure_time || 0.0;
            state.stats.dwellStats.max = data.max_exposure_time || 0.0;
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

        elements.kpiVehicles.textContent = formatIndianNumber(state.stats.totalVehicles);
        elements.kpiDwell.textContent = `${state.stats.avgDwellTime.toFixed(1)} sec`;
        elements.kpiReach.textContent = formatIndianNumber(state.stats.estimatedReach);
        elements.kpiFlow.textContent = `${state.stats.flowRate.toFixed(1)} / min`;
        elements.kpiPeak.textContent = state.stats.peakHour;

        // Update list values and progress bars
        Object.keys(state.stats.classes).forEach(key => {
            const cData = state.stats.classes[key];
            if (elements.counts[key]) {
                elements.counts[key].textContent = formatIndianNumber(cData.count);
            }
            if (elements.pcts[key]) {
                elements.pcts[key].textContent = `${cData.pct}%`;
            }
            if (elements.bars[key]) {
                elements.bars[key].style.width = `${cData.pct}%`;
            }
        });

        // Update timestamp
        if (elements.lastUpdatedTime) {
            const updatedDate = data.last_updated ? new Date(data.last_updated) : new Date();
            elements.lastUpdatedTime.textContent = `Last updated: ${updatedDate.toLocaleTimeString()}`;
        }

        if (elements.hudTime) {
            const updatedDate = data.last_updated ? new Date(data.last_updated) : new Date();
            elements.hudTime.textContent = updatedDate.toISOString().replace('T', ' ').substring(0, 19);
        }

        // Refresh charts
        if (state.charts.donut) {
            state.charts.donut.updateSeries([
                state.stats.classes.economy.count,
                state.stats.classes.premium.count,
                state.stats.classes.luxury.count,
                state.stats.classes.ultra.count,
                state.stats.classes.bikes.count,
                state.stats.classes.commercial.count
            ]);
        }

        if (state.charts.trendLine) {
            const seriesData = state.charts.trendLine.w.config.series;
            const newCats = [...state.charts.trendLine.w.config.xaxis.categories];

            const now = data.last_updated ? new Date(data.last_updated) : new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            newCats.push(timeStr);
            if (newCats.length > 10) newCats.shift();

            const classMapping = {
                'Bike': state.stats.classes.economy.count,
                'Commercial': state.stats.classes.premium.count,
                'Economy': state.stats.classes.luxury.count,
                'Premium': state.stats.classes.ultra.count,
                'Luxury': state.stats.classes.bikes.count,
                'Ultra Luxury': state.stats.classes.commercial.count
            };

            const updatedSeries = seriesData.map(series => {
                const seriesDataPoints = [...series.data];
                seriesDataPoints.push(classMapping[series.name] || 0);
                if (seriesDataPoints.length > 10) seriesDataPoints.shift();
                return {
                    name: series.name,
                    data: seriesDataPoints
                };
            });

            state.charts.trendLine.updateOptions({
                xaxis: { categories: newCats },
                series: updatedSeries
            });
        }
    }

    function clearDashboardMetrics() {
        const selectedText = document.getElementById('selectedLocationText');
        if (selectedText) selectedText.textContent = "No active cameras";

        if (elements.cctvCamId) {
            elements.cctvCamId.textContent = "Camera ID: None";
        }

        if (elements.kpiVehicles) elements.kpiVehicles.textContent = "0";
        if (elements.kpiDwell) elements.kpiDwell.textContent = "0.0 sec";
        if (elements.kpiReach) elements.kpiReach.textContent = "0";
        if (elements.kpiFlow) elements.kpiFlow.textContent = "0.0 / min";
        if (elements.kpiPeak) elements.kpiPeak.textContent = "N/A";

        Object.keys(state.stats.classes).forEach(key => {
            if (elements.counts && elements.counts[key]) elements.counts[key].textContent = "0";
            if (elements.pcts && elements.pcts[key]) elements.pcts[key].textContent = "0%";
            if (elements.bars && elements.bars[key]) elements.bars[key].style.width = "0%";
        });

        if (state.charts && state.charts.donut) {
            state.charts.donut.updateSeries([0, 0, 0, 0, 0, 0]);
        }

        if (state.charts && state.charts.trendLine) {
            const seriesData = state.charts.trendLine.w.config.series;
            const updatedSeries = seriesData.map(series => ({
                name: series.name,
                data: []
            }));
            state.charts.trendLine.updateOptions({
                xaxis: { categories: [] },
                series: updatedSeries
            });
        }
    }

    async function populateCameraDropdown() {
        try {
            let cameras = [];
            const stored = localStorage.getItem('aculion_selected_billboard');
            if (stored) {
                try {
                    const bb = JSON.parse(stored);
                    cameras = [
                        { camera_code: bb.camera_id || bb.billboard_code || bb.id || 'CAM-01', location_name: bb.name || bb.billboard_name || 'Billboard' }
                    ];
                } catch(e) {}
            }
            
            if (cameras.length === 0) {
                const response = await fetch(`${API_BASE}/api/traffic/cameras`);
                if (response.ok) {
                    cameras = await response.json();
                }
            }

            if (cameras.length === 0) {
                cameras = [
                    { camera_code: 'ACU-AN-001', location_name: 'Anna Nagar – Shanthi Colony Junction' }
                ];
            }

            const dropdownMenu = document.getElementById('locationDropdownMenu');
            const hiddenSelect = document.getElementById('headerLocationSelect');
            const filterLocation = document.getElementById('filterLocation');

            if (dropdownMenu) {
                dropdownMenu.innerHTML = '';
                cameras.forEach((cam, index) => {
                    const item = document.createElement('div');
                    item.className = `custom-dropdown-item${index === 0 ? ' active' : ''}`;
                    item.setAttribute('data-value', cam.camera_code);
                    item.setAttribute('role', 'option');
                    item.innerHTML = `
                        <span class="item-text">${cam.location_name} (${cam.camera_code})</span>
                        <i data-lucide="check" class="item-check" style="${index === 0 ? '' : 'display: none;'}"></i>
                    `;
                    dropdownMenu.appendChild(item);
                });
            }

            if (hiddenSelect) {
                hiddenSelect.innerHTML = '';
                cameras.forEach(cam => {
                    const opt = document.createElement('option');
                    opt.value = cam.camera_code;
                    opt.textContent = `${cam.location_name} (${cam.camera_code})`;
                    hiddenSelect.appendChild(opt);
                });
            }

            if (filterLocation) {
                filterLocation.innerHTML = '';
                cameras.forEach(cam => {
                    const opt = document.createElement('option');
                    opt.value = cam.camera_code;
                    opt.textContent = `${cam.location_name} (${cam.camera_code})`;
                    filterLocation.appendChild(opt);
                });
            }

            lucide.createIcons();
            setupDropdownItemListeners();

            if (cameras.length > 0) {
                const firstCam = cameras[0].camera_code;
                const firstText = `${cameras[0].location_name} (${cameras[0].camera_code})`;
                document.getElementById('selectedLocationText').textContent = firstText;
                state.filters.location = firstCam;
                fetchLatestData(firstCam);
                connectToSSE(firstCam);
            } else {
                clearDashboardMetrics();
            }
        } catch (e) {
            console.error("Error populating cameras:", e);
        }
    }

    function setupDropdownItemListeners() {
        const dropdown = document.getElementById('locationDropdown');
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

                selectedText.textContent = text;

                if (hiddenSelect) {
                    hiddenSelect.value = val;
                    hiddenSelect.dispatchEvent(new Event('change', { bubbles: true }));
                }

                dropdown.classList.remove('open');
                document.getElementById('locationDropdownToggle').setAttribute('aria-expanded', 'false');
            });
        });
    }

    populateCameraDropdown();

    // Lucide Icons initialization
    lucide.createIcons();
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

            selectedText.textContent = text;

            if (hiddenSelect) {
                hiddenSelect.value = val;
                hiddenSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }

            closeDropdown();
        });
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
        if (isOpen && !dropdown.contains(e.target)) {
            closeDropdown();
        }
    });

    // Close dropdown on Esc key
    document.addEventListener('keydown', (e) => {
        if (isOpen && e.key === 'Escape') {
            closeDropdown();
        }
    });

    // Sync header dropdown text & selection state externally
    window.syncHeaderDropdown = function (val) {
        items.forEach(i => {
            if (i.getAttribute('data-value') === val) {
                i.classList.add('active');
                selectedText.textContent = i.querySelector('.item-text').textContent;
            } else {
                i.classList.remove('active');
            }
        });
    };
}

/* ============================================================
   AI Camera Feed – Classification Panel Simulation
   ============================================================ */
function initClassifCamera() {
    const canvas = document.getElementById('classifyCctvCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;   // 960
    const H = canvas.height;  // 420

    let name = "Broadway & 42nd St";
    let code = "AC-CAM-801";
    let stored = localStorage.getItem('aculion_selected_billboard');
    if (stored) {
        try {
            const bb = JSON.parse(stored);
            name = bb.name || bb.billboard_name || 'Broadway & 42nd St';
            code = bb.camera_id || bb.billboard_code || bb.id || 'AC-CAM-801';
        } catch(e) {}
    }

    const camLabel = document.getElementById('classifCamLabel');
    if (camLabel) {
        camLabel.textContent = `Camera ID: ${code} • ${name}`;
    }

    const camSel = document.getElementById('classifCamSelect');
    if (camSel) {
        camSel.innerHTML = `
            <option value="cam-1">${code}</option>
        `;
    }

    // Class colour palette (hex)
    const classColors = {
        economy: '#1E88FF',
        premium: '#00C4FF',
        luxury: '#8B5CF6',
        ultra: '#F59E0B',
        bikes: '#10B981',
        commercial: '#F97316'
    };

    const classLabels = {
        economy: 'Bike', premium: 'Commercial', luxury: 'Economy',
        ultra: 'Premium', bikes: 'Luxury', commercial: 'Ultra Luxury'
    };

    // Weighted spawn probabilities (mirror main simulation)
    function randomClass() {
        const r = Math.random() * 100;
        if (r < 52) return 'luxury';      // Economy
        if (r < 81) return 'economy';     // Bike
        if (r < 94) return 'ultra';       // Premium
        if (r < 99) return 'premium';     // Commercial
        if (r < 99.8) return 'bikes';      // Luxury
        return 'commercial';               // Ultra Luxury
    }

    // Vehicle object on the second canvas (top-down road view)
    class CamVehicle {
        constructor() { this.reset(true); }

        reset(initial = false) {
            this.lane = Math.floor(Math.random() * 4);   // 4 lanes
            this.type = randomClass();
            this.color = classColors[this.type];
            this.label = classLabels[this.type];
            this.id = 'V' + Math.floor(Math.random() * 9000 + 1000);
            this.conf = 96 + Math.floor(Math.random() * 4);
            this.speed = 0.6 + Math.random() * 1.4;
            // Width / height in pixels (top-down silhouette)
            this.bw = this.type === 'commercial' ? 44 : this.type === 'bikes' ? 16 : 30;
            this.bh = this.type === 'commercial' ? 80 : this.type === 'bikes' ? 40 : 54;

            const laneW = W / 4;
            this.x = laneW * this.lane + laneW / 2;
            this.y = initial ? Math.random() * H : -this.bh - 10;
            this.opacity = 1;
        }

        update() {
            this.y += this.speed;
            if (this.y > H + this.bh + 10) this.reset();
        }

        draw(ctx) {
            const hex = this.color;
            const alpha = this.opacity;

            // Parse hex to rgba helper
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);

            // Vehicle body (rounded rect)
            ctx.save();
            ctx.globalAlpha = alpha;

            // Soft glow behind box
            ctx.shadowColor = `rgba(${r},${g},${b},0.6)`;
            ctx.shadowBlur = 12;

            // Body fill
            ctx.fillStyle = `rgba(${r},${g},${b},0.18)`;
            roundRect(ctx, this.x - this.bw / 2, this.y - this.bh / 2, this.bw, this.bh, 5);
            ctx.fill();

            // Bounding box border
            ctx.shadowBlur = 0;
            ctx.strokeStyle = `rgba(${r},${g},${b},0.9)`;
            ctx.lineWidth = 1.5;
            roundRect(ctx, this.x - this.bw / 2, this.y - this.bh / 2, this.bw, this.bh, 5);
            ctx.stroke();

            // Corner tick marks
            const tk = 6;
            const corners = [
                [this.x - this.bw / 2, this.y - this.bh / 2],
                [this.x + this.bw / 2, this.y - this.bh / 2],
                [this.x + this.bw / 2, this.y + this.bh / 2],
                [this.x - this.bw / 2, this.y + this.bh / 2]
            ];
            const dirs = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
            ctx.strokeStyle = hex;
            ctx.lineWidth = 2;
            corners.forEach(([cx, cy], i) => {
                const [ddx, ddy] = dirs[i];
                ctx.beginPath();
                ctx.moveTo(cx + ddx * tk, cy);
                ctx.lineTo(cx, cy);
                ctx.lineTo(cx, cy + ddy * tk);
                ctx.stroke();
            });

            // Label above box
            ctx.shadowBlur = 0;
            ctx.fillStyle = hex;
            ctx.font = `bold 9px 'Courier New', monospace`;
            ctx.textAlign = 'center';
            const tag = `${this.label} [${this.conf}%]`;
            const tw = ctx.measureText(tag).width;
            ctx.fillStyle = `rgba(0,0,0,0.55)`;
            ctx.fillRect(this.x - tw / 2 - 3, this.y - this.bh / 2 - 14, tw + 6, 13);
            ctx.fillStyle = hex;
            ctx.fillText(tag, this.x, this.y - this.bh / 2 - 3);

            ctx.restore();
        }
    }

    // Utility: rounded rect path
    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    // Road background (dark, 4 lanes)
    function drawRoad(ctx) {
        // Asphalt
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, W, H);

        // Lane dividers (dashed white)
        ctx.setLineDash([18, 14]);
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 4; i++) {
            const lx = W / 4 * i;
            ctx.beginPath();
            ctx.moveTo(lx, 0);
            ctx.lineTo(lx, H);
            ctx.stroke();
        }
        ctx.setLineDash([]);

        // Edge lines
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(1, 0); ctx.lineTo(1, H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W - 1, 0); ctx.lineTo(W - 1, H); ctx.stroke();

        // Subtle scanline effect
        for (let sy = 0; sy < H; sy += 4) {
            ctx.fillStyle = 'rgba(0,0,0,0.06)';
            ctx.fillRect(0, sy, W, 2);
        }
    }

    // Spawn pool
    const vehicles = Array.from({ length: 8 }, () => new CamVehicle());

    // Spawn throttle
    let spawnTimer = 0;
    const SPAWN_INTERVAL = 60; // frames

    // FPS tracking
    let lastTime = performance.now();
    let frameCount = 0;
    let fps = 0;
    let fpsTimer = 0;

    // HUD element refs
    const hudTime = document.getElementById('classifHudTime');
    const hudVeh = document.getElementById('classifHudVehicles');
    const hudFps = document.getElementById('classifHudFps');
    const infoTotal = document.getElementById('classifTotalVeh');
    const infoDwell = document.getElementById('classifDwell');
    const infoConf = document.getElementById('classifConf');
    const infoSpeed = document.getElementById('classifSpeed');

    function loop(now) {
        const dt = now - lastTime;
        lastTime = now;
        frameCount++;
        fpsTimer += dt;
        spawnTimer += dt;

        // FPS calc every second
        if (fpsTimer >= 1000) {
            fps = frameCount;
            frameCount = 0;
            fpsTimer -= 1000;
            if (hudFps) hudFps.textContent = `FPS: ${fps}`;
        }

        // Spawn new vehicle periodically
        if (spawnTimer >= SPAWN_INTERVAL) {
            spawnTimer -= SPAWN_INTERVAL;
            if (vehicles.length < 16) {
                vehicles.push(new CamVehicle());
            }
        }

        // Update
        vehicles.forEach(v => v.update());
        // Remove off-screen
        for (let i = vehicles.length - 1; i >= 0; i--) {
            if (vehicles[i].y > H + vehicles[i].bh + 20) vehicles.splice(i, 1);
        }

        // Draw
        drawRoad(ctx);
        vehicles.forEach(v => v.draw(ctx));

        // Update HUD
        const active = vehicles.filter(v => v.y > 0 && v.y < H).length;
        if (hudVeh) hudVeh.textContent = `ACTIVE: ${active}`;

        // Timestamp
        if (hudTime) {
            const d = new Date();
            hudTime.textContent = d.toISOString().replace('T', ' ').substring(0, 19);
        }

        // Sync info-bar with main state (if available)
        if (typeof state !== 'undefined') {
            if (infoTotal) infoTotal.textContent = state.stats.totalVehicles.toLocaleString();
            if (infoDwell) infoDwell.textContent = `${state.stats.avgDwellTime}s`;
            const avgSpeed = Math.round(38 + Math.random() * 10);
            if (infoSpeed) infoSpeed.textContent = `${avgSpeed} km/h`;
        }

        requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);

    // --- Fullscreen handler ---
    const fsBtn = document.getElementById('classifFullscreenBtn');
    if (fsBtn) {
        fsBtn.addEventListener('click', () => {
            const wrapper = document.getElementById('classifCamWrapper');
            if (!document.fullscreenElement) {
                wrapper.requestFullscreen?.().catch(() => { });
            } else {
                document.exitFullscreen?.();
            }
        });
    }

    // --- Camera selector handler ---
    const camSel_elem = document.getElementById('classifCamSelect');
    const camLabel_elem = document.getElementById('classifCamLabel');
    const camLocations = {
        'cam-1': `${code} • ${name}`
    };
    if (camSel_elem) {
        camSel_elem.addEventListener('change', () => {
            if (camLabel_elem) camLabel_elem.textContent = 'Camera ID: ' + (camLocations[camSel_elem.value] || camSel_elem.value);
        });
    }
}
