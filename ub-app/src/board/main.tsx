import { createRoot } from 'react-dom/client'
import '../shared/shared.css'
import '../shared/app.css'
import '../shared/board.css'
import { BoardPage } from './BoardPage'

createRoot(document.getElementById('root')!).render(<BoardPage />)
