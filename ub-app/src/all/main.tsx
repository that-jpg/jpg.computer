import { createRoot } from 'react-dom/client'
import '../shared/shared.css'
import '../shared/app.css'
import '../shared/board.css'
import { AllPage } from './AllPage'

createRoot(document.getElementById('root')!).render(<AllPage />)
