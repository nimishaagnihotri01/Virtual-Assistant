import React, { useContext, useState } from 'react'
import { userDataContext } from '../context/UserContext'
import axios from 'axios'
import { IoArrowBack } from "react-icons/io5";
import {useNavigate} from 'react-router-dom'

function Customize2() {
    const {userData,backendImage,selectedImage,serverUrl,setUserData}=useContext(userDataContext)
    const [assistantName,setAssistantName]=useState(userData?.AssistantName || "")
    const [loading,setLoading]=useState(false)
    const navigate=useNavigate()
    const handleUpdateAssistant=async ()=> {
        try {
            let formData = new FormData()
            formData.append("assistantName", assistantName)
            if (backendImage) {
                formData.append("assistantImage", backendImage)
            } else {
                formData.append("imageUrl", selectedImage)
            }
            const result = await axios.post(`${serverUrl}/api/user/update`, formData, { withCredentials: true })

            console.log(result.data)
            setUserData(result.data)
        } catch (error) {
            console.log(error)
        }
    }

    return (
        <div className="w-full h-[100vh] bg-gradient-to-t from-[black] to-[#030353] flex justify-center items-center flex-col p-[20px] relative">
            <IoArrowBack className='absolute top-[30px] left-[30px] text-white cursor-pointer w-[25px] h-[25px]' onClick={()=>navigate("/customize")}/>
            <h1 className="text-white mb-[30px] text-[30px] text-center">
                Enter your <span className="text-blue-200">Assistant name</span>
            </h1>
            <input
                type="text"
                placeholder="eg. jarvis"
                className="w-full max-w-[600px] h-[60px] outline-none border-2 border-white bg-transparent text-white placeholder-gray-300 px-[20px] py-[10px] rounded-full text-[18px]"
                required
                onChange={(e)=>setAssistantName(e.target.value)}
                value={assistantName}
            />
            {assistantName && (
                <button
                    className="min-w-[200px] h-[60px] mt-[25px] text-black font-semibold cursor-pointer bg-white rounded-full text-[19px]" disabled={loading}
                    onClick={handleUpdateAssistant} 
                >
                    {!loading?"Create Assistant":"Loading.."}
                </button>
            )}
        </div>
    )
}

export default Customize2
