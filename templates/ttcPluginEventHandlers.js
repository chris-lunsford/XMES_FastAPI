document.addEventListener('DOMContentLoaded', function() {
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const statusOutput = document.getElementById('status-output');
    const orderIdInput = document.getElementById('order-id');

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Highlight drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });

    // Handle dropped files
    dropArea.addEventListener('drop', handleDrop, false);

    // Handle file selection via browse button
    fileInput.addEventListener('change', handleFileSelection, false);

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function highlight(e) {
        dropArea.classList.add('highlight');
    }

    function unhighlight(e) {
        dropArea.classList.remove('highlight');
    }

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;

        // We are limiting to one file, so only the first file in the list is used
        if (files.length > 0) {
            // Create a new DataTransfer object
            const dataTransfer = new DataTransfer();

            // Add only the first file
            dataTransfer.items.add(files[0]);

            // Update the file input with the new file list containing only one file
            fileInput.files = dataTransfer.files;

            // Update the status output
            statusOutput.textContent = `File selected: Click Upload to process`;
        }
    }

    function handleFileSelection() {
        // Get the selected file from the file input
        const file = fileInput.files[0];
        if (file) {
            statusOutput.textContent = `File selected: Click Upload to process `;
        } else {
            statusOutput.textContent = 'No file selected.';
        }
    }
});


document.getElementById('clear-button').addEventListener('click', function() {
    document.getElementById('file-upload-form').reset();
    document.getElementById('status-output').textContent = "Enter Order ID and select a file.";
});
