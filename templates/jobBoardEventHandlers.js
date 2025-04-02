/***** Production Dashboard *****/


// After this script loads, set its callback in scriptMap if necessary.
if (typeof scriptMap !== 'undefined') {
    scriptMap['/job-board'].callback = initializeJobBoard;
}


function initializeJobBoard() {
    console.log("Initializing Job Board");
    // First, clear all managed listeners
    listenerManager.removeListeners();

   
    
    // Setup event handlers at initialization
    setupEventHandlers();

    // Prevent multiple initializations
    if (window.jobBboardInitialized) return;
    window.jobBoardInitialized = true;

    
}


// Setup or re-setup event handlers
function setupEventHandlers() {
    console.log("Setting up event handlers");   
    listenerManager.addListener(document.getElementById('fetch-defects'), 'click', handleFetchDefectList);    
}




