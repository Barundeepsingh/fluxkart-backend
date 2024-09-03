import { Client } from "pg";
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
    connectionString: process.env.DATABSE_URL,
});

client.connect()
    .then(() => console.log("Conected to postgres"))
    .catch((err) => console.log("error connecting to postgres", err.stack));

export default client;