/***** Order Dashboard *****/


// After this script loads, set its callback in scriptMap if necessary.
if (typeof scriptMap !== 'undefined') {
    scriptMap['/order-dashboard'].callback = initializeOrderDashboard;
}



function initializeOrderDashboard() {
    console.log("Initializing Order Dashboard");
    // First, clear all managed listeners
    listenerManager.removeListeners();

    // Setup event handlers at initialization
    setupEventHandlers();

    // Prevent multiple initializations
    if (window.productionDashboardInitialized) return;
    window.productionDashboardInitialized = true;

    
}


// Setup or re-setup event handlers
function setupEventHandlers() {
    console.log("Setting up event handlers");
    listenerManager.addListener(document.getElementById('not-scanned-parts'), 'click', handleFetchPartsNotScanned);
    listenerManager.addListener(document.body, 'input', handleDynamicInputs);
}


// Handles dynamic inputs and changes specific to the production dashboard
function handleDynamicInputs(event) {
    // This ensures the correct handling of the orderID value
    const orderIDField = document.getElementById('order-id');
    const orderID = orderIDField ? orderIDField.value.trim() : null;

    
    // Handle OrderID input and Resource & Order input together for proper validation
    if (event.target.id === 'order-id') {
        if (orderID.length === 8) {
            fetchJobNotifications(orderID)
            fetchWorkStationGroups().then(groups => {
                const uniqueGroups = new Set(Object.values(groups));
                fetchOrderPartCounts(orderID, () => {
                    uniqueGroups.forEach(code => {
                        updateProgressBar(code);
                    });
                });
                fetchScannedOrderPartCounts(orderID, () => {
                    uniqueGroups.forEach(code => {
                        updateProgressBar(code);
                    });
                });
            });
        } else if (orderID.length === 0) {
            resetPartCounts();
        }
    }

}


// Function to reset all part counts to zero, remove 'has-parts' class, and clear missing parts table
function resetPartCounts() {
    console.log("Resetting part counts, border styles, progress bars, and missing parts table");

    // Fetch work station groups dynamically
    fetchWorkStationGroups().then(groups => {
        const uniqueGroups = new Set(Object.values(groups));

        uniqueGroups.forEach(code => {
            // Resetting progress bars specifically
            let progressBar = document.getElementById(`progress-bar-${code}`);
            let progressText = document.getElementById(`progress-text-${code}`);

            if (progressBar && progressText) {
                progressBar.value = 0;
                progressBar.classList.remove('complete');
                progressText.textContent = '0%';
            }

            // Resetting count texts and classes on containers
            const totalCountElement = document.getElementById(`part-count-Total`);
            let currentCountElement = document.getElementById(`current-count-${code}`);
            let partCountElement = document.getElementById(`part-count-${code}`);
            let machineContainer = currentCountElement ? currentCountElement.closest('.machine-container') : null;

            if (currentCountElement && partCountElement && machineContainer) {
                totalCountElement.textContent = '0';
                currentCountElement.textContent = '0';
                partCountElement.textContent = '0';
                machineContainer.classList.remove('has-parts');
                machineContainer.classList.remove('hidden');  // Assuming you want to hide the container when parts count is reset
            }
        });

        // Clear the missing parts table
        const tableBody = document.getElementById('table-body');
        if (tableBody) {
            tableBody.innerHTML = '';
        }

        // Clear Notifications
        const notificationListElement = document.getElementById('notification-list');
        console.log("Clearing notifications");
        if (notificationListElement) {
            notificationListElement.innerHTML = ''; // Clear existing notifications
    }

    }).catch(error => {
        console.error("Failed to fetch work station groups:", error);
    });
}




// Function to update progress bar
function updateProgressBar(machineGroupCode) {
    console.log("Updating progress bar");
    var currentCountElement = document.getElementById(`current-count-${machineGroupCode}`);
    var partCountElement = document.getElementById(`part-count-${machineGroupCode}`);
    var progressBar = document.getElementById(`progress-bar-${machineGroupCode}`);
    var progressText = document.getElementById(`progress-text-${machineGroupCode}`);

    // Check if elements exist and are visible in the document flow
    if (!currentCountElement || !partCountElement || !progressBar || !progressText) {
        console.error(`Elements not found for ${machineGroupCode}, or are currently hidden.`);
        return; // Skip this group as it is not visible
    }

    var currentCount = parseInt(currentCountElement.textContent, 10);
    var partCount = parseInt(partCountElement.textContent, 10);

    if (partCount > 0) {
        var percentComplete = (currentCount / partCount) * 100;
        progressBar.value = percentComplete;
        progressText.textContent = `${Math.round(percentComplete)}%`;

        if (Math.round(percentComplete) === 100) {
            progressBar.classList.add('complete');
        } else {
            progressBar.classList.remove('complete');
        }
    } else {
        progressBar.value = 0;
        progressText.textContent = "0%";
        progressBar.classList.remove('complete');
    }
}



function fetchDataAndUpdateUI(orderID) {
    fetchWorkStationGroups().then(groups => {
        const uniqueGroups = new Set(Object.values(groups));
        fetchOrderPartCounts(orderID, () => {
            uniqueGroups.forEach(code => {
                updateProgressBar(code);
            });
        });
        fetchScannedOrderPartCounts(orderID, () => {
            uniqueGroups.forEach(code => {
                updateProgressBar(code);
            });
        });
    });
}


// Event handler for fetching parts not scanned by shipping
function handleFetchPartsNotScanned() {
    const orderID = document.getElementById('order-id').value.trim();
    if (orderID) {
        fetchPartsNotScanned(orderID);  // This function will be defined in global.js
    }
}



