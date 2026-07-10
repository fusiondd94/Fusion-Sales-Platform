import { ClientPortalLoginForm } from "./ClientPortalLoginForm";

export default function ClientPortalLoginPage() {
  return (
    <main className="login-shell">
      <a className="brand login-brand" href="/">
        <span className="brand-mark">FDD</span>
        <span>Fusion Client Portal</span>
      </a>
      <section className="login-layout">
        <div className="login-story">
          <p className="eyebrow">Website review workspace</p>
          <h1>Your project files, previews, and comments live here.</h1>
          <p>
            Upload brand assets, review your live preview, and leave exact comments for the Fusion team from one secure workspace.
          </p>
          <div className="login-proof-grid">
            <div><strong>Preview</strong><span>See the project link Fusion shares with you.</span></div>
            <div><strong>Feedback</strong><span>Click the preview and leave comments where changes are needed.</span></div>
          </div>
        </div>
        <ClientPortalLoginForm />
      </section>
    </main>
  );
}
