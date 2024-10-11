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

     // Add click event listener to all elements with class 'machine-container'
     var machineContainers = document.getElementsByClassName('machine-container');
     for (var i = 0; i < machineContainers.length; i++) {
         listenerManager.addListener(machineContainers[i], 'click', handleMachineSummary);
     }
 
     // Close the modal with the close button
     var closeButtons = document.getElementsByClassName('close');
     for (var i = 0; i < closeButtons.length; i++) {
         listenerManager.addListener(closeButtons[i], 'click', function() {
             var modal = document.getElementById('machineModal');
             modal.style.display = 'none';
         });
     }
 
     // Close the modal by clicking outside of it
     listenerManager.addListener(window, 'click', function(event) {
         var modal = document.getElementById('machineModal');
         if (event.target === modal) {
             modal.style.display = 'none';
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



function handleMachineSummary(event) {
    // Display the modal
    var modal = document.getElementById('machineModal');
    modal.style.display = 'block';

    // Optionally, update modal content based on the clicked machine container
    var machineContainer = event.currentTarget;

    // Retrieve machine-specific data
    var machineName = machineContainer.querySelector('.machine-name p:first-child').innerText;
    var machineCode = machineContainer.querySelector('.machine-name p:last-child').innerText;

    // Clean up machineCode by removing square brackets (e.g., '[EB4]' becomes 'EB4')
    var cleanedMachineCode = machineCode.replace(/\[|\]/g, '');

    var partCount = machineContainer.querySelector('.part-count p:last-child').innerText;
    var upTime = machineContainer.querySelector('.times p:first-child').innerText;
    var downTime = machineContainer.querySelector('.times p:last-child').innerText;


    // Update modal content
    document.getElementById('modal-machine-name').innerHTML = machineName + '&nbsp;&nbsp;' + machineCode;
    document.getElementById('modal-part-count').innerText = partCount;
    document.getElementById('modal-up-time').innerText = upTime;
    document.getElementById('modal-down-time').innerText = downTime;


    // Fetch the last scan data from the API
    fetch(`/api/fetch-last-scan?resource=${cleanedMachineCode}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch last scan data');
            }
            return response.json();
        })
        .then(data => {
            // Assuming data contains the Barcode, OrderID, and Timestamp
            if (data) {
                // Format the timestamp if needed
                const formattedTimestamp = new Date(data.Timestamp).toLocaleString();

                // Update the Last Scan section with the fetched data
                document.querySelector('.scan-info div p').innerHTML = `Last Scan:&nbsp&nbsp Barcode: ${data.Barcode}&nbsp&nbsp EmployeeID: ${data.EmployeeID}&nbsp&nbsp Time: ${formattedTimestamp}`;
            } else {
                // Handle case where there is no scan data
                document.querySelector('.scan-info div p').innerHTML = 'Last Scan: No data available.';
            }
        })
        .catch(error => {
            console.error('Error fetching last scan:', error);
            document.querySelector('.scan-info div p').innerHTML = 'Last Scan: Error loading data.';
        });

    
    // Get the selected date range from the form
    const dateRange = document.querySelector('input[name="date-range"]:checked').value;
    let startDate, endDate;

    if (dateRange === 'today') {
        startDate = document.getElementById('today-start-date').value;
        endDate = document.getElementById('today-end-date').value;
    } else if (dateRange === 'week') {
        // Calculate week range (e.g., Monday to Sunday) or pass dynamic start/end dates
        startDate = calculateStartOfWeek();
        endDate = calculateEndOfWeek();
    } else if (dateRange === 'month') {
        startDate = calculateStartOfMonth();
        endDate = calculateEndOfMonth();
    } else if (dateRange === 'custom') {
        startDate = document.getElementById('start-date').value;
        endDate = document.getElementById('end-date').value;
    }

    // Fetch the job list data from the API based on the date range
    fetch(`/api/fetch-joblist-daterange?resource=${cleanedMachineCode}&start_date=${startDate}&end_date=${endDate}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch job list data');
            }
            return response.json();
        })
        .then(data => {
            // Assuming data is an array of arrays, where each inner array contains a single ORDERID
            const jobListContainer = document.querySelector('.job-list');
            jobListContainer.innerHTML = ''; // Clear any existing job entries

            if (data && data.length > 0) {
                data.forEach(job => {
                    // job[0] contains the ORDERID string
                    const orderId = job[0]; // Access the first element of each array
                    const jobItem = document.createElement('li'); // Create an <li> element
                    jobItem.textContent = orderId; // Insert the ORDERID into the <li>
                    jobListContainer.appendChild(jobItem); // Append the <li> to the job list container
                });
            } else {
                jobListContainer.innerHTML = '<li>No jobs found in the selected date range.</li>';
            }
        })
        .catch(error => {
            console.error('Error fetching job list:', error);
            document.querySelector('.job-list').innerHTML = '<li>Error loading job list.</li>';
        });  
}


function calculateStartOfWeek() {
    const today = new Date();
    const firstDayOfWeek = today.getDate() - today.getDay() + 1; // Adjust for Monday
    return new Date(today.setDate(firstDayOfWeek)).toISOString().split('T')[0]; // Return formatted date
}

function calculateEndOfWeek() {
    const today = new Date();
    const lastDayOfWeek = today.getDate() - today.getDay() + 7; // Adjust for Sunday
    return new Date(today.setDate(lastDayOfWeek)).toISOString().split('T')[0]; // Return formatted date
}

function calculateStartOfMonth() {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]; // First day of the month
}

function calculateEndOfMonth() {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]; // Last day of the month
}