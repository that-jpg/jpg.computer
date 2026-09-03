import { createRoot } from 'react-dom/client'
import '../shared/shared.css'
import '../fisica3/fisica3.css'
import './fight.css'
import { FightPage } from './FightPage'

createRoot(document.getElementById('root')!).render(<FightPage />)
