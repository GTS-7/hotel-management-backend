// Helper function to safely convert data to a Date object, handling Firebase Timestamps
const safeToDate = (data: any): Date | null => {
    // Check if it's already a Date object
    if (data instanceof Date) {
        return data;
    }

    // Check if it's a Firebase Timestamp object structure
    if (data && typeof data === 'object' && (data.hasOwnProperty('seconds') || data.hasOwnProperty('_seconds')) && data.hasOwnProperty('nanoseconds')) {
        const seconds = data.seconds || data._seconds; // Handle both 'seconds' and '_seconds'
        if (typeof seconds === 'number' && typeof data.nanoseconds === 'number') {
            // Convert seconds and nanoseconds to milliseconds
            const milliseconds = seconds * 1000 + Math.round(data.nanoseconds / 1000000);
            const date = new Date(milliseconds);
             if (isNaN(date.getTime())) {
                console.warn("Failed to create Date from Firebase Timestamp object:", data);
                return null;
             }
            return date;
        }
         console.warn("Firebase Timestamp object has invalid data types:", data);
         return null;
    }

    // Attempt to create a Date object from other types (like ISO strings)
    const date = new Date(data);
    if (isNaN(date.getTime())) {
         console.warn("Failed to create Date from value using new Date():", data);
         return null;
    }
    return date;
};


function getCloudinaryPublicId(url: string): string | null {
    try {
        // Matches the path segments after /upload/v<version>/ up to the file extension
        const regex = /\/upload\/v\d+\/(.+?)\.\w+$/;
        const match = url.match(regex);
        if (match && match[1]) {
            // match[1] will be something like 'folder/subfolder/image_name'
            return match[1];
        }
        // Handle cases where the URL format might be different, e.g., includes transformations
        // A more robust method might be needed depending on your Cloudinary settings
        // and how URLs are generated. For standard uploaded images, this often works.
        console.warn(`Could not extract public ID from URL: ${url}`);
        return null;

    } catch (e) {
        console.error("Error extracting public ID:", url, e);
        return null;
    }
}

export default {
    safeToDate,
    getCloudinaryPublicId
};