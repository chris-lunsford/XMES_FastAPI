const scriptMap = {
    '/machine-dashboard': {
        path: 'templates/machineDashboardEventHandlers.js',
        callback: null,  // Set to null initially
        teardown: null
    },
    '/production': {
        path: 'templates/productionDashboardEventHandlers.js',
        callback: null,  // Set to null initially
        teardown: null
    },
    '/machine-production': {
        path: 'templates/machineProductionDashboardEventHandlers.js',
        callback: null,  // Set to null initially
        teardown: null
    },
    '/assembly-production': {
        path: 'templates/assemblyProductionDashboardEventHandlers.js',
        callback: null,  // Set to null initially
        teardown: null
    },
    '/notification': {
        path: 'templates/notificationDashboardEventHandlers.js',
        callback: null,  // Set to null initially
        teardown: null
    },
    '/order-dashboard': {
        path: 'templates/orderDashboardEventHandlers.js',
        callback: null,  // Set to null initially
        teardown: null
    },
    '/assembly-order-dashboard': {
        path: 'templates/assemblyOrderDashboardEventHandlers.js',
        callback: null,  // Set to null initially    
        teardown: null
    },
    '/defect-dashboard': {
        path: 'templates/defectDashboardEventHandlers.js',
        callback: null,  // Set to null initially
        teardown: null
    },
};


document.addEventListener("DOMContentLoaded", function() {
    const sidebar = document.querySelector('.sidebar');
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

    loadLastContent(false);
});



// Function to load and initialize scripts
function loadContent(url, highlight = true) {
    fetch(url)
        .then(response => response.text())
        .then(html => {
            const contentDiv = document.getElementById('content');
            contentDiv.innerHTML = html;

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
            // Track the currently active dashboard
        if (!window.currentDashboardRoute) window.currentDashboardRoute = null;

        const matchedRoute = Object.keys(scriptMap).find(key => url.includes(key));

        if (matchedRoute) {
            // Teardown previous dashboard if needed
            if (window.currentDashboardRoute && scriptMap[window.currentDashboardRoute]?.teardown) {
                console.log(`Tearing down previous dashboard: ${window.currentDashboardRoute}`);
                scriptMap[window.currentDashboardRoute].teardown();
            }

            window.currentDashboardRoute = matchedRoute;
            console.log(`Loading script from: ${scriptMap[matchedRoute].path}`);

            const runDashboardInit = () => {
                if (scriptMap[matchedRoute].callback) {
                    scriptMap[matchedRoute].callback();
                }
            };
            
            if (!scriptMap[matchedRoute].callback) {
                loadScript(scriptMap[matchedRoute].path, () => {
                    // Wait for content to be fully swapped before running init
                    contentDiv.addEventListener("contentLoaded", (e) => {
                        if (e.detail.loadedUrl === url) {
                            runDashboardInit();
                        }
                    }, { once: true });
                });
            } else {
                // If already loaded, still wait for content swap
                contentDiv.addEventListener("contentLoaded", (e) => {
                    if (e.detail.loadedUrl === url) {
                        runDashboardInit();
                    }
                }, { once: true });
            }
            
        }

            contentDiv.style.display = 'block';
        })
        .catch(error => {
            console.error('Error loading content:', error);
        });
}



function loadScript(url, callback) {
    console.log("Attempting to append script to head:", url);
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => {
        console.log("Script loaded successfully:", url);
        callback();        
    };
    script.onerror = () => {
        console.error("Error loading script:", url);
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
