import db from "../../../../config/db.js";

const handleRoomReviews = async (req: any, res: any) => {
  try {
    // req.email is set by the auth middleware, it will check there if the token is valid or not
    const email = req.email;

    // Review data
    const { rating, comment, roomId } = req.body;
    if (!email || !rating || !comment || !roomId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    // Check if the room exists
    const room = await db.collection("rooms").where("id", "==", roomId).get();
    if (room.empty) {
      return res.status(404).json({ error: "Room not found" });
    }

    // Check if the user has already reviewed this room
    const existingReview = await db
      .collection("reviews")
      .where("roomId", "==", roomId)
      .where("email", "==", email)
      .get();
    if (!existingReview.empty) {
      return res.status(400).json({ error: "You have already reviewed this room" });
    }

    // Create the review
    const reviewData = {
      email,
      roomId,
      rating,
      comment,
      createdAt: new Date().toISOString(),
    };
    await db.collection("reviews").add(reviewData);

    // Update the room's average rating
    const reviewsSnapshot = await db.collection("reviews").where("roomId", "==", roomId).get();
    let totalRating = 0;
    let reviewCount = 0;
    reviewsSnapshot.forEach((doc) => {
      const review = doc.data();
      totalRating += review.rating;
      reviewCount++;
    });

    const averageRating = totalRating / reviewCount;

    await db.collection("rooms").doc(roomId).update({ averageRating });

    return res.status(201).json({ message: "Review added successfully", averageRating });
  } catch (error) {
    console.error("Error handling room review:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export default {
  handleRoomReviews,
};
