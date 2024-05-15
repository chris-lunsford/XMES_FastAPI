/***** Machine Dashboard *****/


// After this script loads, set its callback in scriptMap if necessary.
if (typeof scriptMap !== 'undefined') {
    scriptMap['/machine-dashboard'].callback = initializeMachineDashboard;
}


// Define named functions for event handlers
function handleInputChange(event) {
    if (event.target.matches('input[name="date-range"]')) {
        updateDateInputs(event.target.value);
        if (event.target.value !== 'custom') {
            event.preventDefault(); // Prevent default form submission
            handleFormSubmit(document.getElementById('dateForm'));
        }
    } else if (event.target.matches('#start-date, #end-date')) {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        if (startDate && endDate) {
            event.preventDefault(); // Prevent default form submission
            handleFormSubmit(document.getElementById('dateForm'));
        }
    }
}

function handleSubmit(event) {
    if (event.target.id === 'dateForm') {
        event.preventDefault();
        handleFormSubmit(event.target);
    }
}

// Initialize machine dashboard with checks to prevent multiple initializations
function initializeMachineDashboard() {
    // First, clear all managed listeners
    listenerManager.removeListeners();
    initializeDateInputs();
    autoSubmitForm();

    
    // Now add new listeners as needed
    listenerManager.addListener(document.body, 'change', handleInputChange);
    listenerManager.addListener(document.body, 'submit', handleSubmit);

    if (window.machineDashboardInitialized) return;
    window.machineDashboardInitialized = true;

    // Set interval if it has not been set before
    if (!window.autoSubmitIntervalSet) {
        window.autoSubmitIntervalSet = true;
        setInterval(autoSubmitForm, 60000); // Auto submit form every minute
    }
}






