document.addEventListener('DOMContentLoaded', function() {
    const dropArea = document.getElementById('drop-area');
    const statusOutput = document.querySelector('.status-output');
    const orderIdInput = document.getElementById('order-id'); // Get the order ID input field

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

    function preventDefaults (e) {
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
      var dt = e.dataTransfer;
      var files = dt.files;

      handleFiles(files);
    }

    function handleFiles(files) {
      ([...files]).forEach(uploadFile);
    }

    function uploadFile(file) {
      const apiUrl = '/process/'; // Your actual API endpoint
      const formData = new FormData();

      // Get the order ID from the input field
      const orderId = orderIdInput.value;
      if (!orderId) {
        statusOutput.textContent = "Order ID is required.";
        return;
      }

      // Append file and order_id to the form data
      formData.append('file', file);
      formData.append('order_id', orderId);

      fetch(apiUrl, {
        method: 'POST',
        body: formData
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.blob();
      })
      .then(blob => {
        const url = window.URL.createObjectURL(new Blob([blob]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', file.name); // Set the filename for the download
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);

        statusOutput.textContent = `File processed successfully.`;
      })
      .catch(error => {
        console.error('Error:', error);
        statusOutput.textContent = `Error uploading file: ${error.message}`;
      });
    }
});
