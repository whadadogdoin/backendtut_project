import dotenv from 'dotenv'
import connectDB from './db/index.js'
import app from './app.js'

dotenv.config({
    path: './env'
})

connectDB()
.then(() => {
    app.listen(process.env.PORT || 8000, () => {
        console.log(`App is listening on PORT: ${process.env.PORT}`);
    })
    app.on("error",(error) => {
        console.log("Error in Express App listener: ", error);
        throw error
    })
})
.catch((error) => {
    console.log("DB connection failed ", error);
})