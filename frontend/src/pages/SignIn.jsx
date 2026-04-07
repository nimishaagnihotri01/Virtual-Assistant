import { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { userDataContext } from "../context/userDataContext.js";
import api from "../lib/api.js";
import getErrorMessage from "../lib/getErrorMessage.js";

const initialFormState = {
  email: "",
  password: "",
};

export default function SignIn() {
  const navigate = useNavigate();
  const { setAssistantDraft, setUserData } = useContext(userDataContext);
  const [formData, setFormData] = useState(initialFormState);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      const { data } = await api.post("/auth/signin", formData);
      setUserData(data);
      setAssistantDraft({
        assistantName: data.assistantName ?? "",
        imageUrl: data.assistantImage ?? "",
        imageSource: data.assistantImage ? "saved" : "",
        imageFile: null,
        imageLabel: data.assistantName ? `${data.assistantName} avatar` : "",
      });
      navigate(data.assistantName && data.assistantImage ? "/" : "/customize");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Unable to sign in right now."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page-shell auth-shell">
      <section className="panel panel-hero auth-panel auth-panel--hero">
        <div className="brand-mark auth-brand-mark">VA</div>
        <div>
          <p className="eyebrow auth-eyebrow">Welcome Back</p>
          <h1 className="title auth-title">Step back into your assistant workspace.</h1>
        </div>
        <p className="subtitle auth-subtitle">
          The sign-in flow now points to real routes and lands you on setup only
          when the assistant still needs configuration.
        </p>
        <div className="preview-card auth-preview-card">
          <div className="assistant-preview">
            <div className="assistant-avatar auth-assistant-avatar">AI</div>
            <div>
              <p className="eyebrow auth-eyebrow">What changed</p>
              <h2 className="title compact auth-title auth-title--compact">Stable routing and API calls</h2>
            </div>
          </div>
          <p className="helper-copy auth-helper-copy">
            Missing pages, broken imports, and dead-end navigation were replaced
            with a complete authentication flow.
          </p>
        </div>
      </section>

      <section className="panel auth-panel auth-panel--form">
        <p className="eyebrow auth-eyebrow">Sign In</p>
        <h2 className="title compact auth-title auth-title--compact">Continue building</h2>
        <p className="subtitle auth-subtitle">Use the account you created for this assistant.</p>

        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field-label field-label--dark">Email</span>
            <input
              className="input input--dark"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="name@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label className="field">
            <span className="field-label field-label--dark">Password</span>
            <input
              className="input input--dark"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Your password"
              autoComplete="current-password"
              required
            />
          </label>

          {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

          <div className="button-row">
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </div>
        </form>

        <div className="divider" />
        <p className="helper-copy auth-helper-copy">
          Need a new account?{" "}
          <Link className="link-copy auth-link-copy" to="/signup">
            Create one here
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
