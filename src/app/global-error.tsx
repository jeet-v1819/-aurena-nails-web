"use client";

/**
 * Last-resort error boundary. Only rendered when the root layout itself fails,
 * so it must contain its own <html> and <body> and cannot rely on app styles.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#fbf7f4",
          color: "#2b2427",
          fontFamily: "Poppins, ui-sans-serif, system-ui, sans-serif",
          padding: "2rem",
        }}
      >
        <main style={{ maxWidth: "34rem", textAlign: "center" }}>
          <p style={{ letterSpacing: "0.2em", textTransform: "uppercase", fontSize: "0.7rem", color: "#b76e79" }}>
            Aurena Nails
          </p>
          <h1 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "2rem", margin: "1rem 0 0" }}>
            The studio is momentarily unavailable
          </h1>
          <p style={{ marginTop: "1rem", color: "#7c6f73", lineHeight: 1.7 }}>
            There was a problem loading the website. Your data is safe — please reload the page in a moment.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "2rem",
              border: "none",
              borderRadius: "999px",
              background: "#b76e79",
              color: "#fff",
              padding: "0.75rem 1.75rem",
              fontSize: "0.95rem",
              cursor: "pointer",
            }}
          >
            Reload the page
          </button>
          {error.digest ? (
            <p style={{ marginTop: "1.5rem", fontSize: "0.75rem", color: "#7c6f73" }}>Reference: {error.digest}</p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
