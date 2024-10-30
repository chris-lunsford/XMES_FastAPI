/***** Production Dashboard *****/


// After this script loads, set its callback in scriptMap if necessary.
if (typeof scriptMap !== 'undefined') {
    scriptMap['/defect-dashboard'].callback = initializeDefectDashboard;
}


function initializeDefectDashboard() {
    console.log("Initializing Defect Dashboard");
    // First, clear all managed listeners
    listenerManager.removeListeners();

    // handleFetchDefectList();
    populateWorkAreas(); 
    populateDefectTypes();
    populateDefectActions();
    
    // Setup event handlers at initialization
    setupEventHandlers();

    // Prevent multiple initializations
    if (window.defectDashboardInitialized) return;
    window.defectDashboardInitialized = true;

    
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

