import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout'
import { SourcesPage } from './pages/sources'
import { SourceDetailPage } from './pages/source-detail'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<SourcesPage />} />
        <Route path="/sources/:id" element={<SourceDetailPage />} />
      </Routes>
    </Layout>
  )
}

export default App 