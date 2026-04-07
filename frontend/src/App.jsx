import { useContext } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { userDataContext } from "./context/userDataContext.js";
import Customize from "./pages/Customize.jsx";
import Customize2 from "./pages/Customize2.jsx";
import Home from "./pages/Home.jsx";
import SignIn from "./pages/SignIn.jsx";
import SignUp from "./pages/SignUp.jsx";

const getHomePath = (userData) => (
  userData?.assistantName && userData?.assistantImage ? "/" : "/customize"
);

function App() {
  const { authReady, userData } = useContext(userDataContext);

  if (!authReady) {
    return (
      <div className="loading-shell">
        <div className="loading-card">Loading your workspace...</div>
      </div>
    );
  }

  const isAuthenticated = Boolean(userData);
  const homePath = getHomePath(userData);

  return (
    <Routes>
      <Route
        path="/"
        element={
          isAuthenticated
            ? (homePath === "/" ? <Home /> : <Navigate to="/customize" replace />)
            : <Navigate to="/signup" replace />
        }
      />
      <Route
        path="/signup"
        element={!isAuthenticated ? <SignUp /> : <Navigate to={homePath} replace />}
      />
      <Route
        path="/signin"
        element={!isAuthenticated ? <SignIn /> : <Navigate to={homePath} replace />}
      />
      <Route
        path="/customize"
        element={isAuthenticated ? <Customize /> : <Navigate to="/signin" replace />}
      />
      <Route
        path="/customize2"
        element={isAuthenticated ? <Customize2 /> : <Navigate to="/signin" replace />}
      />
      <Route
        path="*"
        element={<Navigate to={isAuthenticated ? homePath : "/signup"} replace />}
      />
    </Routes>
  );
}

export default App
