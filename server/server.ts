// server/server.ts
import 'dotenv/config';

import app from "./src/app";
import dbConnect from "./src/config/dbConnect";

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    try {

        console.log(`Server running on port ${PORT}`);
        dbConnect();
    } catch (e: any) {
        console.log(e.message);

    }
});
