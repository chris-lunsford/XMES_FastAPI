/***** Notification Dashboard *****/


// After this script loads, set its callback in scriptMap if necessary.
if (typeof scriptMap !== 'undefined') {
    scriptMap['/notification'].callback = initializeNotificationDashboard;
}


// Initialize machine dashboard with checks to prevent multiple initializations
function initializeNotificationDashboard() {
    console.log("Initializing Notification Dashboard");

    if (window.notificationDashboardInitialized) {
        console.log("Notification Dashboard already initialized. Clearing old listeners and reinitializing.");
        listenerManager.removeListeners();  // Ensure cleanup if already initialized
    } else {
        window.notificationDashboardInitialized = true;
    }
    // Initialize dashboard functionalities
    populateNotificationTypes(); // Populate notification types
    // Setup event handlers at initialization
    setupEventHandlers();   
}

// Setup event handlers using the singleton pattern
function setupEventHandlers() {
    console.log("Setting up event handlers");
    const form = document.querySelector('.data-submission');
    form.removeEventListener('submit', EventHandler.handleNotificationSubmit);
    form.addEventListener('submit', EventHandler.handleNotificationSubmit);    

    const orderInput = document.getElementById('order-id-notificationpage');
    orderInput.removeEventListener('input', EventHandler.handleOrderInput);
    orderInput.addEventListener('input', EventHandler.handleOrderInput);
    
}


const EventHandler = {    
    handleNotificationSubmit: function(event) {
        event.preventDefault();
        const orderID = document.getElementById('order-id-notificationpage').value;
        const notificationType = document.getElementById('notification-type').value;
        const notificationDetail = document.getElementById('notification-detail').value;
        const employeeID = document.getElementById('employee-id').value;

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
            document.getElementById('status-message').textContent = "Submitting...";

            const response = await fetch('/api/submit-order-notification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (response.ok) {
                document.getElementById('status-message').textContent = "Notification submitted successfully: " + result.message;
            } else {
                throw new Error(result.detail || "Unknown error occurred");
            }
        } catch (error) {
            document.getElementById('status-message').textContent = "Error: " + error.message;
        } finally {
            document.getElementById('submit-button').disabled = false; // Re-enable the submit button
        }
    },

    handleOrderInput: function(event) {
        const orderID = event.target.value;
        if (orderID.length === 8) {
            fetchJobNotifications(orderID);
        }
    }    
};