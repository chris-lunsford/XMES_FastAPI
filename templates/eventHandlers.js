document.addEventListener('DOMContentLoaded', function() {
    // Attach event listeners to the body which will handle events from dynamically loaded content
    document.body.addEventListener('change', function(event) {
        // Check if the event is coming from your date-range inputs
        if (event.target.matches('input[name="date-range"]')) {
            updateDateInputs(event.target.value);
        }
    });

    document.body.addEventListener('submit', function(event) {
        // Check if the form being submitted is your dateForm
        if (event.target.id === 'dateForm') {
            event.preventDefault();
            handleFormSubmit(event.target);
        }
    });   
});

document.addEventListener('DOMContentLoaded', function() {
    // Run updateMachineBorders initially when the page loads
    updateMachineBorders();

    // Set up the function to run every 5 minutes
    // setInterval(updateMachineBorders, 60000); // 60000 milliseconds = 1 minute
    
    setInterval(autoSubmitForm, 60000);
});