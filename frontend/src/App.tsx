import { useState, useEffect } from 'react';

function App() {
  const [backendStatus, setBackendStatus] = useState('Checking...');

  // Runs once when component loads - tests connection to backend
  useEffect(() => {
    fetch('http://localhost:5000/api/health')
      .then(res => res.json())
      .then(data => setBackendStatus(data.message))
      .catch(() => setBackendStatus('Backend not reachable'));
  }, []);

  return (
    <div>
      <h1>Team Availability Dashboard</h1>
      <p>Backend status: {backendStatus}</p>
    </div>
  );
}

export default App;