/***** Production Dashboard *****/


function initializeDefectDashboard() {
    if (window.defectDashboardInitialized) return;
    window.defectDashboardInitialized = true;

    console.log("Initializing Defect Dashboard");
    setupEventHandlers();
}

function teardownDefectDashboard() {
    console.log("Tearing down Defect Dashboard");
    listenerManager.removeListeners();
    window.defectDashboardInitialized = false;
}

if (typeof scriptMap !== 'undefined') {
    scriptMap['/defect-dashboard'].callback = initializeDefectDashboard;
    scriptMap['/defect-dashboard'].teardown = teardownDefectDashboard;
}


// Setup or re-setup event handlers
function setupEventHandlers() {
    console.log("Setting up event handlers");   
    listenerManager.addListener(document.getElementById('fetch-defects'), 'click', handleFetchDefectList);    
}




// Event handler for fetching parts not scanned by shipping
function handleFetchDefectList() {
    fetchDefectList();
}

