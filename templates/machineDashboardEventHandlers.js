/***** Machine Dashboard *****/


// After this script loads, set its callback in scriptMap if necessary.
if (typeof scriptMap !== 'undefined') {
    scriptMap['/machine-dashboard'].callback = initializeMachineDashboard;
}

// Check if debouncedHandleInputChange has been defined
if (typeof debouncedHandleInputChange === 'undefined') {
    var debouncedHandleInputChange = debounce(handleInputChange, 300); // Using var to ensure it's hoisted
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// const debouncedHandleInputChange = debounce(handleInputChange, 300);


// Define named functions for event handlers
async function handleInputChange(event) {
    if (event.target.matches('input[name="date-range"]')) {
        updateDateInputs(event.target.value);

        if (event.target.value !== 'custom') {
            event.preventDefault(); // Prevent default form submission
            handleFormSubmit(document.getElementById('dateForm'));

            // Defer the updateRunTimes call to ensure date inputs are updated
            setTimeout(async () => {
                const startDate = document.getElementById('start-date').value;
                const endDate = document.getElementById('end-date').value;
                console.log('Submitting dates:', { startDate, endDate });
                await updateUpTimes(startDate, endDate); 
                await updateDownTimes(startDate, endDate);
            }, 0);
        }
    } else if (event.target.matches('#start-date, #end-date')) {
        event.preventDefault(); // Prevent default form submission
        handleFormSubmit(document.getElementById('dateForm'));

        // Defer the updateRunTimes call to ensure date inputs are updated
        setTimeout(async () => {
            const startDate = document.getElementById('start-date').value;
            const endDate = document.getElementById('end-date').value;
            console.log('Submitting dates:', { startDate, endDate });
            await updateUpTimes(startDate, endDate); 
            await updateDownTimes(startDate, endDate);
        }, 0);
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
    // Update display based on current batch selection
    updateBatchDisplay();
    
    
    // Now add new listeners as needed
    listenerManager.addListener(document.body, 'change', debouncedHandleInputChange);
    listenerManager.addListener(document.body, 'submit', handleSubmit);
    listenerManager.addListener(document.body, 'change', function(event) {
        debouncedHandleInputChange(event);
        if (event.target.name === 'batch-select') {
            updateBatchDisplay();
        }
    });

    if (window.machineDashboardInitialized) return;
    window.machineDashboardInitialized = true;

    // Set interval if it has not been set before
    if (!window.autoSubmitIntervalSet) {
        window.autoSubmitIntervalSet = true;
        setInterval(autoSubmitForm, 60000); // Auto submit form every minute
    }
}



// Update the autoSubmitForm and other relevant calls to pass startDate and endDate
function autoSubmitForm() {
    const form = document.getElementById('dateForm');
    if (form) {
        const formData = new FormData(form); 
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;

        handleFormSubmit(formData); 
        updateUpTimes(startDate, endDate); 
        updateDownTimes(startDate, endDate);  
    }
}




async function updateUpTimes(startDate, endDate) {
    resetUpTimes();
    console.log('Fetching data for:', { startDate, endDate }); 
    const resourceQuery = new URLSearchParams();
    if (startDate) resourceQuery.append('start_date', startDate);
    if (endDate) resourceQuery.append('end_date', endDate);

    try {
        const response = await fetch(`/api/fetch-uptime-all?${resourceQuery.toString()}`);
        const data = await response.json();
        console.log('Received data:', data);
        updateUIUpTimes(data); // Update the UI only after data is fetched
    } catch (error) {
        console.error('Error fetching uptime data:', error);
    }
}


function updateUIUpTimes(data) {
    document.querySelectorAll('[id^="up-time-"]').forEach(element => {
        const machineId = element.id.replace('up-time-', '');
        const upTime = Number(data[machineId] || 0);
        console.log(`Updating ${machineId}:`, upTime);
        element.textContent = (upTime / 60).toFixed(2) + ' hrs';
    });
}


function resetUpTimes() {
    // Example of resetting UI elements for each machine ID
    document.querySelectorAll('[id^="up-time-"]').forEach(element => {
        element.textContent = 'Loading...'; // Or set to '0' depending on your preference
    });
    console.log("Run times have been reset.");
}


async function updateDownTimes(startDate, endDate) {
    resetDownTimes();
    console.log('Fetching data for:', { startDate, endDate }); 
    const resourceQuery = new URLSearchParams();
    if (startDate) resourceQuery.append('start_date', startDate);
    if (endDate) resourceQuery.append('end_date', endDate);

    try {
        const response = await fetch(`/api/fetch-downtime-all?${resourceQuery.toString()}`);
        const data = await response.json();
        console.log('Received data:', data);
        updateUIDownTimes(data); // Update the UI only after data is fetched
    } catch (error) {
        console.error('Error fetching downtime data:', error);
    }
}


function updateUIDownTimes(data) {
    document.querySelectorAll('[id^="down-time-"]').forEach(element => {
        const machineId = element.id.replace('down-time-', '');
        const downTime = Number(data[machineId] || 0);
        console.log(`Updating ${machineId}:`, downTime);
        element.textContent = (downTime / 60).toFixed(2) + ' hrs';
    });
}


function resetDownTimes() {
    // Example of resetting UI elements for each machine ID
    document.querySelectorAll('[id^="down-time-"]').forEach(element => {
        element.textContent = 'Loading...'; // Or set to '0' depending on your preference
    });
    console.log("Run times have been reset.");
}



function updateBatchDisplay() {
    const smallBatchSection = document.getElementById('small-batch-section');
    const largeBatchSection = document.getElementById('large-batch-section');
    const selectedBatch = document.querySelector('input[name="batch-select"]:checked').value;

    switch (selectedBatch) {
        case 'both':
            smallBatchSection.style.display = '';  // or 'block' if you want to specifically set it
            largeBatchSection.style.display = '';
            break;
        case 'large-batch':
            smallBatchSection.style.display = 'none';
            largeBatchSection.style.display = '';
            break;
        case 'small-batch':
            smallBatchSection.style.display = '';
            largeBatchSection.style.display = 'none';
            break;
    }
}