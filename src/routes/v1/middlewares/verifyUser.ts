import jwt from "jsonwebtoken";
import db from "../../../config/db.js";

const verifyUser = (req: any, res: any, next: any) => {
    try {
        // Check if the request has an authorization header
        const token = req.headers["authorization"]?.split(" ")[1];
        if (!token) return res.status(401).json({ message: "Unauthorized" });

        const secretKey = process.env.TOKEN_SECRET || "default";

        // Decode the token
        const decodedToken = jwt.verify(token, secretKey) as { email: string, clientDeviceId: string };
        if (!decodedToken) return res.status(401).json({ message: "Unauthorized" });
        
        // Check if the user exists in the database
        const userRef = db.collection("users").doc(decodedToken.email);
        userRef.get().then((userSnapShot) => {
            if (!userSnapShot.exists) return res.status(401).json({ message: "Unauthorized" });
        });

        // Attach userId and clientDeviceId to the request object
        req.userId = decodedToken.email;
        req.clientDeviceId = decodedToken.clientDeviceId;

        // Proceed to the next middleware or route handler
        next();
    } catch (error) {
        console.error("Error in verifyUser middleware: ", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

export default verifyUser