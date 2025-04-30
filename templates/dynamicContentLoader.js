const scriptMap = {
    '/machine-dashboard': {
        path: 'templates/machineDashboardEventHandlers.js',
        callback: null  // Set to null initially
    },
    '/production': {
        path: 'templates/productionDashboardEventHandlers.js',
        callback: null  // Set to null initially
    },
    '/machine-production': {
        path: 'templates/machineProductionDashboardEventHandlers.js',
        callback: null  // Set to null initially
    },
    '/assembly-production': {
        path: 'templates/assemblyProductionDashboardEventHandlers.js',
        callback: null  // Set to null initially
    },
    '/notification': {
        path: 'templates/notificationDashboardEventHandlers.js',
        callback: null  // Set to null initially
    },
    '/order-dashboard': {
        path: 'templates/orderDashboardEventHandlers.js',
        callback: null  // Set to null initially
    },
    '/assembly-order-dashboard': {
        path: 'templates/assemblyOrderDashboardEventHandlers.js',
        callback: null  // Set to null initially
    },
    '/defect-dashboard': {
        path: 'templates/defectDashboardEventHandlers.js',
        callback: null  // Set to null initially
    },
    '/job-board': {
        path: 'templates/jobBoardEventHandlers.js',
        callback: null,  // Set to null initially
        cleanup: () => {
            if (window.jobBoardIntervalId) {
                clearInterval(window.jobBoardIntervalId);
                window.jobBoardIntervalId = null;
                console.log('Cleared job board interval');
            }
        }
    },
};


let lastLoadedScript = null;

function cleanupScriptForPreviousPage() {
    if (lastLoadedScript && scriptMap[lastLoadedScript]?.cleanup) {
        scriptMap[lastLoadedScript].cleanup();
    }
}


document.addEventListener("DOMContentLoaded", () => {
    // First check app version
    checkAppVersion();

    // Then set up sidebar behavior
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.addEventListener('click', function(event) {
            const link = event.target.closest('a');
            if (link) {
                event.preventDefault();
                const href = link.getAttribute('href').replace('javascript:loadContent(\'', '').replace('\')', '');
                loadContent(href);
                localStorage.setItem('lastLoadedContent', href);
                sessionStorage.setItem('lastSessionTime', Date.now().toString());
            }
        });
    }

    // Finally load last content if any
    loadLastContent(false);
});



// Function to load and initialize scripts
function loadContent(url, highlight = true) {
    cleanupScriptForPreviousPage();

    fetch(url)
        .then(response => response.text())
        .then(html => {
            const contentDiv = document.getElementById('content');
            contentDiv.innerHTML = html;

            // ✅ Parse and apply script version info
            const versionTag = contentDiv.querySelector('#dynamic-version-block');
            if (versionTag) {
                try {
                    const parsed = JSON.parse(versionTag.textContent);
                    window.scriptVersions = {
                        ...(window.scriptVersions || {}),
                        ...parsed
                    };
                    console.log("Loaded script versions:", window.scriptVersions);
                } catch (e) {
                    console.warn("Failed to parse scriptVersions block", e);
                }
            }

            // Dispatch a custom event after loading content
            const contentLoadedEvent = new CustomEvent('contentLoaded', { detail: { loadedUrl: url } });
            contentDiv.dispatchEvent(contentLoadedEvent);

            if (highlight) {
                const sidebarLinks = document.querySelectorAll('.sidebar a');
                sidebarLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href').includes(url.replace('/', ''))) {
                        link.classList.add('active');
                    }
                });
            }

            console.log("Attempting to load content for URL:", url);
            Object.keys(scriptMap).forEach(key => {
                if (url.includes(key)) {
                    lastLoadedScript = key; // 💾 Track current script
                    console.log(`Loading script from: ${scriptMap[key].path}`);
                    loadScript(scriptMap[key].path, () => {
                        if (scriptMap[key].callback) {
                            scriptMap[key].callback();
                        }
                    });
                }
            });

            contentDiv.style.display = 'block';
        })
        .catch(error => {
            console.error('Error loading content:', error);
        });
}



function loadScript(url, callback) {
    const fileName = url.split('/').pop();
    const version = window.scriptVersions?.[fileName];
    const versionedUrl = version ? `${url}?v=${version}` : url;

    console.log("Preparing to load:", { fileName, version, versionedUrl });

    const script = document.createElement('script');
    script.src = versionedUrl;
    script.onload = () => {
        console.log("Script loaded successfully:", versionedUrl);
        callback();
    };
    script.onerror = () => {
        console.error("Error loading script:", versionedUrl);
    };
    script.async = true;
    document.head.appendChild(script);
}


function handleSidebarLinkClick(event) {
    event.preventDefault();
    const href = event.currentTarget.getAttribute('href').replace('javascript:loadContent(\'', '').replace('\')', '');
    loadContent(href);
    localStorage.setItem('lastLoadedContent', href);
    sessionStorage.setItem('lastSessionTime', Date.now().toString());
}


function loadLastContent(highlight) {
    const lastContent = localStorage.getItem('lastLoadedContent');
    if (lastContent) {
        loadContent(lastContent, highlight);
    } else {
        loadContent('/production', highlight);
    }
}


function checkSession() {
    const currentTime = Date.now();
    const lastSessionTime = parseInt(sessionStorage.getItem('lastSessionTime') || 0);

    if (!lastSessionTime || currentTime - lastSessionTime > 1800000) {
        sessionStorage.clear();
        sessionStorage.setItem('sessionActive', 'true');
        loadContent('/home', false);
    } else {
        loadLastContent(true);
    }
    sessionStorage.setItem('lastSessionTime', currentTime.toString());
}


function checkAppVersion() {
    const storedVersion = sessionStorage.getItem('appVersion');
    const currentVersion = window.appVersion;

    console.log("Checking app version:", { storedVersion, currentVersion });

    if (storedVersion && storedVersion !== currentVersion) {
        alert("🔄 A new version of the app is available. Please reload the page to get the latest updates.");
    }

    sessionStorage.setItem('appVersion', currentVersion);
}

function startAppVersionChecker(intervalMinutes = 5) {
    // Check immediately when page loads
    checkAppVersion();

    // Then keep checking every interval
    setInterval(() => {
        fetch(window.location.href, { cache: "no-store" })
            .then(response => response.text())
            .then(html => {
                // Extract new appVersion from the page
                const match = html.match(/window\.appVersion\s*=\s*["'](\d+)["']/);
                if (match && match[1]) {
                    const latestVersion = match[1];
                    const currentStoredVersion = sessionStorage.getItem('appVersion');

                    console.log("Background app version check:", { latestVersion, currentStoredVersion });

                    if (latestVersion !== currentStoredVersion) {
                        alert("🔄 A new version of the app is available. Please reload the page to get the latest updates.");
                        sessionStorage.setItem('appVersion', latestVersion);
                    }
                }
            })
            .catch(err => {
                console.error("Error checking app version in background:", err);
            });
    }, intervalMinutes * 60 * 1000); // Convert minutes to milliseconds
}

// Start background checker
document.addEventListener("DOMContentLoaded", () => {
    startAppVersionChecker(5);  // Check every 5 minutes (you can change this!)
});