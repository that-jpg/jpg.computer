import { createRoot } from 'react-dom/client'
import '../shared/shared.css'
import '../shared/app.css'
import './projects.css'
import { ProjectsPage } from './ProjectsPage'

createRoot(document.getElementById('root')!).render(<ProjectsPage />)
