/***** Production Dashboard *****/


// After this script loads, set its callback in scriptMap if necessary.
if (typeof scriptMap !== 'undefined') {
    scriptMap['/production'].callback = initializeProductionDashboard;
}


// Define the barcode scanning function outside to keep its reference
function handleBarcodeKeyPress(event) {
    if (event.target.id === 'barcode' && event.key === "Enter") {
        console.log("Enter pressed on barcode input");
        event.preventDefault();
        handleBarcodeScan_to_DB();
    }
}

function initializeProductionDashboard() {
    // Initialize dashboard functionalities
    populateCustomerIDs(); // Populate customer IDs
    populateWorkAreas(); // Populate work areas

    // Only initialize once
    if (window.productionDashboardInitialized) return;
    window.productionDashboardInitialized = true;

    // Add event listener for barcode scanning
    // Remove the listener first to ensure it's not added multiple times
    document.body.removeEventListener('keypress', handleBarcodeKeyPress);
    document.body.addEventListener('keypress', handleBarcodeKeyPress);
}



document.addEventListener('DOMContentLoaded', function() {
    document.body.addEventListener('input', function(event) {
        // Handle barcode input
        if (event.target.id === 'barcode') {
            let orderIDField = document.getElementById('order-id');
            if (event.target.value.length >= 8) {
                orderIDField.value = event.target.value.substring(0, 8);
            }
        }

        // Handle employee-id input
        if (event.target.id === 'employee-id') {
            const employeeID = event.target.value;
            const workAreaSelect = document.getElementById('work-area');
            if (workAreaSelect) {
                const workArea = workAreaSelect.value;
                if (employeeID.length === 4 && workArea) {
                    fetchPartsCount(employeeID, workArea);
                }
            }
        }   
    });

        // Safely attach event listener to work area select
        setTimeout(() => {
        const workAreaSelect = document.getElementById('work-area');
        if (workAreaSelect) {
            workAreaSelect.addEventListener('change', function() {
                const employeeID = document.getElementById('employee-id').value;
                const workArea = this.value;

                // Ensure the employee ID is exactly 4 digits before making the API call
                if (employeeID.length === 4 && workArea) {
                    fetchPartsCount(employeeID, workArea);
                }
            });
        } else {
            console.warn('Work area select element not found!');
        }
    }, 500); // Delay of 1000 ms (1 second)
});



function attemptFetchPartsCount() {
    const employeeID = document.getElementById('employee-id').value;
    const workAreaSelect = document.getElementById('work-area');
    const workArea = workAreaSelect.value;

    // Ensure the employee ID is exactly 4 digits and work area is selected before making the API call
    if (employeeID.length === 4 && workArea) {
        fetchPartsCount(employeeID, workArea);
    }
}