import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken"
import { User } from "../models/user.model.js";

const verifyJWT = asyncHandler( async(req, _ , next) => {
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")

    if(!token){
        throw new ApiError(401,"Unauthorized request")
    }

    const validToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

    if(!validToken){
        throw new ApiError(401,"Unauthorized request: Invalid token")
    }

    const user = await User.findById(validToken._id).select("-password -refreshToken")

    if(!user){
        throw new ApiError(401, "Invalid Access Token")
    }

    req.user = user
    next()
})

export {verifyJWT}