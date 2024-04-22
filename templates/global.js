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