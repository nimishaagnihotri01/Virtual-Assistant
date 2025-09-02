import React, { useContext, useState } from "react";
import bg from "../assets/bg.jpg";
import { IoMdEyeOff, IoMdEye } from "react-icons/io";
import { useNavigate } from "react-router-dom";
import { userDataContext } from "../context/userContext";
import axios from "axios";

function SignIn(){
  const [showPassword, setShowPassword] = useState(false);
   const { serverUrl,userData, setUserData} = useContext(userDataContext);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading,setLoading]=useState(false)
  const [password, setPassword] = useState("");
   const [err, setErr] = useState("");

  const handleSignIn = async (e) => {
    e.preventDefault()
     setErr("")
     setLoading(true)
    try {
      let result = await axios.post(
        `${serverUrl}/api/auth/signin`,
        {email, password },
        { withCredentials: true }
      );
      setUserData(result.data)
      setLoading(false)
      navigate("/")
    } catch (error) {
      console.log(error);
      setUserData(null)
      setLoading(false)
      setErr(error.response.data.message)
    }
  };


  return(
    <div className="w-full h-screen bg-cover bg-center flex justify-center items-center"
        style={{ backgroundImage: `url(${bg})` }}>
        <form className="w-[90%] max-w-[500px] h-[600px] bg-[#00000061] backdrop-blur rounded-xl p-6 shadow-lg shadow-black flex flex-col items-center justify-center gap-[20px]" onSubmit={handleSignIn}>
          <h1 className="text-white text-[30px] font-semibold mb-[30px]">
            Sign In to{" "}
            <span className="text-[#3b82f6]">Virtual Assistant</span>
          </h1>
          <input
  type="email"
  placeholder="Email"
  className="w-full h-[60px] outline-none border-2 border-white bg-transparent text-white placeholder-gray-300 px-[20px] py-[10px] rounded-full text-[18px]"
  required
  onChange={(e) => setEmail(e.target.value)}
  value={email}
  autoComplete="username"   // ✅ added this
/>

          <div className="w-full h-[60px] border-2 border-white bg-transparent text-white rounded-full text-[18px] relative flex items-center">
            <input
  type={showPassword ? "text" : "password"}
  placeholder="Password"
  className="w-full h-full rounded-full outline-none bg-transparent text-white placeholder-gray-300 pl-[20px] py-[10px] pr-[50px]"
  required
  onChange={(e) => setPassword(e.target.value)}
  value={password}
  autoComplete="current-password"   // ✅ added this
/>

            {showPassword ? (
              <IoMdEyeOff
                className="absolute top-[16px] right-[20px] w-[25px] h-[25px] text-white cursor-pointer"
                onClick={() => setShowPassword(false)}
              />
            ) : (
              <IoMdEye
                className="absolute top-[16px] right-[20px] w-[25px] h-[25px] text-white cursor-pointer"
                onClick={() => setShowPassword(true)}
              />
            )}
          </div>
          {err.length>0 && <p className='text-red-500 text-[17px]'>
              *{err}
              </p>}
            <button className="min-w-[150px] h-[60px] mt-[25px] text-black font-semibold bg-white rounded-full text-[19px]" disabled={loading}>
           {loading?"loading...":"Sign in"}
          </button>
          <p
            className="text-[white] text-[18px] cursor-pointer"
            onClick={() => navigate("/signup")}
          >
            Want to create new account?{" "}
            <span className="text-blue-400">Sign Up</span>
          </p>
        </form>
    </div>
  )
}

export default SignIn;
