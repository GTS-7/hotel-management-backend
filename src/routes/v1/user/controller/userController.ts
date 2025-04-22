import db from "../../../../config/db.js";

const getUserDetails = async (req: any, res: any) => {
  try {
    const email = req.email; // Assuming email is set in the request by the verifyUser middleware
    if (!email) return res.status(400).json({ message: "Email is required" });

    const userRef = db.collection("users").doc(email);
    const user = await userRef.get();
    if (!user.exists) return res.status(404).json({ message: "User not found" });

    const userData = user.data();
    if (!userData) return res.status(404).json({ message: "User data not found" });

    res.status(200).json({ message: "User details fetched successfully", userData });
  } catch (error) {
    console.error("Error fetching user details: ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const updateUserDetails = async (req: any, res: any) => {
  try {
    const email = req.email;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const { fullName } = req.body;
    if (!fullName) return res.status(400).json({ message: "Full name is required" });

    const userRef = db.collection("users").doc(email);
    const user = await userRef.get();
    if (!user.exists) return res.status(404).json({ message: "User not found" });

    await userRef.update({ fullName });

    const updatedUser = await userRef.get();
    if (!updatedUser.exists) return res.status(404).json({ message: "User not found" });

    res
      .status(200)
      .json({ message: "User details updated successfully", updatedUser: updatedUser.data() });
  } catch (error) {
    console.error("Error updating user details: ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const handleCart = async (req: any, res: any) => {
  try {
    const email = req.email;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const { roomId } = req.body;
    if (!roomId) return res.status(400).json({ message: "Room ID is required" });

    const existingCartItemQuery = db
      .collection("cart")
      .where("email", "==", email)
      .where("roomId", "==", roomId);

    const existingCartItem = await existingCartItemQuery.get();
    if (!existingCartItem.empty) {
      return res.status(400).json({ message: "Item already in cart" });
    }

    const cart = await db.collection("cart").add({
      email,
      roomId,
      createdAt: new Date(),
    });
    if (!cart) return res.status(500).json({ message: "Failed to add to cart" });

    res.status(201).json({ message: "Item added to cart successfully", cartId: cart.id });
  } catch (error) {
    console.error("Error handling cart: ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getCartItems = async (req: any, res: any) => {
  try {
    const email = req.email;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const cartItemsQuery = db.collection("cart").where("email", "==", email);
    const cartItemsSnapshot = await cartItemsQuery.get();
    if (cartItemsSnapshot.empty) return res.status(404).json({ message: "No items in cart" });

    res
      .status(200)
      .json({
        message: "Cart items fetched successfully",
        cartItems: cartItemsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      });
  } catch (error) {
    console.error("Error fetching cart items: ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const deleteCartItem = async (req: any, res: any) => {
  try {
    const email = req.email;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const { cartItemId } = req.body;
    if (!cartItemId) return res.status(400).json({ message: "Cart item ID is required" });

    const cartItemRef = db.collection("cart").doc(cartItemId);
    const cartItem = await cartItemRef.get();
    if (!cartItem.exists) return res.status(404).json({ message: "Cart item not found" });

    const deleteCartItem = await cartItemRef.delete();
    if (!deleteCartItem) return res.status(500).json({ message: "Failed to delete cart item" });

    res.status(200).json({ message: "Cart item deleted successfully" });
  } catch (error) {
    console.error("Error deleting cart item: ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export default {
  getUserDetails,
  handleCart,
  getCartItems,
  deleteCartItem,
  updateUserDetails,
};
