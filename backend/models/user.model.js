import mongoose from "mongoose";

const userSchema=new mongoose.Schema({
    name:{
        type:String,
        required:true,
        trim: true
    },
    email:{
        type:String,
        required:true,
        unique:true,
        trim: true,
        lowercase: true
    },
    password:{
        type:String,
        required:true
    },
    assistantName:{
        type:String,
        trim: true
    },
    assistantImage:{
        type:String,
        trim: true
    },
    history:[
        {
            type:String,
            trim: true
        }
    ]
},{timestamps:true})

const User=mongoose.model("User",userSchema)
export default User
