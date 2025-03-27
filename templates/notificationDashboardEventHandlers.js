/***** Notification Dashboard *****/


// After this script loads, set its callback in scriptMap if necessary.
if (typeof scriptMap !== 'undefined') {
    scriptMap['/notification'].callback = initializeNotificationDashboard;
}


// // Initialize machine dashboard with checks to prevent multiple initializations
// function initializeNotificationDashboard() {
//     console.log("Initializing Notification Dashboard");

//     if (!window.notificationDashboardInitialized) {
//         window.notificationDashboardInitialized = true;
//         setupEventHandlers();
//     } else {
//         console.log("Notification Dashboard already initialized.");
//         listenerManager.removeListeners(); // Clean up first
//         setupEventHandlers(); // Re-setup handlers
//     }

//     // Initialize dashboard functionalities
//     populateNotificationTypes(); // Populate notification types
//     // Setup event handlers at initialization
//     // setupEventHandlers();   
// }

function initializeNotificationDashboard() {
    if (window.notificationDashboardInitialized) return;
    window.notificationDashboardInitialized = true;

    populateNotificationTypes();

    console.log("Initializing Notification Dashboard");
    setupEventHandlers();
}

function teardownNotificationDashboard() {
    console.log("Tearing down Notification Dashboard");
    listenerManager.removeListeners();
    window.notificationDashboardInitialized = false;
}

if (typeof scriptMap !== 'undefined') {
    scriptMap['/notification'].callback = initializeNotificationDashboard;
    scriptMap['/notification'].teardown = teardownNotificationDashboard;
}



// Setup event handlers using the singleton pattern
function setupEventHandlers() {  
    console.log("Setting up event handlers");
    const form = document.querySelector('.data-submission');
    form.removeEventListener('submit', EventHandler.handleNotificationSubmit);
    form.addEventListener('submit', EventHandler.handleNotificationSubmit);
    console.log("Added submit eventhandler");    

    const orderInput = document.getElementById('order-id-notificationpage');
    orderInput.removeEventListener('input', EventHandler.handleOrderInput);
    orderInput.addEventListener('input', EventHandler.handleOrderInput);
    console.log("Added input eventhandler");
    
}


window.EventHandler = window.EventHandler || {  
    handleNotificationSubmit: function(event) {
        event.preventDefault();
        const orderID = document.getElementById('order-id-notificationpage').value;
        const notificationType = document.getElementById('notification-type').value;
        const notificationDetail = document.getElementById('notification-detail').value;
        const employeeID = document.getElementById('employee-id').value;

        // Validate Order ID length
        const statusMessage = document.getElementById('statusMessage');
        if (orderID.length !== 8) {
            statusMessage.textContent = "8 digit Order ID required.";
            statusMessage.style.color = 'red';
            return;
        }

        // Validate Notification Detail is not empty
        if (notificationDetail.trim() === '') {
            statusMessage.textContent = "Notification detail cannot be empty.";
            statusMessage.style.color = 'red';
            return;
        }

        statusMessage.textContent = "";
        statusMessage.style.color = ''; // Reset color if no error

        const data = {
            OrderID: orderID,
            NotificationType: notificationType,
            OrderNotification: notificationDetail,
            SubmittedBy: employeeID
        };

        EventHandler.submitFormData(data);
    },

    submitFormData: async function(data) {
        try {
            document.getElementById('submit-button').disabled = true; // Disable the submit button
            document.getElementById('statusMessage').textContent = "Submitting...";

            const response = await fetch('/api/submit-order-notification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            const statusMessage = document.getElementById('statusMessage');
            if (response.ok) {
                statusMessage.textContent = "Notification submitted: " + result.message;
                statusMessage.style.color = 'green';
                // Clear fields except for order-id-notificationpage
                this.clearFormFieldsExceptOrderId();
                fetchExistingJobNotifications(data.OrderID);
            } else {
                throw new Error(result.detail || "Unknown error occurred");
            }
        } catch (error) {
            statusMessage.textContent = "Error: " + error.message;
            statusMessage.style.color = 'red';
        } finally {
            document.getElementById('submit-button').disabled = false; // Re-enable the submit button
        }
    },

    clearFormFieldsExceptOrderId: function() {
    const notificationType = document.getElementById('notification-type');
    const notificationDetail = document.getElementById('notification-detail');
    const employeeID = document.getElementById('employee-id');

    // Reset these fields to their default values
    if (notificationType) notificationType.value = ''; // Assuming it's a select, might set to default or first option
    if (notificationDetail) notificationDetail.value = '';
    if (employeeID) employeeID.value = '';
},

    handleOrderInput: function(event) {
        const orderID = event.target.value;
        const notificationListElement = document.getElementById('notification-list');
        
        if (orderID.length === 8) {
            fetchExistingJobNotifications(orderID);
        } else {
            notificationListElement.innerHTML = ''; // Clear existing notifications
        }

       }    
};