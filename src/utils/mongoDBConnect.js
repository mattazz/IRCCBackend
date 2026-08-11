import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectToDatabase = async () => {
    if (mongoose.connection.readyState === 0) {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is not set - see readme.MD for the required .env variables');
        }
        try {
            await mongoose.connect(process.env.MONGODB_URI);
            console.log('Connected to database');
        } catch (error) {
            console.error('Error connecting to database:', error);
            throw error;
        }
    }
};

const closeDatabaseConnection = async () => {
    if (mongoose.connection.readyState !== 0) {
        try {
            await mongoose.connection.close();
            console.log('Disconnected from database');
        } catch (error) {
            console.error('Error disconnecting from database:', error);
            throw error;
        }
    }
};

const isConnected = () => mongoose.connection.readyState === 1;

export default { connectToDatabase, closeDatabaseConnection, isConnected }