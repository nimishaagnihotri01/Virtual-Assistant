import express from "express"
import { askToAssistant, getAssistantAvatar, getCurrentUser, updateAssistant } from "../controllers/user.controllers.js"
import isAuth from "../middlewares/isAuth.js"
import upload from "../middlewares/multer.js"
const userRouter=express.Router()

userRouter.get("/current",isAuth,getCurrentUser)
userRouter.get("/avatar",isAuth,getAssistantAvatar)
userRouter.post("/update",isAuth,upload.single("assistantImage"),updateAssistant)
userRouter.post("/ask",isAuth,askToAssistant)
export default userRouter
