/***** Machine Dashboard *****/


document.addEventListener('DOMContentLoaded', function() {
    // Attach event listeners to the body which will handle events from dynamically loaded content
    document.body.addEventListener('change', function(event) {
        if (event.target.matches('input[name="date-range"]')) {
            updateDateInputs(event.target.value);
            if (event.target.value !== 'custom') {
                event.preventDefault();  // Prevent the default form submission
                handleFormSubmit(document.getElementById('dateForm'));
            }
        } else if (event.target.matches('#start-date, #end-date')) {
            const startDate = document.getElementById('start-date').value;
            const endDate = document.getElementById('end-date').value;
            if (startDate && endDate) {
                event.preventDefault();  // Prevent the default form submission
                handleFormSubmit(document.getElementById('dateForm'));
            }
        }
    });

    document.body.addEventListener('submit', function(event) {
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

