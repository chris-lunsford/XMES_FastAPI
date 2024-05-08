const scriptMap = {
    '/link2': {
        path: 'templates/machineDashboardEventHandlers.js',
        callback: null  // Set to null initially
    },
    '/production': {
        path: 'templates/productionDashboardEventHandlers.js',
        callback: null  // Set to null initially
    }
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
            Object.keys(scriptMap).forEach(key => {
                if (url.includes(key)) {
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

// Correctly add event listener for the custom event
// document.getElementById('content').addEventListener('contentLoaded', function(e) {
//     if (e.detail.loadedUrl.includes('/link2')) {
//         if (typeof initializeMachineDashboard === 'function') {
//             initializeMachineDashboard();  // Call only if available
//         }
//     } else if (e.detail.loadedUrl.includes('/production')) {
//         if (typeof initializeProductionDashboard === 'function') {
//             initializeProductionDashboard();  // Call only if available
//         }
//     }
// });


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
        loadContent('/home', highlight);
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
