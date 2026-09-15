import "dotenv/config";
import express from "express";


const app = express();
const PORT = process.env.PORT;

// Wait for MongoDB before accepting requests, so the API does not start half-ready.
const startServer = async () => {

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

startServer();
