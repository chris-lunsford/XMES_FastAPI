/***** Production Dashboard *****/

// After this script loads, set its callback in scriptMap if necessary.
if (typeof scriptMap !== 'undefined') {
    scriptMap['/defect-dashboard'].callback = initializeDefectDashboard;
}

function initializeDefectDashboard() {
    if (window.defectDashboardInitialized) return;
    window.defectDashboardInitialized = true;

    // handleFetchDefectList();
    populateWorkAreas(); 
    populateDefectTypes();
    populateDefectActions();

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

