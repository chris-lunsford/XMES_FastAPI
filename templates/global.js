async function updateMachineBorders() {
    try {
        console.log('Making API call to update machine borders');
        const response = await fetch('/api/machine-status');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        
        for (const [resource, lastScan] of Object.entries(data)) {
            const machineElement = document.getElementById(`machine-${resource}`);
            if (machineElement) {
                const lastScanDate = new Date(lastScan);
                const now = new Date();
                const diffMinutes = (now - lastScanDate) / 60000; // convert milliseconds to minutes

                if (diffMinutes < 5) {
                    machineElement.style.borderColor = 'green'; // less than 5 minutes ago
                } else if (diffMinutes < 15) {
                    machineElement.style.borderColor = 'yellow'; // more than 5 minutes but less than 15 minutes
                } else {
                    machineElement.style.borderColor = 'red'; // more than 15 minutes ago
                }
            }
        }
    } catch (error) {
        console.error('Failed to update machine borders:', error);
        // Optionally handle the error more gracefully in the UI
    }
}
document.addEventListener('DOMContentLoaded', updateMachineBorders);