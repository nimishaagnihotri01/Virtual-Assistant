import { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { userDataContext } from "../context/userDataContext.js";
import api from "../lib/api.js";
import getErrorMessage from "../lib/getErrorMessage.js";

const initialFormState = {
  name: "",
  email: "",
  password: "",
};

export default function SignUp() {
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
      const { data } = await api.post("/auth/signup", formData);
      setUserData(data);
      setAssistantDraft({
        assistantName: data.assistantName ?? "",
        imageUrl: data.assistantImage ?? "",
        imageSource: data.assistantImage ? "saved" : "",
        imageFile: null,
        imageLabel: data.assistantName ? `${data.assistantName} avatar` : "",
      });
      navigate("/customize");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Unable to create your account."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page-shell auth-shell">
      <section className="panel panel-hero auth-panel auth-panel--hero">
        <div className="brand-mark auth-brand-mark">VA</div>
        <div>
          <p className="eyebrow auth-eyebrow">Virtual Assistant Studio</p>
          <h1 className="title auth-title">Build an assistant that feels like your own.</h1>
        </div>
        <p className="subtitle auth-subtitle">
          This project now has a clean auth flow, guided setup, and a live prompt
          screen so you can test the assistant end to end instead of landing in a
          broken starter app.
        </p>
        <div className="info-list auth-info-list">
          <div className="info-item auth-info-item">
            <strong>Cookie auth</strong>
            Sign in stays server-backed with HTTP-only cookies.
          </div>
          <div className="info-item auth-info-item">
            <strong>Guided setup</strong>
            Choose the avatar first, then name the assistant on the next screen.
          </div>
          <div className="info-item auth-info-item">
            <strong>Quick testing</strong>
            Start chatting from the final assistant screen as soon as setup is done.
          </div>
        </div>
      </section>

      <section className="panel auth-panel auth-panel--form">
        <p className="eyebrow auth-eyebrow">Create Account</p>
        <h2 className="title compact auth-title auth-title--compact">Start your workspace</h2>
        <p className="subtitle auth-subtitle">
          A small setup now avoids the missing-file errors the app had before.
        </p>

        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field-label field-label--dark">Your name</span>
            <input
              className="input input--dark"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Nimisha"
              autoComplete="name"
              required
            />
          </label>

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
              placeholder="At least 6 characters"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>

          {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

          <div className="button-row">
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
            </button>
          </div>
        </form>

        <div className="divider" />
        <p className="helper-copy auth-helper-copy">
          Already have an account?{" "}
          <Link className="link-copy auth-link-copy" to="/signin">
            Sign in here
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
