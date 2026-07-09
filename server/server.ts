// server/server.ts
import 'dotenv/config';

if (process.env.NODE_ENV === "production") {
    console.log = () => {};
    console.debug = () => {};
}

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
