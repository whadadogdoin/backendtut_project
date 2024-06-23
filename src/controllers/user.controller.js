import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadFile } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";

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

const updatePassword = asyncHandler( async(req,res) => {
    const {currentPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)

    if(!user){
        throw new ApiError(401, "User could not be found")
    }   

    const validPassword = await user.checkPassword(currentPassword)

    if(!validPassword){
        throw new ApiError(401,"Incorrect Password")
    }

    user.password = newPassword

    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            {},
            "Password Updated Successfully"
        )
    )
})

const getCurrentUser = asyncHandler( async(req,res) => {
    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            req.user,
            "User fetched successfully"
        )
    )
})

const updateAccountDetails = asyncHandler( async(req,res) => {
    const {email, fullName} = req.body

    if(!email || !fullName){
        throw new ApiError(400, "Field to be updated is required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                email,
                fullName
            }
        },
        {
            new: true
        }
    ).select("-password")

    return res
    .status(200)
    .json(
        200,
        user,
        "Account details updated"
    )

})

const updateAvatar = asyncHandler( async(req,res) => {
    const newAvatarPath = req.file?.path

    if(!newAvatarPath){
        throw new ApiError(401, "File could not be uploaded")
    }

    const newAvatar = await uploadFile(newAvatarPath)

    if(!newAvatar.url){
        throw new ApiError(501, "File could not be uploaded to cloudinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                avatar: newAvatar.url
            }
        }
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user,
            "Avatar updated Successfully"
        )
    )
})

const updateCoverImage = asyncHandler( async(req,res) => {
    const newCoverImagePath = req.file?.path

    if(!newCoverImagePath){
        throw new ApiError(401, "File could not be uploaded")
    }

    const newCoverImage = await uploadFile(newCoverImagePath)

    if(!newCoverImage.url){
        throw new ApiError(501, "File could not be uploaded to cloudinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                coverImage: newCoverImage.url
            }
        }
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user,
            "Cover image updated Successfully"
        )
    )
})

const getChannel = asyncHandler( async(req,res) => {
    const {username} = req.params

    if(!username?.trim()){
        throw new ApiError(401, "Channel not found")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribed"
            }
        },
        {
            $addFields: {
                subscriberCount: {
                    $size: "$subscribers"
                },
                subscribedTo: {
                    $size: "$subscribed"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscriberCount: 1,
                subscribedTo: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404, "Channel does not exist")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "Channel fetched successfully")
    )
})

const getWatchHistory = asyncHandler( async(req,res) => {

    const user = await User.aggregate([
        {
            $match: {
                _id: mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    if(!user){
        throw new ApiError(404, "User could not be found")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,user[0].watchHistory, "History fetched successfully")
    )

})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    updatePassword,
    getCurrentUser,
    updateAccountDetails,
    updateAvatar,
    updateCoverImage,
    getChannel,
    getWatchHistory,
}