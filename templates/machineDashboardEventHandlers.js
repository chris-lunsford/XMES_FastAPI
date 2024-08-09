/***** Machine Dashboard *****/


// After this script loads, set its callback in scriptMap if necessary.
if (typeof scriptMap !== 'undefined') {
    scriptMap['/machine-dashboard'].callback = initializeMachineDashboard;
}


// Define named functions for event handlers
function handleInputChange(event) {

    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    if (event.target.matches('input[name="date-range"]')) {
        updateDateInputs(event.target.value);
        if (event.target.value !== 'custom') {
            event.preventDefault(); // Prevent default form submission
            handleFormSubmit(document.getElementById('dateForm'));
            updateRunTimes(startDate, endDate);
        }
    } else if (event.target.matches('#start-date, #end-date')) {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        if (startDate && endDate) {
            event.preventDefault(); // Prevent default form submission
            handleFormSubmit(document.getElementById('dateForm'));
            updateRunTimes(startDate, endDate);
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
        // setInterval(updateRunTimes, 60000); 
    }
}


// Function to fetch and update run times for all machines
// function updateRunTimes() {
//     fetch('/api/fetch-uptime-downtime')
//         .then(response => response.json())
//         .then(data => {
//             // Iterate over each machine in the returned data
//             Object.keys(data).forEach(machineId => {
//                 // Update the DOM elements with the received data
//                 const upTimeElement = document.getElementById(`up-time-${machineId}`);
//                 const downTimeElement = document.getElementById(`down-time-${machineId}`);
                
//                 // Set the text content with the up and down times
//                 if (upTimeElement && downTimeElement) {
//                     upTimeElement.textContent = data[machineId].upTime !== 'N/A' ? data[machineId].upTime : 'N/A';
//                     downTimeElement.textContent = data[machineId].downTime !== 'N/A' ? data[machineId].downTime : 'N/A';
//                 }
//             });
//         })
//         .catch(error => console.error('Error fetching uptime/downtime data:', error));
// }


function updateRunTimes(startDate, endDate) {
    resetRunTimes(); // Reset run times before fetching new data

    const resourceQuery = new URLSearchParams();
    if (startDate) resourceQuery.append('start_date', startDate);
    if (endDate) resourceQuery.append('end_date', endDate);

    // Append a unique timestamp to the query parameters to prevent caching
    resourceQuery.append('_ts', new Date().getTime());

    fetch(`/api/fetch-uptime-downtime?${resourceQuery.toString()}`, {
        headers: {
            'Cache-Control': 'no-cache' // This instructs the browser not to cache the response
        }
    })
        .then(response => response.json())
        .then(data => {
            Object.keys(data).forEach(machineId => {
                const upTimeElement = document.getElementById(`up-time-${machineId}`);
                const downTimeElement = document.getElementById(`down-time-${machineId}`);

                if (upTimeElement && downTimeElement) {
                    upTimeElement.textContent = data[machineId].upTime !== 'N/A' ? data[machineId].upTime : 'N/A';
                    downTimeElement.textContent = data[machineId].downTime !== 'N/A' ? data[machineId].downTime : 'N/A';
                }
            });
        })
        .catch(error => console.error('Error fetching uptime/downtime data:', error));
}

function resetRunTimes() {
    // Example of resetting UI elements for each machine ID
    document.querySelectorAll('[id^="up-time-"], [id^="down-time-"]').forEach(element => {
        element.textContent = 'Loading...'; // Or set to '0' depending on your preference
    });
    console.log("Run times have been reset.");
}


// Update the autoSubmitForm and other relevant calls to pass startDate and endDate
function autoSubmitForm() {
    const form = document.getElementById('dateForm');
    if (form) {
        const formData = new FormData(form); 
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;

        handleFormSubmit(formData); 
        updateRunTimes(startDate, endDate);  // Update run times with date filters
    }
}
