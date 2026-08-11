import { createRoot } from 'react-dom/client'
import '../shared/shared.css'
import '../shared/app.css'
import './today.css'
import { TodayPage } from './TodayPage'

createRoot(document.getElementById('root')!).render(<TodayPage />)
