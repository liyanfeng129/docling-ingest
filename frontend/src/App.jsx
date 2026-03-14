import { useState } from 'react';
import IngestionPage from './pages/IngestionPage';
import QueryTestingPage from './pages/QueryTestingPage';
import NavBar from './components/NavBar';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
    const [activeTab, setActiveTab] = useState('ingestion');

    return (
        <>
            <NavBar activeTab={activeTab} onChange={setActiveTab} />
            <div className={activeTab === 'ingestion' ? 'block h-[calc(100vh-64px)]' : 'hidden h-[calc(100vh-64px)]'}>
                <IngestionPage />
            </div>
            <div className={activeTab === 'query-testing' ? 'block h-[calc(100vh-64px)]' : 'hidden h-[calc(100vh-64px)]'}>
                <QueryTestingPage />
            </div>
            <ToastContainer
                position="bottom-right"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop
                closeOnClick
                pauseOnHover
            />
        </>
    );
}

export default App;
