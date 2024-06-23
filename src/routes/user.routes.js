import { Router } from "express";
import { registerUser, loginUser, logoutUser , refreshAccessToken , updatePassword, getCurrentUser, updateAccountDetails, updateAvatar, getChannel, getWatchHistory } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

router.route("/register").post(upload.fields([
    {
        name: "avatar",
        maxCount: 1
    },
    {
        name: "coverImage",
        maxCount: 1
    }
]),registerUser)


router.route("/login").post(loginUser)



router.route("/logout").post(verifyJWT, logoutUser)
router.route("/refresh-token").post(refreshAccessToken)
router.route("/change-password").post(verifyJWT, updatePassword)
router.route("/current-user").get(verifyJWT, getCurrentUser)
router.route("/update-details").patch(verifyJWT, updateAccountDetails)
router.route("/update_avatar").patch(verifyJWT, upload.single("avatar"), updateAvatar)
router.route("/update_coverImage").patch(verifyJWT, upload.single("coverImage"), updateAvatar)
router.route("/c/:username").get(verifyJWT, getChannel)
router.route("/history").get(verifyJWT, getWatchHistory)


export default router