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
    updateRunTimes();

    
    // Now add new listeners as needed
    listenerManager.addListener(document.body, 'change', handleInputChange);
    listenerManager.addListener(document.body, 'submit', handleSubmit);

    if (window.machineDashboardInitialized) return;
    window.machineDashboardInitialized = true;

    // Set interval if it has not been set before
    if (!window.autoSubmitIntervalSet) {
        window.autoSubmitIntervalSet = true;
        setInterval(autoSubmitForm, 60000); // Auto submit form every minute
        setInterval(updateRunTimes, 60000); // Update run times every minute
    }
}


// Function to fetch and update run times for all machines
function updateRunTimes() {
    fetch('/api/fetch-uptime-downtime')
        .then(response => response.json())
        .then(data => {
            // Iterate over each machine in the returned data
            Object.keys(data).forEach(machineId => {
                // Update the DOM elements with the received data
                const upTimeElement = document.getElementById(`up-time-${machineId}`);
                const downTimeElement = document.getElementById(`down-time-${machineId}`);
                
                // Set the text content with the up and down times
                if (upTimeElement && downTimeElement) {
                    upTimeElement.textContent = data[machineId].upTime !== 'N/A' ? data[machineId].upTime : 'N/A';
                    downTimeElement.textContent = data[machineId].downTime !== 'N/A' ? data[machineId].downTime : 'N/A';
                }
            });
        })
        .catch(error => console.error('Error fetching uptime/downtime data:', error));
}



