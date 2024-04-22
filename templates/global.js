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
document.addEventListener('DOMContentLoaded', updateMachineBorders);



//**********************************/

function initializeDateInputs() {
    console.log('About to load dates');
    var today = new Date().toISOString().substr(0, 10);
    var startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1); // Set start date to one year ago
    var startDateInput = document.getElementById('start-date');
    var endDateInput = document.getElementById('end-date');
    
    console.log('Start Date Input:', startDateInput);
    console.log('End Date Input:', endDateInput);

    if (startDateInput && endDateInput) {
        startDateInput.value = startDate.toISOString().substr(0, 10);
        endDateInput.value = today;
        console.log('Date inputs updated.');
    } else {
        console.log('Date inputs not found.');
    }
}


//**********************************/



function handleFormSubmit(form) {
    let selectedDateRange = form.querySelector('input[name="date-range"]:checked').value;
    let startDate, endDate;

    if (selectedDateRange === 'custom') {
        startDate = document.getElementById('start-date').value;
        endDate = document.getElementById('end-date').value;
    } else {
        startDate = document.getElementById('today-start-date').value;
        endDate = document.getElementById('today-end-date').value;
    }

    const data = { dateRange: selectedDateRange, startDate: startDate, endDate: endDate };

    fetch('/api/dateForm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        console.log('Success:', data);
        updatePartCounts(data);
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

function updateDateInputs(selectedOption) {
    const startInput = document.getElementById('start-date');
    const endInput = document.getElementById('end-date');
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    switch (selectedOption) {
        case 'today':
            setDateInputs(todayStr, todayStr);
            disableDatePickers();
            break;
        case 'week':
            // Calculate start and end dates for the week
            disableDatePickers();
            break;
        case 'month':
            // Calculate start and end dates for the month
            disableDatePickers();
            break;
        case 'custom':
            enableDatePickers();
            break;
    }
}

function setDateInputs(startDate, endDate) {
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
    document.getElementById('start-date').disabled = false;
    document.getElementById('end-date').disabled = false;
}

function updatePartCounts(data) {
    Object.keys(data).forEach(machineId => {
        const partCountElement = document.getElementById(`part-count-${machineId}`);
        if (partCountElement) {
            partCountElement.textContent = data[machineId];
        }
    });
}