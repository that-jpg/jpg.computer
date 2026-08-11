import { createRoot } from 'react-dom/client'
import '../shared/shared.css'
import '../shared/app.css'
import './metrics.css'
import { MetricsPage } from './MetricsPage'

createRoot(document.getElementById('root')!).render(<MetricsPage />)
