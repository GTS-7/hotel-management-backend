import db from "../../../../config/db.js";
import cloudinary from "../../../../config/cloudinary.js";
import sharp from "sharp";
import helperFunctions from "../../../../config/helperFunctions.js";

// Controllers for handling room management
const handleCreateRoom = async (req: any, res: any) => {
  try {
    let { roomName, roomType, beds, price, additionalBedCost, amenities, roomSize } = req.body;
    const files = req.files as Express.Multer.File[];

    // const parsedExtraFacilities = JSON.parse(extraFacilities);

    if (!roomName || !roomType || !beds || !price || !files?.length || !additionalBedCost || !amenities || !roomSize) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Step 1: Compress all images in parallel
    const compressedImages = await Promise.all(
      files.map(async (file) => {
        const format = file.mimetype.split("/")[1];
        let transformer = sharp(file.buffer).resize({ width: 1024 });

        if (format === "png") {
          transformer = transformer.png({ quality: 80 });
        } else if (format === "webp") {
          transformer = transformer.webp({ quality: 70 });
        } else {
          transformer = transformer.jpeg({ quality: 70 });
        }

        return transformer.toBuffer();
      })
    );

    // Step 2: Upload compressed images to Cloudinary in parallel
    const uploadPromises = compressedImages.map((buffer) => {
      return new Promise<string>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: "hotel_rooms" },
          (error, result) => {
            if (error || !result) return reject(error);
            resolve(result.secure_url);
          }
        );
        uploadStream.end(buffer);
      });
    });

    const photoUrls = await Promise.all(uploadPromises);

    // Step 3: Store room in DB
    const newRoomRecord = await db.collection("rooms").add({
      roomName,
      roomType,
      beds,
      price,
      photos: photoUrls,
      amenities,
      additionalBedCost,
      roomSize,
      // extraFacilities: extraFacilities,
      createdAt: new Date(),
    });

    return res.status(201).json({
      message: "Room created successfully",
      roomId: newRoomRecord.id,
    });
  } catch (error) {
    console.error("Error creating room:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getRooms = async (req: any, res: any) => {
  try {
    const roomsSnapshot = await db.collection("rooms").get();
    if (roomsSnapshot.empty) {
      return res.status(404).json({ message: "No rooms found" });
    }

    // Map through the documents and return an array of room objects
    const rooms = roomsSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json(rooms);
  } catch (error) {
    console.error("Error fetching rooms:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const handleUpdateRoom = async (req: any, res: any) => {
  try {
      // req.body contains text/number fields and JSON strings from FormData
      // Ensure your Multer middleware parses these into req.body
      const { roomId, roomName, roomType, beds, price, amenities, additionalBedCost, roomSize } = req.body;

      // req.files contains the array of newly uploaded files (from input[type="file" multiple] named 'files')
      // This is populated by the Multer middleware (e.g., upload.array('files', ...))
      const files = req.files as Express.Multer.File[] | undefined; // files might be undefined if no new files were uploaded


      // --- 1. Process Photos to Remove ---
      let photosToRemove: string[] = [];
      // Assuming frontend sends photosToRemove as a JSON string array in FormData
      if (req.body.photosToRemove) {
          try {
              photosToRemove = JSON.parse(req.body.photosToRemove);
              if (!Array.isArray(photosToRemove)) {
                   return res.status(400).json({ message: "Invalid photosToRemove format: Must be an array." });
              }
              // Filter out any non-string values if necessary
              photosToRemove = photosToRemove.filter(item => typeof item === 'string');

          } catch (e) {
              console.error("Failed to parse photosToRemove JSON:", e);
              return res.status(400).json({ message: "Invalid photosToRemove JSON format." });
          }
      }
      // ------------------------------------


      if (!roomId) {
          return res.status(400).json({ message: "Room ID is required for update." });
      }

      const roomRef = db.collection("rooms").doc(roomId);
      const roomDoc = await roomRef.get();

      if (!roomDoc.exists) {
          return res.status(404).json({ message: "Room not found." });
      }

      const existingRoomData = roomDoc.data();
       // Ensure existingRoomData and its photos array are valid
      if (!existingRoomData || !Array.isArray(existingRoomData.photos)) {
           // This shouldn't happen for a valid room, but handle defensively
           console.error("Invalid existing room data format:", existingRoomData);
      }


      let updatedRoomData: any = {}; // Object to hold fields that will be updated

      // --- 2. Process Text/Number Fields ---
      // Check if fields are provided in the request body (allowing partial updates)
      // Convert beds and price to numbers as they come from FormData as strings
      if (roomName !== undefined) updatedRoomData.roomName = roomName;
      if (roomType !== undefined) updatedRoomData.roomType = roomType;
      if (beds !== undefined) updatedRoomData.beds = Number(beds); // Convert to number
      if (price !== undefined) updatedRoomData.price = Number(price); // Convert to number
      if (additionalBedCost !== undefined) updatedRoomData.additionalBedCost = Number(additionalBedCost); // Convert to number
      if (roomSize !== undefined) updatedRoomData.roomSize = roomSize; // Assuming roomSize is a string, no conversion needed
      

      // --- 3. Process Highlights (sent as JSON string) ---
       if (amenities !== undefined) {
           try {
              const parsedHighlights = JSON.parse(amenities);
              if (!Array.isArray(parsedHighlights)) {
                  return res.status(400).json({ message: "Invalid highlights format: Must be an array." });
              }
               // Filter out non-string highlights if necessary
               updatedRoomData.highlights = parsedHighlights.filter(item => typeof item === 'string');
           } catch (e) {
               console.error("Failed to parse highlights JSON:", e);
               return res.status(400).json({ message: "Invalid highlights JSON format." });
           }
       }


      // --- 4. Manage Photos (Deletion and Upload) ---
      let finalPhotoUrls = [...existingRoomData?.photos]; // Start with all current photos

      const publicIdsToDeleteCloudinary: string[] = [];

      // Identify photos to remove from the DB list and queue for Cloudinary deletion
      if (photosToRemove.length > 0) {
          const initialPhotoCount = finalPhotoUrls.length;
          finalPhotoUrls = finalPhotoUrls.filter(url => {
              const shouldRemove = photosToRemove.includes(url);
              if (shouldRemove) {
                  const publicId = helperFunctions.getCloudinaryPublicId(url);
                  if (publicId) {
                      publicIdsToDeleteCloudinary.push(publicId);
                  } else {
                       // Log a warning if we can't get the public ID for a URL requested for removal
                       console.warn(`Skipping Cloudinary deletion for invalid URL (could not extract public ID): ${url}`);
                  }
              }
              return !shouldRemove; // Keep photos that are NOT in the remove list
          });
           // Optional: Check if all requested photosToRemove were actually found in the DB list
           if (finalPhotoUrls.length + photosToRemove.length !== initialPhotoCount && publicIdsToDeleteCloudinary.length !== photosToRemove.length) {
                console.warn("Mismatch between requested photos to remove and photos found in DB/Cloudinary IDs extracted.");
                // You might want stricter handling here depending on requirements
           }
      }

      // Upload new photos if any were provided
      const newPhotoUrls: string[] = [];
      if (files && files.length > 0) {
          try {
              const uploadPromises = files.map(async (file) => {
                  // Ensure file buffer is available (Multer memoryStorage provides this)
                  if (!file.buffer) {
                       console.error("Multer file buffer missing for upload.");
                       throw new Error("Uploaded file buffer missing.");
                  }
                  const format = file.mimetype.split("/")[1];
                  // Resize and compress the image using sharp
                  let transformer = sharp(file.buffer).resize({
                       width: 1024, // Max width
                       fit: sharp.fit.inside, // Don't enlarge if smaller
                       withoutEnlargement: true
                  });

                  // Apply format specific compression
                  if (format === "png") {
                      transformer = transformer.png({ quality: 80 });
                  } else if (format === "webp") {
                      transformer = transformer.webp({ quality: 70 });
                  } else { // Default to jpeg for others or if format is ambiguous
                      transformer = transformer.jpeg({ quality: 70 });
                  }

                  const buffer = await transformer.toBuffer();

                  // Upload to Cloudinary
                  return new Promise<string>((resolve, reject) => {
                      const uploadStream = cloudinary.uploader.upload_stream(
                          { folder: "hotel_rooms" }, // Use the same folder as create
                          (error, result) => {
                              if (error || !result) {
                                   console.error("Cloudinary upload error:", error);
                                   return reject(error || new Error("Cloudinary upload failed"));
                              }
                              resolve(result.secure_url);
                          }
                      );
                      uploadStream.end(buffer);
                  });
              });

              const uploadedUrls = await Promise.all(uploadPromises);
              newPhotoUrls.push(...uploadedUrls); // Add new URLs to our list

          } catch (uploadError) {
              console.error("Error uploading new photos:", uploadError);
               // Decide how to handle upload failure:
               // 1. Abort the whole update? (Risk leaving Cloudinary deletions half-done)
               // 2. Log the error and proceed without new photos?
               // 3. Attempt to delete the newly uploaded photos on Cloudinary? (Complex rollback)
               // For this example, we'll return an error response.
              return res.status(500).json({ message: "Failed to upload one or more new photos.", error: (uploadError as Error).message });
          }
      }

       // Perform Cloudinary Deletions AFTER potential new uploads succeed (reduces rollback complexity)
      if (publicIdsToDeleteCloudinary.length > 0) {
           try {
               // Use destroy method for an array of public IDs
               const deleteResult = await cloudinary.api.delete_resources(publicIdsToDeleteCloudinary);
               // console.log("Cloudinary delete result:", deleteResult);
               // You might want to check deleteResult.deleted for success status of each ID
           } catch (deleteError) {
                console.error("Error deleting photos from Cloudinary:", deleteError);
                // If deletion fails, decide if this is a critical error.
                // It's often better to log and potentially alert an admin rather than
                // fail the whole update, but it means the photo might remain in Cloudinary.
                // If you need strict consistency, you'd handle this error more aggressively.
                // For now, we log and allow the DB update to proceed.
           }
      }


      // Combine the remaining existing photos and the newly uploaded photos
      updatedRoomData.photos = [...finalPhotoUrls, ...newPhotoUrls];

      // ------------------------------------


      // --- 5. Update Database ---
      // Only proceed with DB update if there's something to update
      if (Object.keys(updatedRoomData).length === 0) {
           return res.status(400).json({ message: "No valid fields or photos provided for update." });
      }

      // Firestore update operation
      await roomRef.update(updatedRoomData);

      // --- 6. Send Success Response ---
      res.status(200).json({ message: "Room updated successfully", roomId: roomId });

  } catch (error) {
      console.error("Error updating room:", error);
      // Catch any unexpected errors
      res.status(500).json({ message: "Internal server error" });
  }
};


const handleDeleteRoom = async (req: any, res: any) => {
  try {
    // Get roomId from URL parameters (`req.params`)
    const { roomId } = req.params;

    // Check if roomId is provided from the URL parameter
    if (!roomId) {
      // This check might be redundant if the route definition enforces the parameter,
      // but it's good practice for safety. Update message for clarity.
      return res.status(400).json({ message: "Room ID is required in URL path" });
    }

    // Proceed with the rest of your logic using the roomId obtained from req.params
    const roomRef = db.collection("rooms").doc(roomId);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      return res.status(404).json({ message: "Room not found" });
    }

    await roomRef.delete();

    res.status(200).json({ message: "Room deleted successfully" });

  } catch (error) {
    console.error("Error deleting room:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export default {
  handleCreateRoom,
  getRooms,
  handleUpdateRoom,
  handleDeleteRoom
};