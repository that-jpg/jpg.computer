import { createRoot } from 'react-dom/client'
import '../shared/shared.css'
import './calendar.css'
import { CalendarPage } from './CalendarPage'

createRoot(document.getElementById('root')!).render(<CalendarPage />)
