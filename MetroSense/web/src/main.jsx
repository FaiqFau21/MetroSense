import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import './styles.css';

// Last resort: if the whole app fails, say so plainly instead of a blank page.
const AppFailed = (error) => (
  <main className="page">
    <div className="page-inner">
      <section className="card error-card" role="alert">
        <h1 className="page-title">MetroSense could not start</h1>
        <p className="meta">{error.message}</p>
        <button className="btn" onClick={() => window.location.reload()}>Reload</button>
      </section>
    </div>
  </main>
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary fallback={AppFailed}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
