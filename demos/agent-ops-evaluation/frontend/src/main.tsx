import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import { StoreProvider } from './store'
import Layout from './components/Layout'
import OverviewPage from './pages/OverviewPage'
import RunPage from './pages/RunPage'
import EvaluatePage from './pages/EvaluatePage'
import RubricPage from './pages/RubricPage'
import RedTeamPage from './pages/RedTeamPage'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<OverviewPage />} />
            <Route path="/run" element={<RunPage />} />
            <Route path="/evaluate" element={<EvaluatePage />} />
            <Route path="/rubric" element={<RubricPage />} />
            <Route path="/red-team" element={<RedTeamPage />} />
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  </React.StrictMode>
)
