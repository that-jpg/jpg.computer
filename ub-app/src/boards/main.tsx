import { createRoot } from 'react-dom/client'
import '../shared/shared.css'
import '../shared/app.css'
import '../shared/board.css'
import { BoardsPage } from './BoardsPage'

createRoot(document.getElementById('root')!).render(<BoardsPage />)
