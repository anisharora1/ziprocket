import admin from "firebase-admin";

if (!admin.apps.length) {
    try {
        const isProduction = process.env.NODE_ENV === "production";
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const projectId = process.env.FIREBASE_PROJECT_ID || "ziprocket01";

        if (isProduction) {
            const missingVars: string[] = [];
            if (!process.env.FIREBASE_PRIVATE_KEY) missingVars.push("FIREBASE_PRIVATE_KEY");
            if (!process.env.FIREBASE_CLIENT_EMAIL) missingVars.push("FIREBASE_CLIENT_EMAIL");

            if (missingVars.length > 0) {
                const errorMsg = `Firebase Admin initialization failed in production: Missing required environment variable(s): ${missingVars.join(", ")}`;
                console.error(`❌ ${errorMsg}`);
                throw new Error(errorMsg);
            }
        }

        if (privateKey && clientEmail) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    privateKey,
                    clientEmail,
                }),
            });
            console.log("🔥 Firebase Admin SDK initialized successfully with credentials.");
        } else {
            // Fallback: Default initialization (using GOOGLE_APPLICATION_CREDENTIALS or project ID)
            admin.initializeApp({
                projectId,
            });
            console.log(`🔥 Firebase Admin SDK initialized with project ID: ${projectId}`);
        }
    } catch (error) {
        console.error("❌ Failed to initialize Firebase Admin SDK:", error);
        if (process.env.NODE_ENV === "production") {
            throw error;
        }
    }
}

export default admin;
