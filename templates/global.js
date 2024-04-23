async function updateMachineBorders() {
    try {
        console.log('Making API call to update machine borders');
        const response = await fetch('/api/machine-status');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // This strips time part, keeping only the date

        for (const [resource, lastScan] of Object.entries(data)) {
            const machineElement = document.getElementById(`machine-${resource}`);
            if (machineElement) {
                const lastScanDate = new Date(lastScan);
                const lastScanDay = new Date(lastScanDate.getFullYear(), lastScanDate.getMonth(), lastScanDate.getDate()); // This strips time part, keeping only the date

                const diffMinutes = (now - lastScanDate) / 60000; // convert milliseconds to minutes

                if (lastScanDay.getTime() === today.getTime()) { // Checks if the scan was today
                    if (diffMinutes < 5) {
                        machineElement.style.borderColor = 'green'; // Less than 5 minutes ago today
                    } else if (diffMinutes < 15) {
                        machineElement.style.borderColor = 'yellow'; // More than 5 minutes but less than 15 minutes ago today
                    } else if (diffMinutes > 15) {
                        machineElement.style.borderColor = 'red'; // More than 15 minutes ago today
                    }
                } else {
                    machineElement.style.borderColor = ''; // Default color if no scan today
                }
            }
        }
    } catch (error) {
        console.error('Failed to update machine borders:', error);
        // Optionally handle the error more gracefully in the UI
    }
}
// document.addEventListener('DOMContentLoaded', updateMachineBorders);



//**********************************/

function initializeDateInputs() {
    console.log('About to initialize dates');
    var today = new Date(); // Use the Date object to manipulate dates
    var todayStr = today.toISOString().substr(0, 10);

    var tomorrow = new Date(today); // Create a new Date object for tomorrow
    tomorrow.setDate(today.getDate() + 1); // Increment the day by one
    var tomorrowStr = tomorrow.toISOString().substr(0, 10);

    var startDateInput = document.getElementById('start-date');
    var endDateInput = document.getElementById('end-date');
    var hiddenStartDateInput = document.getElementById('today-start-date');
    var hiddenEndDateInput = document.getElementById('today-end-date');
    
    console.log('Start Date Input:', startDateInput);
    console.log('End Date Input:', endDateInput);

    if (startDateInput && endDateInput && hiddenStartDateInput && hiddenEndDateInput) {
        startDateInput.value = todayStr;
        endDateInput.value = tomorrowStr;
        hiddenStartDateInput.value = todayStr;
        hiddenEndDateInput.value = tomorrowStr;

        // Log to console for debugging
        console.log('Date inputs initialized. Start Date:', todayStr, 'End Date:', tomorrowStr);
    } else {
        console.error('One or more date inputs are missing.');
    }
}


//**********************************/



function updateDateInputs(selectedOption) {
    const startInput = document.getElementById('start-date');
    const endInput = document.getElementById('end-date');
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1); // Add one day to today's date
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    switch (selectedOption) {
        case 'today':
            setDateInputs(todayStr, tomorrowStr);
            disableDatePickers();
            break;
        case 'week':
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - (today.getDay() || 7) + 1);  // Set to Monday of this week
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);  // Sunday of this week
            setDateInputs(startOfWeek.toISOString().split('T')[0], endOfWeek.toISOString().split('T')[0]);
            disableDatePickers();
            break;
        case 'month':
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);  // Last day of the current month
            setDateInputs(startOfMonth.toISOString().split('T')[0], endOfMonth.toISOString().split('T')[0]);
            disableDatePickers();
            break;
        case 'custom':
            enableDatePickers();
            break;
    }
}

function setDateInputs(startDate, endDate) {
    console.log("Setting dates to:", startDate, endDate);
    document.getElementById('today-start-date').value = startDate;
    document.getElementById('today-end-date').value = endDate;
    document.getElementById('start-date').value = startDate;
    document.getElementById('end-date').value = endDate;
}

function disableDatePickers() {
    document.getElementById('start-date').disabled = true;
    document.getElementById('end-date').disabled = true;
}

function enableDatePickers() {
    const startDatePicker = document.getElementById('start-date');
    const endDatePicker = document.getElementById('end-date');

    // Check if the pickers have valid dates set; if not, initialize to today's date
    const today = new Date().toISOString().split('T')[0];
    if (!startDatePicker.value) startDatePicker.value = today;
    if (!endDatePicker.value) endDatePicker.value = today;

    startDatePicker.disabled = false;
    endDatePicker.disabled = false;
}

function updatePartCounts(data) {
    // First, reset all part count labels to "0"
    const partCountElements = document.querySelectorAll('[id^="part-count-"]');
    partCountElements.forEach(element => {
        element.textContent = "0";
    });

    // Now, update the labels that have new data
    Object.keys(data).forEach(machineId => {
        const partCountElement = document.getElementById(`part-count-${machineId}`);
        if (partCountElement) {
            partCountElement.textContent = data[machineId];
        }
    });
}


//**********************************/


function handleFormSubmit(form) {
    const formData = new FormData(form);
    let startDate = formData.get('start-date');
    let endDate = formData.get('end-date');

    if (!document.getElementById('start-date').disabled) {
        startDate = document.getElementById('start-date').value;
    }
    if (!document.getElementById('end-date').disabled) {
        endDate = document.getElementById('end-date').value;
    }

    console.log('Submitting dates:', { startDate, endDate });

    fetch('/api/dateForm', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({startDate, endDate})
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        if (data && Object.keys(data).length > 0) {
            updatePartCounts(data); // Update UI with received data
            updateMachineBorders(); // Update machine borders whenever the form is submitted
        } else {
            // If data is empty, explicitly reset part counts
            resetPartCounts();
            console.log('No data returned for the given date range.');
        }
        // updateMachineBorders(); // Update machine borders even if no new data
    })
    .catch(error => {
        console.error('Error:', error);
        resetPartCounts(); // Resets part counts on error
        updateMachineBorders(); // Update machine borders on error
    });
}

function resetPartCounts() {
    const partCountElements = document.querySelectorAll('[id^="part-count-"]');
    partCountElements.forEach(element => {
        element.textContent = "0"; // Reset each part count to "0"
    });
}