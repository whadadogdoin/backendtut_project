import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadFile } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"

const generateAccessandRefreshToken = async (userId) => {
    try {

        const user = await User.findById(userId)

        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating tokens")
    }
}

const registerUser = asyncHandler( async (req,res) => {
    const { username, email, fullName, password } = req.body
    
    if (
        [username, email, fullName, password].some( (field) => field?.trim() === "" )
    ) {

        throw new ApiError(400, "All fields are required")
    }

    const existingUser = await User.findOne({
        $or: [{ username },{ email }]
    })
    if (existingUser) {
        throw new ApiError(409,"User with given username or email already exists")
    }
    const avatarLocalPath = req.files?.avatar[0]?.path
    
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    //console.log(req.files);

    const avatar = await uploadFile(avatarLocalPath)
    const coverImage = await uploadFile(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(500, "Avatar could not be uploaded")
    }

    const user = await User.create({
        username: username.toLowerCase(),
        email,
        password,
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || ""
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500, "User could not be registered")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )
})

const loginUser = asyncHandler( async (req,res) => {
    const {email, username, password} = req.body

    if(!email && !username){
        throw new ApiError(400, "Email or username is required")
    }

    const user = await User.findOne({
        $or: [{username},{email}]
    })

    if(!user){
        throw new ApiError(404, "User with given email or username does not exist")
    }

    const validUser = await user.checkPassword(password)

    if(!validUser){
        throw new ApiError(401, "Invalid credentials")
    }

    const {accessToken, refreshToken} = await generateAccessandRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    const cookieOptions = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
        new ApiResponse(200,{
            user: loggedInUser,
            accessToken,
            refreshToken
        },"User Logged In")
    )

})

const logoutUser = asyncHandler( async(req,res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const cookieOptions = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(
        new ApiResponse(200, {} , "User Logged Out")
    )
})

const refreshAccessToken = asyncHandler( async(req,res) => {
    const token = req.cookies?.refreshToken || req.body.refreshToken

    if(!token){
        throw new ApiError(401,"Unauthorized Request")
    }

    const verifiedToken = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET)

    if(!verifiedToken){
        throw new ApiError(401, "Token could not be verified")
    }

    const user = await User.findById(verifiedToken._id)

    if(!user){
        throw new ApiError(401, "Invalid token")
    }

    if(token !== user.refreshToken){
        throw new ApiError(401, "Invalid token: Used or expired")
    }
    
    const {accessToken, refreshToken} = generateAccessandRefreshToken(user._id)

    const cookieOptions = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
        new ApiResponse(
            200,
            {accessToken, refreshToken},
            "Access token refreshed"
        )
    )

})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
}