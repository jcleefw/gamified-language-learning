import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/theme.css'
import './ui/global.css'
import { Root } from './ui/Root'

const root = document.getElementById('root')
if (!root) throw new Error('missing #root element')

createRoot(root).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
