import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadFile } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";


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

export {registerUser}